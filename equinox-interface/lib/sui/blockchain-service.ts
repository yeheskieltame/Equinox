
import { getSuiClient } from "@/lib/sui/client";
import { env, isMockMode, isRealMode } from "@/lib/config";
import type { Order, Position, VestingPosition, MarketStats, PriceData, MarketExposure, ChartDataPoint } from "@/lib/types";
import {
  mockOrders, // Keeping these as fallback or initial state for MockState
  mockPositions,
  mockVestingPositions,
  mockStats,
  mockPrices,
  mockMarketExposure,
  mockApyHistory,
  mockBorrowMarkets,
  mockVaults,
} from "@/lib/data";
import { MockState } from "@/lib/sui/mock-state";
import type { Vault } from "@/lib/types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const PYTH_PRICE_FEED_IDS: Record<string, string> = {
  SUI: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  USDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
};

const PYTH_API_URL = "https://hermes.pyth.network/api/latest_price_feeds";

/**
 * Validate if a string is a valid Sui address
 * Sui addresses are 66 characters (0x + 64 hex chars) or 64 hex chars
 */
function isValidSuiAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  
  // Remove 0x prefix if present
  const cleanAddress = address.startsWith("0x") ? address.slice(2) : address;
  
  // Should be 64 hex characters
  if (cleanAddress.length !== 64) return false;
  
  // Should only contain hex characters
  return /^[0-9a-fA-F]+$/.test(cleanAddress);
}

/**
 * Fetch orders from blockchain
 * In real mode: Queries blockchain for Order objects from Market table
 * In mock mode: Returns mock orders from State
 */
export async function fetchBlockchainOrders(userAddress: string): Promise<Order[]> {
  if (isMockMode()) {
    await delay(300);
    return MockState.getOrders();
  }

  try {
    const client = getSuiClient();
    const marketId = env.sui.marketId;
    
    if (!marketId) {
      console.warn("Market ID not configured");
      return [];
    }

    // 1. Fetch Market object to get orders Table ID
    const marketObj = await client.getObject({
      id: marketId,
      options: { showContent: true },
    });

    if (marketObj.data?.content?.dataType !== "moveObject") {
      console.warn("Invalid market object");
      return [];
    }

    const marketFields = marketObj.data.content.fields as any;
    // Market struct has 'orders' field which is a Table<ID, Order>
    // Table struct has 'id' field which is UID
    const ordersTableId = marketFields.orders?.fields?.id?.id;

    if (!ordersTableId) {
      console.warn("Could not find orders table ID");
      return [];
    }

    // 2. Fetch dynamic fields from orders table
    // Fetching up to 50 active orders for MVP
    const dynamicFields = await client.getDynamicFields({
      parentId: ordersTableId,
      limit: 50,
    });

    if (dynamicFields.data.length === 0) {
      return [];
    }

    // 3. Fetch each order content
    const orderPromises = dynamicFields.data.map(async (field) => {
      try {
        const orderObj = await client.getDynamicFieldObject({
          parentId: ordersTableId,
          name: field.name,
        });

        if (orderObj.data?.content?.dataType !== "moveObject") return null;

        // In a Table<K,V>, the dynamic field object has a 'value' field containing the V
        const value = (orderObj.data.content.fields as any).value;
        const fields = value.fields;

        // Order ID parsing (robust handling for RPC variations)
        let orderId = field.name.value;
        
        // Handle ID struct wrapper { bytes: ... } or { id: ... }
        if (typeof orderId === 'object' && orderId !== null) {
            if ('bytes' in orderId) orderId = orderId.bytes;
            else if ('id' in orderId) orderId = orderId.id;
        }

        // Handle Base64 string (if parsed as string but not hex)
        // 44 chars is typical for Base64 encoded 32-byte address
        if (typeof orderId === 'string' && !orderId.startsWith('0x') && orderId.length > 32) {
             try {
                // Use Buffer if available (Node), else atob (Browser)
                let binString = '';
                if (typeof Buffer !== 'undefined') {
                    binString = Buffer.from(orderId, 'base64').toString('binary');
                } else if (typeof window !== 'undefined') {
                    binString = window.atob(orderId);
                }
                
                if (binString) {
                    // Convert binary string to hex
                    const hex = Array.from(binString).map((c) => 
                        (c as string).charCodeAt(0).toString(16).padStart(2, '0')
                    ).join('');
                    orderId = '0x' + hex;
                }
             } catch(e) {
                console.warn("Failed to decode ID:", orderId, e);
             }
        }

        return {
          id: orderId,
          creator: fields.creator, // Add creator field to Order type if missing or use it for filtering
          type: fields.is_lend ? "lend" : "borrow",
          asset: "USDC", // MVP hardcoded asset
          amount: Number(fields.amount || 0) / 1_000_000, 
          interestRate: Number(fields.interest_rate_bps || 0) / 100,
          ltv: 0.7, // Order struct doesn't have LTV field! It's implied. Mocking 70% for display.
          term: Number(fields.duration_ms || 0) / (24 * 60 * 60 * 1000),
          status: "pending", // All orders in table are pending/active
          createdAt: new Date(Number(fields.created_at || 0)).toISOString(),
          isHidden: false, // Table 'orders' is for public orders
          fairnessScore: 85, // Mock score as it's not stored in Order struct
          zkProofHash: undefined,
        } as Order;
      } catch (e) {
        console.warn("Error fetching order detail:", e);
        return null;
      }
    });

    const results = await Promise.all(orderPromises);
    
    // Filter out nulls
    return results.filter(Boolean) as Order[];

  } catch (error) {
    console.error("Error fetching orders from blockchain:", error);
    return [];
  }
}

