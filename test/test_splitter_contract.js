Promise = require("bluebird");
Promise.promisifyAll(web3.eth, { suffix: "Promise" });

web3.eth.getTransactionReceiptMined = require("./helpers/getTransactionReceiptMined.js");

const TEST_AMOUNT = 1000000;

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

  before(function (done) {
    Splitter.deployed().then(_splitter => {
      splitter = _splitter;
      console.log("Splitter:", splitter.address);
      console.log("Alice:", alice);
      console.log("Bob:", bob);
      console.log("Carol:", carol);
      console.log("Dave:", dave);
      console.log("Emma:", emma);
      done();
    }).catch(done);
  });

  it("Alice should be able to split", function () {
    // calculate expected amounts to be debited and credited
    var amount = TEST_AMOUNT;

    var balancesBefore, txHash, tx, txCost;
    return getBalances().then(_balancesBefore => {
      balancesBefore = _balancesBefore;
      return splitter.split.sendTransaction(bob, carol, { from: alice, to: splitter.address, value: amount });
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
    });
  });

  it("funds split by Alice should be claimable by Bob and Carol", function () {
    var halfAmount1 = Math.floor(TEST_AMOUNT / 2);
    var halfAmount2 = TEST_AMOUNT - halfAmount1;

    var balancesBefore, txBobInfo, txCostBob, txCarolInfo;

    return getBalances().then(_balancesBefore => {
      balancesBefore = _balancesBefore;
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
      return assertBalancesDiffEqual(balancesBefore, [-TEST_AMOUNT, 0, halfAmount1 - txCostBob, halfAmount2 - txCostCarol, 0, 0]);
    });
  });

  function _assertRevert(error, tag) {
    // console.log(`${tag} err:`, JSON.stringify(error));
    const revertFound = error.message.search('revert') >= 0;
    assert(revertFound, `Expected "revert", got ${error} instead`);
  };

  it("transfers to fallback should fail, even from Alice", function (done) {
    var amount = TEST_AMOUNT;

    // send some amount to Splitter on behalf of Alice
    web3.eth.sendTransactionPromise({ from: alice, to: splitter.address, value: amount })
      .then(txHash => {
        return web3.eth.getTransactionReceiptMined(txHash);
      }).then(receipt => {
        // receipt is known, make sure transaction has not succeeded
        assert.notEqual(receipt.status, 1, 'Transaction has not failed');
        done();
      }).catch(error => {
        _assertRevert(error, '@sendTransaction-catch');
        done();
      });
  });

  it("funds sent by Dave to split(emma, carol) should be claimable by Emma and Carol, events should fire", function () {
    // calculate expected amounts to be debited and credited
    var amount = TEST_AMOUNT;
    var halfAmount1 = Math.floor(amount / 2);
    var halfAmount2 = amount - halfAmount1;

    // send some amount to Splitter on behalf of Dave
    var balancesBefore, txDaveInfo, txDaveCost, txEmmaInfo, txEmmaCost, txCarolInfo;
    return getBalances().then(_balancesBefore => {
      balancesBefore = _balancesBefore;
      return splitter.split(emma, carol, { from: dave, value: amount });
    }).then(_txDaveInfo => {
      txDaveInfo = _txDaveInfo;
      assert.equal(txDaveInfo.logs.length, 1);
      assert.equal(txDaveInfo.logs[0].event, 'LogSplit');
      assert.equal(txDaveInfo.logs[0].args.party0, dave);
      assert.equal(txDaveInfo.logs[0].args.party1, emma);
      assert.equal(txDaveInfo.logs[0].args.party2, carol);
      assert.equal(txDaveInfo.logs[0].args.amount, amount);
      return web3.eth.getTransactionPromise(txDaveInfo.tx);
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
    });
  });

  it("kill should work", function () {
    // confirm the contract is not empty to begin with 
    return web3.eth.getCodePromise(splitter.address).then(code => {
      // console.log("contract code before kill:", code); // DEBUG
      assert.notEqual(parseInt(code + "0"), 0, 'Live contract code is empty');
      // kill
      return splitter.kill({ from: alice })
    }).then(txInfo => {
      assert.equal(txInfo.receipt.status, 1, 'Kill transaction has failed');
      assert.equal(txInfo.logs.length, 1, 'kill() has failed to generate one and only one log entry');
      assert.equal(txInfo.logs[0].event, 'LogKill');
      // check code now
      return web3.eth.getCodePromise(splitter.address);
    }).then(code => {
      // console.log("contract code after kill:", code); // DEBUG
      assert.equal(parseInt(code + "0"), 0, 'Killed contract code is not empty');
    });
  });
});
