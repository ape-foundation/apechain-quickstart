import * as chains from "viem/chains";

export type BaseConfig = {
  targetNetworks: readonly chains.Chain[];
  pollingInterval: number;
  alchemyApiKey: string;
  rpcOverrides?: Record<number, string>;
  walletConnectProjectId: string;
};

export type ScaffoldConfig = BaseConfig;

export const DEFAULT_ALCHEMY_API_KEY = "IZYEU2cWBgnFmgiTAgpWD";

const scaffoldConfig = {
  // The networks on which your DApp is live
  // The first network is the default one the app connects to.
  // ApeChain Curtis testnet (33111) for development, ApeChain mainnet (33139) for production.
  targetNetworks: [chains.curtis, chains.apeChain],
  // The interval at which your front-end polls the RPC servers for new data
  pollingInterval: 3000,
  // This is ours Alchemy's default API key.
  // You can get your own at https://dashboard.alchemyapi.io
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
  // If you want to use a different RPC for a specific network, you can add it here.
  // The key is the chain ID, and the value is the HTTP RPC URL
  // Empty values fall back to the public RPCs defined by viem.
  rpcOverrides: Object.fromEntries(
    [
      [chains.curtis.id, process.env.NEXT_PUBLIC_CURTIS_RPC_URL],
      [chains.apeChain.id, process.env.NEXT_PUBLIC_APECHAIN_RPC_URL],
    ].filter(([, url]) => !!url),
  ) as Record<number, string>,
  // This is ours WalletConnect's default project ID.
  // You can get your own at https://cloud.walletconnect.com
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;
