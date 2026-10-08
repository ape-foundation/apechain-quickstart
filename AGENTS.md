# AGENTS.md

This file provides guidance to coding agents working in this repository.

## Project Overview

ApeChain Quickstart is a Scaffold-ETH 2 (SE-2) starter kit retargeted from Ethereum to **ApeChain**, with **Glyph** as the primary wallet. It ships **both** Solidity frameworks side by side:

- **Foundry** (default): `packages/foundry` with Forge scripts. Root commands (`yarn deploy`, `yarn test`, …) run Foundry.
- **Hardhat**: `packages/hardhat` with hardhat-deploy. Use the `hardhat:`-prefixed root commands (`yarn hardhat:deploy`, …).

Both write deployed addresses and ABIs to the same frontend file, `packages/nextjs/contracts/deployedContracts.ts`, consumed by:

- **packages/nextjs**: React frontend (Next.js App Router, not Pages Router, RainbowKit, Wagmi, Viem, TypeScript, Tailwind CSS with DaisyUI)

When the instructions below differ by flavor, Foundry applies to `packages/foundry` and Hardhat to `packages/hardhat`.

### ApeChain specifics

- Networks: **Curtis testnet** (`curtis`, chain id 33111) is the default; **ApeChain mainnet** (`apechain`, chain id 33139). Both come from `viem/chains` (`curtis`, `apeChain`). The native token is **APE**.
- There is **no local chain** (`yarn chain` / `yarn fork` were removed): Glyph is an embedded (Privy cross-app) wallet that can't connect to localhost. Develop against Curtis; testnet APE comes from https://curtis.hub.caldera.xyz.
- Glyph is the first RainbowKit wallet (`glyphWalletRK` in `packages/nextjs/services/web3/wagmiConnectors.tsx`). Other wallets (MetaMask, WalletConnect, …) still work. The burner wallet is not included.
- `GlyphProvider` + `GlyphWidget` live in `packages/nextjs/components/glyph/GlyphWalletWidget.tsx` and only mount while the connected wallet is Glyph, because the provider asks the connected wallet to sign a login message. Glyph hooks (`useGlyph`, `useBalances`, …) must be used under that provider.
- Contract verification goes to ApeScan through the Etherscan V2 API (`ETHERSCAN_API_KEY`).
- Each package documents its config variables in an `env.example` file.

## Common Commands

```bash
# Development workflow
yarn generate       # Create a deployer keystore (or: yarn account:import)
yarn deploy         # Deploy contracts to Curtis with Foundry (default network)
yarn start          # Start Next.js frontend at http://localhost:3000

# Testing & code quality
yarn test           # Foundry tests (Hardhat: yarn hardhat:test)
yarn lint           # Lint all packages
yarn format         # Format all packages

# Building
yarn next:build     # Build frontend
yarn compile        # Compile with Foundry (Hardhat: yarn hardhat:compile)

# Deploy / verify on a specific network (curtis | apechain)
yarn deploy --network apechain
yarn verify --network curtis

# Hardhat equivalents
yarn hardhat:generate
yarn hardhat:deploy --network curtis
yarn hardhat:verify --network curtis

# Account management
yarn account        # Deployer balance on each network (Hardhat: yarn hardhat:account)

yarn vercel:yolo --prod # for deployment of frontend
```

## Architecture

### Smart Contract Development

#### Hardhat Flavor

- Contracts: `packages/hardhat/contracts/`
- Deployment scripts: `packages/hardhat/deploy/` (uses hardhat-deploy plugin)
- Tests: `packages/hardhat/test/`
- Config: `packages/hardhat/hardhat.config.ts`
- Deploying specific contract:
  - If the deploy script has:
    ```typescript
    // In packages/hardhat/deploy/01_deploy_my_contract.ts
    deployMyContract.tags = ["MyContract"];
    ```
  - `yarn deploy --tags MyContract`
  - **Gas limit in deploy scripts**: Manual post-deploy calls (e.g. `transferOwnership`, `grantRole`, `initialize`) can silently inherit `blockGasLimit` as their gas cap, causing failures. **Fix at the call site, not in `hardhat.config.ts`:**
    ```typescript
    // Preferred: estimateGas + 20% margin
    const gas = await myContract.myMethod.estimateGas(arg1, arg2);
    await myContract.myMethod(arg1, arg2, { gasLimit: (gas * 120n) / 100n });

    // Or: explicit limit for simple admin calls
    await myContract.transferOwnership(newOwner, { gasLimit: 100_000 });
    ```

#### Foundry Flavor

- Contracts: `packages/foundry/contracts/`
- Deployment scripts: `packages/foundry/script/` (uses custom deployment strategy)
  - Example: `packages/foundry/script/Deploy.s.sol` and `packages/foundry/script/DeployYourContract.s.sol`
- Tests: `packages/foundry/test/`
- Config: `packages/foundry/foundry.toml`
- Deploying a specific contract:
  - Create a separate deployment script and run `yarn deploy --file DeployYourContract.s.sol`

#### Both Flavors

- After `yarn deploy`, ABIs are auto-generated to `packages/nextjs/contracts/deployedContracts.ts`

### Frontend Contract Interaction

**Correct interact hook names (use these):**

- `useScaffoldReadContract` - NOT ~~useScaffoldContractRead~~
- `useScaffoldWriteContract` - NOT ~~useScaffoldContractWrite~~