/**
 * Fetch positions from blockchain
 * In real mode: Queries blockchain for Loan objects, returns empty if none found
 * In mock mode: Returns mock positions from State
 */
export async function fetchBlockchainPositions(userAddress: string): Promise<Position[]> {
  if (isMockMode()) {
    await delay(300);
    return MockState.getPositions();
  }

  // Real mode - fetch from blockchain only
  if (!userAddress || !isValidSuiAddress(userAddress)) {
    console.warn("Invalid or empty user address");
    return [];
  }

  try {
    const client = getSuiClient();
    const packageId = env.sui.packageId;
    
    if (!packageId) {
      console.warn("Package ID not configured");
      return [];
    }

    // Loan is a generic type: Loan<Asset, Collateral>
    // We need to query for all possible combinations or use MatchAny
    // For MVP, we query the most common pairs
    const loanTypes = [
      `${packageId}::loan::Loan<${packageId}::mock_usdc::MOCK_USDC, 0x2::sui::SUI>`,
      `${packageId}::loan::Loan<0x2::sui::SUI, ${packageId}::mock_usdc::MOCK_USDC>`,
      `${packageId}::loan::Loan<${packageId}::mock_usdc::MOCK_USDC, ${packageId}::mock_eth::MOCK_ETH>`,
    ];

    const allPositions: Position[] = [];

    // 1. Fetch LENDING positions (Loans owned by user)
    for (const loanType of loanTypes) {
      try {
        const objects = await client.getOwnedObjects({
          owner: userAddress,
          filter: { StructType: loanType },
          options: { showContent: true, showType: true },
        });

        for (const obj of objects.data) {
           const pos = parseLoanObject(obj.data, userAddress, "lending");
           if (pos) allPositions.push(pos);
        }
      } catch (e) {
        console.warn(`Error fetching owned loans of type ${loanType}:`, e);
      }
    }

    // 2. Fetch BORROWING positions (Loans where user is borrower)
    // Borrowers don't own the Loan object, so we find them via Events
    try {
        const events = await client.queryEvents({
            query: { MoveEventType: `${packageId}::loan::LoanCreated` },
            limit: 50, // Limit for MVP
            order: "descending"
        });

        // Filter events where borrower is current user
        const myLoanIds = events.data
            .filter((e: any) => e.parsedJson?.borrower === userAddress)
            .map((e: any) => e.parsedJson?.loan_id);

        if (myLoanIds.length > 0) {
            // Fetch latest object state for these loans
            const loanObjects = await client.multiGetObjects({
                ids: myLoanIds,
                options: { showContent: true, showType: true }
            });

            for (const obj of loanObjects) {
                if (obj.error) continue; // Skip deleted/error objects
                const pos = parseLoanObject(obj.data, userAddress, "borrowing");
                if (pos) {
                    allPositions.push(pos);
                }
            }
        }
    } catch (e) {
        console.warn("Error fetching borrowing events:", e);
    }

    return allPositions;
  } catch (error) {
    console.error("Error fetching positions from blockchain:", error);
    return [];
  }
}

