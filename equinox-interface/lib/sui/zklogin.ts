import { generateNonce, generateRandomness, getZkLoginSignature } from "@mysten/sui/zklogin";
import { jwtToAddress } from "@mysten/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { env } from "@/lib/config";

const STORAGE_KEYS = {
  EPHEMERAL_KEYPAIR: "equinox_ephemeral_keypair",
  RANDOMNESS: "equinox_randomness",
  NONCE: "equinox_nonce",
  MAX_EPOCH: "equinox_max_epoch",
  JWT: "equinox_jwt",
  ZK_PROOF: "equinox_zk_proof",
  USER_ADDRESS: "equinox_user_address",
  USER_SALT: "equinox_user_salt",
} as const;

const PROVER_URL = "https://prover-dev.mystenlabs.com/v1";
const SALT_SERVICE_URL = "https://salt.api.mystenlabs.com/get_salt";

export interface ZkLoginSession {
  ephemeralPublicKey: string;
  nonce: string;
  randomness: string;
  maxEpoch: number;
}

export interface ZkLoginUser {
  address: string;
  email?: string;
  name?: string;
  picture?: string;
}

export interface ZkProof {
  proofPoints: {
    a: string[];
    b: string[][];
    c: string[];
  };
  issBase64Details: {
    value: string;
    indexMod4: number;
  };
  headerBase64: string;
  addressSeed: string;
}

export function generateEphemeralKeyPair(): Ed25519Keypair {
  return new Ed25519Keypair();
}

export function getStoredKeyPair(): Ed25519Keypair | null {
  if (typeof window === "undefined") return null;
  
  const secretKey = sessionStorage.getItem(STORAGE_KEYS.EPHEMERAL_KEYPAIR);
  if (!secretKey) return null;
  
  try {
    return Ed25519Keypair.fromSecretKey(secretKey);
  } catch {
    return null;
  }
}

export async function initZkLoginSession(maxEpoch: number): Promise<ZkLoginSession> {
  const ephemeralKeyPair = generateEphemeralKeyPair();
  const randomness = generateRandomness();
  const nonce = generateNonce(ephemeralKeyPair.getPublicKey(), maxEpoch, randomness);

  if (typeof window !== "undefined") {
    const secretKey = ephemeralKeyPair.getSecretKey();
    sessionStorage.setItem(STORAGE_KEYS.EPHEMERAL_KEYPAIR, secretKey);
    sessionStorage.setItem(STORAGE_KEYS.RANDOMNESS, randomness);
    sessionStorage.setItem(STORAGE_KEYS.NONCE, nonce);
    sessionStorage.setItem(STORAGE_KEYS.MAX_EPOCH, maxEpoch.toString());
  }

  return {
    ephemeralPublicKey: ephemeralKeyPair.getPublicKey().toBase64(),
    nonce,
    randomness,
    maxEpoch,
  };
}

export function getGoogleLoginUrl(nonce: string): string {
  const clientId = env.zkLogin.googleClientId;
  const redirectUrl = env.zkLogin.redirectUrl;

  if (!clientId) {
    throw new Error("Google Client ID is not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUrl,
    response_type: "id_token",
    scope: "openid email profile",
    nonce: nonce,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function parseJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  
  const payload = parts[1];
  const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(decoded);
}

export function extractIdTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get("id_token");
}

export function getStoredSession(): Partial<ZkLoginSession> | null {
  if (typeof window === "undefined") return null;

  const randomness = sessionStorage.getItem(STORAGE_KEYS.RANDOMNESS);
  const nonce = sessionStorage.getItem(STORAGE_KEYS.NONCE);
  const maxEpochStr = sessionStorage.getItem(STORAGE_KEYS.MAX_EPOCH);
  const keypairData = sessionStorage.getItem(STORAGE_KEYS.EPHEMERAL_KEYPAIR);

  if (!randomness || !nonce || !maxEpochStr || !keypairData) {
    return null;
  }

  return {
    randomness,
    nonce,
    maxEpoch: parseInt(maxEpochStr, 10),
  };
}

export function getStoredUserAddress(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.USER_ADDRESS);
}

export function setStoredUserAddress(address: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.USER_ADDRESS, address);
  }
}

