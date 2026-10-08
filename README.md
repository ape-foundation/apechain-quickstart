# apechain-quickstart

Get started with your first ApeChain build.

A [Scaffold-ETH 2](https://scaffoldeth.io) starter kit retargeted to **ApeChain**, with **[Glyph](https://docs.useglyph.io)** as the primary wallet. You get contract hot-reload into the frontend, typed contract hooks, and a Debug Contracts page, running on Curtis testnet and ApeChain mainnet.

- **Networks:** Curtis testnet (chain id `33111`, default) and ApeChain mainnet (`33139`). Native token: APE.
- **Wallets:** Glyph (sign in with email or socials) is listed first in the connect modal. MetaMask, WalletConnect, Coinbase, Rainbow, Ledger and Safe are still available.
- **Contracts:** both **Foundry** (default) and **Hardhat** are included. Use whichever you like, or delete the other package.

## Requirements

- [Node.js](https://nodejs.org) ≥ v22.10
- Yarn 4 (`corepack enable`)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) for the default contract workflow
- Git

## Quickstart

1. Clone with submodules (Foundry's libraries are git submodules) and install:

   ```bash
   git clone --recurse-submodules <this-repo-url>
   cd apechain-quickstart
   yarn install
   ```

   If you already cloned without `--recurse-submodules`, run `git submodule update --init --recursive`.

2. Create a deployer account. This generates an encrypted Foundry keystore:

   ```bash
   yarn generate        # or: yarn account:import  to use an existing private key
   yarn account         # shows the address and its balance on Curtis / ApeChain
   ```

3. Fund the deployer with testnet APE from the [Curtis faucet](https://curtis.hub.caldera.xyz).

4. Deploy `YourContract` to Curtis:

   ```bash
   yarn deploy          # same as: yarn deploy --network curtis
   ```

   This writes the address and ABI to `packages/nextjs/contracts/deployedContracts.ts`.

5. Start the frontend and open http://localhost:3000:

   ```bash
   yarn start
   ```

   Click **Connect Wallet**, choose **Glyph**, sign in, and use the **Debug Contracts** tab to read and write `YourContract`.

There is no local chain in this kit: Glyph is an embedded wallet that can't connect to a localhost node, so you develop against Curtis. Run `yarn test` for fast local contract tests.

### Starting with a coding agent

Point your agent (Claude Code, Cursor, Codex, …) at [`SKILL.md`](SKILL.md) and it will clone the kit into a new project, rename the placeholder contract, and walk you through the deployer account and first deploy:

```
Read https://raw.githubusercontent.com/ape-foundation/apechain-quickstart/main/SKILL.md and use it to start a new ApeChain project called <name>.
```

## Using Hardhat instead of Foundry

Every contract command has a `hardhat:` twin:

```bash
yarn hardhat:generate                    # encrypted deployer key, stored in packages/hardhat/.env
yarn hardhat:account
yarn hardhat:compile
yarn hardhat:test
yarn hardhat:deploy --network curtis     # also updates deployedContracts.ts
yarn hardhat:verify --network curtis
```

To keep only one framework, delete `packages/foundry` or `packages/hardhat`, then remove its scripts from the root `package.json`.

## Going to mainnet

```bash
yarn deploy --network apechain           # Foundry
yarn hardhat:deploy --network apechain   # Hardhat
```

The frontend already targets both networks (see `targetNetworks` in `packages/nextjs/scaffold.config.ts`). The first entry is the default network.

## Verifying contracts

ApeScan uses the Etherscan V2 multichain API, so a single API key from https://etherscan.io/myapikey covers both networks. Set `ETHERSCAN_API_KEY` in the package's env file (see below), then:

```bash
yarn verify --network curtis             # Foundry
yarn hardhat:verify --network curtis     # Hardhat
```

## Configuration

Each package has an `env.example` file that lists its variables:

| Package | Copy `env.example` to | Variables |
| --- | --- | --- |
| `packages/foundry` | `.env` (created on `yarn install`) | `ETHERSCAN_API_KEY` (deployer keys live in `~/.foundry/keystores`) |
| `packages/hardhat` | `.env` | `CURTIS_RPC_URL`, `APECHAIN_RPC_URL`, `ETHERSCAN_API_KEY`, `DEPLOYER_PRIVATE_KEY_ENCRYPTED` |
| `packages/nextjs` | `.env.local` | `NEXT_PUBLIC_CURTIS_RPC_URL`, `NEXT_PUBLIC_APECHAIN_RPC_URL`, `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` |

RPCs default to the public endpoints `https://rpc.curtis.apechain.com` and `https://rpc.apechain.com/http`. For Foundry, edit `[rpc_endpoints]` in `packages/foundry/foundry.toml`.

## How Glyph is wired in

- `packages/nextjs/services/web3/wagmiConnectors.tsx` adds `glyphWalletRK` as the first RainbowKit wallet.
- `packages/nextjs/components/glyph/GlyphWalletWidget.tsx` shows Glyph's wallet widget (balances, funding, swaps, activity) in the header while you're connected with Glyph. `GlyphProvider` is mounted only for Glyph sessions, because it asks the connected wallet to sign a login message and that prompt shouldn't appear for MetaMask users.
- Inside that provider you can use Glyph's hooks (`useGlyph`, `useBalances`, `useGlyphFunding`, …). See the [Glyph reference](https://docs.useglyph.io/reference/).

Everything else is standard Scaffold-ETH 2: hooks like `useScaffoldReadContract` and `useScaffoldWriteContract`, the Debug Contracts page and the components all work as described in the [Scaffold-ETH docs](https://docs.scaffoldeth.io). `AGENTS.md` has the same details for coding agents.

## Credits

Built on [Scaffold-ETH 2](https://github.com/scaffold-eth/scaffold-eth-2) (MIT, see `LICENSE-SCAFFOLD-ETH`) and the [Glyph React SDK](https://github.com/yuga-labs/glyph-sdk-react).
