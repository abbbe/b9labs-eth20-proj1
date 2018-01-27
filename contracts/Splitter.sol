pragma solidity ^0.4.4;

contract Splitter {
  address public alice;
  address public bob;
  address public carol;

  modifier onlyAlice() {
    require(msg.sender == alice);
    _;
  }

  function Splitter(address _bob, address _carol) public {
    require(_bob != address(0));
    require(_carol != address(0));
    
    alice = msg.sender;
    bob = _bob;
    carol = _carol;
  }

  function split(address party1, address party2) public payable {
    require(msg.value > 0);
    require(party1 != address(0));
    require(party2 != address(0));

    uint half1 = msg.value / 2;
    uint half2 = msg.value - half1;

    party1.transfer(half1);
    party2.transfer(half2);
  }
  
  function () public payable {
    if (msg.sender == alice) {
      // funds sent by Alice split between Bob and Carol
      split(bob, carol);
    }
  }
}
