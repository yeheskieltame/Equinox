import { Transaction } from "@mysten/sui/transactions";
import { env } from "@/lib/config";

interface CreateOrderParams {
  type: "lend" | "borrow";
  asset: string;
  collateral?: string;
  amount: number;
  interestRate: number;
  ltv?: number;
  term: number;
  isHidden: boolean;
  // Required for non-SUI lending
  coinObjectId?: string;
  // Required for borrow orders
  collateralAmount?: number;
  collateralPrice?: number;
  assetPrice?: number;
}

interface DepositToVaultParams {
  vaultId: string;
  amount: number;
  coinObjectId: string;
}

interface CreateBorrowParams {
  collateralCoinId: string;
  borrowAsset: string;
  borrowAmount: number;
  interestRate: number;
  term: number;
  ltv: number;
  collateralPrice?: number;
  assetPrice?: number;
}

interface LockVestingParams {
  amount: number;
  lockDurationDays: number;
  vestingProofHash?: string;
}

// Registry ID from deployed contracts
const getRegistryId = () => env.sui.registryId;
const getVestingVaultId = () => env.sui.vestingVaultId;
const getPackageId = () => env.sui.packageId;

// Market IDs for different pairs
const getMarketId = (asset: string, collateral: string) => {
  const marketId = env.sui.marketId;
  // For MVP, we use configured market ID
  // In production, this would be fetched from registry per asset/collateral pair
  if (!marketId) {
    throw new Error(
      `Market ID not configured. To use orderbook, you need to create a Market object first:\n\n` +
      `1. Run: sui client call --package ${env.sui.packageId} --module market ` +
      `--function create_market_standalone --type-args "${env.sui.packageId}::mock_usdc::MOCK_USDC" "0x2::sui::SUI" ` +
      `--args '[]' --gas-budget 50000000\n\n` +
      `2. Copy the created Market object ID from the transaction output\n` +
      `3. Add to .env.local: NEXT_PUBLIC_MARKET_ID=<object_id>`
    );
  }
  return marketId;
};

// Helper to get coin type argument based on asset
function getAssetCoinType(asset: string, packageId: string): string {
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

// Helper to get decimals for asset
function getDecimals(asset: string): number {
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

// Convert amount to smallest unit
function toSmallestUnit(amount: number, asset: string): bigint {
  const decimals = getDecimals(asset);
  return BigInt(Math.floor(amount * Math.pow(10, decimals)));
}

/**
 * Build a lend order transaction
 * Matches: place_lend_order<Asset, Collateral>(market, payment, interest_rate_bps, duration_ms, clock, ctx)
 */
export function buildLendOrderTx(params: {
  asset: string;
  collateral: string;
  amount: number;
  interestRate: number;
  term: number;
  coinObjectId: string;
}): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const marketId = getMarketId(params.asset, params.collateral);

  if (!packageId) throw new Error("Package ID not configured");
  if (!marketId) throw new Error("Market ID not configured");

  const interestRateBps = Math.floor(params.interestRate * 100);
  const durationMs = params.term * 24 * 60 * 60 * 1000;

  tx.moveCall({
    target: `${packageId}::market::place_lend_order`,
    typeArguments: [
      getAssetCoinType(params.asset, packageId),
      getAssetCoinType(params.collateral, packageId),
    ],
    arguments: [
      tx.object(marketId),
      tx.object(params.coinObjectId),
      tx.pure.u64(interestRateBps),
      tx.pure.u64(durationMs),
      tx.object("0x6"), // Clock object
    ],
  });

  return tx;
}

/**
 * Build a borrow order transaction (standalone - no registry validation)
 * Matches: place_borrow_order_standalone<Asset, Collateral>(market, collateral, amount, interest_rate_bps, duration_ms, clock, ctx)
 */
export function buildBorrowOrderTx(params: {
  asset: string;
  collateral: string;
  borrowAmount: number;
  interestRate: number;
  term: number;
  collateralCoinId: string;
}): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const marketId = getMarketId(params.asset, params.collateral);

  if (!packageId) throw new Error("Package ID not configured");
  if (!marketId) throw new Error("Market ID not configured");

  const amountInSmallest = toSmallestUnit(params.borrowAmount, params.asset);
  const interestRateBps = Math.floor(params.interestRate * 100);
  const durationMs = params.term * 24 * 60 * 60 * 1000;

  tx.moveCall({
    target: `${packageId}::market::place_borrow_order_standalone`,
    typeArguments: [
      getAssetCoinType(params.asset, packageId),
      getAssetCoinType(params.collateral, packageId),
    ],
    arguments: [
      tx.object(marketId),
      tx.object(params.collateralCoinId),
      tx.pure.u64(amountInSmallest),
      tx.pure.u64(interestRateBps),
      tx.pure.u64(durationMs),
      tx.object("0x6"), // Clock object
    ],
  });

  return tx;
}

/**
 * Build a hidden lend order transaction (ZK-privacy)
 * Matches: place_hidden_lend_order<Asset, Collateral>(market, payment, commitment, clock, ctx)
 */