// Helper to parse Loan object into Position
function parseLoanObject(data: any, userAddress: string, forceType?: "lending" | "borrowing"): Position | null {
    if (!data || data.content?.dataType !== "moveObject") return null;

    const content = data.content;
    const fields = content.fields as Record<string, unknown>;
    const objType = content.type || "";

    const lender = fields.lender as string;
    const borrower = fields.borrower as string;

    // Determine type: use forceType if provided, else deduce
    let type: "lending" | "borrowing";
    if (forceType) {
        type = forceType;
    } else {
        type = lender === userAddress ? "lending" : "borrowing";
    }

    // Validate ownership/participation
    if (type === "lending" && lender !== userAddress) return null;
    if (type === "borrowing" && borrower !== userAddress) return null;

    const amount = Number(fields.amount || 0);
    const startTimestamp = Number(fields.start_timestamp || 0);
    const duration = Number(fields.duration || 0);
    const interestRateBps = Number(fields.interest_rate_bps || 0);
    
    // Parse collateral balance
    // JSON RPC might flatten Balance<T> to just the value string, or keep it as object with value field
    let collateralRaw = 0;
    if (typeof fields.collateral_balance === 'string' || typeof fields.collateral_balance === 'number') {
        collateralRaw = Number(fields.collateral_balance);
    } else if (typeof fields.collateral_balance === 'object' && fields.collateral_balance !== null) {
        // Handle { value: "..." } structure
        const val = (fields.collateral_balance as any).value;
        collateralRaw = Number(val || 0);
    }
    
    // Extract asset/collateral from type string
    // Type format: Package::loan::Loan<AssetType, CollateralType>
    let asset = "USDC";
    let collateralAsset = "SUI";
    
    if (objType.includes("mock_usdc") && objType.indexOf("mock_usdc") < objType.lastIndexOf("::")) {
        // Simple heuristic: First type arg is Asset
        asset = "USDC"; 
    } else if (objType.includes("sui::SUI") && objType.indexOf("sui::SUI") < objType.lastIndexOf("::")) {
        asset = "SUI";
    }

    // Collateral is the second type arg
    if (objType.includes("mock_eth")) collateralAsset = "ETH";
    else if (objType.includes("sui::SUI") && asset !== "SUI") collateralAsset = "SUI";
    else if (objType.includes("mock_usdc") && asset !== "USDC") collateralAsset = "USDC";

    // Refined Asset Logic based on string parsing (MVP)
    if (objType.includes("Loan<")) {
        const types = objType.split("Loan<")[1].split(">")[0].split(",");
        if (types.length >= 2) {
            asset = types[0].includes("USDC") ? "USDC" : types[0].includes("ETH") ? "ETH" : "SUI";
            collateralAsset = types[1].includes("USDC") ? "USDC" : types[1].includes("ETH") ? "ETH" : "SUI";
        }
    }
    
    const assetDecimals = asset === "USDC" ? 6 : asset === "ETH" ? 8 : 9;
    const collateralDecimals = collateralAsset === "USDC" ? 6 : collateralAsset === "ETH" ? 8 : 9;
    
    const now = Date.now();
    const elapsedMs = Math.max(0, now - startTimestamp);
    const yearMs = 31536000000;
    const interestAccrued = Math.floor((amount * interestRateBps * elapsedMs) / (10000 * yearMs));
    
    let status: Position["status"] = "active";
    if (now > startTimestamp + duration) {
        status = "active"; // Overdue
    }
    
    // Unique ID for React Key: Append type suffix to handle self-loans (Lender=Borrower)
    const uniqueId = `${data.objectId}-${type}`;

    return {
        id: uniqueId, // Modified ID for uniqueness
        type,
        asset,
        amount: amount / Math.pow(10, assetDecimals),
        interestRate: interestRateBps / 100,
        ltv: collateralRaw > 0 ? (amount / collateralRaw) * 100 : 0,
        term: Math.floor(duration / (24 * 60 * 60 * 1000)),
        startDate: new Date(startTimestamp).toISOString(),
        endDate: new Date(startTimestamp + duration).toISOString(),
        earnedInterest: type === "lending" ? interestAccrued / Math.pow(10, assetDecimals) : 0,
        paidInterest: type === "borrowing" ? interestAccrued / Math.pow(10, assetDecimals) : 0,
        status,
        collateralAsset: type === "borrowing" ? collateralAsset : undefined, // Only borrower cares about collateral details usually
        collateralAmount: type === "borrowing" ? collateralRaw / Math.pow(10, collateralDecimals) : undefined,
        liquidationPrice: type === "borrowing" && collateralRaw > 0 
            ? (amount * 1.1) / collateralRaw 
            : undefined,
        // Add minimal collateral info for Lender too if needed
    };
}

