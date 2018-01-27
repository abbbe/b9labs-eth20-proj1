const Splitter = artifacts.require("./Splitter.sol")

module.exports = function(deployer, network, accounts) {
	console.log("Accounts:", accounts[1], accounts[2], accounts[3]);
	deployer.deploy(Splitter, accounts[2], accounts[3], { from: accounts[1] }); // alice is a creator
};
