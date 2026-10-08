---
name: eip-5792
description: "Add EIP-5792 batched transaction support to a Scaffold-ETH 2 project. Use when the user wants to: batch multiple contract calls, use wallet_sendCalls, add EIP-5792 wallet integration, batch onchain transactions, or use wagmi's experimental batch hooks."
---

# EIP-5792 Integration for Scaffold-ETH 2

## Prerequisites

Check if `./packages/nextjs/scaffold.config.ts` exists directly in the current working directory (do not search subdirectories). If it doesn't exist, this is not an ApeChain Quickstart project. Follow the instructions in `SKILL.md` at the repo root (or https://raw.githubusercontent.com/ape-foundation/apechain-quickstart/main/SKILL.md if you don't have the repo) to scaffold it first. If it exists, continue directly with building.

## Overview

[EIP-5792](https://eips.ethereum.org/EIPS/eip-5792) (Wallet Call API) lets apps send batched onchain write calls to wallets via `wallet_sendCalls`. No new dependencies needed — SE-2 already includes wagmi, which has the EIP-5792 hooks at `wagmi/experimental`:

- [`useWriteContracts`](https://wagmi.sh/react/api/hooks/useWriteContracts) — batch multiple contract calls into one wallet request
- [`useCapabilities`](https://wagmi.sh/react/api/hooks/useCapabilities) — detect what the connected wallet supports (batching, paymasters, etc.)
- [`useShowCallsStatus`](https://wagmi.sh/react/api/hooks/useShowCallsStatus) — ask the wallet to display status of a batch

> **Import paths are moving.** `useCapabilities` and `useShowCallsStatus` have been promoted to `wagmi` (stable). `useWriteContracts` is still in `wagmi/experimental` as of early 2026. Always check the [wagmi docs](https://wagmi.sh/) for the current import paths.

## Smart Contract

EIP-5792 works with any contract — the point is batching multiple calls into a single wallet interaction. A simple contract with two or more state-changing functions works well for demonstrating batching:

```solidity
contract BatchExample {
    string public greeting = "Hello!";
    uint256 public counter = 0;

    function setGreeting(string memory _newGreeting) public payable {
        greeting = _newGreeting;
    }

    function incrementCounter() public {
        counter += 1;
    }

    receive() external payable {}
}
```

Deploy using the project's existing deployment pattern (Hardhat `deploy/` or Foundry `script/`).

## EIP-5792 Integration Pattern

### Detecting wallet support

Not all wallets support EIP-5792. Use `useCapabilities` to check before offering batch UI:

```tsx
import { useCapabilities } from "wagmi/experimental";
import { useAccount } from "wagmi";

const { address, chainId } = useAccount();
const { isSuccess: isEIP5792Wallet, data: walletCapabilities } = useCapabilities({ account: address });

// Check specific capabilities per chain
const isPaymasterSupported = walletCapabilities?.[chainId]?.paymasterService?.supported;
```

`isSuccess` being `true` means the wallet responded to `wallet_getCapabilities` — i.e., it's EIP-5792 compliant.

### Batching contract calls

Use `useWriteContracts` to send multiple calls in one wallet interaction. Get the contract ABI and address from SE-2's `useDeployedContractInfo` hook:

```tsx
import { useWriteContracts } from "wagmi/experimental";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";

const { data: deployedContract } = useDeployedContractInfo("YourContract");
const { writeContractsAsync, isPending } = useWriteContracts();

// Batch two calls
const result = await writeContractsAsync({
  contracts: [
    {
      address: deployedContract.address,
      abi: deployedContract.abi,
      functionName: "setGreeting",
      args: ["Hello from batch!"],
    },
    {
      address: deployedContract.address,
      abi: deployedContract.abi,
      functionName: "incrementCounter",
    },
  ],
  // Optional: add paymaster capability if supported by the wallet
  capabilities: isPaymasterSupported ? {
    paymasterService: { url: paymasterURL }
  } : undefined,
});
```

### Showing batch status

```tsx
import { useShowCallsStatus } from "wagmi/experimental";

const { showCallsStatusAsync } = useShowCallsStatus();
await showCallsStatusAsync({ id: batchId });
```

## Wallet Compatibility & Graceful Fallback

**Graceful degradation is critical.** The UI must work for both EIP-5792 and non-EIP-5792 wallets:
- Use SE-2's `useScaffoldWriteContract` for individual calls as fallback
- Only show/enable the batch button when `useCapabilities` succeeds (`isEIP5792Wallet`)
- For unsupported wallets, show the individual calls (or a hint to connect an EIP-5792 wallet) instead of a broken batch button

**Capabilities vary by chain.** Always check `walletCapabilities?.[chainId]` for the specific chain, not just whether the wallet is EIP-5792 compliant in general.

**Glyph, the kit's primary wallet, doesn't appear to support EIP-5792.** Neither `@use-glyph/sdk-react` nor Privy's cross-app connector references `wallet_sendCalls` or `wallet_getCapabilities` (checked October 2026), so expect `useCapabilities` to fail for Glyph users and the fallback path to be what they see. Re-check after Glyph SDK upgrades. If you'd rather batch-or-fallback in one call, wagmi's `useSendCalls` takes `experimental_fallback: true`, which sends the calls one by one with `eth_sendTransaction` when the wallet lacks EIP-5792. The user then confirms each call separately, and it isn't atomic.

**There's no burner wallet or local chain in this kit.** Test batching on Curtis with a wallet that supports EIP-5792 and lets you add Curtis (chain 33111) as a custom network. Support differs by wallet and by chain, so trust `useCapabilities` for the connected chain, not a wallet's general marketing.

**Paymaster integration (ERC-7677) is optional.** If you want gas sponsorship, you need a paymaster service URL passed as a `capability` in the `writeContracts` call. The paymaster service is external to SE-2 and must support ApeChain/Curtis (chain 33139/33111), so check that before wiring it up.

## How to Test

1. Deploy the contract: `yarn deploy`
2. Start the frontend: `yarn start`
3. Fallback path: connect with **Glyph** on Curtis. The batch button should be hidden (or use the `experimental_fallback` flow) and the individual `useScaffoldWriteContract` calls should work
4. Batch path: connect an [EIP-5792 compliant wallet](https://www.eip5792.xyz/ecosystem/wallets) on Curtis. `useCapabilities` should return capabilities for chain 33111 and the batch should go through as one wallet request
5. Paymasters / atomic execution: only if the wallet reports them for Curtis in `useCapabilities`