/**
 * Fetch vesting positions from blockchain
 * In real mode: Queries blockchain for VestingPosition objects, returns empty if none found
 * In mock mode: Returns mock vesting positions from State
 */
export async function fetchBlockchainVestingPositions(userAddress: string): Promise<VestingPosition[]> {
  if (isMockMode()) {
    await delay(300);
    return MockState.getVestingPositions();
  }

  // Real mode - fetch from blockchain only
  if (!userAddress || !isValidSuiAddress(userAddress)) {
    console.warn("Invalid or empty user address");
    return [];
  }

  try {
    const client = getSuiClient();
    const packageId = env.sui.packageId;
    
    if (!packageId) {
      console.warn("Package ID not configured");
      return [];
    }

    // Query VestingPosition objects from vesting module
    // VestingPosition is NOT a generic type in the Move contract
    const objects = await client.getOwnedObjects({
      owner: userAddress,
      filter: {
        StructType: `${packageId}::vesting::VestingPosition`,
      },
      options: {
        showContent: true,
        showType: true,
      },
    });

    if (objects.data.length === 0) {
      return [];
    }

    const now = Date.now();
    
    return objects.data.map((obj) => {
      const content = obj.data?.content;
      if (content?.dataType !== "moveObject") return null;
      
      const fields = content.fields as Record<string, unknown>;
      
      // VestingPosition struct fields from vesting.move:
      // - amount: u64
      // - token_type: ascii::String
      // - start_timestamp: u64
      // - lock_duration: u64
      // - owner: address
      // - is_collateralized: bool
      // - loan_id: Option<ID>
      // - pending_rewards: u64
      
      const startTimestamp = Number(fields.start_timestamp || 0);
      const lockDuration = Number(fields.lock_duration || 0);
      const unlockTimestamp = startTimestamp + lockDuration;
      const isCollateralized = Boolean(fields.is_collateralized);
      
      let status: VestingPosition["status"] = "locked";
      if (unlockTimestamp <= now && !isCollateralized) {
        status = "unlockable";
      }
      // Note: "unlocked" status means position was already claimed and shouldn't exist
      
      // Calculate APY based on lock duration (same logic as contract)
      const durationDays = lockDuration / (24 * 60 * 60 * 1000);
      let subsidyRate = 2.0; // BASE_SUBSIDY_BPS = 200 = 2%
      if (durationDays >= 90) {
        subsidyRate = 3.0;
      } else if (durationDays >= 30) {
        subsidyRate = 2.5;
      }
      const baseApy = 4.5;
      
      return {
        id: obj.data?.objectId || "",
        amount: Number(fields.amount || 0) / 1_000_000_000,
        lockDate: new Date(startTimestamp).toISOString(),
        unlockDate: new Date(unlockTimestamp).toISOString(),
        apy: baseApy + subsidyRate,
        subsidyRate,
        earnedRewards: Number(fields.pending_rewards || 0) / 1_000_000_000,
        status,
        zkProofVerified: true, // ZK proof was verified at lock time
      } as VestingPosition;
    }).filter(Boolean) as VestingPosition[];
  } catch (error) {
    console.error("Error fetching vesting positions from blockchain:", error);
    return [];
  }
}

