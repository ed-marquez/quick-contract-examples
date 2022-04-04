// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.11;
pragma experimental ABIEncoderV2;

import "./hip-206/HederaTokenService.sol";
import "./hip-206/HederaResponseCodes.sol";


contract test is HederaTokenService {

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

    function tokenAssociate() external {
        int response = HederaTokenService.associateToken(address(this), tokenAddress);

        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Associate Failed");
        }
    }

    function tokenTransfer(int64 _amount) external {        
    int response = HederaTokenService.transferToken(tokenAddress, msg.sender, address(this), _amount);
    
        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Transfer Failed");
        }
    }
}
