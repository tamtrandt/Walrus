/**
 * Contract Configuration
 * Update these values with your deployed contract details
 */

// Read package ID from Vite env variable VITE_SEAL_PACKAGE_ID
// This is our deployed NFT contract package containing nft and seal_access modules
export const PACKAGE_ID: string = (import.meta.env.VITE_SEAL_PACKAGE_ID as string) || "0x1234567890abcdef";

export const CONTRACT_CONFIG = {
  // Package ID (read from env at build time)
  PACKAGE_ID,

  // Module name matching your Move module
  MODULE_NAME: "nft",

  // NFT struct name
  NFT_STRUCT: "TestnetNFT",

  // Gas budget (in MIST, where 1 SUI = 1e9 MIST)
  GAS_BUDGET: 30000000,
};

export const NFT_CONFIG = {
  // Name constraints
  MIN_NAME_LENGTH: 1,
  MAX_NAME_LENGTH: 100,
  
  // Description constraints
  MIN_DESCRIPTION_LENGTH: 1,
  MAX_DESCRIPTION_LENGTH: 500,
  
  // Image URL must be HTTPS
  IMAGE_URL_PATTERN: /^https:\/\/.+\.(png|jpg|jpeg|gif|webp|svg)$/i,
};

export const NETWORK_CONFIG = {
  // Networks
  NETWORKS: ["devnet", "testnet", "mainnet"] as const,
  
  // Default network
  DEFAULT_NETWORK: "testnet" as const,
};