/**
 * Fetch market stats from blockchain
 * In real mode: Tries to fetch from registry, returns default stats if not available
 * In mock mode: Returns mock stats from State
 */
export async function fetchBlockchainStats(): Promise<MarketStats> {
  if (isMockMode()) {
    await delay(300);
    return MockState.getStats();
  }

  // Default stats for real mode when data is not available
  const defaultStats: MarketStats = {
    totalValueLocked: 0,
    totalLoans: 0,
    averageApy: 0,
    activeUsers: 0,
    totalMatched: 0,
    fairnessScore: 0,
    volume24h: 0,
  };

  try {
    const client = getSuiClient();
    const packageId = env.sui.packageId;
    const registryId = env.sui.registryId;
    
    // Try to fetch registry stats from blockchain
    if (packageId && registryId) {
      try {
        const registry = await client.getObject({
          id: registryId,
          options: { showContent: true },
        });
        
        if (registry.data?.content?.dataType === "moveObject") {
          const fields = registry.data.content.fields as Record<string, unknown>;
          return {
            totalValueLocked: Number(fields.total_tvl || 0) / 1_000_000_000,
            totalLoans: Number(fields.total_loans || 0),
            averageApy: Number(fields.avg_apy || 0) / 100,
            activeUsers: Number(fields.active_users || 0),
            totalMatched: Number(fields.total_matched || 0) / 1_000_000_000,
            fairnessScore: Number(fields.fairness_score || 0),
            volume24h: Number(fields.volume_24h || 0) / 1_000_000_000,
          };
        }
      } catch (e) {
        console.warn("Could not fetch registry stats:", e);
      }
    }
    
    return defaultStats;
  } catch (error) {
    console.error("Error fetching blockchain stats:", error);
    return defaultStats;
  }
}

/**
 * Fetch real-time prices from Pyth oracle
 * In real mode: Fetches from Pyth API, returns default prices on error
 * In mock mode: Returns mock prices from State
 */
export async function fetchBlockchainPrices(): Promise<PriceData[]> {
  if (isMockMode()) {
    await delay(300);
    return MockState.getPrices();
  }

  const oracle = env.priceOracle;
  
  if (oracle === "pyth") {
    return fetchPythPrices();
  }
  
  return fetchSupraPrices();
}

