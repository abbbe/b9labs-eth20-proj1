// Import the page's CSS. Webpack will know what to do with it.
import "../stylesheets/app.css";

// Import libraries we need.
import { default as Web3 } from 'web3';
import { default as contract } from 'truffle-contract'

// Import our contract artifacts and turn them into usable abstractions.
import splitter_artifacts from '../../build/contracts/Splitter.json'

// MetaCoin is our usable abstraction, which we'll use through the code below.
var Splitter = contract(splitter_artifacts);
var splitter, owner;

window.App = {
  start: async function () {
    // Bootstrap the Splitter abstraction for Use.
    Splitter.setProvider(web3.currentProvider);

    Splitter.deployed().then(instance => {
      splitter = instance;
      document.getElementById("splitter_address").innerHTML = splitter.contract.address;
      return splitter.alice();
    }).then(_owner => {
      owner = _owner;
      document.getElementById("owner_address").innerHTML = owner;

      refreshPartiesBalances();
      watchLogs();
    });

    // -------------- -------------- -------------- -------------- --------------

    function _showPartyBalance(party, address) {
      var addressElement = document.getElementById(party + "_address");
      addressElement.innerHTML = address;

      web3.eth.getBalance(address, function (err, balance) {
        var balanceElement = document.getElementById(party + "_balance");
        if (err != null) {
          console.error(`Error getting balance of ${party}@${address}: ${err}`);
          balanceElement.innerHTML = "#ERROR";
        } else {
          balanceElement.innerHTML = web3.fromWei(balance, 'ether');
        }
      });

      splitter.getAllowance(address).then(allowance => {
        var allowanceElement = document.getElementById(party + "_allowance");
        allowanceElement.innerHTML = web3.fromWei(allowance, 'ether');
      });
    }

    function refreshPartiesBalances() {
      _showPartyBalance('alice', web3.eth.accounts[1]);
      _showPartyBalance('bob', web3.eth.accounts[2]);
      _showPartyBalance('carol', web3.eth.accounts[3]);
      _showPartyBalance('dave', web3.eth.accounts[4]);
      _showPartyBalance('emma', web3.eth.accounts[5]);
    }

    // -------------- -------------- -------------- -------------- --------------

    function watchLogs() {
      var logInitFilter = splitter.LogInit({}, { fromBlock: 0 });
      logInitFilter.watch(function (err, res) {
        console.log("LogInit", res.args);
        refreshPartiesBalances();
      });

      var logSplitFilter = splitter.LogSplit({}, { fromBlock: 0 });
      logSplitFilter.watch(function (err, res) {
        console.log("LogSplit", res.args);
        refreshPartiesBalances();
      });

      var logWithdrawFilter = splitter.LogWithdraw({}, { fromBlock: 0 });
      logWithdrawFilter.watch(function (err, res) {
        console.log("LogWithdraw", res.args);
        refreshPartiesBalances();
      });

      // watch kill events and deactivate splitAlice button
      var logKillFilter = splitter.LogKill({}, { fromBlock: 0 });
      logKillFilter.watch(function (err, res) {
        console.log("LogKill", res.args);
        document.getElementById("splitAliceButton").disabled = true;
      });
    };
  },

  // -------------- -------------- -------------- -------------- --------------

  setStatus: function (message) {
    console.log("Status:", message);
    var status = document.getElementById("status");
    status.innerHTML = message;
  },

  kill: async function () {
    console.log("kill: sending");
    splitter.kill({ from: aliceAddress }).then(res => {
      console.log("kill: mined");
    }).catch(err => {
      console.log("kill: failed", err);
    });
  },

  split: async function () {
    var self = this;

    var amount = web3.toWei(parseFloat(document.getElementById("amount").value), 'ether');
    var party0 = document.getElementById("party0_address").value;
    var party1 = document.getElementById("party1_address").value;
    var party2 = document.getElementById("party2_address").value;

    this.setStatus(`Calling split(${party1}, ${party2}, {from: ${party0}, amount: ${amount} ... (please wait)`);
    splitter.split(party1, party2, { from: party0, value: amount })
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
