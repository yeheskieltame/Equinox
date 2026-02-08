"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/shared";
import { VaultTable, VaultFilters } from "@/components/pages/earn";
import { useAppStore } from "@/lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EarnPage() {
  const { vaults, positions, isLoadingVaults, fetchVaults, fetchPositions } = useAppStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [depositFilter, setDepositFilter] = useState("all");
  const [curatorFilter, setCuratorFilter] = useState("all");

  useEffect(() => {
    fetchVaults();
    fetchPositions();
  }, [fetchVaults, fetchPositions]);

  const lendingPositions = positions.filter((p) => p.type === "lending");

  const filteredVaults = vaults.filter((vault) => {
    const matchesSearch = vault.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDeposit = depositFilter === "all" || vault.asset.toLowerCase() === depositFilter;
    const matchesCurator =
      curatorFilter === "all" ||
      (curatorFilter === "verified" && vault.curatorVerified) ||
      (curatorFilter === "community" && !vault.curatorVerified);
    return matchesSearch && matchesDeposit && matchesCurator;
  });

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Navbar />

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">Earn</h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            Deposit assets into vaults to earn yield through lending
          </p>
        </div>

        <Tabs defaultValue="vaults" className="w-full">
          <TabsList className="mb-6 bg-[hsl(var(--secondary))]">
            <TabsTrigger value="positions" className="cursor-pointer">Your positions</TabsTrigger>
            <TabsTrigger value="vaults" className="cursor-pointer">Vaults</TabsTrigger>
          </TabsList>

          <TabsContent value="positions">
            {lendingPositions.length === 0 ? (
              <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-12 text-center">
                <p className="text-[hsl(var(--muted-foreground))] mb-4">
                  You have no active lending positions
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Deposit assets into a vault to start earning yield
                </p>
              </div>
            ) : (
              <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))]">
                      <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">Asset</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">Amount</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">APY</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">Earned</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lendingPositions.map((pos) => (
                      <tr key={pos.id} className="border-b border-[hsl(var(--border))] last:border-b-0">
                        <td className="px-6 py-4 text-sm text-[hsl(var(--foreground))]">{pos.asset}</td>
                        <td className="px-6 py-4 text-sm text-[hsl(var(--foreground))]">${pos.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-[hsl(var(--primary))]">{pos.interestRate}%</td>
                        <td className="px-6 py-4 text-sm text-[hsl(var(--success))]">+${pos.earnedInterest?.toLocaleString() || 0}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs rounded-full bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]">
                            {pos.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="vaults">
            <VaultFilters
              onSearch={setSearchQuery}
              onDepositFilter={setDepositFilter}
              onCuratorFilter={setCuratorFilter}
            />
            {isLoadingVaults ? (
              <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-12 flex items-center justify-center">
                <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Loading vaults...</div>
              </div>
            ) : filteredVaults.length === 0 ? (
              <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-12 text-center">
                <p className="text-[hsl(var(--muted-foreground))] mb-2">
                  No vaults available yet
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Vaults will be created when lenders deposit assets into the protocol
                </p>
              </div>
            ) : (
              <VaultTable vaults={filteredVaults} />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