export function getStoredSalt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.USER_SALT);
}

export function setStoredSalt(salt: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.USER_SALT, salt);
  }
}

export function getStoredJwt(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STORAGE_KEYS.JWT);
}

export function setStoredJwt(jwt: string): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEYS.JWT, jwt);
  }
}

export function getStoredZkProof(): ZkProof | null {
  if (typeof window === "undefined") return null;
  const proof = sessionStorage.getItem(STORAGE_KEYS.ZK_PROOF);
  return proof ? JSON.parse(proof) : null;
}

export function setStoredZkProof(proof: ZkProof): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEYS.ZK_PROOF, JSON.stringify(proof));
  }
}

export function clearZkLoginSession(): void {
  if (typeof window === "undefined") return;

  Object.values(STORAGE_KEYS).forEach((key) => {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  });
}

export function isZkLoginSupported(): boolean {
  return Boolean(env.zkLogin.googleClientId);
}

export async function fetchSalt(jwt: string): Promise<string> {
  const payload = parseJwtPayload(jwt);
  const sub = payload.sub as string;
  const aud = payload.aud as string;
  
  const storedSalt = getStoredSalt();
  if (storedSalt) {
    return storedSalt;
  }
  
  try {
    const response = await fetch(SALT_SERVICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: jwt,
      }),
    });

    if (!response.ok) {
      console.warn("Salt service unavailable, generating deterministic salt");
      const deterministicSalt = generateDeterministicSalt(sub, aud);
      setStoredSalt(deterministicSalt);
      return deterministicSalt;
    }

    const data = await response.json();
    const salt = data.salt;
    setStoredSalt(salt);
    return salt;
  } catch (error) {
    console.warn("Salt service error, generating deterministic salt:", error);
    const deterministicSalt = generateDeterministicSalt(sub, aud);
    setStoredSalt(deterministicSalt);
    return deterministicSalt;
  }
}

function generateDeterministicSalt(sub: string, aud: string): string {
  const input = `${sub}:${aud}:equinox-hackathon-2026`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return BigInt(Math.abs(hash)).toString();
}

export async function deriveZkLoginAddress(jwt: string, salt: string): Promise<string> {
  const payload = parseJwtPayload(jwt);
  const iss = payload.iss as string;
  const aud = payload.aud as string;
  
  try {
    const address = jwtToAddress(jwt, salt);
    return address;
  } catch (error) {
    console.error("Error deriving zkLogin address:", error);
    throw new Error("Failed to derive zkLogin address");
  }
}

export async function fetchZkProof(
  jwt: string,
  salt: string,
  ephemeralPublicKey: string,
  maxEpoch: number,
  randomness: string
): Promise<ZkProof> {
  const storedProof = getStoredZkProof();
  if (storedProof) {
    return storedProof;
  }

  try {
    const response = await fetch(PROVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jwt,
        extendedEphemeralPublicKey: ephemeralPublicKey,
        maxEpoch,
        jwtRandomness: randomness,
        salt,
        keyClaimName: "sub",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("Prover service error:", errorText);
      throw new Error(`Prover service error: ${response.status}`);
    }

    const proof = await response.json() as ZkProof;
    setStoredZkProof(proof);
    return proof;
  } catch (error) {
    console.error("Failed to fetch ZK proof:", error);
    throw error;
  }
}

export async function completeZkLogin(jwt: string): Promise<{
  address: string;
  salt: string;
  proof?: ZkProof;
}> {
  const salt = await fetchSalt(jwt);
  const address = await deriveZkLoginAddress(jwt, salt);
  
  setStoredUserAddress(address);
  setStoredJwt(jwt);

  const session = getStoredSession();
  let proof: ZkProof | undefined;
  
  if (session?.randomness && session?.maxEpoch) {
    const keypair = getStoredKeyPair();
    if (keypair) {
      try {
        proof = await fetchZkProof(
          jwt,
          salt,
          keypair.getPublicKey().toBase64(),
          session.maxEpoch,
          session.randomness
        );
      } catch (error) {
        console.warn("ZK proof generation skipped for demo:", error);
      }
    }
  }

  return { address, salt, proof };
}

export { jwtToAddress, getZkLoginSignature };
