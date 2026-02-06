export type AppMode = "mock" | "real";

export interface EnvConfig {
  appMode: AppMode;
  sui: {
    network: "mainnet" | "testnet" | "devnet";
    rpcUrl: string;
    orderbookPackageId: string;
    loanObjectPackageId: string;
    vestingVaultPackageId: string;
  };
  zkLogin: {
    googleClientId: string;
    redirectUrl: string;
  };
  priceOracle: "pyth" | "supra";
  features: {
    zkOrders: boolean;
    aiMatching: boolean;
    vestingVault: boolean;
  };
}

export const env: EnvConfig = {
  appMode: (process.env.NEXT_PUBLIC_APP_MODE as AppMode) || "mock",
  sui: {
    network: (process.env.NEXT_PUBLIC_SUI_NETWORK as "mainnet" | "testnet" | "devnet") || "testnet",
    rpcUrl: process.env.NEXT_PUBLIC_SUI_RPC_URL || "https://fullnode.testnet.sui.io:443",
    orderbookPackageId: process.env.NEXT_PUBLIC_ORDERBOOK_PACKAGE_ID || "",
    loanObjectPackageId: process.env.NEXT_PUBLIC_LOAN_OBJECT_PACKAGE_ID || "",
    vestingVaultPackageId: process.env.NEXT_PUBLIC_VESTING_VAULT_PACKAGE_ID || "",
  },
  zkLogin: {
    googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
    redirectUrl: process.env.NEXT_PUBLIC_REDIRECT_URL || "http://localhost:3000/auth/callback",
  },
  priceOracle: (process.env.NEXT_PUBLIC_PRICE_ORACLE as "pyth" | "supra") || "pyth",
  features: {
    zkOrders: process.env.NEXT_PUBLIC_ENABLE_ZK_ORDERS === "true",
    aiMatching: process.env.NEXT_PUBLIC_ENABLE_AI_MATCHING === "true",
    vestingVault: process.env.NEXT_PUBLIC_ENABLE_VESTING_VAULT === "true",
  },
};

export const isMockMode = (): boolean => env.appMode === "mock";
export const isRealMode = (): boolean => env.appMode === "real";
