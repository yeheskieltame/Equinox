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
import { Switch } from "@/components/ui/switch";
import { EyeOff, Shield } from "lucide-react";
import { toast } from "sonner";

import Image from "next/image";

// ... existing imports ...

interface CreateOrderFormProps {
  type: "lend" | "borrow";
  onSubmit: (order: {
    asset: string;
    amount: number;
    interestRate: number;
    ltv: number;
    term: number;
    isHidden: boolean;
  }) => void;
  isSubmitting?: boolean;
}

export function CreateOrderForm({ type, onSubmit, isSubmitting = false }: CreateOrderFormProps) {
  const [asset, setAsset] = useState("USDC");
  const [amount, setAmount] = useState("");
  const [interestRate, setInterestRate] = useState([4.5]);
  const [ltv, setLtv] = useState([70]);
  const [term, setTerm] = useState("30");
  const [isHidden, setIsHidden] = useState(false);

  // ... handleSubmit ...

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    onSubmit({
      asset,
      amount: parseFloat(amount),
      interestRate: interestRate[0],
      ltv: ltv[0],
      term: parseInt(term),
      isHidden,
    });

    toast.success(`${type === "lend" ? "Lend" : "Borrow"} order created successfully`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
          Asset
        </label>
        <Select value={asset} onValueChange={setAsset}>
          <SelectTrigger className="w-full bg-[hsl(var(--secondary))] border-none cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USDC">
              <div className="flex items-center gap-2">
                <div className="relative w-5 h-5 rounded-full overflow-hidden">
                  <Image src="/token/usdc.png" alt="USDC" fill sizes="20px" className="object-cover" />
                </div>
                <span>USDC</span>
              </div>
            </SelectItem>
            <SelectItem value="SUI">
              <div className="flex items-center gap-2">
                <div className="relative w-5 h-5 rounded-full overflow-hidden">
                  <Image src="/token/sui.png" alt="SUI" fill sizes="20px" className="object-cover" />
                </div>
                <span>SUI</span>
              </div>
            </SelectItem>
            <SelectItem value="ETH">
              <div className="flex items-center gap-2">
                <div className="relative w-5 h-5 rounded-full overflow-hidden">
                  <Image src="/token/eth.png" alt="ETH" fill sizes="20px" className="object-cover" />
                </div>
                <span>ETH</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
          Amount
        </label>
        <div className="relative">
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="pr-16 bg-[hsl(var(--secondary))] border-none"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[hsl(var(--muted-foreground))]">
            {asset}
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-[hsl(var(--foreground))]">
            {type === "lend" ? "Min" : "Max"} Interest Rate
          </label>
          <span className="text-sm font-medium text-[hsl(var(--primary))]">
            {interestRate[0].toFixed(2)}%
          </span>
        </div>
        <Slider
          value={interestRate}
          onValueChange={setInterestRate}
          min={1}
          max={15}
          step={0.1}
          className="cursor-pointer"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-[hsl(var(--foreground))]">
            {type === "lend" ? "Max" : "Min"} LTV
          </label>
          <span className="text-sm font-medium text-[hsl(var(--foreground))]">
            {ltv[0]}%
          </span>
        </div>
        <Slider
          value={ltv}
          onValueChange={setLtv}
          min={30}
          max={90}
          step={5}
          className="cursor-pointer"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
          Term Duration
        </label>
        <Select value={term} onValueChange={setTerm}>
          <SelectTrigger className="w-full bg-[hsl(var(--secondary))] border-none cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="14">14 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="60">60 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between p-4 bg-[hsl(var(--secondary))] rounded-xl">
        <div className="flex items-center gap-3">
          <EyeOff className="w-5 h-5 text-[hsl(var(--primary))]" />
          <div>
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">ZK Hidden Order</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Keep your order private until matched
            </p>
          </div>
        </div>
        <Switch
          checked={isHidden}
          onCheckedChange={setIsHidden}
          className="cursor-pointer"
        />
      </div>

      <div className="flex items-center gap-2 p-4 bg-[hsl(var(--accent))]/10 rounded-xl">
        <Shield className="w-5 h-5 text-[hsl(var(--accent))]" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          AI Fairness matching ensures priority for retail users
        </p>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full cursor-pointer bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
      >
        {isSubmitting ? "Submitting..." : `Place ${type === "lend" ? "Lend" : "Borrow"} Order`}
      </Button>
    </form>
  );
}
