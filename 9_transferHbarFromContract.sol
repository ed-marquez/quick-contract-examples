// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;
 
 contract hbarFromContract{

    function getBalance() public view returns (uint) {
        return address(this).balance;
    }

    function callHbar(address payable _receiverAddress, uint _amount) public {
        (bool sent, ) = _receiverAddress.call{value:_amount}("");
        require(sent, "Failed to send Hbar");
    }

    function transferHbar(address payable _receiverAddress, uint _amount) public {
        _receiverAddress.transfer(_amount);
    }

    function sendHbar(address payable _receiverAddress, uint _amount) public {
        require(_receiverAddress.send(_amount));
    }
}