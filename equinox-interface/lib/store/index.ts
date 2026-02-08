import { create } from "zustand";
import { isMockMode } from "@/lib/config";
import type {
  User,
  Order,
  Position,
  Vault,
  VestingPosition,
  MarketStats,
  MarketExposure,
  ChartDataPoint,
  PriceData,
} from "@/lib/types";
import {
  mockUser,
  mockOrders,
  mockPositions,
  mockVaults,
  mockVestingPositions,
} from "@/lib/data";
import {
  fetchBlockchainOrders,
  fetchBlockchainPositions,
  fetchBlockchainVestingPositions,
  fetchBlockchainStats,
  fetchBlockchainPrices,
  fetchMarketExposure,
  fetchApyHistory,
  fetchBorrowMarkets,
  fetchVaults,
  calculateFairnessScore,
} from "@/lib/sui/blockchain-service";

interface UserSlice {
  user: User | null;
  isConnecting: boolean;
  setUser: (user: User | null) => void;
  setIsConnecting: (isConnecting: boolean) => void;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

interface OrderSlice {
  orders: Order[];
  isLoadingOrders: boolean;
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (orderId: string, updates: Partial<Order>) => void;
  cancelOrder: (orderId: string) => void;
  fetchOrders: () => Promise<void>;
}

interface PositionSlice {
  positions: Position[];
  isLoadingPositions: boolean;
  setPositions: (positions: Position[]) => void;
  fetchPositions: () => Promise<void>;
}

interface VaultSlice {
  vaults: Vault[];
  isLoadingVaults: boolean;
  setVaults: (vaults: Vault[]) => void;
  fetchVaults: () => Promise<void>;
}

interface VestingSlice {
  vestingPositions: VestingPosition[];
  isLoadingVesting: boolean;
  setVestingPositions: (positions: VestingPosition[]) => void;
  addVestingPosition: (position: VestingPosition) => void;
  unlockVestingPosition: (positionId: string) => void;
  fetchVestingPositions: () => Promise<void>;
}

interface MarketSlice {
  stats: MarketStats;
  marketExposure: MarketExposure[];
  apyHistory: ChartDataPoint[];
  prices: PriceData[];
  borrowMarkets: { asset: string; available: number; borrowApr: number; maxLtv: number }[];
  isLoadingMarket: boolean;
  setStats: (stats: MarketStats) => void;
  setMarketExposure: (exposure: MarketExposure[]) => void;
  setApyHistory: (history: ChartDataPoint[]) => void;
  setPrices: (prices: PriceData[]) => void;
  fetchMarketData: () => Promise<void>;
  refreshPrices: () => Promise<void>;
}

type AppState = UserSlice & OrderSlice & PositionSlice & VaultSlice & VestingSlice & MarketSlice;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  isConnecting: false,
  orders: [],
  isLoadingOrders: false,
  positions: [],
  isLoadingPositions: false,
  vaults: [],
  isLoadingVaults: false,
  vestingPositions: [],
  isLoadingVesting: false,
  stats: {
    totalValueLocked: 0,
    totalLoans: 0,
    averageApy: 0,
    activeUsers: 0,
    totalMatched: 0,
    fairnessScore: 0,
    volume24h: 0,
  },
  marketExposure: [],
  apyHistory: [],
  prices: [],
  borrowMarkets: [],
  isLoadingMarket: false,

  setUser: (user) => set({ user }),
  setIsConnecting: (isConnecting) => set({ isConnecting }),

  connectWallet: async () => {
    set({ isConnecting: true });

    if (isMockMode()) {
      await delay(1500);
      set({
        user: mockUser,
        orders: mockOrders,
        positions: mockPositions,
        vestingPositions: mockVestingPositions,
        isConnecting: false,
      });
    } else {
      // In real mode, wallet connection is handled by SuiProvider
      // After connection, we need to fetch data
      set({ isConnecting: false });
      
      // Trigger data fetching - the actual wallet state comes from useWallet hook
      const { fetchOrders, fetchPositions, fetchVestingPositions, fetchMarketData } = get();
      await Promise.all([
        fetchOrders(),
        fetchPositions(),
        fetchVestingPositions(),
        fetchMarketData(),
      ]);
    }
  },

