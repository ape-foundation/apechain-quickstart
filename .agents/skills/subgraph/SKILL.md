---
name: subgraph
description: "Integrate The Graph subgraph into a Scaffold-ETH 2 project for indexing blockchain events. Use when the user wants to: index contract events with The Graph, add a subgraph, query onchain data with GraphQL, set up a local graph node, or deploy a hosted subgraph on ApeChain or Curtis (Goldsky)."
---

# The Graph Subgraph Integration for Scaffold-ETH 2

## Prerequisites

Check if `./packages/nextjs/scaffold.config.ts` exists directly in the current working directory (do not search subdirectories). If it doesn't exist, this is not an ApeChain Quickstart project. Follow the instructions in `SKILL.md` at the repo root (or https://raw.githubusercontent.com/ape-foundation/apechain-quickstart/main/SKILL.md if you don't have the repo) to scaffold it first. If it exists, continue directly with building.

## Overview

[The Graph](https://thegraph.com/) is a decentralized indexing protocol for querying blockchain data via GraphQL. A **subgraph** defines which contract events to index, how to transform them, and exposes the indexed data through a GraphQL API. This skill adds a subgraph workspace to SE-2 that indexes contracts deployed on **Curtis** (testnet) or **ApeChain** (mainnet).

**Where the subgraph runs.** The Graph's Subgraph Studio and decentralized network don't support ApeChain, so this kit uses:

- **[Goldsky](https://docs.goldsky.com/chains/apechain)** for hosted subgraphs. It runs standard Graph subgraphs (same manifest, schema, mappings and `graph-cli` build) on both chains, with network slugs `apechain-curtis` and `apechain-mainnet`. It has a free tier.
- **A local Graph Node (Docker)** pointed at the Curtis RPC, for iterating on mappings without redeploying to Goldsky. Optional.

There is no local chain in this kit, so both options index real Curtis (or ApeChain) blocks. Deploy your contracts with `yarn deploy` first.

For The Graph's full API reference, see the [official docs](https://thegraph.com/docs/). This skill focuses on the SE-2 integration — the workspace structure, the ABI copy bridge, and the build/deploy workflow.

## Dependencies & Scripts

### Subgraph package (`packages/subgraph/`)

Create `packages/subgraph/package.json`:

```json
{
  "name": "@se-2/subgraph",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "abi-copy": "tsx scripts/abi_copy.ts",
    "codegen": "graph codegen",
    "build": "graph build",
    "graph": "graph",
    "ship": "yarn abi-copy && yarn codegen && yarn build --network apechain-curtis && goldsky subgraph deploy your-contract/0.0.1 --path .",
    "ship:mainnet": "yarn abi-copy && yarn codegen && yarn build --network apechain-mainnet && goldsky subgraph deploy your-contract-mainnet/0.0.1 --path .",
    "create-local": "graph create --node http://localhost:8020/ scaffold-eth/your-contract",
    "remove-local": "graph remove --node http://localhost:8020/ scaffold-eth/your-contract",
    "deploy-local": "graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 scaffold-eth/your-contract",
    "local-ship": "yarn abi-copy && yarn codegen && yarn build --network apechain-curtis && yarn deploy-local",
    "test": "graph test -d",
    "run-node": "cd graph-node && docker compose up",
    "stop-node": "cd graph-node && docker compose down",
    "clean-node": "rm -rf graph-node/data/"
  },
  "dependencies": {
    "@graphprotocol/graph-cli": "^0.98.0",
    "@graphprotocol/graph-ts": "^0.38.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0"
  },
  "devDependencies": {
    "@types/chalk": "^2.2.0",
    "@types/node": "^20.11.0",
    "matchstick-as": "~0.6.0"
  }
}
```

### NextJS package additions

For querying the subgraph from the frontend via Graph Client:

```json
{
  "scripts": {
    "client": "graphclient build"
  },
  "dependencies": {
    "graphql": "^16.8.0"
  },
  "devDependencies": {
    "@graphprotocol/client-cli": "^3.0.0"
  }
}
```

### Root package.json scripts

```json
{
  "graph": "yarn workspace @se-2/subgraph graph",
  "graphclient:build": "yarn workspace @se-2/nextjs client",
  "subgraph:abi-copy": "yarn workspace @se-2/subgraph abi-copy",
  "subgraph:build": "yarn workspace @se-2/subgraph build",
  "subgraph:clean-node": "yarn workspace @se-2/subgraph clean-node",
  "subgraph:codegen": "yarn workspace @se-2/subgraph codegen",
  "subgraph:create-local": "yarn workspace @se-2/subgraph create-local",
  "subgraph:local-ship": "yarn workspace @se-2/subgraph local-ship",
  "subgraph:run-node": "yarn workspace @se-2/subgraph run-node",
  "subgraph:ship": "yarn workspace @se-2/subgraph ship",
  "subgraph:ship:mainnet": "yarn workspace @se-2/subgraph ship:mainnet",
  "subgraph:stop-node": "yarn workspace @se-2/subgraph stop-node",
  "subgraph:test": "yarn workspace @se-2/subgraph test -d"
}
```

`goldsky` is a global CLI, not a package dependency. Install it once with `curl https://goldsky.com | sh` (Windows: `npm install -g @goldskycom/cli`) and run `goldsky login`.

## Docker Setup (Local Graph Node, optional)

Skip this section if you only deploy to Goldsky. The local node needs three services: a Graph Node, IPFS, and PostgreSQL. Create `packages/subgraph/graph-node/docker-compose.yml` with these three services:

- **graph-node**: `graphprotocol/graph-node:v0.41.1` — ports 8000 (GraphQL), 8001, 8020 (admin), 8030, 8040. Set `ethereum: "apechain-curtis:https://rpc.curtis.apechain.com"`. The part before the colon is the network name and must match `network:` in `subgraph.yaml`, so the same manifest works locally and on Goldsky. Use a dedicated RPC (e.g. Alchemy's Curtis endpoint) for anything beyond light testing: graph-node makes many requests and the public RPC rate-limits.
- **ipfs**: `ipfs/kubo:v0.39.0` (not the legacy `ipfs/go-ipfs`) — port 5001, volume `./data/ipfs:/data/ipfs`
- **postgres**: `postgres` — port 5432, volume `./data/postgres:/var/lib/postgresql/data`. Credentials: user `graph-node`, password `let-me-in`, db `graph-node`. **Must set `POSTGRES_INITDB_ARGS: "--locale=C --encoding=UTF8"`** — graph-node requires the C locale and will panic on startup otherwise.

The graph-node environment also needs: `postgres_host: postgres`, `postgres_user/pass/db`, `ipfs: "ipfs:5001"`, `GRAPH_LOG: info`.

## Subgraph Configuration

### Subgraph manifest (`subgraph.yaml`)

The manifest defines what to index. Adapt this to the project's actual contracts:

```yaml
# packages/subgraph/subgraph.yaml
specVersion: 0.0.4
description: Your subgraph description
schema:
  file: ./src/schema.graphql
dataSources:
  - kind: ethereum/contract
    name: YourContract
    network: apechain-curtis
    source:
      abi: YourContract
      # Filled in from networks.json by `graph build --network <name>` (written by abi-copy)
      address: "0x0000000000000000000000000000000000000000"
      startBlock: 0
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.6
      language: wasm/assemblyscript
      entities:
        - Greeting
        - Sender
      abis:
        - name: YourContract
          file: ./abis/YourContract.json
      eventHandlers:
        - event: GreetingChange(indexed address,string,bool,uint256)
          handler: handleGreetingChange
      file: ./src/mapping.ts
```

**Key fields to update per project:**

- `name` — must match the contract name in `deployedContracts.ts`
- `network`, `address`, `startBlock` — don't edit by hand. `abi-copy` writes them to `networks.json` and `graph build --network <name>` copies them into the manifest
- `startBlock` — matters a lot on a live chain: without it the indexer scans from genesis, which takes hours on Curtis
- `eventHandlers` — must match the exact Solidity event signatures (parameter names don't matter, types and order do)
- `entities` — must match what's defined in `schema.graphql`

### GraphQL schema (`src/schema.graphql`)

Define entities that represent your indexed data. Each entity maps to a table in the Graph Node's Postgres:

```graphql
# packages/subgraph/src/schema.graphql
type Greeting @entity(immutable: true) {
  id: ID!
  sender: Sender!
  greeting: String!
  premium: Boolean
  value: BigInt
  createdAt: BigInt!
  transactionHash: String!
}

type Sender @entity(immutable: false) {
  id: ID!
  address: Bytes!
  greetings: [Greeting!] @derivedFrom(field: "sender")
  createdAt: BigInt!
  greetingCount: BigInt!
}
```

### AssemblyScript mappings (`src/mapping.ts`)

Mappings transform raw event data into entities. They're written in [AssemblyScript](https://www.assemblyscript.org/) (a TypeScript subset that compiles to WASM):

```typescript
// packages/subgraph/src/mapping.ts
import { BigInt } from "@graphprotocol/graph-ts";
import { GreetingChange } from "../generated/YourContract/YourContract";
import { Greeting, Sender } from "../generated/schema";

export function handleGreetingChange(event: GreetingChange): void {
  const senderString = event.params.greetingSetter.toHexString();
  let sender = Sender.load(senderString);

  if (sender === null) {
    sender = new Sender(senderString);
    sender.address = event.params.greetingSetter;
    sender.createdAt = event.block.timestamp;
    sender.greetingCount = BigInt.fromI32(1);
  } else {
    sender.greetingCount = sender.greetingCount.plus(BigInt.fromI32(1));
  }

  const greeting = new Greeting(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString(),
  );
  greeting.greeting = event.params.newGreeting;
  greeting.sender = senderString;
  greeting.premium = event.params.premium;
  greeting.value = event.params.value;
  greeting.createdAt = event.block.timestamp;
  greeting.transactionHash = event.transaction.hash.toHex();

  greeting.save();
  sender.save();
}
```

AssemblyScript compiles to WASM — no closures, no `Array.map/filter/reduce`, no `console.log`. Use `@graphprotocol/graph-ts` utilities for logging (`log.info()`).

## ABI Copy Bridge

The `abi-copy` script bridges SE-2's deployment output to the subgraph. It reads `packages/nextjs/contracts/deployedContracts.ts`, extracts ABIs, addresses and deployment blocks for Curtis (33111) and ApeChain (33139), and writes them to `packages/subgraph/abis/` and `networks.json` under the Graph network names `apechain-curtis` and `apechain-mainnet`.

Create `packages/subgraph/scripts/abi_copy.ts` — this script parses the deployedContracts file, extracts contract data, and publishes it:

```typescript
// packages/subgraph/scripts/abi_copy.ts
import * as fs from "fs";
import type { Abi } from "viem";

const DEPLOYED_CONTRACTS_FILE = "../nextjs/contracts/deployedContracts.ts";
const GRAPH_DIR = "./";

// Chain id → network name used by graph-node and Goldsky
const GRAPH_NETWORKS: Record<number, string> = {
  33111: "apechain-curtis",
  33139: "apechain-mainnet",
};

function publishContract(
  contractName: string,
  contractObject: { address: string; abi: Abi; deployedOnBlock?: number },
  networkName: string,
) {
  const graphConfigPath = `${GRAPH_DIR}/networks.json`;
  let graphConfig = fs.existsSync(graphConfigPath)
    ? JSON.parse(fs.readFileSync(graphConfigPath, "utf8"))
    : {};

  if (!graphConfig[networkName]) graphConfig[networkName] = {};
  graphConfig[networkName][contractName] = {
    address: contractObject.address,
    startBlock: contractObject.deployedOnBlock ?? 0,
  };

  fs.writeFileSync(graphConfigPath, JSON.stringify(graphConfig, null, 2));
  if (!fs.existsSync(`${GRAPH_DIR}/abis`)) fs.mkdirSync(`${GRAPH_DIR}/abis`);
  fs.writeFileSync(
    `${GRAPH_DIR}/abis/${contractName}.json`,
    JSON.stringify(contractObject.abi, null, 2),
  );
}

async function main() {
  const fileContent = fs.readFileSync(DEPLOYED_CONTRACTS_FILE, "utf8");
  const match = fileContent.match(
    /const deployedContracts = ({[^;]+}) as const;/s,
  );
  if (!match?.[1]) throw new Error("Failed to find deployedContracts");

  // Parse the TS object literal as JSON (add quotes around keys, remove trailing commas)
  let json = match[1]
    .replace(/(\w+)(?=\s*:)/g, '"$1"')
    .replace(/,(?=\s*[}\]])/g, "");
  const contracts = JSON.parse(json);

  let published = 0;
  for (const [chainId, networkName] of Object.entries(GRAPH_NETWORKS)) {
    const chainContracts = contracts[chainId];
    if (!chainContracts) continue;
    for (const name in chainContracts) {
      publishContract(name, chainContracts[name], networkName);
      published++;
    }
  }
  if (published === 0) {
    console.error("No contracts on Curtis or ApeChain in deployedContracts.ts. Run `yarn deploy` first.");
    process.exit(1);
  }
  console.log(`Published ${published} contract(s) to the subgraph package.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

## Graph Client (Frontend Queries)

[Graph Client](https://github.com/graphprotocol/graph-client) provides a typed GraphQL client with features like client-side composition and automatic pagination.

### Configuration

```yaml
# packages/nextjs/.graphclientrc.yml
sources:
  - name: YourContract
    handler:
      graphql:
        # Goldsky (printed by `goldsky subgraph deploy`), e.g.
        # https://api.goldsky.com/api/public/<project-id>/subgraphs/your-contract/0.0.1/gn
        # or the local Graph Node: http://localhost:8000/subgraphs/name/scaffold-eth/your-contract
        endpoint: https://api.goldsky.com/api/public/<project-id>/subgraphs/your-contract/0.0.1/gn
documents:
  - ./graphql/GetGreetings.gql
```

### GraphQL queries

```graphql
# packages/nextjs/graphql/GetGreetings.gql
query GetGreetings {
  greetings(first: 25, orderBy: createdAt, orderDirection: desc) {
    id
    greeting
    premium
    value
    createdAt
    sender {
      address
      greetingCount
    }
  }
}
```

### Using in components

After running `yarn graphclient:build`, import the generated client. Use TanStack Query (already available in SE-2) for data fetching:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { GetGreetingsDocument, execute } from "~~/.graphclient";

async function fetchGreetings() {
  const result = await execute(GetGreetingsDocument, {});
  return result.data?.greetings ?? [];
}

const GreetingsTable = () => {
  const {
    data: greetings = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["subgraph-greetings"],
    queryFn: fetchGreetings,
  });

  // Render data...
};
```

> **`~~/.graphclient`** is the generated runtime artifact. It only exists after `yarn graphclient:build`. The `.graphclient/` directory should NOT be committed — it's generated from `.graphclientrc.yml` and the GQL files.

## Gotchas & Common Pitfalls

**Don't use Subgraph Studio or `graph deploy --studio`.** The Graph's hosted network doesn't list ApeChain or Curtis, so the deploy is rejected. Use Goldsky (or another Graph-compatible host that supports ApeChain).

**Docker must be running for the local node.** The local Graph Node, IPFS, and Postgres all run in Docker. If Docker isn't running, `yarn subgraph:run-node` will fail. Goldsky deploys don't need Docker.

**`yarn deploy` must run before `yarn subgraph:abi-copy`.** The ABI copy script reads from `deployedContracts.ts` which is generated by the deploy step. If you haven't deployed, there's nothing to copy.

**`ship` / `local-ship` do everything in one command.** They run `abi-copy` → `codegen` → `build --network …` → deploy (Goldsky or local node). Use these instead of running each step manually.

**Bump the Goldsky version on every redeploy.** `goldsky subgraph deploy your-contract/0.0.1` fails if that version already exists. Bump the version in the `ship` script (and the Graph Client endpoint), or delete the old one with `goldsky subgraph delete your-contract/0.0.1`.

**Redeploying the contract means re-shipping the subgraph.** A new `yarn deploy` changes the address and start block. Re-run `ship` (with a new version) so the subgraph follows the new contract.

**`create-local` only needs to run once.** It registers the subgraph name with the local Graph Node. Running it again will error with "subgraph already exists." Only re-run after `clean-node`.

**Graph Client artifacts must be regenerated after schema changes.** Run `yarn graphclient:build` whenever you change the GraphQL schema or queries. The frontend imports from `~~/.graphclient` which contains generated types.

**Port conflicts with other services.** The Graph Node stack uses ports 5001 (IPFS), 5432 (Postgres), 8000 (GraphQL), 8020 (admin). If you're also running the drizzle-neon extension (which uses port 5432 for its own Postgres), you'll have a conflict. Change one of the Postgres ports.

## How to Test

1. `yarn deploy` — deploy contracts to Curtis (generates `deployedContracts.ts` with the address and `deployedOnBlock`)
2. `yarn subgraph:abi-copy` — check that `packages/subgraph/networks.json` has an `apechain-curtis` entry with the right address and `startBlock`
3. `yarn subgraph:test` — run Matchstick unit tests (no chain needed)

### Deploying to Goldsky (recommended)

1. Install the CLI and run `goldsky login` (see Dependencies & Scripts)
2. `yarn subgraph:ship` — copies ABIs, generates types, builds for `apechain-curtis`, and deploys to Goldsky. The CLI prints the GraphQL endpoint
3. Open the endpoint in a browser and run a query once indexing catches up (the Goldsky dashboard shows progress)
4. Put the endpoint in `packages/nextjs/.graphclientrc.yml`, run `yarn graphclient:build`, then `yarn start` and visit the subgraph page

For mainnet, `yarn deploy --network apechain`, then `yarn subgraph:ship:mainnet`.

### Local Graph Node (optional)

1. `yarn subgraph:run-node` — start the Docker Graph Node indexing Curtis (keep this terminal open)
2. `yarn subgraph:create-local` — register subgraph (once only)
3. `yarn subgraph:local-ship` — copies ABIs, generates types, builds, and deploys to the local node
4. Visit `http://localhost:8000/subgraphs/name/scaffold-eth/your-contract/graphql` — test GraphQL queries
5. Point `.graphclientrc.yml` at that URL, run `yarn graphclient:build` and `yarn start`

Events only show up after you send transactions to the contract on Curtis (e.g. `setGreeting` from the Debug Contracts page with Glyph).
