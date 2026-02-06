"use client";

import { useEffect } from "react";
import { Navbar } from "@/components/shared";
import { BorrowForm, BorrowPositionCard } from "@/components/pages/borrow";
import { useAppStore } from "@/lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils/format";
import { toast } from "sonner";

export default function BorrowPage() {
  const {
    positions,
    borrowMarkets,
    prices,
    isLoadingPositions,
    isLoadingMarket,
    fetchPositions,
    fetchMarketData,
    user,
  } = useAppStore();

  useEffect(() => {
    fetchPositions();
    fetchMarketData();
  }, [fetchPositions, fetchMarketData]);

  const borrowPositions = positions.filter((p) => p.type === "borrowing");

  const getPrice = (asset: string) => {
    const priceData = prices.find((p) => p.asset === asset);
    return priceData?.price || 0;
  };

  const handleBorrowSubmit = (data: {
    collateralAsset: string;
    collateralAmount: number;
    borrowAsset: string;
    borrowAmount: number;
    ltv: number;
  }) => {
    if (!user?.isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }
    toast.success(`Borrow order created: ${formatNumber(data.borrowAmount)} ${data.borrowAsset}`);
  };

  const handleRepay = (positionId: string) => {
    if (!user?.isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }
    toast.success("Repayment initiated");
  };

  const handleAddCollateral = (positionId: string) => {
    if (!user?.isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }
    toast.success("Add collateral dialog opened");
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Navbar />

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">Borrow</h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            Deposit collateral and borrow assets with custom terms
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs defaultValue="positions" className="w-full">
              <TabsList className="mb-6 bg-[hsl(var(--secondary))]">
                <TabsTrigger value="positions" className="cursor-pointer">Your Positions</TabsTrigger>
                <TabsTrigger value="markets" className="cursor-pointer">Markets</TabsTrigger>
              </TabsList>

              <TabsContent value="positions">
                {isLoadingPositions ? (
                  <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-12 flex items-center justify-center">
                    <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Loading positions...</div>
                  </div>
                ) : borrowPositions.length === 0 ? (
                  <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-12 text-center">
                    <p className="text-[hsl(var(--muted-foreground))] mb-4">
                      You have no active borrow positions
                    </p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      Create a borrow position using the form on the right
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {borrowPositions.map((position) => (
                      <BorrowPositionCard
                        key={position.id}
                        position={position}
                        collateralAsset={position.collateralAsset || "SUI"}
                        collateralAmount={position.collateralAmount || 0}
                        currentPrice={getPrice(position.collateralAsset || "SUI")}
                        liquidationPrice={position.liquidationPrice || 0}
                        onRepay={handleRepay}
                        onAddCollateral={handleAddCollateral}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="markets">
                {isLoadingMarket ? (
                  <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-12 flex items-center justify-center">
                    <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Loading markets...</div>
                  </div>
                ) : (
                  <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-6">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[hsl(var(--border))]">
                            <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">Asset</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">Available</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">Borrow APR</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">Max LTV</th>
                          </tr>
                        </thead>
                        <tbody>
                          {borrowMarkets.map((market) => (
                            <tr key={market.asset} className="border-b border-[hsl(var(--border))] last:border-b-0">
                              <td className="px-4 py-4 text-sm text-[hsl(var(--foreground))]">{market.asset}</td>
                              <td className="px-4 py-4 text-sm text-[hsl(var(--foreground))]">${formatNumber(market.available)}</td>
                              <td className="px-4 py-4 text-sm text-[hsl(var(--warning))]">{market.borrowApr}%</td>
                              <td className="px-4 py-4 text-sm text-[hsl(var(--foreground))]">{market.maxLtv}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <BorrowForm onSubmit={handleBorrowSubmit} />
          </div>
        </div>
      </main>
    </div>
  );
}
