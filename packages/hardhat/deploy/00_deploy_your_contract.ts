import { deployScript, artifacts } from "../rocketh/deploy.js";

/**
 * Deploys a contract named "YourContract" using the deployer account and
 * constructor arguments set to the deployer address
 *
 * @param env Rocketh environment object.
 */
export default deployScript(
  async env => {
    /*
      When deploying to ApeChain (e.g `yarn hardhat:deploy --network curtis`), the deployer account
      needs enough APE to pay for gas. Get testnet APE for Curtis from https://curtis.hub.caldera.xyz

      You can generate a random account with `yarn generate` or `yarn account:import` to import your
      existing PK which will fill DEPLOYER_PRIVATE_KEY_ENCRYPTED in the .env file (then used on hardhat.config.ts)
      You can run the `yarn account` command to check your balance in every network.
    */
    const { deployer } = env.namedAccounts;

    const yourContract = await env.deploy("YourContract", {
      account: deployer,
      artifact: artifacts.YourContract,
      // Contract constructor arguments
      args: [deployer],
    });

    // Read back from the deployed contract
    const greeting = await env.read(yourContract, { functionName: "greeting" });
    console.log("👋 Initial greeting:", greeting);
  },
  {
    // Tags are useful if you have multiple deploy files and only want to run some of them.
    // e.g. yarn deploy --tags YourContract
    tags: ["YourContract"],
  },
);
