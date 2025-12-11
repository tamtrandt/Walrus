import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { Box, Container, Flex, Heading, Text, Button, Card } from "@radix-ui/themes";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import "../styles/NFTGallery.css";
import { PACKAGE_ID } from "../utils/config";
const MODULE_NAME = "nft";

const AGGREGATOR = (import.meta.env.VITE_AGGREGATOR as string) || "";

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
              PACKAGE_ID is not configured. Set `VITE_PACKAGE_ID` in your `.env` to view NFTs.
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
              <NFTCard key={nft.data?.objectId} nft={nft as any} />
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

function NFTCard({ nft }: { nft: NFTData }) {
  const objectId = nft.data?.objectId || "";
  const fields = nft.data?.content?.fields || {};
  const name = (fields.name as string) || "Unnamed NFT";
  const description = (fields.description as string) || "No description";
  let imageUrl = (fields.url as string) || "";

  // If imageUrl looks like a Walrus blob ID (not a full URL), convert to aggregator URL
  if (AGGREGATOR && imageUrl && !imageUrl.startsWith("http")) {
    imageUrl = getWalrusImageUrl(imageUrl);
  }

  return (
    <Card className="nft-card">
      <div className="nft-image-container">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="nft-image" />
        ) : (
          <div className="nft-image-placeholder">No Image</div>
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
        </Flex>
      </Box>
    </Card>
  );
}
