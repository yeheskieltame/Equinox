"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { formatNumber, formatPercentage } from "@/lib/utils/format";
import { Info } from "lucide-react";

interface DepositPanelProps {
  asset: string;
  balance: number;
  apy: number;
}

export function DepositPanel({ asset, balance, apy }: DepositPanelProps) {
  const { user, connectWallet,isConnecting } = useAppStore();

  return (
    <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-medium text-[hsl(var(--foreground))]">Deposit {asset}</h3>
        <div className="w-8 h-8 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
          <span className="text-xs font-bold text-[hsl(var(--primary-foreground))]">{asset.slice(0, 1)}</span>
        </div>
      </div>

      <div className="mb-6">
        <div className="text-4xl font-semibold text-[hsl(var(--foreground))] mb-1">0.00</div>
        <div className="text-sm text-[hsl(var(--muted-foreground))]">$0</div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between py-3 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--primary))]" />
            <span className="text-sm text-[hsl(var(--foreground))]">Deposit ({asset})</span>
          </div>
          <span className="text-sm text-[hsl(var(--muted-foreground))]">0.00</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-[hsl(var(--muted-foreground))]">APY</span>
          <span className="text-sm font-medium text-[hsl(var(--primary))]">{formatPercentage(apy)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-[hsl(var(--muted-foreground))]">Projected monthly earnings</span>
          <span className="text-sm text-[hsl(var(--foreground))]">$0.00</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-[hsl(var(--muted-foreground))]">Projected yearly earnings</span>
          <span className="text-sm text-[hsl(var(--foreground))]">$0.00</span>
        </div>
      </div>

      {user?.isConnected ? (
        <Button
          className="w-full h-12 cursor-pointer rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 font-medium"
        >
          Deposit
        </Button>
      ) : (
        <Button
          onClick={connectWallet}
          disabled={isConnecting}
          className="w-full h-12 cursor-pointer rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 font-medium"
        >
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </Button>
      )}
    </div>
  );
}
