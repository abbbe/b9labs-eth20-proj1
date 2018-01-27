pragma solidity ^0.4.4;

contract Splitter {
  address public alice;
  address public bob;
  address public carol;

  function Splitter(address _bob, address _carol) public {
    require(_bob != address(0));
    require(_carol != address(0));
    
    alice = msg.sender;
    bob = _bob;
    carol = _carol;
  }
  
  modifier onlyAlice() {
    require(msg.sender == alice);
    _;
  }

  function () public onlyAlice payable {
    require(msg.sender == alice);

    // funds sent by Alice split between Bob and Carol
    uint forBob = msg.value / 2;
    uint forCarol = msg.value - forBob;

    bob.transfer(forBob);
    carol.transfer(forCarol);
  }
}
