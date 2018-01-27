web3.eth.getTransactionReceiptMined = require("./getTransactionReceiptMined.js");

var Splitter = artifacts.require("./Splitter.sol");

contract('Splitter', function (accounts) {
  const alice = accounts[1];
  const bob = accounts[2];
  const carol = accounts[3];
  const dave = accounts[4];
  const emma = accounts[5];
  var splitter;

  // returns an array containing account balances (as BigNumber, in wei)
  function getBalances() {
    return [splitter.address, alice, bob, carol, dave, emma].map(function (acc) { return web3.eth.getBalance(acc) });
  }

  // returns an array of BigNumbers, containing differences between current and "before" account balances
  function getBalancesDiff(balancesBefore) {
    var balancesAfter = getBalances();
    return balancesBefore.map(function (_, i) { return balancesAfter[i].minus(balancesBefore[i]) });
  }

  // compares balances "before" (array of BigNumbers as returned by getBalances()) with expected ones (simple numbers)
  function assertBalancesDiffEqual(balancesBefore, expectedDiffNumbers) {
    var actualDiffs = getBalancesDiff(balancesBefore).map(function (n) { return n.toString(10) });
    var expectedDiffs = expectedDiffNumbers.map(function (n) { return n.toString(); });
    assert.deepEqual(actualDiffs, expectedDiffs);
  }

  before(async function () {
    splitter = await Splitter.deployed();

    console.log("Splitter:", splitter.address);
    console.log("Alice:", alice);
    console.log("Bob:", bob);
    console.log("Carol:", carol);
    console.log("Dave:", dave);
    console.log("Emma:", emma);

    assert.equal(alice, accounts[1]);
    assert.equal(bob, accounts[2]);
    assert.equal(carol, accounts[3]);
    assert.equal(dave, accounts[4]);
    assert.equal(emma, accounts[5]);
  });

  it("funds sent by Alice to fallback should split between Bob and Carol", async function () {
    // calculate expected amounts to be debited and credited
    var amount = 1000000;
    var halfAmount1 = Math.floor(amount / 2);
    var halfAmount2 = amount - halfAmount1;

    // send some amount to Splitter on behalf of Alice
    var balancesBefore = getBalances();
    var txHash = web3.eth.sendTransaction({ from: alice, to: splitter.address, value: amount });
    var tx = web3.eth.getTransaction(txHash);
    var txReceipt = await web3.eth.getTransactionReceiptMined(txHash);

    // got receipt for the transaction
    var txCost = txReceipt.gasUsed * tx.gasPrice;
    assertBalancesDiffEqual(balancesBefore, [0, -txCost - amount, halfAmount1, halfAmount2, 0, 0]);
  });

  function _assertRevert(error, tag) {
    // console.log(`${tag} err:`, JSON.stringify(error));
    const revertFound = error.message.search('revert') >= 0;
    assert(revertFound, `Expected "revert", got ${error} instead`);
  };

  it("transfers from Bob should fail", function (done) {
    var amount = 1000000;

    // send some amount to Splitter on behalf of Bob
    try {
      web3.eth.sendTransaction({ from: bob, to: splitter.address, value: amount }, function (error, txHash) {
        if (error) {
          _assertRevert(error, '@sendTransaction-catch');
          done();
        } else {
          // txHash is known
          //console.log('txHash:', txHash); // DEBUG
          web3.eth.getTransaction(txHash, function (error, tx) {
            assert.isNull(error, '@getTransaction-callback');
            // tx is known
            //console.log('tx:', JSON.stringify(tx)); // DEBUG
            web3.eth.getTransactionReceiptMined(txHash).then(
              (receipt) => {
                // receipt is known
                //console.log("receipt:", JSON.stringify(receipt));
                assert.equal(receipt.status, 0, 'Transaction has not failed');
                done();
              }, (error) => {
                assert.fail('@getTransactionReceiptMined-error');
              }
            );
          });
        }
      });
    } catch (error) {
      _assertRevert('@sendTransaction-catch', error);
      done();
    }
  });

  it("funds sent by Dave to split(emma, carol) should be split between Emma and Carol", async function () {
    var amount = 1000000;
    var halfAmount1 = Math.floor(amount / 2);
    var halfAmount2 = amount - halfAmount1;

    // send some amount to Splitter on behalf of Bob
    var balancesBefore = getBalances();
    var txInfo = await splitter.split(emma, carol, { from: dave, to: splitter.address, value: amount });
    var tx = web3.eth.getTransaction(txInfo.tx);
    var txReceipt = await web3.eth.getTransactionReceiptMined(txInfo.tx);

    // got receipt for the transaction
    var txCost = txReceipt.gasUsed * tx.gasPrice;
    assertBalancesDiffEqual(balancesBefore, [0, 0, 0, halfAmount2, -txCost - amount, halfAmount1]);
  });

  // got receipt for the transaction
  //var txCost = txReceipt.gasUsed * tx.gasPrice;
  //assertBalancesDiffEqual(balancesBefore, [amount, 0, -txCost - amount, 0, 0, 0]);

});
