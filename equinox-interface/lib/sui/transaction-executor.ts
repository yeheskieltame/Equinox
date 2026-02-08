
import { Transaction } from "@mysten/sui/transactions";
import { getSuiClient } from "@/lib/sui/client";
import { isMockMode } from "@/lib/config";
import { MockState } from "@/lib/sui/mock-state";
import {
  buildCreateOrderTx,
  buildLockVestingTx,
  buildUnlockVestingTx,
  buildDepositToVaultTx,
  buildCreateBorrowTx,
  buildRepayLoanTx,
  buildMintTokenTx,
  buildMatchOrdersTx,
  buildLiquidateLoanTx,
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

// Global execution function for REAL transactions
async function executeTransaction(tx: Transaction, userAddress: string): Promise<TransactionResult> {
  // NOTE: We REMOVED the global mock check here. 
  // If we are here, it means the caller explicitly wants to run a transaction (likely real or the caller decided to use real tx).

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

// --- Specific Executors with Mock Interception ---

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
    collateral?: string; // Primary collateral asset (e.g., "ETH", "SUI", "USDC")
    collateralCoinId?: string; // Coin object ID for non-SUI collateral
    collaterals?: { asset: string; amount: number }[];
  },
  userAddress: string
): Promise<TransactionResult> {
  if (isMockMode()) {
    // Update local Mock State
    MockState.addOrder({
      id: `order-${Date.now()}`,
      creator: userAddress,
      type: params.type,
      asset: params.asset,
      amount: params.amount,
      interestRate: params.interestRate,
      ltv: params.ltv,
      term: params.term,
      status: "pending",
      createdAt: new Date().toISOString(),
      isHidden: params.isHidden,
      fairnessScore: 85, // Default mock score
      zkProofHash: params.isHidden ? `0x${Array(64).fill('a').join('')}` : undefined,
      collaterals: params.collaterals,
    });
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true, digest: `mock_${Date.now()}` };
  }

  try {
    // Build transaction with collateral parameter for proper market routing
    const tx = buildCreateOrderTx({
      ...params,
      collateral: params.collateral, // Pass collateral for market selection
      collateralCoinId: params.collateralCoinId, // Pass coin object ID for non-SUI collateral
    });
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
  if (isMockMode()) {
    const subsidy = params.lockDurationDays >= 365 ? 3.5 : 1.5;
    MockState.addVestingPosition({
      id: `vesting-${Date.now()}`,
      amount: params.amount,
      lockDate: new Date().toISOString(),
      unlockDate: new Date(Date.now() + params.lockDurationDays * 86400000).toISOString(),
      apy: 4.5 + subsidy,
      subsidyRate: subsidy,
      earnedRewards: 0,
      status: "locked",
      zkProofVerified: true,
    });
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true, digest: `mock_${Date.now()}` };
  }

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
  if (isMockMode()) {
    MockState.unlockVestingPosition(vestingPositionId);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true, digest: `mock_${Date.now()}` };
  }

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
  if (isMockMode()) {
    // Mock deposit logic if needed
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true, digest: `mock_${Date.now()}` };
  }

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
  if (isMockMode()) {
    // Mock borrow logic if needed
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true, digest: `mock_${Date.now()}` };
  }

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
  asset: string,
  userAddress: string
): Promise<TransactionResult> {
  if (isMockMode()) {
    MockState.repayLoan(loanId);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true, digest: `mock_${Date.now()}` };
  }

  try {
    const tx = buildRepayLoanTx(loanId, coinObjectId, asset);
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create repay transaction",
    };
  }
}

export async function executeLiquidate(
  loanId: string,
  coinObjectId: string,
  asset: string,
  userAddress: string
): Promise<TransactionResult> {
  if (isMockMode()) {
    MockState.liquidateLoan(loanId);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true, digest: `mock_${Date.now()}` };
  }

  try {
    const tx = buildLiquidateLoanTx(loanId, coinObjectId, asset);
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create liquidate transaction",
    };
  }
}

