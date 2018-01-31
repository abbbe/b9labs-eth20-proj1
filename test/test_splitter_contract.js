Promise = require("bluebird");
Promise.promisifyAll(web3.eth, { suffix: "Promise" });

web3.eth.getTransactionReceiptMined = require("./helpers/getTransactionReceiptMined.js");
const expectedExceptionPromise = require("./helpers/expectedExceptionPromise.js");

const TEST_AMOUNT = 1000000;

var Splitter = artifacts.require("./Splitter.sol");

contract('Splitter', function (accounts) {
  const alice = accounts[1];
  const bob = accounts[2];
  const carol = accounts[3];
  const dave = accounts[4];
  const emma = accounts[5];

  var splitter;
  before("deploy", function (done) {
    Splitter.new().then(_splitter => {
      splitter = _splitter;
      done();
    }).catch(done);
  });

  // returns promise of an array containing account balances (as BigNumber, in wei)
  function getBalances() {
    return Promise.all([splitter.address].concat(accounts)
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

  describe("End to end use case: ", function () {
    var amount = TEST_AMOUNT;

    function measureTx(truffleTxObjPromise, resolve, reject) {
      return getBalances().then(balancesBefore =>
        truffleTxObjPromise.then(txObj =>
          getBalances().then(balancesAfter =>
            web3.eth.getTransactionPromise(txObj.tx).then(tx => {
              //console.log("txObj.receipt", txObj.receipt);
              //console.log("tx", tx);
              var cost = txObj.receipt.gasUsed * tx.gasPrice;
              // console.log("cost", cost);
              return { cost: cost, before: balancesBefore, after: balancesAfter, txObj: txObj, tx: tx };
            })))).catch(reject);
    }

    it("Alice should be able to split", function () {
      // calculate expected amounts to be debited and credited
      var txObj;

      var balancesBefore, txHash, tx, txCost;
      return getBalances().then(_balancesBefore => {
        balancesBefore = _balancesBefore;
        return splitter.split(bob, carol, { from: alice, value: amount });
      }).then(_txObj => {
        txObj = _txObj;
        // make sure LogSplit event was issued
        assert.equal(txObj.logs.length, 1);
        assert.equal(txObj.logs[0].event, 'LogSplit');
        assert.equal(txObj.logs[0].args.party0, alice);
        assert.equal(txObj.logs[0].args.party1, bob);
        assert.equal(txObj.logs[0].args.party2, carol);
        assert.equal(txObj.logs[0].args.amount, amount);
        // make sure all funds are accounted for
        return web3.eth.getTransactionPromise(txObj.tx);
      }).then(tx => {
        txCost = txObj.receipt.gasUsed * tx.gasPrice;
        return assertBalancesDiffEqual(balancesBefore, [amount, 0, -txCost - amount, 0, 0, 0, 0, 0, 0, 0, 0]);
      });
    });

    it("funds split by Alice should be claimable by Bob [and Carol]", function () {
      var halfAmount1 = Math.floor(amount / 2);
      var halfAmount2 = amount - halfAmount1;

      // claim as bob and carol
      return measureTx(splitter.withdraw({ from: bob })).then(mtxBob =>
        measureTx(splitter.withdraw({ from: carol })).then(mtxCarol => {
          var exp = [-amount, 0, 0, halfAmount1 - mtxBob.cost, halfAmount2 - mtxCarol.cost, 0, 0, 0, 0, 0, 0];
          return assertBalancesDiffEqual(mtxBob.before, exp);
        }));
    });
  });

  function _assertRevert(error, tag) {
    // console.log(`${tag} err:`, JSON.stringify(error));
    const revertFound = error.message.search('revert') >= 0;
    assert(revertFound, `Expected "revert", got ${error} instead`);
  };

  describe("Individuial tests", function () {
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

    it("should not be able to split 1 Wei", function () {
      return expectedExceptionPromise(function () {
        return splitter.split(bob, carol, { from: alice, value: 1, gas: 3000000 })
      }, 3000000);
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
        assert.equal(txDaveInfo.receipt.status, 1, 'split(dave => emma, carol) has failed');
        assert.equal(txDaveInfo.logs.length, 1);
        assert.equal(txDaveInfo.logs[0].event, 'LogSplit');
        assert.equal(txDaveInfo.logs[0].args.party0, dave);
        assert.equal(txDaveInfo.logs[0].args.party1, emma);
        assert.equal(txDaveInfo.logs[0].args.party2, carol);
        assert.equal(txDaveInfo.logs[0].args.amount.toString(10), amount.toString(10));
        return web3.eth.getTransactionPromise(txDaveInfo.tx);
      }).then(txDave => {
        txDaveCost = txDaveInfo.receipt.gasUsed * txDave.gasPrice;
        return assertBalancesDiffEqual(balancesBefore, [amount, 0, 0, 0, 0, -txDaveCost - amount, 0, 0, 0, 0, 0]);
      }).then(() => {
        // claim as emma
        return splitter.withdraw({ from: emma })
      }).then(_txEmmaInfo => {
        txEmmaInfo = _txEmmaInfo;
        assert.equal(txEmmaInfo.logs.length, 1);
        assert.equal(txEmmaInfo.logs[0].event, 'LogWithdraw');
        assert.equal(txEmmaInfo.logs[0].args.party, emma);
        assert.equal(txEmmaInfo.logs[0].args.amount.toString(10), halfAmount1.toString(10));
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
        assert.equal(txCarolInfo.logs[0].args.amount.toString(10), halfAmount2.toString(10));
        return web3.eth.getTransactionPromise(txCarolInfo.tx);
      }).then(txCarol => {
        var txCostCarol = txCarolInfo.receipt.gasUsed * txCarol.gasPrice;
        return assertBalancesDiffEqual(balancesBefore, [0, 0, 0, 0, halfAmount2 - txCostCarol, -txDaveCost - amount, halfAmount1 - txEmmaCost, 0, 0, 0, 0]);
      });
    });

    it("kill should work", function () {
      // confirm the contract is not empty to begin with 
      return web3.eth.getCodePromise(splitter.address).then(code => {
        // console.log("contract code before kill:", code); // DEBUG
        assert.notEqual(parseInt(code + "0"), 0, 'Live contract code is empty');
        // kill
        return splitter.kill({})
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
});
