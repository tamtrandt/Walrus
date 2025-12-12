/// ========================================================================================
/// 🎨 NFT GALLERY COMPONENT - Pay-to-View NFT Display & Decryption
/// ========================================================================================
///
/// This component displays user's NFT collection and handles the decryption process
/// for pay-to-view encrypted NFTs.
///
/// COMPLETE USER FLOW:
/// 1. User sees encrypted NFT thumbnail
/// 2. Clicks "Decrypt & View" button
/// 3. Signs authorization message in wallet
/// 4. Pays 0.005 SUI (first time only per content)
/// 5. Seal SDK decrypts content using threshold cryptography
/// 6. User can view decrypted image unlimited times
///
/// TECHNICAL FLOW:
/// - Fetch encrypted data from Walrus
/// - Create SessionKey for authorization
/// - Build PTB calling seal_access::seal_approve
/// - Seal decrypts using session key + transaction
/// - Display decrypted image
///
/// PAYMENT TRACKING:
/// - Uses PaymentRegistry shared object
/// - Tracks per content (blob ID) and per user
/// - One-time payment per user per content
///
import { useCurrentAccount, useSuiClientQuery, useSignPersonalMessage } from "@mysten/dapp-kit";
import { Box, Container, Flex, Heading, Text, Button, Card } from "@radix-ui/themes";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { useState, useEffect } from "react";
import { SuiClient } from "@mysten/sui/client";
import { SealClient, SessionKey } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";
import "../styles/NFTGallery.css";
import { PACKAGE_ID } from "../utils/config";
const MODULE_NAME = "nft";

const AGGREGATOR = (import.meta.env.VITE_AGGREGATOR as string) || "";

// Seal Configuration
const PAYMENT_REGISTRY_ID = (import.meta.env.VITE_PAYMENT_REGISTRY_ID as string) || "";

/**
 * Convert a Walrus blob ID to a full aggregator URL.
 * Example: "UIFoThEcXvPR0dKz_9wBEhsNv1oeTJU4gxTzjzL8SDQ" 
 * becomes "https://aggregator.walrus-testnet.walrus.space/v1/blobs/UIFoThEcXvPR0dKz_9wBEhsNv1oeTJU4gxTzjzL8SDQ"
 */
function getWalrusImageUrl(blobId: string): string {
  if (!AGGREGATOR || !blobId) return "";
  const base = AGGREGATOR.endsWith("/") ? AGGREGATOR.slice(0, -1) : AGGREGATOR;
  return `${base}/v1/blobs/${blobId}`;
}

