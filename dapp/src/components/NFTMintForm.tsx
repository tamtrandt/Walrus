import { useState, useRef } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
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
      setStatus({ type: "info" as any, message: "No publisher configured — preview only" });
    }
  };

  const uploadFileToWalrus = async (file: File) => {
    setIsUploading(true);
    setBlobId(null);
    try {
      const uploadUrl = PUBLISHER.endsWith("/") ? `${PUBLISHER}v1/blobs` : `${PUBLISHER}/v1/blobs`;
      const resp = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Upload failed: ${resp.status} ${text}`);
      }

      // Try to parse JSON first, fall back to text
      let blobIdentifier: string | null = null;
      try {
        const j = await resp.json();
        // Walrus publisher may return nested structure. Prefer newlyCreated.blobObject.blobId
        if (j?.newlyCreated?.blobObject?.blobId) {
          blobIdentifier = j.newlyCreated.blobObject.blobId;
        } else {
          // fallback to common fields
          blobIdentifier = j.id || j.blob_id || j.blobId || j.hash || JSON.stringify(j);
        }
      } catch (e) {
        const txt = await resp.text();
        blobIdentifier = txt.trim();
      }

      if (!blobIdentifier) throw new Error("No blob id returned from publisher");

      // store only the blobId string for minting (per request)
      setBlobId(blobIdentifier);
      setFormData((prev) => ({ ...prev, imageUrl: blobIdentifier }));

      setStatus({ type: "success", message: `Uploaded to publisher — blob id: ${blobIdentifier}` });
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
        message: "⚠️ PACKAGE_ID is not configured. Set VITE_PACKAGE_ID in your .env",
      });
      return;
    }

    setIsLoading(true);
    setStatus({
      type: "loading",
      message: "Creating your NFT...",
    });

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::mint_to_sender`,
        arguments: [
          tx.pure.string(formData.name),
          tx.pure.string(formData.description),
          tx.pure.string(formData.imageUrl),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
            setStatus({
              type: "success",
              message: `✨ NFT created successfully! Transaction: ${result.digest}`,
            });
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
            <strong>⚠️ Note:</strong> PACKAGE_ID is read from `VITE_PACKAGE_ID` environment variable. Update your `.env` file if needed.
          </Text>
        </Box>
      </Box>
    </Container>
  );
}
