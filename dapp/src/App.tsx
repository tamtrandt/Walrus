import { ConnectButton } from "@mysten/dapp-kit";
import { Box, Container, Flex, Heading, Tabs } from "@radix-ui/themes";
import { WalletStatus } from "./WalletStatus";
import { NFTMintForm } from "./components/NFTMintForm";
import { NFTGallery } from "./components/NFTGallery";
import "./styles/App.css";

function App() {
  return (
    <>
      <Flex
        position="sticky"
        px="4"
        py="2"
        justify="between"
        align="center"
        style={{
          borderBottom: "1px solid #e0e0e0",
          background: "#f8f9fa",
        }}
      >
        <Box>
          <Heading size="6" style={{ color: "#333" }}>
            🎨 Sui NFT Creator
          </Heading>
        </Box>

        <Box>
          <ConnectButton />
        </Box>
      </Flex>

      <Container size="4" mt="5">
        <Tabs.Root defaultValue="mint" style={{ marginTop: "2rem" }}>
          <Tabs.List>
            <Tabs.Trigger value="mint">🎨 Create NFT</Tabs.Trigger>
            <Tabs.Trigger value="gallery">📚 My Gallery</Tabs.Trigger>
            <Tabs.Trigger value="wallet">💼 Wallet Status</Tabs.Trigger>
          </Tabs.List>

          <Box pt="4">
            <Tabs.Content value="mint">
              <NFTMintForm />
            </Tabs.Content>

            <Tabs.Content value="gallery">
              <NFTGallery />
            </Tabs.Content>

            <Tabs.Content value="wallet">
              <Container
                pt="2"
                px="4"
                style={{ background: "var(--gray-a2)", borderRadius: "8px" }}
              >
                <WalletStatus />
              </Container>
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Container>
    </>
  );
}

export default App;
