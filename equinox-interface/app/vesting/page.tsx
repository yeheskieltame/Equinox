"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/shared";
import { VestingDepositForm, VestingPositionCard } from "@/components/pages/vesting";
import { useAppStore } from "@/lib/store";
import { useWallet } from "@/components/providers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils/format";
import { Lock, Sparkles, Shield, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { VestingPosition } from "@/lib/types";
import { executeLockVesting, executeUnlockVesting } from "@/lib/sui/transaction-executor";
import { isMockMode, env } from "@/lib/config";

export default function VestingPage() {
  const {
    vestingPositions,
    user,
    isLoadingVesting,
    fetchVestingPositions,
    addVestingPosition,
    unlockVestingPosition,
  } = useAppStore();

  const { address, isConnected } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTxDigest, setLastTxDigest] = useState<string | null>(null);

  useEffect(() => {
    fetchVestingPositions();
  }, [fetchVestingPositions]);

  const activePositions = vestingPositions.filter((p) => p.status !== "unlocked");
  const unlockedPositions = vestingPositions.filter((p) => p.status === "unlocked");

  const totalLocked = activePositions.reduce((acc, p) => acc + p.amount, 0);
  const totalEarned = vestingPositions.reduce((acc, p) => acc + p.earnedRewards, 0);
  const hasActiveLock = activePositions.length > 0;

  const handleDeposit = async (data: { amount: number; lockDuration: number }) => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsSubmitting(true);

    try {
      const subsidyRate = data.lockDuration >= 365 ? 3.5 : data.lockDuration >= 180 ? 2.5 : data.lockDuration >= 90 ? 1.5 : 0.5;
      const baseApy = 4.5;

      const hasPackageId = Boolean(env.sui.vestingVaultPackageId);

      if (hasPackageId && !isMockMode()) {
        const result = await executeLockVesting(
          {
            amount: data.amount,
            lockDurationDays: data.lockDuration,
          },
          address
        );

        if (result.success) {
          setLastTxDigest(result.digest || null);

          const newPosition: VestingPosition = {
            id: result.digest || `vest-${Date.now()}`,
            amount: data.amount,
            lockDate: new Date().toISOString(),
            unlockDate: new Date(Date.now() + data.lockDuration * 24 * 60 * 60 * 1000).toISOString(),
            apy: baseApy + subsidyRate,
            subsidyRate,
            earnedRewards: 0,
            status: "locked",
            zkProofVerified: true,
          };

          addVestingPosition(newPosition);

          toast.success(
            <div className="flex flex-col gap-1">
              <span>Locked {formatNumber(data.amount)} SUI for {data.lockDuration} days</span>
              {result.digest && (
                <a
                  href={`https://suiscan.xyz/testnet/tx/${result.digest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                >
                  View transaction <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          );
        } else {
          toast.error(result.error || "Failed to lock tokens on blockchain");
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const newPosition: VestingPosition = {
          id: `vest-${Date.now()}`,
          amount: data.amount,
          lockDate: new Date().toISOString(),
          unlockDate: new Date(Date.now() + data.lockDuration * 24 * 60 * 60 * 1000).toISOString(),
          apy: baseApy + subsidyRate,
          subsidyRate,
          earnedRewards: 0,
          status: "locked",
          zkProofVerified: true,
        };

        addVestingPosition(newPosition);

        toast.success(
          <div className="flex flex-col gap-1">
            <span>Locked {formatNumber(data.amount)} SUI for {data.lockDuration} days</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              APY: {(baseApy + subsidyRate).toFixed(1)}% (includes {subsidyRate}% subsidy)
            </span>
          </div>
        );
      }
    } catch (error) {
      console.error("Lock vesting error:", error);
      toast.error("Failed to lock tokens. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlock = async (positionId: string) => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsSubmitting(true);

    try {
      const hasPackageId = Boolean(env.sui.vestingVaultPackageId);

      if (hasPackageId && !isMockMode()) {
        const result = await executeUnlockVesting(positionId, address);

        if (result.success) {
          setLastTxDigest(result.digest || null);
          unlockVestingPosition(positionId);

          toast.success(
            <div className="flex flex-col gap-1">
              <span>Tokens unlocked successfully</span>
              {result.digest && (
                <a
                  href={`https://suiscan.xyz/testnet/tx/${result.digest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                >
                  View transaction <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          );
        } else {
          toast.error(result.error || "Failed to unlock tokens on blockchain");
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        unlockVestingPosition(positionId);
        toast.success("Tokens unlocked successfully");
      }
    } catch (error) {
      console.error("Unlock vesting error:", error);
      toast.error("Failed to unlock tokens. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Navbar />

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">Vesting Vault</h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            Lock vested tokens to earn subsidy yield and get priority matching
          </p>
          {lastTxDigest && (
            <a
              href={`https://suiscan.xyz/testnet/tx/${lastTxDigest}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[hsl(var(--primary))] hover:underline flex items-center gap-1 mt-2"
            >
              Last transaction: {lastTxDigest.slice(0, 16)}... <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--primary))]/20 flex items-center justify-center">
                <Lock className="w-5 h-5 text-[hsl(var(--primary))]" />
              </div>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Total Locked</span>
            </div>
            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
              {formatNumber(totalLocked)} SUI
            </p>
          </div>

          <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--accent))]/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-[hsl(var(--accent))]" />
              </div>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Total Earned</span>
            </div>
            <p className="text-2xl font-bold text-[hsl(var(--accent))]">
              +{formatNumber(totalEarned)} SUI
            </p>
          </div>

          <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--success))]/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[hsl(var(--success))]" />
              </div>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Priority Status</span>
            </div>
            <p className={`text-2xl font-bold ${hasActiveLock ? "text-[hsl(var(--success))]" : "text-[hsl(var(--muted-foreground))]"}`}>
              {hasActiveLock ? "Active" : "Inactive"}
            </p>
          </div>

          <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--warning))]/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-[hsl(var(--warning))]" />
              </div>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Active Locks</span>
            </div>
            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
              {activePositions.filter((p) => p.status === "locked").length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs defaultValue="positions" className="w-full">
              <TabsList className="mb-6 bg-[hsl(var(--secondary))]">
                <TabsTrigger value="positions" className="cursor-pointer">Your Positions</TabsTrigger>
                <TabsTrigger value="history" className="cursor-pointer">History</TabsTrigger>
              </TabsList>

              <TabsContent value="positions">
                {isLoadingVesting ? (
                  <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-12 flex items-center justify-center">
                    <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Loading positions...</div>
                  </div>
                ) : activePositions.length === 0 ? (
                  <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-12 text-center">
                    <p className="text-[hsl(var(--muted-foreground))] mb-4">
                      You have no locked vesting positions
                    </p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      Lock your vested SUI to earn subsidy yield
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activePositions.map((position) => (
                      <VestingPositionCard
                        key={position.id}
                        position={position}
                        onUnlock={position.status === "unlockable" ? handleUnlock : undefined}
                        isSubmitting={isSubmitting}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history">
                {unlockedPositions.length === 0 ? (
                  <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-8 text-center">
                    <p className="text-[hsl(var(--muted-foreground))]">No unlock history yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {unlockedPositions.map((position) => (
                      <VestingPositionCard key={position.id} position={position} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <VestingDepositForm onSubmit={handleDeposit} isSubmitting={isSubmitting} />
          </div>
        </div>

        <div className="mt-8 p-6 bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))]">
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Benefits of Vesting Vault</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="w-5 h-5 text-[hsl(var(--accent))]" />
                <h4 className="font-medium text-[hsl(var(--foreground))]">Subsidy Yield</h4>
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Earn additional APY on top of base lending yield by locking vested tokens
              </p>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-[hsl(var(--success))]" />
                <h4 className="font-medium text-[hsl(var(--foreground))]">Priority Matching</h4>
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Get priority in order matching for better rates and faster execution
              </p>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Lock className="w-5 h-5 text-[hsl(var(--primary))]" />
                <h4 className="font-medium text-[hsl(var(--foreground))]">Ecosystem Stability</h4>
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Reduce sell pressure and contribute to Sui ecosystem stability
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
