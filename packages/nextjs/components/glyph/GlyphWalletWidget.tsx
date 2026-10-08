"use client";

import { useEffect } from "react";
import {
  GlyphProvider,
  GlyphWidget,
  StrategyType,
  WalletClientType,
  glyphConnectorDetails,
  useGlyphConfigureDynamicChains,
} from "@use-glyph/sdk-react";
import { useAccount } from "wagmi";
import scaffoldConfig from "~~/scaffold.config";

/**
 * Warns in development when a target network isn't one Glyph supports, since Glyph users
 * won't be able to transact there.
 */
const GlyphChainCheck = () => {
  const { chainIds } = useGlyphConfigureDynamicChains();

  useEffect(() => {
    if (!chainIds) return;
    const unsupported = scaffoldConfig.targetNetworks.filter(network => !chainIds.includes(network.id));
    if (unsupported.length > 0) {
      console.warn(
        `[Glyph] These target networks aren't supported by Glyph: ${unsupported
          .map(network => `${network.name} (${network.id})`)
          .join(", ")}`,
      );
    }
  }, [chainIds]);

  return null;
};

/**
 * Glyph's wallet widget (balances, funding, swaps, activity), shown only while the user is
 * connected with Glyph. GlyphProvider asks the connected wallet to sign a login message, so it
 * is mounted here instead of at the app root to keep other wallets free of that prompt.
 */
export const GlyphWalletWidget = () => {
  const { connector, isConnected } = useAccount();
  const isGlyph = isConnected && connector?.name === glyphConnectorDetails.name;

  return (
    <>
      {process.env.NODE_ENV === "development" && <GlyphChainCheck />}
      {isGlyph && (
        <GlyphProvider strategy={StrategyType.EIP1193} walletClientType={WalletClientType.RAINBOWKIT} askForSignature>
          <GlyphWidget />
        </GlyphProvider>
      )}
    </>
  );
};
