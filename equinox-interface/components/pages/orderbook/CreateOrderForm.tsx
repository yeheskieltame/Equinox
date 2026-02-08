"use client";

import { useState, useEffect } from "react";
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
import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { getCoinType, getDecimalsForAsset } from "@/lib/sui/blockchain-service";

interface CreateOrderFormProps {
  type: "lend" | "borrow";
  onSubmit: (order: {
    asset: string;
    amount: number;
    interestRate: number;
    ltv: number;
    term: number;
    isHidden: boolean;
    coinObjectId?: string;
    collateralAmount?: number;
  }) => void;
  isSubmitting?: boolean;
}

export function CreateOrderForm({ type, onSubmit, isSubmitting = false }: CreateOrderFormProps) {
  const [asset, setAsset] = useState("USDC");
  const [amount, setAmount] = useState("");
  const [collateralAmount, setCollateralAmount] = useState("");
  const [interestRate, setInterestRate] = useState([4.5]);
  const [ltv, setLtv] = useState([70]);
  const [term, setTerm] = useState("30");
  const [isHidden, setIsHidden] = useState(false);
  
  // Balance info
  const [assetBalance, setAssetBalance] = useState<number>(0);
  const [collateralBalance, setCollateralBalance] = useState<number>(0);
  const [coinObjectId, setCoinObjectId] = useState<string | undefined>(undefined);

  // Constants for MVP
  const COLLATERAL_ASSET = "SUI"; 

  const suiClient = useSuiClient();
  const account = useCurrentAccount();

  // Fetch balances and coin objects
  useEffect(() => {
    const fetchInfo = async () => {
      if (!account?.address) return;
      
      try {
        // 1. Fetch Asset Balance (USDC/SUI)
        if (asset === "SUI") {
          const bal = await suiClient.getBalance({ owner: account.address, coinType: "0x2::sui::SUI" });
          setAssetBalance(Number(bal.totalBalance) / 1_000_000_000);
        } else {
          const coinType = getCoinType(asset);
          const coins = await suiClient.getCoins({ owner: account.address, coinType });
          const decimals = getDecimalsForAsset(asset);
          const total = coins.data.reduce((acc, c) => acc + (Number(c.balance) / Math.pow(10, decimals)), 0);
          setAssetBalance(total);
        }

        // 2. Fetch Collateral Balance (Fixed to SUI for MVP)
        const colBal = await suiClient.getBalance({ owner: account.address, coinType: "0x2::sui::SUI" });
        setCollateralBalance(Number(colBal.totalBalance) / 1_000_000_000);

        // 3. Determine Coin Object ID
        // For Lend: We need Asset Coin Object
        // For Borrow: We need Collateral Coin Object (SUI)
        
        let targetCoinType = "";
        let targetDecimals = 9;
        
        if (type === "lend") {
          if (asset === "SUI") {
            setCoinObjectId(undefined); // SUI split from gas
          } else {
            targetCoinType = getCoinType(asset);
            targetDecimals = getDecimalsForAsset(asset);
          }
        } else {
          // Borrow: Need Collateral Object (SUI)
          // SUI collateral is split from gas, so usually undefined if we use gas object
          // But wait, transactions.ts might need explicit coin for collateral if we don't use gas
          // Our buildBorrowOrderTx assumes SUI collateral is split from gas in buildCreateOrderTx?
          // Let's check buildCreateOrderTx in transactions.ts:
          // if (collateral === "SUI") { const [collateralCoin] = tx.splitCoins(tx.gas, [collateralAmount]); ... }
          // So for SUI collateral, we don't need coinObjectId.
          setCoinObjectId(undefined);
          return;
        }

        if (targetCoinType) {
           const coins = await suiClient.getCoins({ owner: account.address, coinType: targetCoinType });
           let bestCoinId = undefined;
           let maxBalance = 0;
           const divisor = Math.pow(10, targetDecimals);
           
           for (const coin of coins.data) {
             const bal = Number(coin.balance) / divisor;
             if (bal > maxBalance) {
               maxBalance = bal;
               bestCoinId = coin.coinObjectId;
             }
           }
           setCoinObjectId(bestCoinId);
        }

      } catch (error) {
        console.error("Error fetching balances:", error);
      }
    };

    fetchInfo();
  }, [asset, type, account?.address, suiClient]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    const amountNum = parseFloat(amount);

    if (type === "lend") {
      if (amountNum > assetBalance) {
        toast.error(`Insufficient ${asset} balance`);
        return;
      }
      if (asset !== "SUI" && !coinObjectId) {
        toast.error(`No suitable ${asset} coin found. Please mint some tokens.`);
        return;
      }
    } else {
      // Borrow
      if (!collateralAmount || parseFloat(collateralAmount) <= 0) {
        toast.error("Please enter a valid collateral amount");
        return;
      }
      const colAmountNum = parseFloat(collateralAmount);
      if (colAmountNum > collateralBalance) {
         toast.error(`Insufficient ${COLLATERAL_ASSET} collateral balance`);
         return;
      }
      // For MVP Market (USDC/SUI), Asset must be USDC
      if (asset === "SUI") {
        toast.error("Cannot borrow SUI with SUI collateral. Please select USDC.");
        return;
      }
    }

    onSubmit({
      asset,
      amount: amountNum,
      interestRate: interestRate[0],
      ltv: ltv[0],
      term: parseInt(term),
      isHidden,
      coinObjectId,
      collateralAmount: collateralAmount ? parseFloat(collateralAmount) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
          {type === "lend" ? "Asset to Lend" : "Asset to Borrow"}
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
                <span>USDC (Mock)</span>
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
          </SelectContent>
        </Select>
        {type === "lend" && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2 text-right">
            Balance: {assetBalance.toLocaleString()} {asset}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
          {type === "lend" ? "Lend Amount" : "Borrow Amount"}
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

      {type === "borrow" && (
        <div>
          <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
            Collateral Amount ({COLLATERAL_ASSET})
          </label>
          <div className="relative">
            <Input
              type="number"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              placeholder="0.00"
              className="pr-16 bg-[hsl(var(--secondary))] border-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[hsl(var(--muted-foreground))]">
              {COLLATERAL_ASSET}
            </span>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2 text-right">
            Balance: {collateralBalance.toLocaleString()} {COLLATERAL_ASSET}
          </p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-[hsl(var(--foreground))]">
            {type === "lend" ? "Min Interest Rate" : "Max Interest Rate"}
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
            {type === "lend" ? "Max LTV" : "Target LTV"}
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
        {type === "borrow" && amount && collateralAmount && (
           <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2 text-right">
             Implied LTV: {((parseFloat(amount) * 1 /* Assuming 1 USDC = 1 USD */) / (parseFloat(collateralAmount) * 1 /* Assuming 1 SUI = 1 USD for mock */) * 100).toFixed(2)}%
             <br/>
             <span className="text-[10px]">(Approximation based on mock prices)</span>
           </p>
        )}
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
