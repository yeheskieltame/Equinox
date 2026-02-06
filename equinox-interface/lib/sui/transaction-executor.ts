import { Transaction } from "@mysten/sui/transactions";
import { getZkLoginSignature } from "@mysten/sui/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getSuiClient } from "@/lib/sui/client";
import { isMockMode } from "@/lib/config";
import { 
  getStoredKeyPair, 
  getStoredJwt, 
  getStoredZkProof, 
  getStoredSalt,
  getStoredSession,
  type ZkProof,
} from "@/lib/sui/zklogin";
import {
  buildCreateOrderTx,
  buildLockVestingTx,
  buildUnlockVestingTx,
  buildDepositToVaultTx,
  buildCreateBorrowTx,
  buildRepayLoanTx,
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

  const client = getSuiClient();
  const keypair = getStoredKeyPair();
  const jwt = getStoredJwt();
  const proof = getStoredZkProof();
  const salt = getStoredSalt();
  const session = getStoredSession();

  if (!keypair || !jwt || !salt || !session?.maxEpoch || !session?.randomness) {
    return {
      success: false,
      error: "Missing authentication data. Please reconnect your wallet.",
    };
  }

  try {
    tx.setSender(userAddress);
    
    const { bytes, signature: userSignature } = await tx.sign({
      client,
      signer: keypair,
    });

    if (proof) {
      const zkLoginSignature = getZkLoginSignature({
        inputs: {
          ...proof,
          addressSeed: proof.addressSeed,
        },
        maxEpoch: session.maxEpoch,
        userSignature,
      });

      const result = await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature: zkLoginSignature,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      return {
        success: result.effects?.status?.status === "success",
        digest: result.digest,
        effects: result.effects as TransactionResult["effects"],
      };
    } else {
      const result = await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature: userSignature,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      return {
        success: result.effects?.status?.status === "success",
        digest: result.digest,
        effects: result.effects as TransactionResult["effects"],
      };
    }
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
  },
  userAddress: string
): Promise<TransactionResult> {
  try {
    const tx = buildCreateBorrowTx(params);
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

  try {
    const client = getSuiClient();
    const keypair = getStoredKeyPair();
    
    if (!keypair) {
      return {
        success: false,
        error: "No keypair found. Please reconnect your wallet.",
      };
    }

    const tx = new Transaction();
    tx.setSender(userAddress);
    
    const [coin] = tx.splitCoins(tx.gas, [1]);
    tx.transferObjects([coin], userAddress);

    const session = getStoredSession();
    const proof = getStoredZkProof();
    
    const { bytes, signature: userSignature } = await tx.sign({
      client,
      signer: keypair,
    });

    if (proof && session?.maxEpoch) {
      const zkLoginSignature = getZkLoginSignature({
        inputs: {
          ...proof,
          addressSeed: proof.addressSeed,
        },
        maxEpoch: session.maxEpoch,
        userSignature,
      });

      const result = await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature: zkLoginSignature,
        options: {
          showEffects: true,
        },
      });

      return {
        success: result.effects?.status?.status === "success",
        digest: result.digest,
        effects: result.effects as TransactionResult["effects"],
      };
    } else {
      const result = await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature: userSignature,
        options: {
          showEffects: true,
        },
      });

      return {
        success: result.effects?.status?.status === "success",
        digest: result.digest,
        effects: result.effects as TransactionResult["effects"],
      };
    }
  } catch (error) {
    console.error("Demo transaction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Demo transaction failed",
    };
  }
}