export function NFTGallery() {
  const account = useCurrentAccount();
  const [sealClient, setSealClient] = useState<SealClient | null>(null);

  // Initialize SealClient
  useEffect(() => {
    const initSealClient = async () => {
      // Get key servers inside useEffect to avoid dependency issues
      const SEAL_KEY_SERVERS = (import.meta.env.VITE_SEAL_KEY_SERVERS as string)?.split(",") || [];

      if (!SEAL_KEY_SERVERS.length) {
        console.warn("No Seal key servers configured");
        return;
      }

      try {
        const suiClient = new SuiClient({ url: "https://fullnode.testnet.sui.io:443" });

        const client = new SealClient({
          suiClient,
          serverConfigs: SEAL_KEY_SERVERS.map(id => ({
            objectId: id.trim(),
            weight: 1
          })),
          // Remove verifyKeyServers to use default
        });

        setSealClient(client);
        console.log("✅ SealClient initialized in Gallery");
      } catch (error) {
        console.error("❌ Failed to initialize SealClient in Gallery:", error);
      }
    };

    initSealClient();
  }, []); // Remove SEAL_KEY_SERVERS from dependencies

  const { data, isPending, error, refetch } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address as string,
      filter: {
        StructType: `${PACKAGE_ID}::${MODULE_NAME}::TestnetNFT`,
      },
      options: {
        showContent: true,
      },
        },
        {
          enabled: !!account && !!PACKAGE_ID && PACKAGE_ID !== "0x1234567890abcdef",
        },
  );

  if (!account) {
    return (
      <Container className="gallery-container">
        <Box className="wallet-not-connected-message">
          <Flex direction="column" align="center" gap="3">
            <ExclamationTriangleIcon width="48" height="48" color="var(--red-11)" />
            <Heading size="5">Wallet Not Connected</Heading>
            <Text color="gray">Please connect your wallet to view your NFTs</Text>
          </Flex>
        </Box>
      </Container>
    );
  }

  if (!PACKAGE_ID || PACKAGE_ID === "0x1234567890abcdef") {
    return (
      <Container className="gallery-container">
        <Box p="4" style={{
          backgroundColor: "#fff4e6",
          borderRadius: "8px",
          borderLeft: "4px solid #f0c36a",
        }}>
          <Flex direction="column" gap="2">
            <Heading size="4">⚠️ Configuration Required</Heading>
            <Text size="2" style={{ color: "#8b7300" }}>
              PACKAGE_ID is not configured. Set `VITE_SEAL_PACKAGE_ID` in your `.env` to view NFTs.
            </Text>
          </Flex>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="gallery-container">
        <Box p="4" style={{
          backgroundColor: "var(--red-2)",
          borderRadius: "8px",
          borderLeft: "4px solid var(--red-10)",
        }}>
          <Flex direction="column" gap="2">
            <Heading size="4">Error Loading NFTs</Heading>
            <Text size="2" color="red">{error.message}</Text>
          </Flex>
        </Box>
      </Container>
    );
  }

  if (isPending) {
    return (
      <Container className="gallery-container">
        <Flex direction="column" align="center" gap="3" py="4">
          <div className="spinner" />
          <Text color="gray">Loading your NFT collection...</Text>
        </Flex>
      </Container>
    );
  }

  const nfts = data?.data || [];

  return (
    <Container className="gallery-container">
      <Flex direction="column" gap="4">
        <Flex justify="between" align="center">
          <Heading size="5">
            📚 Your NFT Collection ({nfts.length})
          </Heading>
          <Button
            onClick={() => refetch()}
            variant="outline"
            disabled={isPending}
          >
            🔄 Refresh
          </Button>
        </Flex>

        {nfts.length === 0 ? (
          <Box p="4" style={{
            backgroundColor: "var(--gray-2)",
            borderRadius: "8px",
            textAlign: "center",
          }}>
            <Text color="gray" size="2">
              You haven't created any NFTs yet. Go to the Create NFT tab to mint your first one!
            </Text>
          </Box>
        ) : (
          <div className="nft-grid">
            {nfts.map((nft) => (
              <NFTCard key={nft.data?.objectId} nft={nft as any} sealClient={sealClient} account={account} />
            ))}
          </div>
        )}
      </Flex>
    </Container>
  );
}

interface NFTData {
  data?: {
    objectId: string;
    content?: {
      fields?: {
        name?: string;
        description?: string;
        url?: string;
      };
      dataType?: string;
    };
  };
}