  disconnectWallet: () => {
    set({
      user: null,
      orders: [],
      positions: [],
      vestingPositions: [],
    });
  },

  setOrders: (orders) => set({ orders }),

  addOrder: async (order) => {
    const { orders, user, vestingPositions } = get();
    
    const isVested = vestingPositions.some(vp => vp.status === "locked" || vp.status === "unlockable");
    
    try {
      const fairnessResult = await calculateFairnessScore(
        order.amount,
        user?.address || "",
        isVested
      );
      
      const orderWithFairness = {
        ...order,
        fairnessScore: fairnessResult.score,
      };
      
      set({ orders: [orderWithFairness, ...orders] });
    } catch {
      set({ orders: [order, ...orders] });
    }
  },

  updateOrder: (orderId, updates) => {
    const { orders } = get();
    set({
      orders: orders.map((o) => (o.id === orderId ? { ...o, ...updates } : o)),
    });
  },

  cancelOrder: (orderId) => {
    const { orders } = get();
    set({
      orders: orders.map((o) => (o.id === orderId ? { ...o, status: "cancelled" as const } : o)),
    });
  },

  fetchOrders: async () => {
    const { user } = get();
    set({ isLoadingOrders: true });

    try {
      const orders = await fetchBlockchainOrders(user?.address || "");
      set({ orders, isLoadingOrders: false });
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      set({ isLoadingOrders: false });
    }
  },

  setPositions: (positions) => set({ positions }),

  fetchPositions: async () => {
    const { user } = get();
    set({ isLoadingPositions: true });

    try {
      const positions = await fetchBlockchainPositions(user?.address || "");
      set({ positions, isLoadingPositions: false });
    } catch (error) {
      console.error("Failed to fetch positions:", error);
      set({ isLoadingPositions: false });
    }
  },

  setVaults: (vaults) => set({ vaults }),

  fetchVaults: async () => {
    set({ isLoadingVaults: true });

    try {
      const vaults = await fetchVaults();
      set({ vaults, isLoadingVaults: false });
    } catch (error) {
      console.error("Failed to fetch vaults:", error);
      set({ isLoadingVaults: false });
    }
  },

  setVestingPositions: (vestingPositions) => set({ vestingPositions }),

  addVestingPosition: (position) => {
    const { vestingPositions } = get();
    set({ vestingPositions: [position, ...vestingPositions] });
  },

  unlockVestingPosition: (positionId) => {
    const { vestingPositions } = get();
    set({
      vestingPositions: vestingPositions.map((p) =>
        p.id === positionId ? { ...p, status: "unlocked" as const } : p
      ),
    });
  },

  fetchVestingPositions: async () => {
    const { user } = get();
    set({ isLoadingVesting: true });

    try {
      const vestingPositions = await fetchBlockchainVestingPositions(user?.address || "");
      set({ vestingPositions, isLoadingVesting: false });
    } catch (error) {
      console.error("Failed to fetch vesting positions:", error);
      set({ isLoadingVesting: false });
    }
  },

  setStats: (stats) => set({ stats }),
  setMarketExposure: (marketExposure) => set({ marketExposure }),
  setApyHistory: (apyHistory) => set({ apyHistory }),
  setPrices: (prices) => set({ prices }),

  fetchMarketData: async () => {
    set({ isLoadingMarket: true });

    try {
      const [stats, prices, marketExposure, apyHistory, borrowMarkets] = await Promise.all([
        fetchBlockchainStats(),
        fetchBlockchainPrices(),
        fetchMarketExposure(),
        fetchApyHistory(),
        fetchBorrowMarkets(),
      ]);

      set({
        stats,
        marketExposure,
        apyHistory,
        prices,
        borrowMarkets,
        isLoadingMarket: false,
      });
    } catch (error) {
      console.error("Failed to fetch market data:", error);
      set({ isLoadingMarket: false });
    }
  },

  refreshPrices: async () => {
    try {
      const prices = await fetchBlockchainPrices();
      set({ prices });
    } catch (error) {
      console.error("Failed to refresh prices:", error);
    }
  },
}));

