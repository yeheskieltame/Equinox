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

export function buildCreateOrderTx(params: CreateOrderParams): Transaction {
  const tx = new Transaction();
  const packageId = env.sui.orderbookPackageId;

  if (!packageId) {
    throw new Error("Orderbook package ID not configured");
  }

  const amountInMist = BigInt(params.amount * 1_000_000_000);
  const interestRateBps = Math.floor(params.interestRate * 100);
  const ltvBps = Math.floor(params.ltv * 100);
  const termSeconds = params.term * 24 * 60 * 60;

  tx.moveCall({
    target: `${packageId}::orderbook::create_order`,
    arguments: [
      tx.pure.bool(params.type === "lend"),
      tx.pure.u64(amountInMist),
      tx.pure.u16(interestRateBps),
      tx.pure.u16(ltvBps),
      tx.pure.u64(termSeconds),
      tx.pure.bool(params.isHidden),
    ],
  });

  return tx;
}

export function buildDepositToVaultTx(params: DepositToVaultParams): Transaction {
  const tx = new Transaction();
  const packageId = env.sui.loanObjectPackageId;

  if (!packageId) {
    throw new Error("Loan object package ID not configured");
  }

  tx.moveCall({
    target: `${packageId}::vault::deposit`,
    arguments: [
      tx.object(params.vaultId),
      tx.object(params.coinObjectId),
    ],
  });

  return tx;
}

export function buildCreateBorrowTx(params: CreateBorrowParams): Transaction {
  const tx = new Transaction();
  const packageId = env.sui.loanObjectPackageId;

  if (!packageId) {
    throw new Error("Loan object package ID not configured");
  }

  const borrowAmountMist = BigInt(params.borrowAmount * 1_000_000_000);
  const ltvBps = Math.floor(params.ltv * 100);

  tx.moveCall({
    target: `${packageId}::loan::create_borrow`,
    arguments: [
      tx.object(params.collateralCoinId),
      tx.pure.u64(borrowAmountMist),
      tx.pure.u16(ltvBps),
    ],
  });

  return tx;
}

export function buildLockVestingTx(params: LockVestingParams): Transaction {
  const tx = new Transaction();
  const packageId = env.sui.vestingVaultPackageId;

  if (!packageId) {
    throw new Error("Vesting vault package ID not configured");
  }

  const amountMist = BigInt(params.amount * 1_000_000_000);
  const lockDurationSeconds = params.lockDurationDays * 24 * 60 * 60;

  tx.moveCall({
    target: `${packageId}::vesting_vault::lock_tokens`,
    arguments: [
      tx.pure.u64(amountMist),
      tx.pure.u64(lockDurationSeconds),
    ],
  });

  return tx;
}

export function buildUnlockVestingTx(vestingPositionId: string): Transaction {
  const tx = new Transaction();
  const packageId = env.sui.vestingVaultPackageId;

  if (!packageId) {
    throw new Error("Vesting vault package ID not configured");
  }

  tx.moveCall({
    target: `${packageId}::vesting_vault::unlock_tokens`,
    arguments: [tx.object(vestingPositionId)],
  });

  return tx;
}

export function buildRepayLoanTx(loanId: string, coinObjectId: string): Transaction {
  const tx = new Transaction();
  const packageId = env.sui.loanObjectPackageId;

  if (!packageId) {
    throw new Error("Loan object package ID not configured");
  }

  tx.moveCall({
    target: `${packageId}::loan::repay`,
    arguments: [
      tx.object(loanId),
      tx.object(coinObjectId),
    ],
  });

  return tx;
}

export { Transaction };
