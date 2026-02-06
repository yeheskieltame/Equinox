"use client";

import { useWallet } from "@/components/providers";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Wallet, Copy, LogOut, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

function formatAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ConnectButton() {
  const { isConnected, address, suiBalance, isConnecting, connect, disconnect } = useWallet();
  const { connectWallet, disconnectWallet, user } = useAppStore();

  useEffect(() => {
    if (isConnected && address && !user?.isConnected) {
      connectWallet();
    }
  }, [isConnected, address, user?.isConnected, connectWallet]);

  const handleConnect = async () => {
    await connect();
    await connectWallet();
  };

  const handleDisconnect = () => {
    disconnect();
    disconnectWallet();
    toast.success("Wallet disconnected");
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success("Address copied to clipboard");
    }
  };

  const openExplorer = () => {
    if (address) {
      window.open(`https://suiscan.xyz/testnet/account/${address}`, "_blank");
    }
  };

  if (isConnected && address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="cursor-pointer h-9 px-4 rounded-full text-sm border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/50 hover:bg-[hsl(var(--secondary))]"
          >
            <Wallet className="w-4 h-4 mr-2" />
            {formatAddress(address)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 bg-[hsl(var(--card))] border-[hsl(var(--border))]"
        >
          <div className="px-3 py-2">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Balance</p>
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">
              {suiBalance.toLocaleString()} SUI
            </p>
          </div>
          <DropdownMenuSeparator className="bg-[hsl(var(--border))]" />
          <DropdownMenuItem
            onClick={copyAddress}
            className="cursor-pointer text-[hsl(var(--foreground))] focus:bg-[hsl(var(--secondary))]"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Address
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={openExplorer}
            className="cursor-pointer text-[hsl(var(--foreground))] focus:bg-[hsl(var(--secondary))]"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View on Explorer
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[hsl(var(--border))]" />
          <DropdownMenuItem
            onClick={handleDisconnect}
            className="cursor-pointer text-[hsl(var(--destructive))] focus:bg-[hsl(var(--secondary))]"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      onClick={handleConnect}
      disabled={isConnecting}
      className="cursor-pointer h-9 px-4 rounded-full text-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
    >
      {isConnecting ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <Wallet className="w-4 h-4 mr-2" />
          Connect Wallet
        </>
      )}
    </Button>
  );
}
