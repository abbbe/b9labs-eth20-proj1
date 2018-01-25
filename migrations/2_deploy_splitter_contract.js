const Splitter = artifacts.require("./Splitter.sol")

module.exports = function(deployer, network, accounts) {
	deployer.deploy(Splitter, accounts[1], accounts[2], accounts[3]);
};
