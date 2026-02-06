import { getSuiClient } from "@/lib/sui/client";
import { env, isMockMode } from "@/lib/config";
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
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  USDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  USDT: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
};

const PYTH_API_URL = "https://hermes.pyth.network/api/latest_price_feeds";

export async function fetchBlockchainOrders(userAddress: string): Promise<Order[]> {
  if (isMockMode()) {
    await delay(500);
    return mockOrders;
  }

  try {
    const client = getSuiClient();
    const packageId = env.sui.orderbookPackageId;
    
    if (!packageId) {
      console.warn("Orderbook package ID not configured, returning mock orders for demo");
      return mockOrders;
    }

    const objects = await client.getOwnedObjects({
      owner: userAddress,
      filter: {
        StructType: `${packageId}::orderbook::Order`,
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

export async function fetchBlockchainPositions(userAddress: string): Promise<Position[]> {
  if (isMockMode()) {
    await delay(500);
    return mockPositions;
  }

  try {
    const client = getSuiClient();
    const packageId = env.sui.loanObjectPackageId;
    
    if (!packageId) {
      console.warn("Loan object package ID not configured, returning empty positions");
      return [];
    }

    const objects = await client.getOwnedObjects({
      owner: userAddress,
      filter: {
        StructType: `${packageId}::loan::LoanPosition`,
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

export async function fetchBlockchainVestingPositions(userAddress: string): Promise<VestingPosition[]> {
  if (isMockMode()) {
    await delay(500);
    return mockVestingPositions;
  }

  try {
    const client = getSuiClient();
    const packageId = env.sui.vestingVaultPackageId;
    
    if (!packageId) {
      console.warn("Vesting vault package ID not configured, returning empty vesting positions");
      return [];
    }

    const objects = await client.getOwnedObjects({
      owner: userAddress,
      filter: {
        StructType: `${packageId}::vesting_vault::VestingPosition`,
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
        zkProofVerified: Boolean(fields.zk_proof_verified),
      } as VestingPosition;
    }).filter(Boolean) as VestingPosition[];
  } catch (error) {
    console.error("Error fetching vesting positions from blockchain:", error);
    return [];
  }
}

export async function fetchBlockchainStats(): Promise<MarketStats> {
  if (isMockMode()) {
    await delay(500);
    return mockStats;
  }

  try {
    const client = getSuiClient();
    
    const totalTxBlocks = await client.getTotalTransactionBlocks();
    
    return {
      ...mockStats,
      activeUsers: Math.floor(Number(totalTxBlocks) / 1000),
    };
  } catch (error) {
    console.error("Error fetching blockchain stats:", error);
    return mockStats;
  }
}

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
          price: mockPrices.find(p => p.asset === asset)?.price || 0,
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
    console.error("Error fetching Pyth prices, falling back to mock:", error);
    return mockPrices;
  }
}

async function fetchSupraPrices(): Promise<PriceData[]> {
  console.warn("Supra oracle not yet implemented, using mock prices");
  return mockPrices;
}

export async function fetchMarketExposure(): Promise<MarketExposure[]> {
  if (isMockMode()) {
    await delay(300);
    return mockMarketExposure;
  }
  
  return mockMarketExposure;
}

export async function fetchApyHistory(): Promise<ChartDataPoint[]> {
  if (isMockMode()) {
    await delay(300);
    return mockApyHistory;
  }

  return mockApyHistory;
}

export async function fetchBorrowMarkets(): Promise<{ asset: string; available: number; borrowApr: number; maxLtv: number }[]> {
  if (isMockMode()) {
    await delay(300);
    return mockBorrowMarkets;
  }

  return mockBorrowMarkets;
}

export async function fetchVaults(): Promise<Vault[]> {
  if (isMockMode()) {
    await delay(500);
    return mockVaults;
  }

  return mockVaults;
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
 * - Retail Priority: Orders < 10,000 USDC get +10-15 points
 * - Order Size: Smaller orders get preference for inclusivity
 * - Vesting Status: Locked vested tokens get +5-8 points boost
 * - Risk Diversity: Penalize over-concentration (max -10 points)
 * - Historical Behavior: Good actors get slight boost
 * 
 * CURRENT IMPLEMENTATION:
 * For HackMoney 2026 demo, we use a documented mock that simulates
 * Nautilus behavior with deterministic scoring based on the above factors.
 * 
 * TODO for production:
 * - Integrate with Nautilus API endpoint
 * - Implement proof verification
 * - Add caching for repeated calculations
 */

const NAUTILUS_API_URL = "https://nautilus.mystenlabs.com/v1/compute";

export interface FairnessScoreResult {
  score: number;
  factors: {
    isRetail: boolean;
    orderSize: "small" | "medium" | "large";
    riskDiversity: number;
    priorityBoost: number;
    vestingBoost: number;
  };
  metadata: {
    computeMethod: "nautilus" | "local-mock";
    timestamp: string;
    version: string;
  };
}

export async function calculateFairnessScore(
  orderAmount: number,
  userAddress: string,
  isVested: boolean
): Promise<FairnessScoreResult> {
  const timestamp = new Date().toISOString();
  
  const isRetail = orderAmount < 10000;
  const orderSize: "small" | "medium" | "large" = 
    orderAmount < 1000 ? "small" : 
    orderAmount < 50000 ? "medium" : "large";
  
  let baseScore = 70;
  
  const retailBoost = isRetail ? 12 : 0;
  baseScore += retailBoost;
  
  const sizeBoost = orderSize === "small" ? 8 : orderSize === "medium" ? 4 : 0;
  baseScore += sizeBoost;
  
  const vestingBoost = isVested ? 8 : 0;
  baseScore += vestingBoost;
  
  const addressHash = userAddress.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const riskDiversity = (addressHash % 10) + 1;
  baseScore += riskDiversity;
  
  const priorityBoost = isVested ? 5 : 0;
  baseScore += priorityBoost;
  
  const concentrationPenalty = orderAmount > 100000 ? -5 : 0;
  baseScore += concentrationPenalty;
  
  const finalScore = Math.min(100, Math.max(0, Math.floor(baseScore)));
  
  return {
    score: finalScore,
    factors: {
      isRetail,
      orderSize,
      riskDiversity,
      priorityBoost,
      vestingBoost,
    },
    metadata: {
      computeMethod: "local-mock",
      timestamp,
      version: "1.0.0-hackathon",
    },
  };
}

/**
 * Production implementation that would call Nautilus API
 * Kept for reference and future integration
 */
export async function calculateFairnessScoreWithNautilus(
  orderAmount: number,
  userAddress: string,
  isVested: boolean
): Promise<FairnessScoreResult> {
  try {
    const response = await fetch(NAUTILUS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: "fairness_score",
        inputs: {
          order_amount: orderAmount,
          user_address: userAddress,
          is_vested: isVested,
          timestamp: Date.now(),
        },
      }),
    });

    if (!response.ok) {
      console.warn("Nautilus API unavailable, falling back to local calculation");
      return calculateFairnessScore(orderAmount, userAddress, isVested);
    }

    const result = await response.json();
    
    return {
      score: result.score,
      factors: result.factors,
      metadata: {
        computeMethod: "nautilus",
        timestamp: new Date().toISOString(),
        version: result.version,
      },
    };
  } catch (error) {
    console.warn("Nautilus API error, falling back to local calculation:", error);
    return calculateFairnessScore(orderAmount, userAddress, isVested);
  }
}
