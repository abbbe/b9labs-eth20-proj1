pragma solidity 0.4.18;

contract Splitter {
  address public alice;
  address public bob;
  address public carol;

  mapping (address => uint) public allowances;

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

  // interface for Alice and Dave
  function split(address party1, address party2) public payable {
    require(party1 != address(0));
    require(party2 != address(0));

    require(msg.value > 0);
    uint half1 = msg.value / 2;
    uint half2 = msg.value - half1;
    assert(half1 + half2 == msg.value);

    if (half1 > 0) {
      _authorizeWithdraw(party1, half1);
    }

    if (half2 > 0) {
      _authorizeWithdraw(party2, half2);
    }
  }
  
  function _authorizeWithdraw(address party, uint amount) private {
    allowances[party] += amount;
  }

  // interface for Bob, Carol, Emma
  function withdraw() public {
    uint amount = allowances[msg.sender];
    if (amount > 0) {
      allowances[msg.sender] = 0;
      msg.sender.transfer(amount);
    }
  }

  function () onlyAlice public payable {
    // funds sent by Alice split between Bob and Carol
    split(bob, carol);
  }
}
