import "dotenv/config";
import { defineConfig, overrideTask } from "hardhat/config";
import hardhatToolbox from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import HardhatDeploy from "hardhat-deploy";
import generateTsAbis from "./scripts/generateTsAbis.js";

// Only used by the in-process `hardhat` network for tests. Live networks get the decrypted keystore key
// injected by scripts/runHardhatDeployWithPK.ts.
// You can generate a random account with `yarn generate` or `yarn account:import` to import your existing PK
const deployerPrivateKey =
  process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY ?? "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// Public ApeChain RPCs. Override with your own provider (e.g. Alchemy, QuickNode) for production.
const curtisRpcUrl = process.env.CURTIS_RPC_URL || "https://rpc.curtis.apechain.com";
const apechainRpcUrl = process.env.APECHAIN_RPC_URL || "https://rpc.apechain.com/http";

// ApeScan is served through the Etherscan V2 multichain API, so one key covers Curtis and ApeChain.
export const etherscanApiKey = process.env.ETHERSCAN_API_KEY || "DNXJA8RX2Q3VZ4URQIWP7Z68CJXQZSC6AW";

const deployTasks = [
  overrideTask("deploy")
    .setInlineAction(async (args, _hre, runSuper) => {
      // Run the original deploy task
      await runSuper(args);
      // Force run the generateTsAbis script
      await generateTsAbis();
    })
    .build(),
];

export default defineConfig({
  plugins: [hardhatToolbox, HardhatDeploy],
  solidity: {
    compilers: [
      {
        version: "0.8.30",
        settings: {
          optimizer: {
            enabled: true,
            // https://docs.soliditylang.org/en/latest/using-the-compiler.html#optimizer-options
            runs: 200,
          },
        },
      },
    ],
  },
  generateTypedArtifacts: {
    destinations: [
      {
        folder: "./generated",
        mode: "typescript",
      },
    ],
  },
  // Configuration for hardhat-verify and rocketh-verify
  verify: {
    etherscan: {
      apiKey: etherscanApiKey,
    },
  },
  networks: {
    // In-process network used by `yarn hardhat:test`
    hardhat: {
      type: "edr-simulated",
    },
    // ApeChain Curtis testnet (chain id 33111)
    curtis: {
      type: "http",
      chainId: 33111,
      url: curtisRpcUrl,
      accounts: [deployerPrivateKey],
    },
    // ApeChain mainnet (chain id 33139)
    apechain: {
      type: "http",
      chainId: 33139,
      url: apechainRpcUrl,
      accounts: [deployerPrivateKey],
    },
  },
  tasks: deployTasks,
});
