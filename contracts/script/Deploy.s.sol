// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";

import {HumanRegistry} from "../src/HumanRegistry.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {RareItems} from "../src/RareItems.sol";
import {RareMarket} from "../src/RareMarket.sol";
import {RoosterRWA} from "../src/RoosterRWA.sol";

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

    struct Deployed {
        address usdc;
        address registry;
        address rare;
        address market;
        address rooster;
        address gameSigner;
        address farmSigner;
        address treasury;
        uint256 chainId;
        uint256 startBlock;
    }

    function run() public {
        uint256 deployerKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (deployerKey == 0) deployerKey = ANVIL_DEPLOYER;

        Deployed memory d;
        d.gameSigner = vm.envOr("GAME_SIGNER_ADDRESS", ANVIL_GAME_SIGNER);
        d.farmSigner = vm.envOr("FARM_SIGNER_ADDRESS", ANVIL_FARM_SIGNER);
        d.treasury = vm.envOr("TREASURY_ADDRESS", ANVIL_TREASURY);
        string memory baseURI = vm.envOr("RARE_ITEMS_BASE_URI", string("http://localhost:3000/api/items/"));

        vm.startBroadcast(deployerKey);

        address owner = vm.addr(deployerKey);
        MockUSDC usdc = new MockUSDC();
        HumanRegistry registry = new HumanRegistry(d.gameSigner, owner);
        RareItems rare = new RareItems(d.gameSigner, registry, baseURI, owner);
        RareMarket market = new RareMarket(rare, usdc, registry, d.treasury, owner);
        // RFC Club holds mint rights; starts as deployer, transfer later.
        RoosterRWA rooster = new RoosterRWA(d.farmSigner, owner);

        d.usdc = address(usdc);
        d.registry = address(registry);
        d.rare = address(rare);
        d.market = address(market);
        d.rooster = address(rooster);
        d.chainId = block.chainid;
        d.startBlock = block.number;

        vm.stopBroadcast();

        _writeJson(d);
    }

    function _writeJson(Deployed memory d) internal {
        string memory chain = _chainName(d.chainId);
        string memory json = "{\n";
        json = string.concat(json, '  "chainId": ', vm.toString(d.chainId), ",\n");
        json = string.concat(json, _kv("HumanRegistry", vm.toString(d.registry)));
        json = string.concat(json, _kv("RareItems", vm.toString(d.rare)));
        json = string.concat(json, _kv("RareMarket", vm.toString(d.market)));
        json = string.concat(json, _kv("MockUSDC", vm.toString(d.usdc)));
        json = string.concat(json, _kv("RoosterRWA", vm.toString(d.rooster)));
        json = string.concat(json, _kv("gameSigner", vm.toString(d.gameSigner)));
        json = string.concat(json, _kv("farmSigner", vm.toString(d.farmSigner)));
        json = string.concat(json, _kv("treasury", vm.toString(d.treasury)));
        json = string.concat(json, '  "startBlock": ', vm.toString(d.startBlock), "\n}");
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
