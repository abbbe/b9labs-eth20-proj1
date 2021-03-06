pragma solidity 0.4.18;

contract Splitter {
  address public alice;

  mapping (address => uint256) public allowances;

  modifier onlyAlice() {
    require(msg.sender == alice);
    _;
  }

  function getAllowance(address addr) public view returns(uint256 allowance) {
    allowance = allowances[addr];
  }

  event LogInit(address alice);
  event LogSplit(address party0, address party1, address party2, uint256 amount);
  event LogWithdraw(address party, uint256 amount);
  event LogKill();

  function Splitter() public {
    alice = msg.sender;
    LogInit(msg.sender);
  }

  // interface for Alice and Dave
  function split(address party1, address party2) public payable {
    require(party1 != address(0));
    require(party2 != address(0));

    require(msg.value > 1);
    uint256 half1 = msg.value / 2;
    uint256 half2 = msg.value - half1;
    assert(half1 + half2 == msg.value);

    LogSplit(msg.sender, party1, party2, msg.value);

    _authorizeWithdraw(party1, half1);
    _authorizeWithdraw(party2, half2);
  }
  
  function _authorizeWithdraw(address party, uint256 amount) private {
    assert(party != address(0));
    assert(amount > 0);
    allowances[party] += amount;
  }

  // interface for Bob, Carol, Emma
  function withdraw() public {
    uint256 amount = allowances[msg.sender];
    require(amount > 0);
    allowances[msg.sender] = 0;
    LogWithdraw(msg.sender, amount);
    msg.sender.transfer(amount);
  }

  function kill() onlyAlice public {
    LogKill();
    selfdestruct(alice);
  }
}