export function buildHiddenLendOrderTx(params: {
  asset: string;
  collateral: string;
  coinObjectId: string;
  commitment: Uint8Array;
}): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const marketId = getMarketId(params.asset, params.collateral);

  if (!packageId) throw new Error("Package ID not configured");
  if (!marketId) throw new Error("Market ID not configured");

  tx.moveCall({
    target: `${packageId}::market::place_hidden_lend_order`,
    typeArguments: [
      getAssetCoinType(params.asset, packageId),
      getAssetCoinType(params.collateral, packageId),
    ],
    arguments: [
      tx.object(marketId),
      tx.object(params.coinObjectId),
      tx.pure.vector("u8", Array.from(params.commitment)),
      tx.object("0x6"), // Clock object
    ],
  });

  return tx;
}

/**
 * Build create order transaction - unified interface for frontend
 */
export function buildCreateOrderTx(params: CreateOrderParams): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const marketId = getMarketId(params.asset, params.collateral || "SUI");

  if (!packageId) throw new Error("Package ID not configured");
  if (!marketId) throw new Error("Market ID not configured");

  const interestRateBps = Math.floor(params.interestRate * 100);
  const durationMs = params.term * 24 * 60 * 60 * 1000;
  const collateral = params.collateral || "SUI";

  if (params.type === "lend") {
    // For lend order, we need to split coins from gas
    const amountInSmallest = toSmallestUnit(params.amount, params.asset);
    
    if (params.asset === "SUI") {
      // Split SUI from gas
      const [coin] = tx.splitCoins(tx.gas, [amountInSmallest]);
      
      tx.moveCall({
        target: `${packageId}::market::place_lend_order`,
        typeArguments: [
          getAssetCoinType(params.asset, packageId),
          getAssetCoinType(collateral, packageId),
        ],
        arguments: [
          tx.object(marketId),
          coin,
          tx.pure.u64(interestRateBps),
          tx.pure.u64(durationMs),
          tx.object("0x6"), // Clock object
        ],
      });
    } else {
      // For other assets, user needs to provide coin object
      if (!params.coinObjectId) {
        throw new Error(`For non-SUI assets (${params.asset}), coinObjectId is required`);
      }
      return buildLendOrderTx({
        asset: params.asset,
        collateral: collateral,
        amount: params.amount,
        interestRate: params.interestRate,
        term: params.term,
        coinObjectId: params.coinObjectId,
      });
    }
  } else {
    // Borrow order
    const amountInSmallest = toSmallestUnit(params.amount, params.asset);
    const collateralAmount = toSmallestUnit(params.collateralAmount || 0, collateral);
    
    if (collateral === "SUI") {
      // Split SUI from gas as collateral
      const [collateralCoin] = tx.splitCoins(tx.gas, [collateralAmount]);
      
      tx.moveCall({
        target: `${packageId}::market::place_borrow_order_standalone`,
        typeArguments: [
          getAssetCoinType(params.asset, packageId),
          getAssetCoinType(collateral, packageId),
        ],
        arguments: [
          tx.object(marketId),
          collateralCoin,
          tx.pure.u64(amountInSmallest),
          tx.pure.u64(interestRateBps),
          tx.pure.u64(durationMs),
          tx.object("0x6"), // Clock object
        ],
      });
    } else {
      throw new Error("For non-SUI collateral, provide collateralCoinId");
    }
  }

  return tx;
}

export function buildDepositToVaultTx(params: DepositToVaultParams): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();

  if (!packageId) {
    throw new Error("Package ID not configured");
  }

  // Using registry module for vault deposits
  tx.moveCall({
    target: `${packageId}::registry::deposit_to_vault`,
    arguments: [
      tx.object(params.vaultId),
      tx.object(params.coinObjectId),
    ],
  });

  return tx;
}

export function buildCreateBorrowTx(params: CreateBorrowParams): Transaction {
  return buildBorrowOrderTx({
    asset: params.borrowAsset,
    collateral: "SUI", // Default collateral
    borrowAmount: params.borrowAmount,
    interestRate: params.interestRate || 5.0,
    term: params.term || 30,
    collateralCoinId: params.collateralCoinId,
  });
}

export function buildLockVestingTx(params: LockVestingParams): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const vestingVaultId = getVestingVaultId();

  if (!packageId) {
    throw new Error("Package ID not configured");
  }

  if (!vestingVaultId) {
    throw new Error("Vesting vault ID not configured");
  }

  const amountMist = BigInt(Math.floor(params.amount * 1_000_000_000));
  const lockDurationMs = params.lockDurationDays * 24 * 60 * 60 * 1000;

  // Split SUI from gas for locking
  const [coin] = tx.splitCoins(tx.gas, [amountMist]);

  // Using vesting module for locking tokens (simple lock without ZK for MVP)
  tx.moveCall({
    target: `${packageId}::vesting::lock_simple`,
    typeArguments: ["0x2::sui::SUI"],
    arguments: [
      tx.object(vestingVaultId),
      coin,
      tx.pure.u64(lockDurationMs),
      tx.object("0x6"), // Clock object
    ],
  });

  return tx;
}

