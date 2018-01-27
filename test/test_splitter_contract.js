var Splitter = artifacts.require("./Splitter.sol");

contract('Splitter', function (accounts) {
  const alice = accounts[1];
  const bob = accounts[2];
  const carol = accounts[3];

  // returns an array containing account balances (as BigNumber, in wei)
  function getBalances() {
    return [splitter.address, alice, bob, carol].map(function (acc) { return web3.eth.getBalance(acc) });
  }

  // returns an array of BigNumbers, containing differences between current and "before" account balances
  function getBalancesDiff(balancesBefore) {
    var balancesAfter = getBalances();
    return balancesBefore.map(function (_, i) { return balancesAfter[i].minus(balancesBefore[i]) });
  }

  // compares balances "before" (array of BigNumbers as returned by getBalances()) with expected ones (simple numbers)
  function assertBalancesDiffEqual(balancesBefore, expectedDiffNumbers) {
    var balancesDiff = getBalancesDiff(balancesBefore);
    var balancesDiffNumbers = balancesDiff.map(function (n) { return n.toNumber() });
    assert.deepEqual(balancesDiffNumbers, expectedDiffNumbers);
  }

  before(async function () {
    splitter = await Splitter.deployed();

    console.log("Splitter:", splitter.address);
    console.log("Alice:", alice);
    console.log("Bob:", bob);
    console.log("Carol:", carol);
  });

  it("funds sent by Alice should split between Bob and Carol", async function () {
    // calculate expected amounts to be debited and credited
    var amount = 1000000;
    var halfAmount1 = Math.floor(amount / 2);
    var halfAmount2 = amount - halfAmount1;

    // send some amount to Splitter on behalf of Alice
    var balancesBefore = getBalances();
    var tx = await web3.eth.sendTransaction({ from: alice, to: splitter.address, value: amount });

    var txReceipt = await web3.eth.getTransactionReceipt(tx);
    assertBalancesDiffEqual(balancesBefore, [0, -txReceipt.gasUsed - amount, halfAmount1, halfAmount2]);
  });

  it("funds sent by non-Alice should be kept by Splitter", async function () {
    var amount = 1000000;

    var balancesBefore = getBalances();
    var tx = await web3.eth.sendTransaction({ from: bob, to: splitter.address, value: amount });

    var txReceipt = await web3.eth.getTransactionReceipt(tx);
    assertBalancesDiffEqual(balancesBefore, [amount, 0, -txReceipt.gasUsed - amount, 0]);
  });
});
