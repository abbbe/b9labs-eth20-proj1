const Splitter = artifacts.require("./Splitter.sol")

module.exports = function(deployer, network, accounts) {
	console.log("Deploying as Alice:", accounts[1]);
	deployer.deploy(Splitter, { from: accounts[1] }); // alice is a creator
};
