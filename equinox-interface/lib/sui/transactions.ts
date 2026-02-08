import { Transaction } from "@mysten/sui/transactions";
import { env } from "@/lib/config";

interface CreateOrderParams {
  type: "lend" | "borrow";
  asset: string;
  amount: number;
  interestRate: number;
  ltv: number;
  term: number;
  isHidden: boolean;
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
  ltv: number;
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

export function buildCreateOrderTx(params: CreateOrderParams): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const registryId = getRegistryId();

  if (!packageId) {
    throw new Error("Package ID not configured");
  }

  const amountInMist = BigInt(params.amount * 1_000_000_000);
  const interestRateBps = Math.floor(params.interestRate * 100);
  const ltvBps = Math.floor(params.ltv * 100);
  const termSeconds = params.term * 24 * 60 * 60;

  // Using the market module for order creation
  tx.moveCall({
    target: `${packageId}::market::place_lend_order`,
    typeArguments: getAssetTypeArg(params.asset, packageId),
    arguments: [
      tx.object(registryId),
      tx.pure.u64(amountInMist),
      tx.pure.u64(interestRateBps),
      tx.pure.u64(ltvBps),
      tx.pure.u64(termSeconds),
      tx.pure.bool(params.isHidden),
    ],
  });

  return tx;
}

// Helper to get coin type argument based on asset
function getAssetTypeArg(asset: string, packageId: string): string[] {
  switch (asset) {
    case "USDC":
      return [`${packageId}::mock_coins::MOCK_USDC`];
    case "ETH":
      return [`${packageId}::mock_coins::MOCK_ETH`];
    case "SUI":
    default:
      return ["0x2::sui::SUI"];
  }
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
  const tx = new Transaction();
  const packageId = getPackageId();
  const registryId = getRegistryId();

  if (!packageId) {
    throw new Error("Package ID not configured");
  }

  const borrowAmountMist = BigInt(params.borrowAmount * 1_000_000_000);
  const ltvBps = Math.floor(params.ltv * 100);

  // Using market module for borrow orders
  tx.moveCall({
    target: `${packageId}::market::place_borrow_order`,
    typeArguments: getAssetTypeArg(params.borrowAsset, packageId),
    arguments: [
      tx.object(registryId),
      tx.object(params.collateralCoinId),
      tx.pure.u64(borrowAmountMist),
      tx.pure.u64(ltvBps),
    ],
  });

  return tx;
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

  const amountMist = BigInt(params.amount * 1_000_000_000);
  const lockDurationSeconds = params.lockDurationDays * 24 * 60 * 60;

  // Using vesting module for locking tokens
  tx.moveCall({
    target: `${packageId}::vesting::lock_sui`,
    arguments: [
      tx.object(vestingVaultId),
      tx.gas, // SUI coin to lock
      tx.pure.u64(amountMist),
      tx.pure.u64(lockDurationSeconds),
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
    ],
  });

  return tx;
}

export function buildRepayLoanTx(loanId: string, coinObjectId: string): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const registryId = getRegistryId();

  if (!packageId) {
    throw new Error("Package ID not configured");
  }

  // Using loan module for repayment
  tx.moveCall({
    target: `${packageId}::loan::repay`,
    arguments: [
      tx.object(registryId),
      tx.object(loanId),
      tx.object(coinObjectId),
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
    ],
  });

  return tx;
}

export { Transaction };
