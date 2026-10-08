---
name: x402
description: "Add x402 payment-gated routes to an ApeChain Quickstart project (pay-per-request in USDC.e on ApeChain mainnet via thirdweb's facilitator). Use when the user wants to: monetize an API with micropayments, add HTTP 402 payment required to routes, gate content behind crypto payments, implement pay-per-call APIs, or integrate the x402 protocol."
---

# x402 Payments on ApeChain

## Prerequisites

Check if `./packages/nextjs/scaffold.config.ts` exists directly in the current working directory (do not search subdirectories). If it doesn't exist, this is not an ApeChain Quickstart project. Follow the instructions in `SKILL.md` at the repo root (or https://raw.githubusercontent.com/ape-foundation/apechain-quickstart/main/SKILL.md if you don't have the repo) to scaffold it first. If it exists, continue directly with building.

## Overview

[x402](https://www.x402.org/) uses HTTP status 402 ("Payment Required") for per-request stablecoin payments. A client requests a protected resource, gets a 402 with payment requirements, signs an EIP-712 authorization (no transaction, no gas), and retries with the signature in a header. A **facilitator** verifies the signature and settles the transfer onchain.

## What works on ApeChain (read this first)

| | ApeChain mainnet (`33139`) | Curtis testnet (`33111`) |
| --- | --- | --- |
| Facilitator | **thirdweb** (needs a secret key + server wallet) | none |
| Payment token (set in `NEXT_PUBLIC_X402_TOKEN_ADDRESS`) | tested: **USDC.e** `0xF1815bd50389c46847f0Bda824eC8da914045D14` (EIP-3009) | none known |
| Status | settles on-chain (tested end to end, Oct 2026) | — |

- **There is no testnet path.** Develop the 402 flow against mainnet with tiny prices (e.g. 0.01 USDC.e). Tell the user this before building, and ask before running anything that pays.
- **Don't use the `@x402/*` packages or `https://x402.org/facilitator`.** The x402.org and PayAI facilitators don't support ApeChain, and `@x402/evm` has no default asset for it (`price: "$0.01"` throws `No default asset configured`). Use thirdweb's SDK (`thirdweb/x402`) instead.
- **Always pass the token explicitly.** `price: "$0.01"` resolves to a default USDC that thirdweb doesn't have for ApeChain. Use `x402Price` below, which builds the price from the configured token.
- **Don't trust thirdweb's `/supported` list.** It only shows chains with a default USDC and omits ApeChain, but `verify`/`settle` work for chain 33139 with USDC.e.
- Other ApeChain stablecoins don't work: **ApeUSD** has no permit/EIP-3009, **USDT** (stgUSDT) has no EIP-3009.

## How a payment settles (fees and gas)

thirdweb settles each payment as one EIP-7702 batch from your server wallet, sent and paid for by thirdweb's executor:

1. `transferWithAuthorization`: the full price moves from the payer to **your server wallet**
2. 0.3% goes from the server wallet to thirdweb's fee address
3. the remaining 99.7% goes to `payTo`

So a 0.01 USDC.e price lands as **0.00997 USDC.e** at `payTo`. Set prices with that in mind, and tell the user about the fee.

Gas: in testing, thirdweb's executor paid it and the server wallet's APE balance didn't change. A small APE balance on the server wallet (e.g. 0.1) is a harmless buffer, but don't tell users it's required.

### `waitUntil`: keep `"confirmed"`

`settlePayment` returns when the facilitator reaches the `waitUntil` stage:

- `"confirmed"` (use this): returns after the transfer is on-chain, about 5s on ApeChain. Content is only served for payments that actually landed.
- `"submitted"`: returns as soon as thirdweb queues the transaction (about 2s), **before any funds move**. If the settlement is delayed or fails, you've served the content for free. Thirdweb settlements have been stuck in `SUBMITTED` for over half an hour before.

## Dependencies

Add to `packages/nextjs/package.json`, then `yarn install`:

```json
{
  "dependencies": {
    "thirdweb": "^5.121.0"
  }
}
```

## Environment variables

Add these to `packages/nextjs/env.example` (documented, empty values) and tell the user to fill them in `packages/nextjs/.env.local`. Never read or write `.env*` files yourself.

```env
# x402 (thirdweb facilitator). Secret key is server-only: never prefix it with NEXT_PUBLIC_.
THIRDWEB_SECRET_KEY=
# thirdweb server wallet that submits settlements (dashboard → project → Server Wallets).
THIRDWEB_SERVER_WALLET_ADDRESS=
# Address that receives payments.
X402_PAY_TO=
# Public client id, used by the browser to build payments.
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=
# EIP-3009 token that payments are made in, on ApeChain mainnet. Its EIP-712 domain and decimals are read on-chain.
# Tested: USDC.e (Bridged USDC via Stargate) 0xF1815bd50389c46847f0Bda824eC8da914045D14
NEXT_PUBLIC_X402_TOKEN_ADDRESS=
```

## Shared config

The payment token is configuration, not code: set its address in `NEXT_PUBLIC_X402_TOKEN_ADDRESS` (public, so the page can show its symbol and cap the price). Everything else about the token is read on-chain.

```typescript
// packages/nextjs/services/x402/config.ts
// Shared x402 settings, safe to import from client and server code.
import type { Address } from "viem";
import { apeChain } from "viem/chains";

export const X402_CHAIN = apeChain;

// EIP-3009 token that payments are made in. Configured rather than hardcoded so it can be swapped
// without code changes; its EIP-712 domain and decimals are read from the token itself.
export const X402_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_X402_TOKEN_ADDRESS as Address | undefined;

// Human-readable amount, in whole token units.
export const X402_PRICE = "0.01";
```

## Server: token, price and facilitator

```typescript
// packages/nextjs/services/x402/server.ts
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
```

Don't hardcode the token's EIP-712 domain or decimals. `x402Price` reads `name()`, `version()` and `decimals()` from the configured token and checks the domain against its `DOMAIN_SEPARATOR()`, so swapping tokens is an env change. A wrong domain makes the token reject every signature (`FiatTokenV2: invalid signature`); for USDC.e the name is `"Bridged USDC (Stargate)"`, not `"USD Coin"`. The token must implement EIP-3009 (`transferWithAuthorization`) plus `version()` and `DOMAIN_SEPARATOR()`, as Circle's FiatToken does.

## Server: a paid route

Gate each route in its handler with `settlePayment`. This keeps the secret key in server code and avoids Next.js middleware/proxy edge-runtime limits.

```typescript
// packages/nextjs/app/api/premium/route.ts
import { settlePayment } from "thirdweb/x402";
import { X402_PRICE } from "~~/services/x402/config";
import { X402_NETWORK, getFacilitator, getPayTo, x402Price } from "~~/services/x402/server";

export async function GET(request: Request) {
  const result = await settlePayment({
    resourceUrl: request.url,
    method: "GET",
    paymentData: request.headers.get("PAYMENT-SIGNATURE") ?? request.headers.get("X-PAYMENT"),
    payTo: getPayTo(),
    network: X402_NETWORK,
    price: await x402Price(X402_PRICE),
    facilitator: getFacilitator(),
  });

  if (result.status !== 200) {
    return Response.json(result.responseBody, { status: result.status, headers: result.responseHeaders });
  }

  return Response.json({ data: "premium content" }, { headers: result.responseHeaders });
}
```

`settlePayment` verifies **and** settles. Produce the content only after it returns 200. For usage-based pricing, call `verifyPayment` first with `scheme: "upto"`, do the work, then `settlePayment` with the final amount.

## Client: pay from the connected wallet

Payments are signed by the user's wagmi wallet (Glyph, MetaMask, …), wrapped for thirdweb with `createWalletAdapter`. The page reads the token's symbol and decimals to label the button and cap `maxValue`. The wallet must be on **ApeChain mainnet**, but the kit's default network is Curtis, so switch first.

```tsx
// packages/nextjs/app/premium/page.tsx
"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { createThirdwebClient, defineChain } from "thirdweb";
import { viemAdapter } from "thirdweb/adapters/viem";
import { createWalletAdapter } from "thirdweb/wallets";
import { wrapFetchWithPayment } from "thirdweb/x402";
import { erc20Abi, parseUnits } from "viem";
import { useAccount, useReadContracts, useSwitchChain, useWalletClient } from "wagmi";
import { X402_CHAIN, X402_PRICE, X402_TOKEN_ADDRESS } from "~~/services/x402/config";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

const THIRDWEB_CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
// thirdweb pins its own viem version, so wagmi's WalletClient type doesn't match its parameter type exactly.
type ThirdwebViemWalletClient = Parameters<typeof viemAdapter.walletClient.fromViem>[0]["walletClient"];

const Premium: NextPage = () => {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient({ chainId: X402_CHAIN.id });
  const { data: token } = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: X402_TOKEN_ADDRESS, abi: erc20Abi, functionName: "symbol", chainId: X402_CHAIN.id },
      { address: X402_TOKEN_ADDRESS, abi: erc20Abi, functionName: "decimals", chainId: X402_CHAIN.id },
    ],
    query: { enabled: !!X402_TOKEN_ADDRESS },
  });
  const [data, setData] = useState<unknown>();
  const [isPaying, setIsPaying] = useState(false);

  if (!X402_TOKEN_ADDRESS || !THIRDWEB_CLIENT_ID) {
    return (
      <div className="alert alert-warning m-10 w-auto">
        Set NEXT_PUBLIC_X402_TOKEN_ADDRESS and NEXT_PUBLIC_THIRDWEB_CLIENT_ID to enable payments.
      </div>
    );
  }

  const buy = async () => {
    if (!token) return;
    const [symbol, decimals] = token;
    setIsPaying(true);
    try {
      if (chainId !== X402_CHAIN.id) await switchChainAsync({ chainId: X402_CHAIN.id });
      if (!walletClient) throw new Error(`Connect a wallet on ${X402_CHAIN.name}`);
      // Created here rather than at module scope, where a missing client ID would throw during prerender.
      const thirdwebClient = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
      // createWalletAdapter wraps the already-connected wagmi account. (viemAdapter.wallet.fromViem
      // returns a disconnected wallet, and wrapFetchWithPayment throws "Wallet not connected".)
      const wallet = createWalletAdapter({
        client: thirdwebClient,
        adaptedAccount: viemAdapter.walletClient.fromViem({
          walletClient: walletClient as unknown as ThirdwebViemWalletClient,
        }),
        chain: defineChain(X402_CHAIN.id),
        onDisconnect: () => {},
        switchChain: () => {},
      });
      // Refuse to pay more than the advertised price.
      const maxValue = parseUnits(X402_PRICE, decimals);
      const fetchWithPayment = wrapFetchWithPayment(fetch, thirdwebClient, wallet, { maxValue });
      const res = await fetchWithPayment("/api/premium");
      if (!res.ok) throw new Error(`Payment failed (${res.status})`);
      setData(await res.json());
      notification.success(`Paid ${X402_PRICE} ${symbol}`);
    } catch (e) {
      notification.error(getParsedError(e));
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 pt-10">
      <button className="btn btn-primary" onClick={buy} disabled={isPaying || !token}>
        {isPaying || !token ? <span className="loading loading-spinner" /> : `Unlock for ${X402_PRICE} ${token[0]}`}
      </button>
      {data !== undefined && <pre className="bg-base-200 rounded-box p-4">{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
};

export default Premium;
```

`wrapFetchWithPayment` handles the 402 → sign → retry loop. Always set `maxValue` so a server can't ask the wallet for more than you expect.

## Gotchas

- **Mainnet only.** Curtis has no facilitator or EIP-3009 stablecoin. Point users at tiny prices on mainnet, or (advanced) a self-deployed EIP-3009 token and a self-hosted facilitator on Curtis.
- **Payer needs USDC.e, not APE.** The payer only signs; thirdweb submits the settlement and pays its gas. Fund the payer with USDC.e (bridged via Stargate).
- **`payTo` receives 99.7%.** Payments pass through the server wallet, and thirdweb keeps 0.3% (see "How a payment settles").
- **Don't trust `success: true` alone.** The receipt's `transaction` is a thirdweb queue ID, not a tx hash. When debugging, check balances or the token's `Transfer` logs on ApeScan.
- **Secret key stays server-side.** `THIRDWEB_SECRET_KEY` must not be `NEXT_PUBLIC_`, and `services/x402/server.ts` must never be imported by a `"use client"` file.
- **Wrong chain = wrong domain.** If the wallet signs while on Curtis, the signature's chainId doesn't match and verification fails. Switch to ApeChain before paying.
- **viem type mismatch.** `thirdweb` pins an older viem than the kit, so passing wagmi's `walletClient` to `viemAdapter.walletClient.fromViem` fails type-checking. Cast it as shown above; runtime is unaffected.
- **Decimals come from the token.** Prices are written in whole units (`X402_PRICE = "0.01"`) and converted with the token's own `decimals()` (6 for USDC.e). Don't use `parseEther` or hardcode base units.

## How to test

1. Fill `packages/nextjs/.env.local` (user action) and `yarn start`.
2. Unpaid request returns 402 with payment requirements. This costs nothing:
   ```bash
   curl -i http://localhost:3000/api/premium
   ```
3. Paid request (**spends real USDC.e, ask the user first**): open `/premium`, connect a wallet holding USDC.e on ApeChain, click unlock. Check the settlement transaction on [ApeScan](https://apescan.io): the payer is down the full price and `payTo` is up 99.7% of it.
