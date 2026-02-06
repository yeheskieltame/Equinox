"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, ArrowRight, Shield } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, formatPercentage } from "@/lib/utils/format";

import Image from "next/image";

// ... existing imports ...

interface BorrowFormProps {
  onSubmit: (data: {
    collateralAsset: string;
    collateralAmount: number;
    borrowAsset: string;
    borrowAmount: number;
    ltv: number;
  }) => void;
}

export function BorrowForm({ onSubmit }: BorrowFormProps) {
  const [collateralAsset, setCollateralAsset] = useState("SUI");
  const [collateralAmount, setCollateralAmount] = useState("");
  const [borrowAsset, setBorrowAsset] = useState("USDC");
  const [ltv, setLtv] = useState([65]);

  const collateralPrice = collateralAsset === "SUI" ? 2.45 : collateralAsset === "WETH" ? 2500 : 1;
  const collateralValue = parseFloat(collateralAmount || "0") * collateralPrice;
  const maxBorrow = collateralValue * (ltv[0] / 100);
  const liquidationPrice = maxBorrow / (parseFloat(collateralAmount || "1") * 0.8);

  const healthFactor = ltv[0] < 50 ? "healthy" : ltv[0] < 70 ? "moderate" : "risky";

  // ... handleSubmit ...
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!collateralAmount || parseFloat(collateralAmount) <= 0) {
      toast.error("Please enter a valid collateral amount");
      return;
    }

    onSubmit({
      collateralAsset,
      collateralAmount: parseFloat(collateralAmount),
      borrowAsset,
      borrowAmount: maxBorrow,
      ltv: ltv[0],
    });

    toast.success("Borrow position created successfully");
  };

  return (
    <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-6">
      <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-6">Borrow</h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
            Collateral
          </label>
          <div className="flex gap-3">
            <Select value={collateralAsset} onValueChange={setCollateralAsset}>
              <SelectTrigger className="w-[140px] bg-[hsl(var(--secondary))] border-none cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SUI">
                  <div className="flex items-center gap-2">
                    <div className="relative w-5 h-5 rounded-full overflow-hidden">
                      <Image src="/token/sui.png" alt="SUI" fill className="object-cover" />
                    </div>
                    <span>SUI</span>
                  </div>
                </SelectItem>
                <SelectItem value="USDC">
                  <div className="flex items-center gap-2">
                    <div className="relative w-5 h-5 rounded-full overflow-hidden">
                      <Image src="/token/usdc.png" alt="USDC" fill className="object-cover" />
                    </div>
                    <span>USDC</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-[hsl(var(--secondary))] border-none"
            />
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
            Value: ${formatNumber(collateralValue)}
          </p>
        </div>

        <div className="flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-[hsl(var(--secondary))] flex items-center justify-center">
            <ArrowRight className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
            Borrow
          </label>
          <div className="flex gap-3">
            <Select value={borrowAsset} onValueChange={setBorrowAsset}>
              <SelectTrigger className="w-[140px] bg-[hsl(var(--secondary))] border-none cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USDC">
                  <div className="flex items-center gap-2">
                    <div className="relative w-5 h-5 rounded-full overflow-hidden">
                      <Image src="/token/usdc.png" alt="USDC" fill className="object-cover" />
                    </div>
                    <span>USDC</span>
                  </div>
                </SelectItem>
                <SelectItem value="SUI">
                  <div className="flex items-center gap-2">
                    <div className="relative w-5 h-5 rounded-full overflow-hidden">
                      <Image src="/token/sui.png" alt="SUI" fill className="object-cover" />
                    </div>
                    <span>SUI</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1 px-4 py-2 bg-[hsl(var(--secondary))] rounded-md flex items-center">
              <span className="text-[hsl(var(--foreground))]">
                {formatNumber(maxBorrow)}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[hsl(var(--foreground))]">
              Loan-to-Value (LTV)
            </label>
            <span className={`text-sm font-medium ${
              healthFactor === "healthy" 
                ? "text-[hsl(var(--success))]" 
                : healthFactor === "moderate"
                ? "text-[hsl(var(--warning))]"
                : "text-[hsl(var(--destructive))]"
            }`}>
              {ltv[0]}%
            </span>
          </div>
          <Slider
            value={ltv}
            onValueChange={setLtv}
            min={20}
            max={85}
            step={5}
            className="cursor-pointer"
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-[hsl(var(--success))]">Safe</span>
            <span className="text-xs text-[hsl(var(--warning))]">Moderate</span>
            <span className="text-xs text-[hsl(var(--destructive))]">Risky</span>
          </div>
        </div>

        <div className="space-y-3 p-4 bg-[hsl(var(--secondary))] rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Liquidation Price</span>
            <span className="text-sm font-medium text-[hsl(var(--foreground))]">
              ${formatNumber(liquidationPrice)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Borrow APR</span>
            <span className="text-sm font-medium text-[hsl(var(--warning))]">
              5.2%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Health Factor</span>
            <span className={`text-sm font-medium ${
              healthFactor === "healthy" 
                ? "text-[hsl(var(--success))]" 
                : healthFactor === "moderate"
                ? "text-[hsl(var(--warning))]"
                : "text-[hsl(var(--destructive))]"
            }`}>
              {healthFactor === "healthy" ? "Healthy" : healthFactor === "moderate" ? "Moderate" : "At Risk"}
            </span>
          </div>
        </div>

        {healthFactor === "risky" && (
          <div className="flex items-center gap-2 p-4 bg-[hsl(var(--destructive))]/10 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-[hsl(var(--destructive))]" />
            <p className="text-sm text-[hsl(var(--destructive))]">
              High LTV increases liquidation risk
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 p-4 bg-[hsl(var(--primary))]/10 rounded-xl">
          <Shield className="w-5 h-5 text-[hsl(var(--primary))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Orders matched via AI fairness scoring for best rates
          </p>
        </div>

        <Button
          type="submit"
          className="w-full cursor-pointer bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
        >
          Create Borrow Position
        </Button>
      </form>
    </div>
  );
}
