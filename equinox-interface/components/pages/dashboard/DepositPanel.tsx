"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { useWallet } from "@/components/providers";
import { formatNumber, formatPercentage } from "@/lib/utils/format";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { fetchUserCoins, getCoinType } from "@/lib/sui/blockchain-service";
import { toast } from "sonner";

interface DepositPanelProps {
  asset: string;
  balance: number;
  apy: number;
}

export function DepositPanel({ asset, apy }: DepositPanelProps) {
  const { connectWallet, isConnecting } = useAppStore();
  const { address, isConnected } = useWallet();
  const [depositAmount, setDepositAmount] = useState("");
  const [userBalance, setUserBalance] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Fetch user's balance for the asset
  useEffect(() => {
    if (isConnected && address) {
      setIsLoadingBalance(true);
      fetchUserCoins(address, getCoinType(asset)).then((coins) => {
        const total = coins.reduce((acc, coin) => acc + coin.balance, 0);
        setUserBalance(total);
        setIsLoadingBalance(false);
      });
    } else {
      setUserBalance(0);
    }
  }, [isConnected, address, asset]);

  const amount = parseFloat(depositAmount || "0");
  const monthlyEarnings = amount * (apy / 100) / 12;
  const yearlyEarnings = amount * (apy / 100);

  const handleMaxClick = () => {
    if (userBalance > 0) {
      setDepositAmount(userBalance.toString());
    }
  };

  const handleDeposit = () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }
    if (amount <= 0) {
      toast.error("Please enter an amount");
      return;
    }
    if (amount > userBalance) {
      toast.error("Insufficient balance");
      return;
    }
    // TODO: Implement deposit transaction
    toast.info("Deposit feature coming soon");
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl">
      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-medium text-[hsl(var(--foreground))]">Deposit {asset}</h3>
          <div className="relative w-8 h-8 rounded-full overflow-hidden">
            <Image 
              src={`/token/${asset.toLowerCase()}.png`} 
              alt={asset} 
              fill 
              className="object-cover" 
            />
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.00"
              className="text-2xl font-semibold bg-transparent border-none p-0 h-auto focus-visible:ring-0"
            />
            {isConnected && userBalance > 0 && (
              <button
                type="button"
                onClick={handleMaxClick}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-[hsl(var(--primary))] hover:underline cursor-pointer px-2 py-1 rounded bg-[hsl(var(--secondary))]"
              >
                MAX
              </button>
            )}
          </div>
          <div className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Balance: {isLoadingBalance ? "..." : formatNumber(userBalance)} {asset}
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between py-3 border-b border-[hsl(var(--border))]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[hsl(var(--primary))]" />
              <span className="text-sm text-[hsl(var(--foreground))]">Deposit ({asset})</span>
            </div>
            <span className="text-sm text-[hsl(var(--muted-foreground))]">{formatNumber(amount)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">APY</span>
            <span className="text-sm font-medium text-[hsl(var(--primary))]">{formatPercentage(apy)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Projected monthly earnings</span>
            <span className="text-sm text-[hsl(var(--foreground))]">${formatNumber(monthlyEarnings)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Projected yearly earnings</span>
            <span className="text-sm text-[hsl(var(--foreground))]">${formatNumber(yearlyEarnings)}</span>
          </div>
        </div>
      </div>

      {isConnected ? (
        <Button
          onClick={handleDeposit}
          disabled={amount <= 0 || amount > userBalance}
          className="w-full h-12 cursor-pointer rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 font-medium disabled:opacity-50"
        >
          Deposit
        </Button>
      ) : (
        <Button
          onClick={connectWallet}
          disabled={isConnecting}
          className="w-full h-12 cursor-pointer rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 font-medium"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            "Connect Wallet"
          )}
        </Button>
      )}
    </div>
  );
}
