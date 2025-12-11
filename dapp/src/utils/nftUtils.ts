/**
 * NFT Related Utilities
 */

import { NFT_CONFIG } from "./config";

export interface NFTFormData {
  name: string;
  description: string;
  imageUrl: string;
}

/**
 * Validate NFT form data
 */
export function validateNFTForm(formData: NFTFormData): {
  valid: boolean;
  error?: string;
} {
  // Validate name
  if (!formData.name.trim()) {
    return { valid: false, error: "NFT name is required" };
  }

  if (formData.name.length > NFT_CONFIG.MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: `NFT name must be ${NFT_CONFIG.MAX_NAME_LENGTH} characters or less`,
    };
  }

  // Validate description
  if (!formData.description.trim()) {
    return { valid: false, error: "Description is required" };
  }

  if (formData.description.length > NFT_CONFIG.MAX_DESCRIPTION_LENGTH) {
    return {
      valid: false,
      error: `Description must be ${NFT_CONFIG.MAX_DESCRIPTION_LENGTH} characters or less`,
    };
  }

  // Validate image URL
  if (!formData.imageUrl.trim()) {
    return { valid: false, error: "Image URL is required" };
  }

  if (!formData.imageUrl.startsWith("https://")) {
    return { valid: false, error: "Image URL must start with https://" };
  }

  return { valid: true };
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string, chars = 6): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format transaction digest
 */
export function shortenDigest(digest: string, chars = 10): string {
  return `${digest.slice(0, chars)}...${digest.slice(-chars)}`;
}

/**
 * Extract NFT data from Sui object
 */
export function extractNFTData(objectData: any) {
  try {
    const fields = objectData?.content?.fields || {};
    return {
      name: fields.name || "Unnamed NFT",
      description: fields.description || "No description",
      url: fields.url || "",
      id: objectData.objectId,
    };
  } catch {
    return null;
  }
}

/**
 * Check if URL is a valid image
 */
export function isValidImageUrl(url: string): boolean {
  try {
    new URL(url);
    return url.startsWith("https://");
  } catch {
    return false;
  }
}
