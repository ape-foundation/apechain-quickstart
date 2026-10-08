import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  base,
  ledgerWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { glyphWalletRK } from "@use-glyph/sdk-react";
import scaffoldConfig from "~~/scaffold.config";

// Scaffold-ETH's burner wallet only works on a local chain, so it's left out: this kit targets
// ApeChain's live networks (Curtis and mainnet).
const wallets = [metaMaskWallet, walletConnectWallet, ledgerWallet, base, rainbowWallet, safeWallet];

/**
 * wagmi connectors for the wagmi context
 */
export const wagmiConnectors = () => {
  // Only create connectors on client-side to avoid SSR issues
  // TODO: update when https://github.com/rainbow-me/rainbowkit/issues/2476 is resolved
  if (typeof window === "undefined") {
    return [];
  }

  return connectorsForWallets(
    [
      {
        // Glyph is ApeChain's social-login wallet (email, X, Apple, Google…), listed first.
        groupName: "Recommended",
        wallets: [glyphWalletRK],
      },
      {
        groupName: "Other Wallets",
        wallets,
      },
    ],

    {
      appName: "ApeChain Quickstart",
      projectId: scaffoldConfig.walletConnectProjectId,
    },
  );
};
