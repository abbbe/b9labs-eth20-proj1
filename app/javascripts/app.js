// Import the page's CSS. Webpack will know what to do with it.
import "../stylesheets/simple.css";
import "../stylesheets/app.css";

// Import libraries we need.
import { default as Web3 } from 'web3';
import { default as contract } from 'truffle-contract'

// Import our contract artifacts and turn them into usable abstractions.
import splitter_artifacts from '../../build/contracts/Splitter.json'

// MetaCoin is our usable abstraction, which we'll use through the code below.
var Splitter = contract(splitter_artifacts);
var splitter, owner;
var parties = Array(); // array of addresses of involved parties

window.App = {
  start: async function () {
    var self = this;

    // display network_id
    web3.version.getNetwork(function (err, networkId) {
      document.getElementById("network_id").innerHTML = networkId;
    });

    // watch blocks and jupdate last_block number
    web3.eth.filter("latest", function (error, blockHash) {
      if (error) {
        document.getElementById("last_block").innerHTML = "#ERROR";
      } else {
        web3.eth.getBlock(blockHash, function (error, block) {
          document.getElementById("last_block").innerHTML = "#" + block.number;
        });
      }
    });

    // prefill list of known parties with accounts known to the provider
    web3.eth.getAccounts(function(error, accounts) {
      accounts.forEach(acc => addParty(acc));
    });

    Splitter.setProvider(web3.currentProvider);

    Splitter.deployed().then(instance => {
      splitter = instance;
      document.getElementById("splitter_address").innerHTML = splitter.contract.address;
      return splitter.alice();
    }).then(_owner => {
      owner = _owner;
      document.getElementById("owner_address").innerHTML = owner;

      watchLogs();

      self.setStatus('started');
    });

    // -------------- -------------- -------------- -------------- --------------

    function updateParty(partyIndex, address) {
      if (address == null) return;

      var party = "party" + partyIndex;
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

    function addParty(addr) {
      var known = false;

      parties.forEach((p, i) => {
        if (p == addr) {
          updateParty(i, addr);
          known = true;
        }
      });

      if (!known) {
        parties.push(addr);
        updateParty(parties.length - 1, addr);
      }
    }

    // -------------- -------------- -------------- -------------- --------------

    function watchLogs() {
      var logInitFilter = splitter.LogInit({}, { fromBlock: 0 });
      logInitFilter.watch(function (err, res) {
        console.log("LogInit", res.args);
        addParty(res.args.alice);
      });

      var logSplitFilter = splitter.LogSplit({}, { fromBlock: 0 });
      logSplitFilter.watch(function (err, res) {
        console.log("LogSplit", res.args);
        addParty(res.args.party0);
        addParty(res.args.party1);
        addParty(res.args.party2);
      });

      var logWithdrawFilter = splitter.LogWithdraw({}, { fromBlock: 0 });
      logWithdrawFilter.watch(function (err, res) {
        console.log("LogWithdraw", res.args);
        addParty(res.args.party);
      });

      // watch kill events and deactivate Split button
      var logKillFilter = splitter.LogKill({}, { fromBlock: 0 });
      logKillFilter.watch(function (err, res) {
        console.log("LogKill", res.args);
        document.getElementById("splitButton").disabled = true;
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
    var self = this;

    var txMsg = `kill()`;

    self.setStatus(`Sending ${txMsg} ...`);
    splitter.kill({ from: owner }).then(res => {
      self.setStatus(`${txMsg} mined`);
    }).catch(err =>
      self.setStatus(`${txMsg} failed: ${err}`)
      );
  },

  withdraw: async function (partyIndex) {
    var self = this;

    var acc = parties[partyIndex];
    var txMsg = `withdraw(${acc})`;

    self.setStatus(`Sending ${txMsg} ...`);
    splitter.withdraw({ from: acc }).then(res => {
      self.setStatus(`${txMsg} mined`);
    }).catch(err =>
      self.setStatus(`${txMsg} failed: ${err}`)
      );
  },

  split: async function () {
    var self = this;

    var amount = web3.toWei(parseFloat(document.getElementById("split_amount").value), 'ether');
    var party0 = document.getElementById("split_party0_address").value;
    var party1 = document.getElementById("split_party1_address").value;
    var party2 = document.getElementById("split_party2_address").value;
    var txMsg = `split(${party1}, ${party2}, {from: ${party0}, amount: ${amount})`;

    this.setStatus(`Calling ${txMsg} ...`);
    splitter.split(party1, party2, { from: party0, value: amount })
      .then(function () {
        self.setStatus(`${txMsg} mined`);
      }).catch(err =>
        self.setStatus(`${txMsg} failed: ${err}`)
      );
  }
};

window.addEventListener('load', function () {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof web3 !== 'undefined') {
    console.warn("Using web3 detected from external source. If you find that your accounts don't appear or you have 0 MetaCoin, ensure you've configured that source properly. If using MetaMask, see the following link. Feel free to delete this warning. :) http://truffleframework.com/tutorials/truffle-and-metamask")
    // Use Mist/MetaMask's provider
    window.web3 = new Web3(web3.currentProvider);
  } else {
    console.warn("No web3 detected. Falling back to http://127.0.0.1:8545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask");
    // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
    window.web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"));
  }

  App.start();
});
