module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*"
    },

    geth_rinkeby: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "42",
      from: "0xe2DBC1817A18d345d051a348ceF998f3c14C2033"
    }
  }
};