function NFTCard({ nft, sealClient, account }: { nft: NFTData; sealClient: SealClient | null; account: any }) {
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [decryptedImageUrl, setDecryptedImageUrl] = useState<string>("");
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string>("");

  const objectId = nft.data?.objectId || "";
  const fields = nft.data?.content?.fields || {};
  const name = (fields.name as string) || "Unnamed NFT";
  const description = (fields.description as string) || "No description";
  const encryptedBlobId = (fields.url as string) || "";

  const handleDecrypt = async () => {
    if (!sealClient || !encryptedBlobId || !account) {
      setDecryptError("Seal client not available, no encrypted blob ID, or wallet not connected");
      return;
    }

    if (!PAYMENT_REGISTRY_ID) {
      setDecryptError("Payment registry ID not configured. Please set VITE_PAYMENT_REGISTRY_ID in your .env file");
      return;
    }

    setIsDecrypting(true);
    setDecryptError("");

    // Set up global error handler for unhandled promise rejections
    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      console.error("⚠️ Unhandled promise rejection detected:", event.reason);
      console.error("Rejection reason type:", typeof event.reason);
      console.error("Rejection reason value:", event.reason);
      // Don't prevent default - let it log to console
    };
    
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);

    try {
      // ========================================================================================
      // 🔐 SEAL DECRYPTION FLOW - Pay-to-view NFT system
      // ========================================================================================
      // This implements a pay-once system where users pay 0.005 SUI to view encrypted images
      // After payment, they can view the same image unlimited times without paying again

      // Step 1: Fetch encrypted blob from Walrus decentralized storage
      console.log("📥 Fetching encrypted data from Walrus...");
      const blobUrl = getWalrusImageUrl(encryptedBlobId);
      if (!blobUrl) {
        throw new Error("Invalid blob ID or aggregator URL not configured");
      }
      console.log("📥 Fetching from URL:", blobUrl);
      
      const response = await fetch(blobUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch encrypted blob: ${response.status} ${response.statusText}`);
      }

      const encryptedBytes = new Uint8Array(await response.arrayBuffer());
      console.log("📦 Fetched encrypted data, length:", encryptedBytes.length);
      
      if (encryptedBytes.length === 0) {
        throw new Error("Fetched encrypted blob is empty");
      }

      // Step 2: Create SessionKey for user authorization
      // SessionKey enables time-limited access to decryption keys
      const suiClient = new SuiClient({ url: "https://fullnode.testnet.sui.io:443" });

      if (!PACKAGE_ID || PACKAGE_ID === "0x1234567890abcdef") {
        throw new Error("Package ID not configured. Please set VITE_SEAL_PACKAGE_ID in your .env file");
      }

      console.log("🔓 Creating SessionKey for decryption authorization...");
      console.log("Using package ID:", PACKAGE_ID);
      console.log("Using address:", account.address);
      
      let sessionKey: SessionKey;
      try {
        sessionKey = await SessionKey.create({
          address: account.address,
          packageId: PACKAGE_ID, // Our NFT package containing seal_access module
          ttlMin: 10, // 10 minutes access time
          suiClient,
        });
        console.log("✅ SessionKey created successfully");
      } catch (sessionKeyError) {
        console.error("❌ Failed to create SessionKey:", sessionKeyError);
        throw new Error(`Failed to create SessionKey: ${sessionKeyError instanceof Error ? sessionKeyError.message : String(sessionKeyError)}`);
      }

      // Step 3: Get user authorization via wallet signature
      // This proves the user approves the decryption request
      const message = sessionKey.getPersonalMessage();
      console.log("📝 Requesting user authorization via wallet signature...");
      console.log("Message to sign:", message);

      let signature: string;
      try {
        const result = await signPersonalMessage({
          message: message, // Use string directly
        });
        signature = result.signature;
        console.log("✅ Personal message signed successfully");
      } catch (signError) {
        console.error("❌ Failed to sign personal message:", signError);
        throw new Error(`Wallet signature failed: ${signError instanceof Error ? signError.message : String(signError)}`);
      }

      sessionKey.setPersonalMessageSignature(signature);

      // Step 4: Build Programmable Transaction Block (PTB) for Seal approval
      // The PTB calls our seal_access::seal_approve function
      console.log("🔨 Building transaction for payment verification...");
      const tx = new Transaction();

      // Get user's SUI coins for payment (0.005 SUI required)
      const coins = await suiClient.getCoins({
        owner: account.address,
        coinType: "0x2::sui::SUI",
      });

      if (!coins.data.length) {
        throw new Error("No SUI coins found in wallet");
      }

      // Use the first available coin for payment
      const paymentCoin = coins.data[0];

      // Convert blob ID to bytes for content identification
      const contentIdBytes = new TextEncoder().encode(encryptedBlobId);

      // Call seal_access::seal_approve with:
      // - content_id: The identity (MUST BE FIRST PARAMETER per Seal docs)
      // - PaymentRegistry: Shared object tracking all payments
      // - fee_coin: Reference to user's payment coin
      console.log("Building transaction with:", {
        target: `${PACKAGE_ID}::seal_access::seal_approve`,
        contentIdLength: contentIdBytes.length,
        paymentRegistryId: PAYMENT_REGISTRY_ID,
        paymentCoinId: paymentCoin.coinObjectId,
        paymentCoinBalance: paymentCoin.balance,
      });
      
      tx.moveCall({
        target: `${PACKAGE_ID}::seal_access::seal_approve`,
        arguments: [
          tx.pure.vector("u8", contentIdBytes), // Content ID (identity) - FIRST PARAMETER
          tx.object(PAYMENT_REGISTRY_ID), // Payment registry shared object (tracks who paid for what)
          tx.object(paymentCoin.coinObjectId), // User's payment coin reference (owned object)
        ],
      });

      // Build transaction bytes for Seal evaluation
      // Seal SDK needs transaction bytes for evaluation (onlyTransactionKind: true)
      // This creates a transaction that can be evaluated without execution
      let txBytes: Uint8Array;
      try {
        console.log("Building transaction bytes for Seal evaluation...");
        console.log("Transaction details:", {
          target: `${PACKAGE_ID}::seal_access::seal_approve`,
          hasPaymentRegistry: !!PAYMENT_REGISTRY_ID,
          hasPaymentCoin: !!paymentCoin.coinObjectId,
        });
        
        // Build with onlyTransactionKind: true for Seal evaluation
        // Seal SDK evaluates the transaction to check if it would succeed
        txBytes = await tx.build({ 
          client: suiClient, 
          onlyTransactionKind: true 
        });
        
        console.log("📋 Transaction built successfully for Seal evaluation");
        console.log("Transaction bytes length:", txBytes.length);
        console.log("Transaction bytes (first 50 bytes):", Array.from(txBytes.slice(0, 50)));
        
        if (!txBytes || txBytes.length === 0) {
          throw new Error("Transaction bytes are empty after building");
        }
        
        // Verify transaction bytes are valid Uint8Array
        if (!(txBytes instanceof Uint8Array)) {
          throw new Error(`Transaction bytes are not Uint8Array, got: ${typeof txBytes}`);
        }
      } catch (buildError) {
        console.error("❌ Failed to build transaction:", buildError);
        console.error("Build error details:", {
          error: buildError,
          type: typeof buildError,
          message: buildError instanceof Error ? buildError.message : String(buildError),
        });
        throw new Error(`Failed to build transaction: ${buildError instanceof Error ? buildError.message : String(buildError)}`);
      }

      // Step 5: Decrypt the image using Seal SDK
      // Seal evaluates the transaction and grants access if payment is valid
      console.log("🔓 Decrypting image with Seal...");
      console.log("Encrypted data length:", encryptedBytes.length);
      console.log("Transaction bytes length:", txBytes.length);
      
      // Validate inputs before decrypt
      if (!encryptedBytes || encryptedBytes.length === 0) {
        throw new Error("Encrypted data is empty or invalid");
      }
      if (!sessionKey) {
        throw new Error("SessionKey is not initialized");
      }
      if (!txBytes || txBytes.length === 0) {
        throw new Error("Transaction bytes are empty or invalid");
      }
      
      // Log session key details for debugging
      try {
        const sessionKeyMessage = sessionKey.getPersonalMessage();
        console.log("SessionKey message:", sessionKeyMessage);
        console.log("SessionKey type:", typeof sessionKey);
      } catch (skError) {
        console.warn("Could not inspect SessionKey:", skError);
      }
      
      let decrypted: Uint8Array;
      try {
        console.log("Calling sealClient.decrypt with:", {
          dataLength: encryptedBytes.length,
          txBytesLength: txBytes.length,
          sessionKeyType: typeof sessionKey,
          sealClientType: typeof sealClient,
          sealClientExists: !!sealClient,
        });
        
        // Validate all inputs before calling decrypt
        if (!sealClient) {
          throw new Error("SealClient is null or undefined");
        }
        if (!encryptedBytes || encryptedBytes.length === 0) {
          throw new Error("Encrypted bytes are invalid");
        }
        if (!sessionKey) {
          throw new Error("SessionKey is invalid");
        }
        if (!txBytes || txBytes.length === 0) {
          throw new Error("Transaction bytes are invalid");
        }
        
        // Call decrypt with explicit promise error handling
        console.log("Starting decrypt call...");
        let decryptPromise: Promise<Uint8Array>;
        
        try {
          // Try to call decrypt - catch any synchronous errors
          decryptPromise = sealClient.decrypt({
            data: encryptedBytes,        // Encrypted image data from Walrus
            sessionKey,                  // User's authorization token
            txBytes,                     // Transaction proving payment validity
          });
          console.log("Decrypt promise created successfully");
        } catch (syncError) {
          console.error("Synchronous error when calling decrypt:", syncError);
          throw new Error(`Synchronous error in decrypt call: ${syncError instanceof Error ? syncError.message : String(syncError)}`);
        }
        
        if (!decryptPromise || typeof decryptPromise.then !== 'function') {
          throw new Error("decrypt() did not return a promise");
        }
        
        console.log("Decrypt promise created, awaiting result...");
        
        // Add explicit catch handler to the promise to see what's being rejected
        const decryptWithErrorHandling = decryptPromise.catch((error) => {
          console.error("Promise rejection caught in .catch():", error);
          console.error("Rejection type:", typeof error);
          console.error("Rejection value:", error);
          console.error("Rejection === undefined:", error === undefined);
          // Re-throw with more context
          if (error === undefined || error === null) {
            throw new Error("Seal SDK rejected promise with undefined/null. This may indicate a network error, CORS issue, or SDK bug.");
          }
          throw error;
        });
        
        decrypted = await decryptWithErrorHandling;
        console.log("Decrypt promise resolved successfully");
        
        if (!decrypted) {
          throw new Error("Decryption returned null or undefined");
        }
        
        if (decrypted.length === 0) {
          throw new Error("Decryption returned empty result");
        }
        
        console.log("✅ Decryption successful, decrypted data length:", decrypted.length);
      } catch (decryptError: unknown) {
        // Comprehensive error logging - handle all possible error types
        console.error("❌ Seal decrypt failed - Raw error:", decryptError);
        console.error("Error type:", typeof decryptError);
        console.error("Error value:", decryptError);
        console.error("Error === undefined:", decryptError === undefined);
        console.error("Error === null:", decryptError === null);
        console.error("Error instanceof Error:", decryptError instanceof Error);
        
        // Log the error in multiple ways to catch any structure
        try {
          console.error("Error stringified:", JSON.stringify(decryptError, null, 2));
        } catch (e) {
          console.error("Could not stringify error:", e);
        }
        
        try {
          console.error("Error toString:", String(decryptError));
        } catch (e) {
          console.error("Could not convert error to string:", e);
        }
        
        if (decryptError instanceof Error) {
          console.error("Error message:", decryptError.message);
          console.error("Error stack:", decryptError.stack);
          console.error("Error name:", decryptError.name);
        }
        
        // Try to extract error from various possible structures
        const errorObj = decryptError as any;
        if (errorObj && typeof errorObj === "object") {
          console.error("Error object keys:", Object.keys(errorObj));
          
          // Check for common error properties
          if (errorObj.message) console.error("errorObj.message:", errorObj.message);
          if (errorObj.error) console.error("errorObj.error:", errorObj.error);
          if (errorObj.reason) console.error("errorObj.reason:", errorObj.reason);
          if (errorObj.code) console.error("errorObj.code:", errorObj.code);
          if (errorObj.details) console.error("errorObj.details:", errorObj.details);
          if (errorObj.status) console.error("errorObj.status:", errorObj.status);
          if (errorObj.statusText) console.error("errorObj.statusText:", errorObj.statusText);
        }
        
        // Create a more informative error message
        let errorMessage = "Seal decryption failed";
        
        if (decryptError === undefined) {
          errorMessage = "Seal decryption failed: Error was undefined. This may indicate a network issue or SDK error. Check browser console and network tab.";
        } else if (decryptError === null) {
          errorMessage = "Seal decryption failed: Error was null";
        } else if (decryptError instanceof Error) {
          errorMessage = `Seal decryption failed: ${decryptError.message || decryptError.name || "Unknown error"}`;
        } else if (errorObj?.message) {
          errorMessage = `Seal decryption failed: ${errorObj.message}`;
        } else if (errorObj?.error?.message) {
          errorMessage = `Seal decryption failed: ${errorObj.error.message}`;
        } else if (errorObj?.reason) {
          errorMessage = `Seal decryption failed: ${errorObj.reason}`;
        } else if (typeof decryptError === "string") {
          errorMessage = `Seal decryption failed: ${decryptError}`;
        } else {
          errorMessage = `Seal decryption failed: ${String(decryptError)}`;
        }
        
        console.error("Final error message:", errorMessage);
        throw new Error(errorMessage);
      }

      // Step 6: Create viewable image from decrypted data
      const blob = new Blob([new Uint8Array(decrypted)]);
      const url = URL.createObjectURL(blob);
      setDecryptedImageUrl(url);

      console.log("✅ Image decrypted and ready for viewing!");
      console.log("💰 Payment verified - user can now view this image unlimited times");

    } catch (error) {
      // Extract error message from various error types
      let errorMessage = "Decryption failed";
      
      if (error instanceof Error) {
        errorMessage = error.message || error.toString();
        console.error("❌ Decrypt process failed:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
      } else if (typeof error === "string") {
        errorMessage = error;
        console.error("❌ Decrypt process failed:", error);
      } else if (error && typeof error === "object") {
        // Handle error objects that might have different structures
        const errorObj = error as any;
        errorMessage = 
          errorObj.message || 
          errorObj.error?.message || 
          errorObj.reason || 
          errorObj.toString() || 
          JSON.stringify(errorObj) ||
          "Decryption failed";
        console.error("❌ Decrypt process failed:", error);
        console.error("Error details:", {
          error,
          message: errorObj.message,
          errorMessage: errorObj.error?.message,
          reason: errorObj.reason,
          stringified: JSON.stringify(errorObj),
        });
      } else {
        console.error("❌ Decrypt process failed with unknown error type:", error);
        console.error("Error type:", typeof error);
        console.error("Error value:", error);
      }
      
      setDecryptError(errorMessage);
    } finally {
      // Cleanup: Remove unhandled rejection handler
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
      setIsDecrypting(false);
    }
  };

  return (
    <Card className="nft-card">
      <div className="nft-image-container">
        {decryptedImageUrl ? (
          <img src={decryptedImageUrl} alt={name} className="nft-image" />
        ) : (
          <div className="nft-image-placeholder">
            <Flex direction="column" align="center" gap="2" p="3">
              <Text size="2" color="gray">🔒 Encrypted Image</Text>
              <Button
                size="2"
                onClick={handleDecrypt}
                disabled={isDecrypting || !sealClient}
                loading={isDecrypting}
              >
                {isDecrypting ? "🔓 Decrypting..." : "🔓 Decrypt & View (0.005 SUI)"}
              </Button>
              {decryptError && (
                <Text size="1" color="red">{decryptError}</Text>
              )}
            </Flex>
          </div>
        )}
      </div>

      <Box p="3" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Heading size="3" mb="2">
          {name}
        </Heading>

        <Text size="2" color="gray" mb="2" style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {description}
        </Text>

        <Text size="1" color="gray" mb="3" style={{
          fontFamily: "monospace",
          wordBreak: "break-all",
        }}>
          ID: {objectId.slice(0, 10)}...
        </Text>

        <Flex gap="2" mt="auto">
          <Button
            size="2"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(objectId);
            }}
          >
            📋 Copy ID
          </Button>
          {decryptedImageUrl && (
            <Button
              size="2"
              variant="outline"
              onClick={() => {
                setDecryptedImageUrl("");
                setDecryptError("");
              }}
            >
              🔒 Hide Image
            </Button>
          )}
        </Flex>
      </Box>
    </Card>
  );
}
