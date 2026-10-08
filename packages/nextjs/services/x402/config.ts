// Shared x402 settings, safe to import from client and server code.
import type { Address } from "viem";
import { apeChain } from "viem/chains";

export const X402_CHAIN = apeChain;

// EIP-3009 token that payments are made in. Configured rather than hardcoded so it can be swapped
// without code changes; its EIP-712 domain and decimals are read from the token itself.
export const X402_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_X402_TOKEN_ADDRESS as Address | undefined;

// Human-readable amount, in whole token units.
export const X402_PRICE = "0.01";
