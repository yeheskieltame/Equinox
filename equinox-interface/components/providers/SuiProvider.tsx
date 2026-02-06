"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isMockMode } from "@/lib/config";
import { 
  initZkLoginSession, 
  getGoogleLoginUrl, 
  getStoredSession,
  getStoredUserAddress,
  setStoredUserAddress,
  clearZkLoginSession,
  isZkLoginSupported,
  parseJwtPayload,
  completeZkLogin,
  getStoredKeyPair,
  getStoredJwt,
  getStoredZkProof,
  getStoredSalt,
  type ZkProof,
} from "@/lib/sui/zklogin";
import { getSuiClient } from "@/lib/sui/client";
import { toast } from "sonner";

interface UserInfo {
  email?: string;
  name?: string;
  picture?: string;
}

interface WalletContextValue {
  isConnected: boolean;
  address: string | null;
  suiBalance: number;
  isConnecting: boolean;
  userInfo: UserInfo | null;
  zkProof: ZkProof | null;
  salt: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  getSignatureInputs: () => {
    jwt: string | null;
    salt: string | null;
    proof: ZkProof | null;
    maxEpoch: number | null;
    randomness: string | null;
  };
}

const WalletContext = createContext<WalletContextValue>({
  isConnected: false,
  address: null,
  suiBalance: 0,
  isConnecting: false,
  userInfo: null,
  zkProof: null,
  salt: null,
  connect: async () => {},
  disconnect: () => {},
  refreshBalance: async () => {},
  getSignatureInputs: () => ({ jwt: null, salt: null, proof: null, maxEpoch: null, randomness: null }),
});

export function useWallet() {
  return useContext(WalletContext);
}

function WalletContextProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [suiBalance, setSuiBalance] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [zkProof, setZkProof] = useState<ZkProof | null>(null);
  const [salt, setSalt] = useState<string | null>(null);

  const fetchBalance = useCallback(async (userAddress: string) => {
    if (isMockMode()) {
      setSuiBalance(50000);
      return;
    }

    try {
      const client = getSuiClient();
      const balance = await client.getBalance({
        owner: userAddress,
        coinType: "0x2::sui::SUI",
      });
      setSuiBalance(Number(balance.totalBalance) / 1_000_000_000);
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      setSuiBalance(0);
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (address) {
      await fetchBalance(address);
    }
  }, [address, fetchBalance]);

  const getSignatureInputs = useCallback(() => {
    const session = getStoredSession();
    return {
      jwt: getStoredJwt(),
      salt: getStoredSalt(),
      proof: getStoredZkProof(),
      maxEpoch: session?.maxEpoch ?? null,
      randomness: session?.randomness ?? null,
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const authSuccess = urlParams.get("auth");
    
    if (authSuccess === "success") {
      const jwt = sessionStorage.getItem("equinox_jwt");
      if (jwt) {
        handleAuthSuccess(jwt);
      }
    } else {
      restoreSession();
    }
  }, [fetchBalance]);

  async function handleAuthSuccess(jwt: string) {
    setIsConnecting(true);
    try {
      const payload = parseJwtPayload(jwt);
      
      setUserInfo({
        email: payload.email as string,
        name: payload.name as string,
        picture: payload.picture as string,
      });

      const result = await completeZkLogin(jwt);
      
      setAddress(result.address);
      setSalt(result.salt);
      setIsConnected(true);
      
      if (result.proof) {
        setZkProof(result.proof);
      }
      
      await fetchBalance(result.address);
      
      toast.success(`Welcome, ${payload.name || payload.email || "User"}!`);
      
      window.history.replaceState({}, "", "/");
    } catch (error) {
      console.error("Failed to process auth:", error);
      toast.error("Authentication failed. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  }

  function restoreSession() {
    const storedAddress = getStoredUserAddress();
    const storedSalt = getStoredSalt();
    const storedProof = getStoredZkProof();
    
    if (storedAddress) {
      setAddress(storedAddress);
      setIsConnected(true);
      setSalt(storedSalt);
      setZkProof(storedProof);
      fetchBalance(storedAddress);
      
      const storedEmail = sessionStorage.getItem("equinox_user_email");
      const storedName = sessionStorage.getItem("equinox_user_name");
      const storedPicture = sessionStorage.getItem("equinox_user_picture");
      
      if (storedEmail || storedName) {
        setUserInfo({
          email: storedEmail || undefined,
          name: storedName || undefined,
          picture: storedPicture || undefined,
        });
      }
    }
  }

  const connect = async () => {
    setIsConnecting(true);
    try {
      if (isMockMode()) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const mockAddress = "0x7a4b9c8d2e1f3a6b5c4d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b";
        setAddress(mockAddress);
        setIsConnected(true);
        setSuiBalance(50000);
        setStoredUserAddress(mockAddress);
        setUserInfo({
          email: "demo@equinox.fi",
          name: "Demo User",
        });
        toast.success("Connected with demo wallet");
      } else {
        if (!isZkLoginSupported()) {
          toast.error("zkLogin is not configured. Please set up Google OAuth credentials.");
          return;
        }

        try {
          const client = getSuiClient();
          const { epoch } = await client.getLatestSuiSystemState();
          const maxEpoch = Number(epoch) + 10;
          
          const session = await initZkLoginSession(maxEpoch);
          
          const loginUrl = getGoogleLoginUrl(session.nonce);
          
          window.location.href = loginUrl;
        } catch (error) {
          console.error("zkLogin initialization failed:", error);
          toast.error("Failed to initialize zkLogin. Please try again.");
        }
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setIsConnected(false);
    setSuiBalance(0);
    setUserInfo(null);
    setZkProof(null);
    setSalt(null);
    clearZkLoginSession();
    toast.success("Wallet disconnected");
  };

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        address,
        suiBalance,
        isConnecting,
        userInfo,
        zkProof,
        salt,
        connect,
        disconnect,
        refreshBalance,
        getSignatureInputs,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

interface SuiProviderProps {
  children: ReactNode;
}

export function SuiProvider({ children }: SuiProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletContextProvider>{children}</WalletContextProvider>
    </QueryClientProvider>
  );
}
