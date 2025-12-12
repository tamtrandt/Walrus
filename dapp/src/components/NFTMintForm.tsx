/// ========================================================================================
/// 🎨 NFT MINT FORM COMPONENT - Create Pay-to-View Encrypted NFTs
/// ========================================================================================
///
/// This component handles the complete NFT creation process including:
/// 1. Image encryption with Seal threshold cryptography
/// 2. Decentralized storage on Walrus
/// 3. NFT minting on Sui blockchain
///
/// COMPLETE CREATION FLOW:
/// 1. User selects image file
/// 2. Image encrypted using Seal SDK (threshold: 1)
/// 3. Encrypted data uploaded to Walrus publisher
/// 4. Receive blob ID from Walrus
/// 5. Mint NFT with blob ID reference
/// 6. NFT stored on Sui blockchain
///
/// ENCRYPTION DETAILS:
/// - Uses Seal threshold cryptography
/// - 1 key server required for decryption
/// - Policy ID "01" for access control
/// - Encrypted content requires 0.005 SUI payment to view
///
/// STORAGE ARCHITECTURE:
/// - Walrus: Decentralized blob storage
/// - Sui: NFT metadata and ownership
/// - Seal: Threshold encryption keys
///
import { useState, useRef, useEffect } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import { SealClient } from "@mysten/seal";
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Text,
  TextField,
  TextArea,
} from "@radix-ui/themes";
import { ExclamationTriangleIcon, CheckCircledIcon, CrossCircledIcon } from "@radix-ui/react-icons";
import "../styles/NFTMintForm.css";
import { PACKAGE_ID } from "../utils/config";
const MODULE_NAME = "nft";

interface MintFormState {
  name: string;
  description: string;
  imageUrl: string;
}

interface MintStatus {
  type: "idle" | "loading" | "success" | "error";
  message: string;
}

type ImageSource = "url" | "file";