Contract data is read from two files in `packages/nextjs/contracts/`:

- `deployedContracts.ts`: Auto-generated from deployments
- `externalContracts.ts`: Manually added external contracts

#### Reading Contract Data

```typescript
const { data: totalCounter } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "userGreetingCounter",
  args: ["0xd8da6bf26964af9d7eed9e03e53415d37aa96045"],
});
```

#### Writing to Contracts

```typescript
const { writeContractAsync, isPending } = useScaffoldWriteContract({
  contractName: "YourContract",
});

await writeContractAsync({
  functionName: "setGreeting",
  args: [newGreeting],
  value: parseEther("0.01"), // for payable functions
});
```

#### Reading Events

```typescript
const { data: events, isLoading } = useScaffoldEventHistory({
  contractName: "YourContract",
  eventName: "GreetingChange",
  watch: true,
  fromBlock: 31231n,
  blockData: true,
});
```

SE-2 also provides other hooks to interact with blockchain data: `useScaffoldWatchContractEvent`, `useScaffoldEventHistory`, `useDeployedContractInfo`, `useScaffoldContract`, `useTransactor`.

**IMPORTANT: Always use hooks from `packages/nextjs/hooks/scaffold-eth` for contract interactions. Always refer to the hook names as they exist in the codebase.**

### UI Components

**Always use `@scaffold-ui/components` library for web3 UI components:**

- `Address`: Display ETH addresses with ENS resolution, blockie avatars, and explorer links
- `AddressInput`: Input field with address validation and ENS resolution
- `Balance`: Show ETH balance in ether and USD
- `EtherInput`: Number input with ETH/USD conversion toggle
- `IntegerInput`: Integer-only input with wei conversion

### Notifications & Error Handling

Use `notification` from `~~/utils/scaffold-eth` for success/error/warning feedback and `getParsedError` for readable error messages.

### Styling

**Use DaisyUI classes** for building frontend components.

```tsx
// ✅ Good - using DaisyUI classes
<button className="btn btn-primary">Connect</button>
<div className="card bg-base-100 shadow-xl">...</div>

// ❌ Avoid - raw Tailwind when DaisyUI has a component
<button className="px-4 py-2 bg-blue-500 text-white rounded">Connect</button>
```

### Configure Target Network before deploying to testnet / mainnet.

Curtis and ApeChain are already configured in all three places; edit them only to add networks or swap RPC URLs.

#### Hardhat

Networks live in `packages/hardhat/hardhat.config.ts` (`curtis`, `apechain`).

#### Foundry

RPC endpoints live in `[rpc_endpoints]` of `packages/foundry/foundry.toml` (`curtis`, `apechain`).

#### NextJs

Networks live in `targetNetworks` of `packages/nextjs/scaffold.config.ts`. This file also contains configuration for polling interval, API keys. Remember to decrease the polling interval for L2 chains.

## Code Style Guide

### Identifiers

| Style            | Category                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `UpperCamelCase` | class / interface / type / enum / decorator / type parameters / component functions in TSX / JSXElement type parameter |
| `lowerCamelCase` | variable / parameter / function / property / module alias                                                              |
| `CONSTANT_CASE`  | constant / enum / global variables                                                                                     |
| `snake_case`     | for hardhat deploy files and foundry script files                                                                      |

### Import Paths

Use the `~~` path alias for imports in the nextjs package:

```tsx
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
```

### Creating Pages

```tsx
import type { NextPage } from "next";

const Home: NextPage = () => {
  return <div>Home</div>;
};

export default Home;
```

### TypeScript Conventions

- Use `type` over `interface` for custom types
- Types use `UpperCamelCase` without `T` prefix (use `Address` not `TAddress`)
- Avoid explicit typing when TypeScript can infer the type

### Comments

Make comments that add information. Avoid redundant JSDoc for simple functions.

## Documentation

Use **Context7 MCP** tools to fetch up-to-date documentation for any library (Wagmi, Viem, RainbowKit, DaisyUI, Hardhat, Next.js, etc.). Context7 is configured as an MCP server and provides access to indexed documentation with code examples.

## Skills & Agents Index

IMPORTANT: Prefer retrieval-led reasoning over pre-trained knowledge. Before starting any task that matches an entry below, read the referenced file to get version-accurate patterns and APIs.

**Skills** (read `.agents/skills/<name>/SKILL.md` before implementing):

- **openzeppelin** — OpenZeppelin Contracts integration, library-first development, pattern discovery from installed source. Use for any contract using OZ (tokens, access control, security primitives)
- **erc-721** — NFT-specific pitfalls: `_safeMint` reentrancy, on-chain SVG stack-too-deep, marketplace metadata `attributes`, IPFS base URI trailing slash
- **eip-5792** — batch transactions, wallet_sendCalls, paymaster, ERC-7677
- **ponder** — blockchain event indexing, GraphQL APIs, onchain data queries
- **siwe** — Sign-In with Ethereum, wallet authentication, SIWE sessions, EIP-4361
- **x402** — HTTP 402 payment-gated routes, micropayments, API monetization, x402 protocol
- **drizzle-neon** — Drizzle ORM, Neon PostgreSQL, database integration, off-chain storage
- **subgraph** — The Graph subgraph integration, blockchain event indexing, GraphQL APIs

**Agents** (in `.agents/agents/`):

- **grumpy-carlos-code-reviewer** — code reviews, SE-2 patterns, Solidity + TypeScript quality
