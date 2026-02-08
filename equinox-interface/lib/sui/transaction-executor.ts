import { Transaction } from "@mysten/sui/transactions";
import { getSuiClient } from "@/lib/sui/client";
import { isMockMode } from "@/lib/config";
import {
  buildCreateOrderTx,
  buildLockVestingTx,
  buildUnlockVestingTx,
  buildDepositToVaultTx,
  buildCreateBorrowTx,
  buildRepayLoanTx,
  buildMintTokenTx,
  buildMatchOrdersTx,
} from "@/lib/sui/transactions";

export interface TransactionResult {
  success: boolean;
  digest?: string;
  error?: string;
  effects?: {
    status: { status: string };
    gasUsed: {
      computationCost: string;
      storageCost: string;
    };
  };
}

// This will be set by the component that has access to dapp-kit hooks
let signAndExecuteCallback: ((tx: Transaction) => Promise<{ digest: string; effects?: unknown }>) | null = null;

export function setSignAndExecuteCallback(
  callback: ((tx: Transaction) => Promise<{ digest: string; effects?: unknown }>) | null
) {
  signAndExecuteCallback = callback;
}

async function executeTransaction(tx: Transaction, userAddress: string): Promise<TransactionResult> {
  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return {
      success: true,
      digest: `mock_${Date.now().toString(16)}`,
      effects: {
        status: { status: "success" },
        gasUsed: {
          computationCost: "1000000",
          storageCost: "2000000",
        },
      },
    };
  }

  if (!signAndExecuteCallback) {
    return {
      success: false,
      error: "Wallet not connected. Please connect your wallet first.",
    };
  }

  try {
    tx.setSender(userAddress);
    
    const result = await signAndExecuteCallback(tx);

    return {
      success: true,
      digest: result.digest,
      effects: result.effects as TransactionResult["effects"],
    };
  } catch (error) {
    console.error("Transaction execution error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Transaction failed",
    };
  }
}

export async function executeCreateOrder(
  params: {
    type: "lend" | "borrow";
    asset: string;
    amount: number;
    interestRate: number;
    ltv: number;
    term: number;
    isHidden: boolean;
    coinObjectId?: string;
    collateralAmount?: number;
  },
  userAddress: string
): Promise<TransactionResult> {
  try {
    const tx = buildCreateOrderTx(params);
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create order transaction",
    };
  }
}

export async function executeLockVesting(
  params: {
    amount: number;
    lockDurationDays: number;
  },
  userAddress: string
): Promise<TransactionResult> {
  try {
    const tx = buildLockVestingTx(params);
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create vesting transaction",
    };
  }
}

export async function executeUnlockVesting(
  vestingPositionId: string,
  userAddress: string
): Promise<TransactionResult> {
  try {
    const tx = buildUnlockVestingTx(vestingPositionId);
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create unlock transaction",
    };
  }
}

export async function executeDeposit(
  params: {
    vaultId: string;
    amount: number;
    coinObjectId: string;
  },
  userAddress: string
): Promise<TransactionResult> {
  try {
    const tx = buildDepositToVaultTx(params);
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create deposit transaction",
    };
  }
}

export async function executeBorrow(
  params: {
    collateralCoinId: string;
    borrowAsset: string;
    borrowAmount: number;
    ltv: number;
    interestRate?: number;
    term?: number;
  },
  userAddress: string
): Promise<TransactionResult> {
  try {
    const tx = buildCreateBorrowTx({
      ...params,
      interestRate: params.interestRate || 5.0,
      term: params.term || 30,
    });
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create borrow transaction",
    };
  }
}

export async function executeRepay(
  loanId: string,
  coinObjectId: string,
  userAddress: string
): Promise<TransactionResult> {
  try {
    const tx = buildRepayLoanTx(loanId, coinObjectId);
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create repay transaction",
    };
  }
}

export async function executeMintToken(
  asset: string,
  amount: number,
  userAddress: string
): Promise<TransactionResult> {
  try {
    const tx = buildMintTokenTx(asset, amount);
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create mint transaction",
    };
  }
}

export async function executeDemoTransaction(userAddress: string): Promise<TransactionResult> {
  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return {
      success: true,
      digest: `demo_${Date.now().toString(16)}`,
      effects: {
        status: { status: "success" },
        gasUsed: {
          computationCost: "500000",
          storageCost: "1000000",
        },
      },
    };
  }

  if (!signAndExecuteCallback) {
    return {
      success: false,
      error: "Wallet not connected. Please connect your wallet first.",
    };
  }

  try {
    const tx = new Transaction();
    tx.setSender(userAddress);
    
    const [coin] = tx.splitCoins(tx.gas, [1]);
    tx.transferObjects([coin], userAddress);

    const result = await signAndExecuteCallback(tx);

    return {
      success: true,
      digest: result.digest,
      effects: result.effects as TransactionResult["effects"],
    };
  } catch (error) {
    console.error("Demo transaction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Demo transaction failed",
    };
  }
}

export async function executeMatchOrders(
  lendOrderId: string,
  borrowOrderId: string,
  asset: string,
  userAddress: string
): Promise<TransactionResult> {
  try {
    const tx = buildMatchOrdersTx(lendOrderId, borrowOrderId, asset);
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create match orders transaction",
    };
  }
}