export async function executeMintToken(
  asset: string,
  amount: number,
  userAddress: string
): Promise<TransactionResult> {
  // Faucet is ALWAYS real if possible, because user wants real faucet.
  // We do NOT intercept with MockState here.
  
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
  userAddress: string,
  // Optional additional parameters for better fairness calculation
  options?: {
    lendAmount?: number;
    borrowAmount?: number;
    lendRate?: number;
    borrowRate?: number;
    lenderAddress?: string;
    borrowerAddress?: string;
    isVested?: boolean;
  }
): Promise<TransactionResult & { fairnessScore?: number; finalRate?: number }> {
  if (isMockMode()) {
    // Mock mode: simulate Nautilus computation
    const { computeFairnessScore } = await import("@/lib/nautilus");
    
    const fairnessResult = await computeFairnessScore({
      lendOrderId,
      borrowOrderId,
      lendAmount: options?.lendAmount || 1000,
      borrowAmount: options?.borrowAmount || 1000,
      lendRate: options?.lendRate || 5,
      borrowRate: options?.borrowRate || 7,
      lenderAddress: options?.lenderAddress || userAddress,
      borrowerAddress: options?.borrowerAddress || userAddress,
      isVested: options?.isVested,
    });

    console.log("Nautilus Fairness Result:", {
      score: fairnessResult.score,
      finalRate: fairnessResult.finalRate,
      breakdown: fairnessResult.scoreBreakdown,
    });

    // Execute mock matching
    MockState.matchOrders(lendOrderId, borrowOrderId);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    return { 
      success: true, 
      digest: `mock_nautilus_${Date.now()}`,
      fairnessScore: fairnessResult.score,
      finalRate: fairnessResult.finalRate,
    };
  }

  // Real mode: Use Nautilus enclave for fairness computation
  try {
    const { computeFairnessScore, formatSignatureForChain } = await import("@/lib/nautilus");
    
    // 1. Compute fairness score via Nautilus
    const fairnessResult = await computeFairnessScore({
      lendOrderId,
      borrowOrderId,
      lendAmount: options?.lendAmount || 1000,
      borrowAmount: options?.borrowAmount || 1000,
      lendRate: options?.lendRate || 5,
      borrowRate: options?.borrowRate || 7,
      lenderAddress: options?.lenderAddress || userAddress,
      borrowerAddress: options?.borrowerAddress || userAddress,
      isVested: options?.isVested,
    });

    console.log("Nautilus Fairness Computation:", {
      score: fairnessResult.score,
      finalRate: fairnessResult.finalRate,
      breakdown: fairnessResult.scoreBreakdown,
    });

    // 2. Build transaction with Nautilus signature
    // NOTE: For full on-chain verification, we need:
    // - Registered enclave on-chain (EnclaveConfig object)
    // - RegisteredEnclave object with matching public key
    // For hackathon demo without on-chain enclave registration,
    // we simulate the matching in mock mode.
    
    // Check if enclave is registered on-chain
    const enclaveId = process.env.NEXT_PUBLIC_NAUTILUS_ENCLAVE_ID;
    
    if (!enclaveId) {
      // No enclave registered - return demo result with computed score
      console.log("No on-chain enclave registered. Returning computed fairness score.");
      console.log("To enable on-chain matching:");
      console.log("1. Deploy Nautilus enclave to AWS Nitro");
      console.log("2. Register enclave PCRs and public key on-chain");
      console.log("3. Set NEXT_PUBLIC_NAUTILUS_ENCLAVE_ID in .env");
      
      return {
        success: false,
        fairnessScore: fairnessResult.score,
        finalRate: fairnessResult.finalRate,
        error: `Fairness Score: ${fairnessResult.score}/100 (Rate: ${fairnessResult.finalRate.toFixed(2)}%). ` +
               `On-chain matching requires enclave registration. See console for setup instructions.`,
      };
    }

    // 3. Build and execute on-chain match transaction
    const tx = buildMatchOrdersWithNautilus(
      lendOrderId,
      borrowOrderId,
      asset,
      enclaveId,
      fairnessResult.score,
      formatSignatureForChain(fairnessResult.signature)
    );

    const result = await executeTransaction(tx, userAddress);
    
    return {
      ...result,
      fairnessScore: fairnessResult.score,
      finalRate: fairnessResult.finalRate,
    };

  } catch (error) {
    console.error("Nautilus matching error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Nautilus matching failed",
    };
  }
}

/**
 * Build match orders transaction with Nautilus fairness proof
 */
function buildMatchOrdersWithNautilus(
  lendOrderId: string,
  borrowOrderId: string,
  asset: string,
  enclaveId: string,
  fairnessScore: number,
  fairnessProof: number[],
  collateral: string = "SUI"
): Transaction {
  const tx = new Transaction();
  const { env } = require("@/lib/config");
  const packageId = env.sui.packageId;
  const marketId = env.sui.marketId;

  if (!packageId) throw new Error("Package ID not configured");
  if (!marketId) throw new Error("Market ID not configured");

  // Get asset coin types
  const getAssetCoinType = (assetName: string): string => {
    switch (assetName.toUpperCase()) {
      case "SUI":
        return "0x2::sui::SUI";
      case "USDC":
        return `${packageId}::mock_usdc::MOCK_USDC`;
      case "ETH":
        return `${packageId}::mock_eth::MOCK_ETH`;
      default:
        return `${packageId}::mock_usdc::MOCK_USDC`;
    }
  };

  tx.moveCall({
    target: `${packageId}::market::match_orders`,
    typeArguments: [
      getAssetCoinType(asset),
      getAssetCoinType(collateral),
    ],
    arguments: [
      tx.object(marketId),
      tx.object(enclaveId),
      tx.pure.address(lendOrderId),
      tx.pure.address(borrowOrderId),
      tx.pure.u64(fairnessScore),
      tx.pure.vector("u8", fairnessProof),
      tx.object("0x6"), // Clock object
    ],
  });

  return tx;
}