export function NFTMintForm() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<MintFormState>({
    name: "",
    description: "",
    imageUrl: "",
  });

  const [status, setStatus] = useState<MintStatus>({
    type: "idle",
    message: "",
  });

  const [imagePreview, setImagePreview] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [imageSource, setImageSource] = useState<ImageSource>("file");
  const [blobId, setBlobId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const PUBLISHER = (import.meta.env.VITE_PUBLISHER as string) || "";
  const AGGREGATOR = (import.meta.env.VITE_AGGREGATOR as string) || "";

  // Seal Configuration
  const SEAL_PACKAGE_ID = (import.meta.env.VITE_SEAL_PACKAGE_ID as string) || "";
  const SEAL_POLICY_ID = (import.meta.env.VITE_SEAL_POLICY_ID as string) || "";

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
        console.log("✅ SealClient initialized successfully");
      } catch (error) {
        console.error("❌ Failed to initialize SealClient:", error);
      }
    };

    initSealClient();
  }, []); // Remove SEAL_KEY_SERVERS from dependencies

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "imageUrl") {
      setImagePreview(value);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatus({ type: "error", message: "Please select a valid image file" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setImagePreview(dataUrl);
      // set a temporary data URL so user sees preview immediately
      setFormData((prev) => ({ ...prev, imageUrl: dataUrl }));
      setStatus({ type: "idle", message: "" });
    };
    reader.readAsDataURL(file);

    // If a publisher URL is configured, upload the file to Walrus
    if (PUBLISHER) {
      uploadFileToWalrus(file);
    } else {
      setStatus({ type: "idle", message: "No publisher configured — preview only" });
    }
  };

  const uploadFileToWalrus = async (file: File) => {
    setIsUploading(true);
    setBlobId(null);
    try {
      setStatus({ type: "loading", message: "📁 Đang xử lý file ảnh..." });

      // Read file as Uint8Array for processing
      const data = new Uint8Array(await file.arrayBuffer());

      // ========================================================================================
      // 🔐 SEAL ENCRYPTION FLOW - Step 1: Encrypt image data before uploading to Walrus
      // ========================================================================================
      // This creates a "pay-to-view" NFT where users must pay 0.005 SUI to decrypt the image
      // The encryption uses threshold cryptography for decentralized key management
      let dataToUpload: Uint8Array = data;

      if (sealClient && SEAL_PACKAGE_ID && SEAL_POLICY_ID) {
        try {
          setStatus({ type: "loading", message: "🔐 Đang mã hóa file với Seal..." });
          console.log("🔐 Starting Seal encryption...");
          console.log("Seal config:", { packageId: SEAL_PACKAGE_ID, policyId: SEAL_POLICY_ID });

          // Call Seal SDK encrypt() function:
          // - threshold: 1 (need 1 key server to decrypt, matches our 1 key server config)
          // - packageId: Our NFT contract package (contains seal_access module with approval logic)
          // - id: Policy ID "01" (identifies this encryption policy)
          // - data: Original image bytes
          // Returns: encryptedObject (Uint8Array of encrypted data)
          const { encryptedObject } = await sealClient.encrypt({
            threshold: 1, // Use threshold 1 with 1 key server
            packageId: PACKAGE_ID, // Use our NFT package ID (contains seal_access module)
            id: SEAL_POLICY_ID,
            data: dataToUpload,
          });

          // Replace original data with encrypted data for upload
          dataToUpload = encryptedObject;
          console.log("✅ Seal encryption completed successfully");
          console.log("🔐 Encrypted data length:", encryptedObject.length);
          setStatus({ type: "loading", message: "✅ Mã hóa Seal thành công! Đang upload lên Walrus..." });
        } catch (sealError) {
          console.error("❌ Seal encryption failed:", sealError);
          setStatus({ type: "loading", message: "⚠️ Mã hóa Seal thất bại, tiếp tục upload không mã hóa..." });
          // Continue with unencrypted upload if Seal fails
          console.warn("Continuing with unencrypted upload due to Seal error");
        }
      } else {
        console.log("ℹ️ SealClient not available - uploading without encryption");
        setStatus({ type: "loading", message: "🔄 Seal không khả dụng, upload không mã hóa..." });
      }

      // Step 2: Upload encrypted data to Walrus
      console.log("📤 Starting Walrus upload...");
      setStatus({ type: "loading", message: "📤 Đang upload lên Walrus publisher..." });
      const uploadUrl = PUBLISHER.endsWith("/") ? `${PUBLISHER}v1/blobs` : `${PUBLISHER}/v1/blobs`;

      const resp = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream", // Use generic content type for encrypted data
        },
        body: new Uint8Array(dataToUpload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Upload failed: ${resp.status} ${text}`);
      }

      // Step 3: Process Walrus response
      setStatus({ type: "loading", message: "📋 Đang xử lý phản hồi từ Walrus..." });
      console.log("📋 Processing Walrus response...");

      // Try to parse JSON first, fall back to text
      let blobIdentifier: string | null = null;
      try {
        const j = await resp.json();
        console.log("Walrus response JSON:", j);
        // Walrus publisher may return nested structure. Prefer newlyCreated.blobObject.blobId
        if (j?.newlyCreated?.blobObject?.blobId) {
          blobIdentifier = j.newlyCreated.blobObject.blobId;
        } else {
          // fallback to common fields
          blobIdentifier = j.id || j.blob_id || j.blobId || j.hash || JSON.stringify(j);
        }
      } catch (e) {
        const txt = await resp.text();
        console.log("Walrus response text:", txt);
        blobIdentifier = txt.trim();
      }

      if (!blobIdentifier) throw new Error("No blob id returned from publisher");

      console.log("✅ Extracted encrypted blob ID:", blobIdentifier);

      // Store the encrypted blob ID for minting
      setBlobId(blobIdentifier);
      setFormData((prev) => ({ ...prev, imageUrl: blobIdentifier as string }));

      setStatus({ type: "success", message: `🎉 Upload thành công! Encrypted Blob ID: ${blobIdentifier}` });
    } catch (err: any) {
      setStatus({ type: "error", message: `Upload failed: ${err?.message || err}` });
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageSourceChange = (source: ImageSource) => {
    setImageSource(source);
    setImagePreview("");
    setFormData((prev) => ({
      ...prev,
      imageUrl: "",
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setStatus({
        type: "error",
        message: "Please enter an NFT name",
      });
      return false;
    }

    if (formData.name.length > 100) {
      setStatus({
        type: "error",
        message: "Name must be 100 characters or less",
      });
      return false;
    }

    if (!formData.description.trim()) {
      setStatus({
        type: "error",
        message: "Please enter a description",
      });
      return false;
    }

    if (formData.description.length > 500) {
      setStatus({
        type: "error",
        message: "Description must be 500 characters or less",
      });
      return false;
    }

    if (!formData.imageUrl.trim()) {
      setStatus({
        type: "error",
        message: "Please select or upload an image",
      });
      return false;
    }

    if (imageSource === "url" && !formData.imageUrl.startsWith("https://")) {
      setStatus({
        type: "error",
        message: "Image URL must start with https://",
      });
      return false;
    }

    return true;
  };

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account) {
      setStatus({
        type: "error",
        message: "Please connect your wallet first",
      });
      return;
    }

    if (!validateForm()) {
      return;
    }

    if (!PACKAGE_ID || PACKAGE_ID === "0x1234567890abcdef") {
      setStatus({
        type: "error",
        message: "⚠️ PACKAGE_ID is not configured. Set VITE_SEAL_PACKAGE_ID in your .env",
      });
      return;
    }

    // ========================================================================================
    // 🎨 NFT MINTING FLOW - Step 4: Create NFT on Sui blockchain
    // ========================================================================================
    // After encrypting and uploading the image, we create an NFT that references the blob ID
    // The NFT stores metadata (name, description) and the encrypted content reference

    setIsLoading(true);
    setStatus({
      type: "loading",
      message: "🎨 Creating your NFT on Sui blockchain...",
    });

    try {
      // Build Programmable Transaction Block (PTB) to mint NFT
      const tx = new Transaction();

      // Call our NFT contract's mint_to_sender function:
      // - name: NFT title
      // - description: NFT description
      // - imageUrl: Walrus blob ID (references encrypted content)
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::mint_to_sender`,
        arguments: [
          tx.pure.string(formData.name),        // NFT name
          tx.pure.string(formData.description), // NFT description
          tx.pure.string(formData.imageUrl),    // Walrus blob ID (encrypted content)
        ],
      });

      // Execute transaction via wallet
      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
            setStatus({
              type: "success",
              message: `✨ NFT created successfully! Transaction: ${result.digest}`,
            });
            // Reset form after successful minting
            setFormData({
              name: "",
              description: "",
              imageUrl: "",
            });
            setImagePreview("");
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          },
          onError: (error) => {
            setStatus({
              type: "error",
              message: `Transaction failed: ${error.message}`,
            });
          },
        }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setStatus({
        type: "error",
        message: `Error creating NFT: ${errorMessage}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!account) {
    return (
      <Container className="mint-form-container">
        <Box className="wallet-not-connected-message">
          <Flex direction="column" align="center" gap="3">
            <ExclamationTriangleIcon width="48" height="48" color="#d97b7b" />
            <Heading size="5">Wallet Not Connected</Heading>
            <Text color="gray">
              Please connect your wallet to create an NFT
            </Text>
          </Flex>
        </Box>
      </Container>
    );
  }

  return (
    <Container className="mint-form-container">
      <Box className="mint-form-card">
        <Heading size="5" mb="4">
          🎨 Create Your NFT
        </Heading>

        {status.type !== "idle" && (
          <Box
            mb="4"
            p="3"
            style={{
              borderRadius: "8px",
              backgroundColor:
                status.type === "error"
                  ? "#fde8e8"
                  : status.type === "success"
                    ? "#e6f5f0"
                    : "#e3f0ff",
              borderLeft:
                status.type === "error"
                  ? "4px solid #d97b7b"
                  : status.type === "success"
                    ? "4px solid #4a9b7e"
                    : "4px solid #5e9ccc",
            }}
          >
            <Flex gap="2" align="center">
              {status.type === "error" && (
                <CrossCircledIcon color="#d97b7b" />
              )}
              {status.type === "success" && (
                <CheckCircledIcon color="#4a9b7e" />
              )}
              {status.type === "loading" && (
                <div className="spinner" />
              )}
              <Text size="2">{status.message}</Text>
            </Flex>
          </Box>
        )}

        <form onSubmit={handleMint} className="mint-form">
          <Flex direction="column" gap="4">
            {/* NFT Name Field */}
            <Box>
              <Box mb="2">
                <label htmlFor="name" style={{ display: "block" }}>
                  <Text weight="medium" as="div">
                    NFT Name *
                  </Text>
                </label>
              </Box>
              <TextField.Root
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter NFT name"
                disabled={isLoading}
                maxLength={100}
              />
              <Text size="1" color="gray" mt="1">
                {formData.name.length}/100 characters
              </Text>
            </Box>

            {/* Description Field */}
            <Box>
              <Box mb="2">
                <label htmlFor="description" style={{ display: "block" }}>
                  <Text weight="medium" as="div">
                    Description *
                  </Text>
                </label>
              </Box>
              <TextArea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your NFT"
                disabled={isLoading}
                maxLength={500}
                style={{ minHeight: "120px", fontFamily: "inherit" }}
              />
              <Text size="1" color="gray" mt="1">
                {formData.description.length}/500 characters
              </Text>
            </Box>

            {/* Image Source Tabs */}
            <Box>
              <Box className="image-source-tabs">
                <button
                  type="button"
                  className={`image-source-tab ${imageSource === "file" ? "active" : ""}`}
                  onClick={() => handleImageSourceChange("file")}
                  disabled={isLoading}
                >
                  📁 Upload File
                </button>
                <button
                  type="button"
                  className={`image-source-tab ${imageSource === "url" ? "active" : ""}`}
                  onClick={() => handleImageSourceChange("url")}
                  disabled={isLoading}
                >
                  🔗 URL
                </button>
              </Box>

              {/* Image Input - File */}
              {imageSource === "file" && (
                <Box>
                  <Box mb="2">
                    <label htmlFor="imageFile" className="file-input-label">
                      📁 Choose Image
                      <input
                        ref={fileInputRef}
                        id="imageFile"
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        disabled={isLoading}
                      />
                    </label>
                  </Box>
                  <Text size="1" color="gray">
                    Select an image from your computer (PNG, JPG, GIF, etc.)
                  </Text>
                </Box>
              )}

              {/* Image Input - URL */}
              {imageSource === "url" && (
                <Box>
                  <Box mb="2">
                    <label htmlFor="imageUrl" style={{ display: "block" }}>
                      <Text weight="medium" as="div">
                        Image URL (HTTPS) *
                      </Text>
                    </label>
                  </Box>
                  <TextField.Root
                    id="imageUrl"
                    name="imageUrl"
                    value={formData.imageUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/image.png"
                    disabled={isLoading}
                  />
                  <Text size="1" color="gray" mt="1">
                    Must be a valid HTTPS image URL
                  </Text>
                </Box>
              )}
            </Box>

            {/* Image Preview */}
            {imagePreview && (
              <Box className="image-preview-container">
                <Text size="2" weight="medium" mb="2">
                  Image Preview
                </Text>
                <img
                  src={imagePreview}
                  alt="NFT preview"
                  className="image-preview"
                  onError={() => setStatus({
                    type: "error",
                    message: "Failed to load image preview. Check the URL.",
                  })}
                />
              </Box>
            )}

            {isUploading && (
              <Box p="3" style={{ marginTop: "0.5rem", background: "#f3f7ff", borderRadius: 8, border: "1px solid #e0e6f3" }}>
                <Text size="2">Uploading image to publisher...</Text>
              </Box>
            )}

            {blobId && (
              <Box p="3" style={{ marginTop: "0.5rem", background: "#f6fff5", borderRadius: 8, border: "1px solid #dff3e6" }}>
                <Flex direction="column" gap="2">
                  <Text size="2">Uploaded Blob ID</Text>
                  <Text size="1" style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{blobId}</Text>
                  {AGGREGATOR ? (
                    <a href={`${AGGREGATOR.replace(/\/$/, "")}/v1/blobs/${blobId}`} target="_blank" rel="noreferrer">View on aggregator</a>
                  ) : null}
                  <Button size="2" variant="outline" onClick={() => navigator.clipboard.writeText(blobId)}>Copy Blob ID</Button>
                </Flex>
              </Box>
            )}

            {/* Submit Button */}
            <Box pt="2">
              <Button
                type="submit"
                disabled={isLoading || isUploading}
                className="mint-button"
                size="3"
              >
                {isLoading || isUploading ? "Please wait..." : "🚀 Create NFT"}
              </Button>
            </Box>
          </Flex>
        </form>

        <Box mt="4" p="3" style={{
          backgroundColor: "#fff9e6",
          borderRadius: "8px",
          borderLeft: "4px solid #d4a700",
        }}>
          <Text size="2" style={{ color: "#8b7300" }}>
            <strong>⚠️ Note:</strong> PACKAGE_ID is read from `VITE_SEAL_PACKAGE_ID` environment variable. Update your `.env` file if needed.
          </Text>
        </Box>
      </Box>
    </Container>
  );
}
