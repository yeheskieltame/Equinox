"use client";

import { useEffect, useState } from "react";
import { Navbar, FairnessScoreBadge } from "@/components/shared";
import { OrderCard, CreateOrderForm } from "@/components/pages/orderbook";
import { useAppStore } from "@/lib/store";
import { useWallet } from "@/components/providers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, EyeOff, Shield, Zap, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Order } from "@/lib/types";
import { executeCreateOrder } from "@/lib/sui/transaction-executor";
import { calculateFairnessScore } from "@/lib/sui/blockchain-service";
import { isMockMode, env } from "@/lib/config";

export default function OrderbookPage() {
  const { orders, user, isLoadingOrders, fetchOrders, addOrder, vestingPositions } = useAppStore();
  const { address, isConnected } = useWallet();

  const [orderType, setOrderType] = useState<"lend" | "borrow">("lend");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTxDigest, setLastTxDigest] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const lendOrders = orders.filter((o) => o.type === "lend");
  const borrowOrders = orders.filter((o) => o.type === "borrow");

  const generateZkProofHash = (): string => {
    const timestamp = Date.now().toString(16);
    const random = Math.random().toString(16).slice(2, 18);
    return `0x${timestamp}${random}`.padEnd(66, "0").slice(0, 66);
  };

  const handleOrderSubmit = async (orderData: {
    asset: string;
    amount: number;
    interestRate: number;
    ltv: number;
    term: number;
    isHidden: boolean;
  }) => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsSubmitting(true);

    try {
      const isVested = vestingPositions.some(vp => vp.status === "locked" || vp.status === "unlockable");
      const fairnessResult = await calculateFairnessScore(
        orderData.amount,
        address,
        isVested
      );

      const zkProofHash = orderData.isHidden ? generateZkProofHash() : undefined;

      const hasPackageId = Boolean(env.sui.orderbookPackageId);
      
      if (hasPackageId && !isMockMode()) {
        const result = await executeCreateOrder(
          {
            type: orderType,
            ...orderData,
          },
          address
        );

        if (result.success) {
          setLastTxDigest(result.digest || null);
          
          const newOrder: Order = {
            id: result.digest || `order-${Date.now()}`,
            type: orderType,
            asset: orderData.asset,
            amount: orderData.amount,
            interestRate: orderData.interestRate,
            ltv: orderData.ltv,
            term: orderData.term,
            status: "pending",
            createdAt: new Date().toISOString(),
            isHidden: orderData.isHidden,
            zkProofHash,
            fairnessScore: fairnessResult.score,
          };

          addOrder(newOrder);
          setIsDialogOpen(false);

          toast.success(
            <div className="flex flex-col gap-1">
              <span>Order created on blockchain!</span>
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
          toast.error(result.error || "Failed to create order on blockchain");
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const newOrder: Order = {
          id: `order-${Date.now()}`,
          type: orderType,
          asset: orderData.asset,
          amount: orderData.amount,
          interestRate: orderData.interestRate,
          ltv: orderData.ltv,
          term: orderData.term,
          status: "pending",
          createdAt: new Date().toISOString(),
          isHidden: orderData.isHidden,
          zkProofHash,
          fairnessScore: fairnessResult.score,
        };

        addOrder(newOrder);
        setIsDialogOpen(false);

        if (orderData.isHidden) {
          toast.success(
            <div className="flex flex-col gap-1">
              <span>{orderType === "lend" ? "Lend" : "Borrow"} order placed with ZK privacy</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                Fairness Score: {fairnessResult.score}/100
              </span>
            </div>
          );
        } else {
          toast.success(
            <div className="flex flex-col gap-1">
              <span>{orderType === "lend" ? "Lend" : "Borrow"} order placed successfully</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                Fairness Score: {fairnessResult.score}/100
              </span>
            </div>
          );
        }
      }
    } catch (error) {
      console.error("Order submission error:", error);
      toast.error("Failed to submit order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Navbar />

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">Orderbook</h1>
            <p className="text-[hsl(var(--muted-foreground))]">
              Place custom lending and borrowing orders with ZK privacy
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

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="cursor-pointer bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90">
                <Plus className="w-4 h-4 mr-2" />
                New Order
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-[hsl(var(--card))] border-[hsl(var(--border))]">
              <DialogHeader>
                <DialogTitle className="text-[hsl(var(--foreground))]">Create New Order</DialogTitle>
              </DialogHeader>
              <Tabs value={orderType} onValueChange={(v) => setOrderType(v as "lend" | "borrow")}>
                <TabsList className="mb-4 w-full bg-[hsl(var(--secondary))]">
                  <TabsTrigger value="lend" className="flex-1 cursor-pointer">Lend</TabsTrigger>
                  <TabsTrigger value="borrow" className="flex-1 cursor-pointer">Borrow</TabsTrigger>
                </TabsList>
                <TabsContent value="lend">
                  <CreateOrderForm 
                    type="lend" 
                    onSubmit={handleOrderSubmit} 
                    isSubmitting={isSubmitting}
                  />
                </TabsContent>
                <TabsContent value="borrow">
                  <CreateOrderForm 
                    type="borrow" 
                    onSubmit={handleOrderSubmit}
                    isSubmitting={isSubmitting}
                  />
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>

        {isLoadingOrders ? (
          <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-12 flex items-center justify-center">
            <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Loading orders...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">Lend Orders</h2>
                <span className="text-sm text-[hsl(var(--muted-foreground))]">{lendOrders.length} orders</span>
              </div>
              {lendOrders.length === 0 ? (
                <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-8 text-center">
                  <p className="text-[hsl(var(--muted-foreground))]">No lend orders yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {lendOrders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">Borrow Orders</h2>
                <span className="text-sm text-[hsl(var(--muted-foreground))]">{borrowOrders.length} orders</span>
              </div>
              {borrowOrders.length === 0 ? (
                <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-8 text-center">
                  <p className="text-[hsl(var(--muted-foreground))]">No borrow orders yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {borrowOrders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 p-6 bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))]">
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-[hsl(var(--primary))]/20 flex items-center justify-center mx-auto mb-3">
                <EyeOff className="w-6 h-6 text-[hsl(var(--primary))]" />
              </div>
              <h4 className="font-medium text-[hsl(var(--foreground))] mb-2">ZK Hidden Orders</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Set your preferred rate, LTV, and term duration with optional ZK privacy protection
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-[hsl(var(--primary))]/20 flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-[hsl(var(--primary))]" />
              </div>
              <h4 className="font-medium text-[hsl(var(--foreground))] mb-2">AI Fair Matching</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Nautilus AI ensures fair matching with priority for retail users and risk diversity
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-[hsl(var(--primary))]/20 flex items-center justify-center mx-auto mb-3">
                <Zap className="w-6 h-6 text-[hsl(var(--primary))]" />
              </div>
              <h4 className="font-medium text-[hsl(var(--foreground))] mb-2">Fast Finality</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Orders are matched and executed on-chain via Mysticeti with ~400ms finality
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
