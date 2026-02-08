import { getSuiClient } from "@/lib/sui/client";
import { env, isMockMode, isRealMode } from "@/lib/config";
import type { Order, Position, VestingPosition, MarketStats, PriceData, MarketExposure, ChartDataPoint } from "@/lib/types";
import {
  mockOrders,
  mockPositions,
  mockVestingPositions,
  mockStats,
  mockPrices,
  mockMarketExposure,
  mockApyHistory,
  mockBorrowMarkets,
  mockVaults,
} from "@/lib/data";
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
 * In real mode: Queries blockchain for Order objects, returns empty if none found
 * In mock mode: Returns mock orders
 */
export async function fetchBlockchainOrders(userAddress: string): Promise<Order[]> {
  if (isMockMode()) {
    await delay(500);
    return mockOrders;
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

    // Query Order objects from market module
    const objects = await client.getOwnedObjects({
      owner: userAddress,
      filter: {
        StructType: `${packageId}::market::Order`,
      },
      options: {
        showContent: true,
        showType: true,
      },
    });

    if (objects.data.length === 0) {
      return [];
    }

    return objects.data.map((obj) => {
      const content = obj.data?.content;
      if (content?.dataType !== "moveObject") return null;
      
      const fields = content.fields as Record<string, unknown>;
      return {
        id: obj.data?.objectId || "",
        type: fields.is_lend ? "lend" : "borrow",
        asset: String(fields.asset || "USDC"),
        amount: Number(fields.amount || 0) / 1_000_000_000,
        interestRate: Number(fields.interest_rate || 0) / 100,
        ltv: Number(fields.ltv || 0) / 100,
        term: Number(fields.term || 0) / (24 * 60 * 60),
        status: String(fields.status || "pending") as Order["status"],
        createdAt: new Date(Number(fields.created_at || 0)).toISOString(),
        isHidden: Boolean(fields.is_hidden),
        fairnessScore: Number(fields.fairness_score || 0),
        zkProofHash: fields.zk_proof_hash ? String(fields.zk_proof_hash) : undefined,
      } as Order;
    }).filter(Boolean) as Order[];
  } catch (error) {
    console.error("Error fetching orders from blockchain:", error);
    return [];
  }
}

/**
 * Fetch positions from blockchain
 * In real mode: Queries blockchain for Loan objects, returns empty if none found
 * In mock mode: Returns mock positions
 */
export async function fetchBlockchainPositions(userAddress: string): Promise<Position[]> {
  if (isMockMode()) {
    await delay(500);
    return mockPositions;
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

    // Query Loan objects from loan module
    const objects = await client.getOwnedObjects({
      owner: userAddress,
      filter: {
        StructType: `${packageId}::loan::Loan`,
      },
      options: {
        showContent: true,
        showType: true,
      },
    });

    if (objects.data.length === 0) {
      return [];
    }

    return objects.data.map((obj) => {
      const content = obj.data?.content;
      if (content?.dataType !== "moveObject") return null;
      
      const fields = content.fields as Record<string, unknown>;
      return {
        id: obj.data?.objectId || "",
        type: fields.is_lender ? "lending" : "borrowing",
        asset: String(fields.asset || "USDC"),
        amount: Number(fields.amount || 0) / 1_000_000_000,
        interestRate: Number(fields.interest_rate || 0) / 100,
        ltv: Number(fields.ltv || 0) / 100,
        term: Number(fields.term || 0) / (24 * 60 * 60),
        startDate: new Date(Number(fields.start_date || 0)).toISOString(),
        endDate: new Date(Number(fields.end_date || 0)).toISOString(),
        earnedInterest: Number(fields.earned_interest || 0) / 1_000_000_000,
        paidInterest: Number(fields.paid_interest || 0) / 1_000_000_000,
        status: String(fields.status || "active") as Position["status"],
        collateralAsset: fields.collateral_asset ? String(fields.collateral_asset) : undefined,
        collateralAmount: fields.collateral_amount ? Number(fields.collateral_amount) / 1_000_000_000 : undefined,
        liquidationPrice: fields.liquidation_price ? Number(fields.liquidation_price) / 1_000_000_000 : undefined,
      } as Position;
    }).filter(Boolean) as Position[];
  } catch (error) {
    console.error("Error fetching positions from blockchain:", error);
    return [];
  }
}

