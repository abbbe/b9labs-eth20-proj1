// Import the page's CSS. Webpack will know what to do with it.
import "../stylesheets/app.css";

// Import libraries we need.
import { default as Web3 } from 'web3';
import { default as contract } from 'truffle-contract'

// Import our contract artifacts and turn them into usable abstractions.
import splitter_artifacts from '../../build/contracts/Splitter.json'

// MetaCoin is our usable abstraction, which we'll use through the code below.
var Splitter = contract(splitter_artifacts);
var splitter, alice, bob, carol;

window.App = {
  start: async function () {
    var self = this;

    // Bootstrap the Splitter abstraction for Use.
    Splitter.setProvider(web3.currentProvider);
    splitter = await Splitter.deployed();

    // read Splitter/Alice/Bob/Carol's addresses, balances, and allowances and make them available in DOM
    function _showBalance(party, err, balance) {
      var balanceElement = document.getElementById(party + "_balance");
      if (err != null) {
        alert(`Error getting balance of ${party} contract: ${err}`);
        balanceElement.innerHTML = "#ERROR";
      } else {
        console.debug(`Balance of ${party}: ${balance.toString()}`);
        balanceElement.innerHTML = web3.fromWei(balance, 'ether');
      }
    }

    function _showAllowance(party, allowance) {
      var allowanceElement = document.getElementById(party + "_allowance");
      console.debug(`Allowance of ${party}: ${'0xcafdc475816febe82d65ba184ae43e9e19cbcff8'.toString(10)}`);
      allowanceElement.innerHTML = web3.fromWei(allowance, 'ether');
    }

    function _showPartyBalance(party, address) {
      if (!address) return;

      console.log(`Address of ${party}: ${address}`);
      var addressElement = document.getElementById(party + "_address");
      addressElement.innerHTML = address;
      
      web3.eth.getBalance(address, function (err, balance) {
        _showBalance(party, err, balance);
      });

      splitter.getAllowance(address).then(allowance => {
        _showAllowance(party, allowance);
      });
    }

    function refreshPartiesBalances() {
      _showPartyBalance('splitter', splitter.contract.address);
      _showPartyBalance('alice', alice);
      _showPartyBalance('bob', bob);
      _showPartyBalance('carol', carol);
    }

    var logInitFilter = splitter.LogInit({}, { fromBlock: 0 });
    logInitFilter.watch(function (err, res) {
      console.log("LogInit", res.args);
      alice = res.args.alice;
      bob = res.args.bob;
      carol = res.args.carol;

      refreshPartiesBalances();
    });

    var logSplitFilter = splitter.LogSplit({}, { fromBlock: 0 });
    logSplitFilter.watch(function (err, res) {
      console.log("LogSplit", res);
      refreshPartiesBalances();
    });

    var logWithdrawFilter = splitter.LogWithdraw({}, { fromBlock: 0 });
    logWithdrawFilter.watch(function (err, res) {
      console.log("LogWithdraw", res);
      refreshPartiesBalances();
    });

    // watch kill events and deactivate splitAlice button
    var logKillFilter = splitter.LogKill({}, { fromBlock: 0 });
    logKillFilter.watch(function (err, res) {
      console.log("LogKill", res);
      document.getElementById("splitAliceButton").disabled = true;
    });
  },

  setStatus: function (message) {
    var status = document.getElementById("status");
    status.innerHTML = message;
  },

  // refreshBalance: function() {
  //   var self = this;

  //   var meta;
  //   MetaCoin.deployed().then(function(instance) {
  //     meta = instance;
  //     return meta.getBalance.call(account, {from: account});
  //   }).then(function(value) {
  //     var balance_element = document.getElementById("balance");
  //     balance_element.innerHTML = value.valueOf();
  //   }).catch(function(e) {
  //     console.log(e);
  //     self.setStatus("Error getting balance; see log.");
  //   });
  // },

  killSplitter: async function () {
    console.log("kill: sending");
    splitter.kill({ from: alice }).then(res => {
      console.log("kill: mined");
    }).catch(err => {
      console.log("kill: failed", err);
    });
  },

  splitAlice: async function () {
    var self = this;

    // initialize Splitter contract
    var splitter = await Splitter.deployed();
    var aliceAddress = await splitter.alice.call();

    var amount = web3.toWei(parseInt(document.getElementById("amount").value), 'ether');

    this.setStatus(`Initiating transaction to transfer ${amount}... (please wait)`);
    splitter.sendTransaction({ from: aliceAddress, to: splitter.contract.address, value: amount })
      .then(function () {
        self.setStatus("Transaction complete!");
        // self.refreshBalance();
      }).catch(function (e) {
        console.log(e);
        self.setStatus("Error sending coin; see log.");
      });
  }
};

window.addEventListener('load', function () {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof web3 !== 'undefined') {
    console.warn("Using web3 detected from external source. If you find that your accounts don't appear or you have 0 MetaCoin, ensure you've configured that source properly. If using MetaMask, see the following link. Feel free to delete this warning. :) http://truffleframework.com/tutorials/truffle-and-metamask")
    // Use Mist/MetaMask's provider
    window.web3 = new Web3(web3.currentProvider);
  } else {
    console.warn("No web3 detected. Falling back to http://127.0.0.1:7545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask");
    // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
    window.web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"));
  }

  App.start();
});