export function buildUnlockVestingTx(vestingPositionId: string): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const vestingVaultId = getVestingVaultId();

  if (!packageId) {
    throw new Error("Package ID not configured");
  }

  if (!vestingVaultId) {
    throw new Error("Vesting vault ID not configured");
  }

  // Using vesting module for unlocking
  tx.moveCall({
    target: `${packageId}::vesting::unlock`,
    arguments: [
      tx.object(vestingVaultId),
      tx.object(vestingPositionId),
      tx.object("0x6"), // Clock object
    ],
  });

  return tx;
}

export function buildRepayLoanTx(loanId: string, coinObjectId: string): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();

  if (!packageId) {
    throw new Error("Package ID not configured");
  }

  // Using loan module for repayment
  tx.moveCall({
    target: `${packageId}::loan::repay`,
    arguments: [
      tx.object(loanId),
      tx.object(coinObjectId),
      tx.object("0x6"), // Clock object
    ],
  });

  return tx;
}

// Build a transaction to claim rewards from vesting
export function buildClaimVestingRewardsTx(vestingPositionId: string): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const vestingVaultId = getVestingVaultId();

  if (!packageId) {
    throw new Error("Package ID not configured");
  }

  if (!vestingVaultId) {
    throw new Error("Vesting vault ID not configured");
  }

  tx.moveCall({
    target: `${packageId}::vesting::claim_rewards`,
    arguments: [
      tx.object(vestingVaultId),
      tx.object(vestingPositionId),
      tx.object("0x6"), // Clock object
    ],
  });

  return tx;
}

// Build a transaction to mint mock tokens (Faucet)
export function buildMintTokenTx(asset: string, amount: number): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();

  if (!packageId) {
    throw new Error("Package ID not configured");
  }

  const decimals = getDecimals(asset);
  const amountSmallest = BigInt(Math.floor(amount * Math.pow(10, decimals)));

  if (asset === "USDC") {
    const capId = env.sui.usdcAdminCapId;
    if (!capId) throw new Error("USDC Admin Cap ID not configured. Please redeploy contracts.");
    
    tx.moveCall({
      target: `${packageId}::mock_usdc::faucet`,
      arguments: [
        tx.object(capId),
        tx.pure.u64(amountSmallest),
      ],
    });
  } else if (asset === "ETH") {
    const capId = env.sui.ethAdminCapId;
    if (!capId) throw new Error("ETH Admin Cap ID not configured. Please redeploy contracts.");

    tx.moveCall({
      target: `${packageId}::mock_eth::faucet`,
      arguments: [
        tx.object(capId),
        tx.pure.u64(amountSmallest),
      ],
    });
  } else {
    throw new Error(`Faucet not available for ${asset}`);
  }

  return tx;
}

// Cancel a lend order
export function buildCancelLendOrderTx(orderId: string, asset: string, collateral: string): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const marketId = getMarketId(asset, collateral);

  if (!packageId) throw new Error("Package ID not configured");
  if (!marketId) throw new Error("Market ID not configured");

  tx.moveCall({
    target: `${packageId}::market::cancel_lend_order`,
    typeArguments: [
      getAssetCoinType(asset, packageId),
      getAssetCoinType(collateral, packageId),
    ],
    arguments: [
      tx.object(marketId),
      tx.pure.id(orderId),
    ],
  });

  return tx;
}

// Cancel a borrow order
export function buildCancelBorrowOrderTx(orderId: string, asset: string, collateral: string): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const marketId = getMarketId(asset, collateral);

  if (!packageId) throw new Error("Package ID not configured");
  if (!marketId) throw new Error("Market ID not configured");

  tx.moveCall({
    target: `${packageId}::market::cancel_borrow_order`,
    typeArguments: [
      getAssetCoinType(asset, packageId),
      getAssetCoinType(collateral, packageId),
    ],
    arguments: [
      tx.object(marketId),
      tx.pure.id(orderId),
    ],
  });

  return tx;
}

// Match orders (for demo/testing)
export function buildMatchOrdersTx(
  lendOrderId: string,
  borrowOrderId: string,
  asset: string,
  collateral: string = "SUI"
): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const marketId = getMarketId(asset, collateral);

  if (!packageId) throw new Error("Package ID not configured");
  if (!marketId) throw new Error("Market ID not configured");

  tx.moveCall({
    target: `${packageId}::market::match_orders`,
    typeArguments: [
      getAssetCoinType(asset, packageId),
      getAssetCoinType(collateral, packageId),
    ],
    arguments: [
      tx.object(marketId),
      tx.pure.address(lendOrderId), // Use address for ID type
      tx.pure.address(borrowOrderId),
      tx.object("0x6"), // Clock object
    ],
  });

  return tx;
}

export { Transaction };
