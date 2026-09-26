// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";

import {HumanRegistry} from "../src/HumanRegistry.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {RareItems} from "../src/RareItems.sol";
import {RareMarket} from "../src/RareMarket.sol";

/// @notice Deploys the RFC Legends contracts and writes
///         contracts/deployments/<chain>.json (see docs/interfaces.md §4.6).
///         Set SEPOLIA_RPC_URL + DEPLOYER_PRIVATE_KEY for Sepolia; defaults
///         to anvil account #0 so `forge script` works on a local node.
contract Deploy is Script {
    // Local fallbacks: anvil deterministic accounts #0..#3.
    uint256 internal constant ANVIL_DEPLOYER =
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address internal constant ANVIL_GAME_SIGNER = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address internal constant ANVIL_FARM_SIGNER = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address internal constant ANVIL_TREASURY = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;

    function run() public {
        uint256 deployerKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (deployerKey == 0) deployerKey = ANVIL_DEPLOYER;
        address gameSigner = vm.envOr("GAME_SIGNER_ADDRESS", ANVIL_GAME_SIGNER);
        address farmSigner = vm.envOr("FARM_SIGNER_ADDRESS", ANVIL_FARM_SIGNER);
        address treasury = vm.envOr("TREASURY_ADDRESS", ANVIL_TREASURY);
        string memory baseURI = vm.envOr("RARE_ITEMS_BASE_URI", string("http://localhost:3000/api/items/"));

        vm.startBroadcast(deployerKey);

        MockUSDC usdc = new MockUSDC();
        HumanRegistry registry = new HumanRegistry(gameSigner);
        RareItems rare = new RareItems(gameSigner, registry, baseURI);
        RareMarket market = new RareMarket(rare, usdc, registry, treasury);

        uint256 startBlock = block.number;

        vm.stopBroadcast();

        string memory chain = _chainName(block.chainid);
        string memory json = "{\n";
        json = string.concat(json, '  "chainId": ', vm.toString(block.chainid), ",\n");
        json = string.concat(json, _kv("HumanRegistry", vm.toString(address(registry))));
        json = string.concat(json, _kv("RareItems", vm.toString(address(rare))));
        json = string.concat(json, _kv("RareMarket", vm.toString(address(market))));
        json = string.concat(json, _kv("MockUSDC", vm.toString(address(usdc))));
        json = string.concat(json, _kv("gameSigner", vm.toString(gameSigner)));
        json = string.concat(json, _kv("farmSigner", vm.toString(farmSigner)));
        json = string.concat(json, _kv("treasury", vm.toString(treasury)));
        json = string.concat(json, '  "startBlock": ', vm.toString(startBlock), "\n}");
        vm.writeFile(string.concat("./deployments/", chain, ".json"), json);
        console2.log(string.concat("Wrote deployments/", chain, ".json:"));
        console2.log(json);
    }

    function _kv(string memory key, string memory value) internal pure returns (string memory) {
        return string.concat('  "', key, '": "', value, '",\n');
    }

    function _chainName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 11155111) return "sepolia";
        if (chainId == 31337) return "anvil";
        return string.concat("chain-", vm.toString(chainId));
    }
}
