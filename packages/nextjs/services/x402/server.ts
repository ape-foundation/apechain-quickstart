// Server-only: imports the thirdweb secret key. Never import this from a client component.
import { createThirdwebClient, defineChain } from "thirdweb";
import { facilitator } from "thirdweb/x402";
import { createPublicClient, domainSeparator, erc20Abi, getAddress, http, parseAbi, parseUnits } from "viem";
import scaffoldConfig from "~~/scaffold.config";
import { X402_CHAIN, X402_TOKEN_ADDRESS } from "~~/services/x402/config";

export const X402_NETWORK = defineChain(X402_CHAIN.id);

const eip712TokenAbi = parseAbi([
  "function version() view returns (string)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
]);

const publicClient = createPublicClient({
  chain: X402_CHAIN,
  transport: http(scaffoldConfig.rpcOverrides?.[X402_CHAIN.id]),
});

// The signed EIP-712 domain must match the token's exactly, or it rejects the signature
// (`FiatTokenV2: invalid signature`). Read it from the token and check it against DOMAIN_SEPARATOR.
const loadToken = async () => {
  if (!X402_TOKEN_ADDRESS) throw new Error("NEXT_PUBLIC_X402_TOKEN_ADDRESS is not set");
  const address = getAddress(X402_TOKEN_ADDRESS);
  const [name, version, decimals, separator] = await Promise.all([
    publicClient.readContract({ address, abi: erc20Abi, functionName: "name" }),
    publicClient.readContract({ address, abi: eip712TokenAbi, functionName: "version" }),
    publicClient.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
    publicClient.readContract({ address, abi: eip712TokenAbi, functionName: "DOMAIN_SEPARATOR" }),
  ]);
  const expected = domainSeparator({ domain: { name, version, chainId: X402_CHAIN.id, verifyingContract: address } });
  if (expected !== separator) throw new Error(`x402 token ${address}: EIP-712 domain doesn't match DOMAIN_SEPARATOR`);
  return {
    // viem's Address resolves to plain `string` here; thirdweb's asset type wants the `0x${string}` template.
    address: address as `0x${string}`,
    decimals,
    eip712: { name, version, primaryType: "TransferWithAuthorization" as const },
  };
};

let tokenPromise: ReturnType<typeof loadToken> | undefined;
const getToken = () =>
  (tokenPromise ??= loadToken().catch(e => {
    tokenPromise = undefined;
    throw e;
  }));

export const x402Price = async (amount: string) => {
  const asset = await getToken();
  return { amount: parseUnits(amount, asset.decimals).toString(), asset };
};

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see packages/nextjs/env.example)`);
  return value;
};

// Created on the first request, not at import: `next build` imports the route to collect page data,
// and createThirdwebClient throws when the secret key isn't set (fresh clones, CI, preview deploys).
let thirdwebFacilitator: ReturnType<typeof facilitator> | undefined;
export const getFacilitator = () =>
  (thirdwebFacilitator ??= facilitator({
    client: createThirdwebClient({ secretKey: requireEnv("THIRDWEB_SECRET_KEY") }),
    serverWalletAddress: requireEnv("THIRDWEB_SERVER_WALLET_ADDRESS"),
    waitUntil: "confirmed",
  }));

export const getPayTo = () => requireEnv("X402_PAY_TO");