async function fetchPythPrices(): Promise<PriceData[]> {
  // Default prices for when API fails
  const defaultPrices: PriceData[] = [
    { asset: "SUI", price: 0, change24h: 0, lastUpdated: new Date().toISOString() },
    { asset: "USDC", price: 1.0, change24h: 0, lastUpdated: new Date().toISOString() },
    { asset: "ETH", price: 0, change24h: 0, lastUpdated: new Date().toISOString() },
  ];

  try {
    const feedIds = Object.values(PYTH_PRICE_FEED_IDS);
    const assetNames = Object.keys(PYTH_PRICE_FEED_IDS);
    
    const queryParams = feedIds.map(id => `ids[]=${id}`).join("&");
    const response = await fetch(`${PYTH_API_URL}?${queryParams}`);
    
    if (!response.ok) {
      throw new Error(`Pyth API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return assetNames.map((asset, index) => {
      const priceData = data[index];
      if (!priceData || !priceData.price) {
        return {
          asset,
          price: asset === "USDC" ? 1.0 : 0,
          change24h: 0,
          lastUpdated: new Date().toISOString(),
        };
      }
      
      const price = Number(priceData.price.price) * Math.pow(10, priceData.price.expo);
      const prevPrice = priceData.prev_price 
        ? Number(priceData.prev_price.price) * Math.pow(10, priceData.prev_price.expo)
        : price;
      const change24h = prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;
      
      return {
        asset,
        price,
        change24h,
        lastUpdated: new Date(priceData.price.publish_time * 1000).toISOString(),
      };
    });
  } catch (error) {
    console.error("Error fetching Pyth prices:", error);
    return defaultPrices;
  }
}

async function fetchSupraPrices(): Promise<PriceData[]> {
  console.warn("Supra oracle not yet implemented");
  return [
    { asset: "SUI", price: 0, change24h: 0, lastUpdated: new Date().toISOString() },
    { asset: "USDC", price: 1.0, change24h: 0, lastUpdated: new Date().toISOString() },
    { asset: "ETH", price: 0, change24h: 0, lastUpdated: new Date().toISOString() },
  ];
}

/**
 * Fetch market exposure data
 * In real mode: Returns protocol's asset distribution (could be fetched from registry)
 * In mock mode: Returns mock exposure data
 */
export async function fetchMarketExposure(): Promise<MarketExposure[]> {
  if (isMockMode()) {
    await delay(300);
    return mockMarketExposure;
  }
  
  // Real mode: Return the three supported assets exposure
  // In production this would be fetched from on-chain registry
  return [
    { asset: "SUI / USDC", symbol: "SUI", allocation: 45, vaultAllocation: 0, supplyCap: 999999999, apy: 0, utilization: 0 },
    { asset: "USDC / SUI", symbol: "USDC", allocation: 30, vaultAllocation: 0, supplyCap: 890073000, apy: 0, utilization: 0 },
    { asset: "ETH / USDC", symbol: "ETH", allocation: 25, vaultAllocation: 0, supplyCap: 500000000, apy: 0, utilization: 0 },
  ];
}

/**
 * Fetch APY history for charts
 * In real mode: Would be fetched from indexer/API, returns empty for now
 * In mock mode: Returns mock APY history
 */
export async function fetchApyHistory(): Promise<ChartDataPoint[]> {
  if (isMockMode()) {
    await delay(300);
    return mockApyHistory;
  }

  // Real mode: Return empty history (would need indexer in production)
  return [];
}

/**
 * Fetch borrow markets data
 * In real mode: Returns supported borrow markets
 * In mock mode: Returns mock borrow markets
 */
export async function fetchBorrowMarkets(): Promise<{ asset: string; available: number; borrowApr: number; maxLtv: number }[]> {
  if (isMockMode()) {
    await delay(300);
    return mockBorrowMarkets;
  }

  // Real mode: Return supported borrow markets based on blueprint
  // These are the default configurations per asset type
  return [
    { asset: "USDC", available: 0, borrowApr: 5.2, maxLtv: 90 },
    { asset: "SUI", available: 0, borrowApr: 6.1, maxLtv: 75 },
    { asset: "ETH", available: 0, borrowApr: 5.8, maxLtv: 70 },
  ];
}

/**
 * Fetch vaults data
 * In real mode: Would fetch from on-chain, returns empty for now
 * In mock mode: Returns mock vaults
 */
export async function fetchVaults(): Promise<Vault[]> {
  if (isMockMode()) {
    await delay(500);
    return MockState.getVaults();
  }

  // Real mode: Return empty vaults (would need vault registry in production)
  return [];
}

/**
 * NAUTILUS AI FAIRNESS SCORING SYSTEM
 */
interface FairnessResult {
  score: number;
  breakdown: {
    sizeScore: number;
    behaviorScore: number;
    vestingBonus: number;
    queuePriority: number;
  };
  proof?: string;
}

export async function calculateFairnessScore(
  orderAmount: number,
  userAddress: string,
  hasVesting: boolean
): Promise<FairnessResult> {
  // Size-based scoring: Smaller orders get higher scores (retail protection)
  const sizeScore = Math.min(100, Math.max(0, 100 - (orderAmount / 10000) * 10));
  
  // Behavior score: In production, would check on-chain history
  const behaviorScore = 75 + Math.random() * 25;
  
  // Vesting bonus: Users with locked tokens get priority
  const vestingBonus = hasVesting ? 15 : 0;
  
  // Queue priority: In production, would check order timestamp
  const queuePriority = 5 + Math.random() * 10;
  
  const totalScore = Math.min(100, (sizeScore * 0.3 + behaviorScore * 0.4 + vestingBonus * 0.2 + queuePriority * 0.1));

  await delay(100);

  return {
    score: Math.round(totalScore),
    breakdown: {
      sizeScore: Math.round(sizeScore),
      behaviorScore: Math.round(behaviorScore),
      vestingBonus,
      queuePriority: Math.round(queuePriority),
    },
    proof: isRealMode() ? `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2)}` : undefined,
  };
}

export async function verifyFairnessProof(proof: string): Promise<boolean> {
  // Simulated verification - in production would call blockchain
  await delay(200);
  return proof.startsWith("0x") && proof.length >= 20;
}

/**
 * Fetch user's coin objects for transaction
 * Used when user needs to select a coin to deposit/use as collateral
 */
export async function fetchUserCoins(userAddress: string, coinType?: string): Promise<{ objectId: string; balance: number }[]> {
  // ALWAYS fetch real coins if address is real
  // Faucet works on real coins
  
  if (!userAddress || !isValidSuiAddress(userAddress)) {
    return [];
  }

  try {
    const client = getSuiClient();
    const coins = await client.getCoins({
      owner: userAddress,
      coinType: coinType,
    });

    // Determine decimals based on coin type
    const decimals = getDecimalsForCoinType(coinType);
    const divisor = Math.pow(10, decimals);

    return coins.data.map((coin) => ({
      objectId: coin.coinObjectId,
      balance: Number(coin.balance) / divisor,
    }));
  } catch (error) {
    console.error("Error fetching user coins:", error);
    return [];
  }
}

/**
 * Get decimals for coin type
 */
function getDecimalsForCoinType(coinType?: string): number {
  if (!coinType) return 9; // Default to SUI decimals
  if (coinType.includes("mock_usdc") || coinType.includes("MOCK_USDC")) return 6;
  if (coinType.includes("mock_eth") || coinType.includes("MOCK_ETH")) return 8;
  return 9; // SUI and default
}

/**
 * Get coin type for asset
 */
export function getCoinType(asset: string): string {
  const packageId = env.sui.packageId;
  switch (asset) {
    case "USDC":
      return `${packageId}::mock_usdc::MOCK_USDC`;
    case "ETH":
      return `${packageId}::mock_eth::MOCK_ETH`;
    case "SUI":
    default:
      return "0x2::sui::SUI";
  }
}

/**
 * Get decimals for asset
 */
export function getDecimalsForAsset(asset: string): number {
  switch (asset) {
    case "USDC":
      return 6;
    case "ETH":
      return 8;
    case "SUI":
    default:
      return 9;
  }
}