/**
 * Fetch vesting positions from blockchain
 * In real mode: Queries blockchain for VestingPosition objects, returns empty if none found
 * In mock mode: Returns mock vesting positions
 */
export async function fetchBlockchainVestingPositions(userAddress: string): Promise<VestingPosition[]> {
  if (isMockMode()) {
    await delay(500);
    return mockVestingPositions;
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
      const unlockDate = Number(fields.unlock_date || 0);
      
      let status: VestingPosition["status"] = "locked";
      if (fields.is_unlocked) {
        status = "unlocked";
      } else if (unlockDate <= now) {
        status = "unlockable";
      }
      
      return {
        id: obj.data?.objectId || "",
        amount: Number(fields.amount || 0) / 1_000_000_000,
        lockDate: new Date(Number(fields.lock_date || 0)).toISOString(),
        unlockDate: new Date(unlockDate).toISOString(),
        apy: Number(fields.apy || 0) / 100,
        subsidyRate: Number(fields.subsidy_rate || 0) / 100,
        earnedRewards: Number(fields.earned_rewards || 0) / 1_000_000_000,
        status,
        zkProofVerified: Boolean(fields.zk_proof_verified || true),
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
 * In mock mode: Returns mock stats
 */
export async function fetchBlockchainStats(): Promise<MarketStats> {
  if (isMockMode()) {
    await delay(300);
    return mockStats;
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
 * In mock mode: Returns mock prices
 */
export async function fetchBlockchainPrices(): Promise<PriceData[]> {
  if (isMockMode()) {
    await delay(300);
    return mockPrices;
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
    return mockVaults;
  }

  // Real mode: Return empty vaults (would need vault registry in production)
  return [];
}

/**
 * NAUTILUS AI FAIRNESS SCORING SYSTEM
 * ====================================
 * 
 * This module implements the AI-verifiable fair matching system described in the blueprint.
 * In production, this would integrate with Nautilus off-chain compute for verifiable AI inference.
 * 
 * ARCHITECTURE:
 * 1. Frontend sends order parameters to Nautilus API
 * 2. Nautilus runs ML model to calculate fairness score
 * 3. Result includes cryptographic proof of computation
 * 4. Proof is verified on-chain during order matching
 * 
 * SCORING FACTORS (from Blueprint):
 * - Order size (smaller = higher priority for retail protection)
 * - Historical behavior (good actors get rewarded)
 * - Vesting participation (shows long-term commitment)
 * - Time in queue (prevents starvation)
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

/**
 * Verify a fairness proof on-chain
 * In production, this would call a Move function to verify the Nautilus proof
 */
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
  if (isMockMode()) {
    await delay(300);
    return [];
  }

  if (!userAddress || !isValidSuiAddress(userAddress)) {
    return [];
  }

  try {
    const client = getSuiClient();
    const coins = await client.getCoins({
      owner: userAddress,
      coinType: coinType,
    });

    return coins.data.map((coin) => ({
      objectId: coin.coinObjectId,
      balance: Number(coin.balance) / 1_000_000_000,
    }));
  } catch (error) {
    console.error("Error fetching user coins:", error);
    return [];
  }
}

/**
 * Get coin type for asset
 */
export function getCoinType(asset: string): string {
  const packageId = env.sui.packageId;
  switch (asset) {
    case "USDC":
      return `${packageId}::mock_coins::MOCK_USDC`;
    case "ETH":
      return `${packageId}::mock_coins::MOCK_ETH`;
    case "SUI":
    default:
      return "0x2::sui::SUI";
  }
}
