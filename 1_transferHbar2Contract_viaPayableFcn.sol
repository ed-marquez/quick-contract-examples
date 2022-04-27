// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.11;
pragma experimental ABIEncoderV2;

import "./hip-206/HederaTokenService.sol";
import "./hip-206/HederaResponseCodes.sol";


contract hbar2Contract is HederaTokenService {

    address tokenAddress;

    constructor(address _tokenAddress) public {
        tokenAddress = _tokenAddress;
     }

    function mintFungibleToken(uint64 _amount) external {
        (int response, uint64 newTotalSupply, int64[] memory serialNumbers) = HederaTokenService.mintToken(tokenAddress, _amount, new bytes[](0));
           
        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Mint Failed");
        }
    }

    function tokenAssociate(address _account) external {
        int response = HederaTokenService.associateToken(_account, tokenAddress);

        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Associate Failed");
        }
    }

    function  tokenTransfer(address _sender, address _receiver, int64 _amount) payable external {        
        // REQUIRE HBAR PAYMENT FOR FUNCTION EXECUTION
        // if (msg.value < 5000000000) {
        //     revert ("Transfer Failed - Send more HBAR");
        // } 
        
        // OR
        require(msg.value > 1233000000,"Send more HBAR");

        int response = HederaTokenService.transferToken(tokenAddress, _sender, _receiver, _amount);
    
        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Transfer Failed");
        }

    }

    function getBalance() public view returns (uint) {
        return address(this).balance;
}
}