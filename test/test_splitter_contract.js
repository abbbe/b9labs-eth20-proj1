Promise = require("bluebird");
Promise.promisifyAll(web3.eth, { suffix: "Promise" });

web3.eth.getTransactionReceiptMined = require("./getTransactionReceiptMined.js");

var Splitter = artifacts.require("./Splitter.sol");

contract('Splitter', function (accounts) {
  const alice = accounts[1];
  const bob = accounts[2];
  const carol = accounts[3];
  const dave = accounts[4];
  const emma = accounts[5];
  var splitter;

  // returns promise of an array containing account balances (as BigNumber, in wei)
  function getBalances() {
    return Promise.all([splitter.address, alice, bob, carol, dave, emma]
      .map(acc => web3.eth.getBalancePromise(acc)));
  }

  // compares balances "before" (array of BigNumbers as returned by getBalances()) with expected ones (simple numbers)
  function assertBalancesDiffEqual(balancesBefore, expectedDiffNumbers) {
    return getBalances().then(balancesAfter => {
      var actualDiffStr = balancesBefore.map((_, i) => balancesAfter[i].minus(balancesBefore[i]).toString(10));
      var expectedDiffStr = expectedDiffNumbers.map(n => n.toString());
      assert.deepEqual(actualDiffStr, expectedDiffStr);
    });
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

  it("funds sent by Alice to fallback should be claimable by Bob and Carol", function (done) {
    // calculate expected amounts to be debited and credited
    var amount = 1000000;
    var halfAmount1 = Math.floor(amount / 2);
    var halfAmount2 = amount - halfAmount1;

    // send some amount to Splitter on behalf of Alice
    var balancesBefore, txHash, tx, txCost;
    var txBobInfo, txCostBob, txCarolInfo;
    getBalances().then(_balancesBefore => {
      balancesBefore = _balancesBefore;
      return web3.eth.sendTransactionPromise({ from: alice, to: splitter.address, value: amount });
    }).then(_txHash => {
      txHash = _txHash;
      return web3.eth.getTransactionPromise(txHash);
    }).then(_tx => {
      tx = _tx;
      return web3.eth.getTransactionReceiptMined(txHash);
    }).then(txReceipt => {
      // got receipt for the transaction - make sure funds are with splitter
      txCost = txReceipt.gasUsed * tx.gasPrice;
      return assertBalancesDiffEqual(balancesBefore, [amount, -txCost - amount, 0, 0, 0, 0]);
    }).then(() => {
      // claim as bob
      return splitter.withdraw({ from: bob });
    }).then(_txBobInfo => {
      txBobInfo = _txBobInfo;
      return web3.eth.getTransactionPromise(txBobInfo.tx);
    }).then(txBob => {
      txCostBob = txBobInfo.receipt.gasUsed * txBob.gasPrice;
      // claim as carol
      return splitter.withdraw({ from: carol });
    }).then(_txCarolInfo => {
      txCarolInfo = _txCarolInfo;
      return web3.eth.getTransactionPromise(txCarolInfo.tx);
    }).then(txCarol => {
      var txCostCarol = txCarolInfo.receipt.gasUsed * txCarol.gasPrice;
      return assertBalancesDiffEqual(balancesBefore, [0, -txCost - amount, halfAmount1 - txCostBob, halfAmount2 - txCostCarol, 0, 0]);
    }).then(() => {
      done();
    });
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

  // it("funds sent by Dave to split(emma, carol) should be split between Emma and Carol", async function () {
  //   var amount = 1000000;
  //   var halfAmount1 = Math.floor(amount / 2);
  //   var halfAmount2 = amount - halfAmount1;

  //   // send some amount to Splitter on behalf of Bob
  //   var balancesBefore = getBalances();
  //   var txInfo = await splitter.split(emma, carol, { from: dave, to: splitter.address, value: amount });
  //   var tx = web3.eth.getTransaction(txInfo.tx);
  //   var txReceipt = await web3.eth.getTransactionReceiptMined(txInfo.tx);

  //   // got receipt for the transaction
  //   var txCost = txReceipt.gasUsed * tx.gasPrice;
  //   assertBalancesDiffEqual(balancesBefore, [0, 0, 0, halfAmount2, -txCost - amount, halfAmount1]);
  // });

  it("funds sent by Dave to split(emma, carol) should be claimable by Emma and Carol, events should fire", function (done) {
    // calculate expected amounts to be debited and credited
    var amount = 1000000;
    var halfAmount1 = Math.floor(amount / 2);
    var halfAmount2 = amount - halfAmount1;

    // send some amount to Splitter on behalf of Dave
    var balancesBefore, txDaveInfo, txDaveCost, txEmmaInfo, txEmmaCost, txCarolInfo;
    getBalances().then(_balancesBefore => {
      balancesBefore = _balancesBefore;
      return splitter.split(emma, carol, { from: dave, to: splitter.address, value: amount });
    }).then(_txDaveInfo => {
      txDaveInfo = _txDaveInfo;
      return web3.eth.getTransactionPromise(txDaveInfo.tx);
      assert.equal(txDaveInfo.logs.length, 1);
      assert.equal(txDaveInfo.logs[0].event, 'LogSplit');
      assert.equal(txDaveInfo.logs[0].args.party0, dave);
      assert.equal(txDaveInfo.logs[0].args.party1, emma);
      assert.equal(txDaveInfo.logs[0].args.party2, carol);
      assert.equal(txDaveInfo.logs[0].args.amount, amount);
    }).then(txDave => {
      txDaveCost = txDaveInfo.receipt.gasUsed * txDave.gasPrice;
      return assertBalancesDiffEqual(balancesBefore, [amount, 0, 0, 0, -txDaveCost - amount, 0]);
    }).then(() => {
      // claim as emma
      return splitter.withdraw({ from: emma })
    }).then(_txEmmaInfo => {
      txEmmaInfo = _txEmmaInfo;
      assert.equal(txEmmaInfo.logs.length, 1);
      assert.equal(txEmmaInfo.logs[0].event, 'LogWithdraw');
      assert.equal(txEmmaInfo.logs[0].args.party, emma);
      assert.equal(txEmmaInfo.logs[0].args.amount, halfAmount1);
      return web3.eth.getTransactionPromise(txEmmaInfo.tx);
    }).then(txEmma => {
      txEmmaCost = txEmmaInfo.receipt.gasUsed * txEmma.gasPrice;
      // claim as carol
      return splitter.withdraw({ from: carol });
    }).then(_txCarolInfo => {
      txCarolInfo = _txCarolInfo;
      assert.equal(txCarolInfo.logs.length, 1);
      assert.equal(txCarolInfo.logs[0].event, 'LogWithdraw');
      assert.equal(txCarolInfo.logs[0].args.party, carol);
      assert.equal(txCarolInfo.logs[0].args.amount, halfAmount2);
      return web3.eth.getTransactionPromise(txCarolInfo.tx);
    }).then(txCarol => {
      var txCostCarol = txCarolInfo.receipt.gasUsed * txCarol.gasPrice;
      assertBalancesDiffEqual(balancesBefore, [0, 0, 0, halfAmount2 - txCostCarol, -txDaveCost - amount, halfAmount1 - txEmmaCost]);
      done();
    })
  });
});
