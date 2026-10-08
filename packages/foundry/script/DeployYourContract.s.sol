// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "../contracts/YourContract.sol";

/**
 * @notice Deploy script for YourContract contract
 * @dev Inherits ScaffoldETHDeploy which:
 *      - Includes forge-std/Script.sol for deployment
 *      - Includes ScaffoldEthDeployerRunner modifier
 *      - Provides `deployer` variable
 * Example:
 * yarn deploy --file DeployYourContract.s.sol                      # Curtis testnet (default)
 * yarn deploy --file DeployYourContract.s.sol --network apechain   # ApeChain mainnet
 */
contract DeployYourContract is ScaffoldETHDeploy {
    /**
     * @dev The deployer is the keystore account you pick (or pass with --keystore). It needs APE for gas.
     *
     * Note: Must use ScaffoldEthDeployerRunner modifier to:
     *      - Setup correct `deployer` account
     *      - Export contract addresses & ABIs to `nextjs` packages
     */
    function run() external ScaffoldEthDeployerRunner {
        new YourContract(deployer);
    }
}
