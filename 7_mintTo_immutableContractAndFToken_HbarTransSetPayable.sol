// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.11;
pragma experimental ABIEncoderV2;

import "./hip-206/HederaTokenService.sol";
import "./hip-206/HederaResponseCodes.sol";


contract mintAssocTransImmutableTok is HederaTokenService {
    address tokenAddress;

    function setToken(address _tokenAddress) external {
        tokenAddress = _tokenAddress;
    }

    function mintTo(int64 _amount, address _receiver) external payable {
        uint64 uIntAmount = uint64(_amount);

        (int response, uint64 newTotalSupply, int64[] memory serialNumbers) = HederaTokenService.mintToken(tokenAddress, uIntAmount, new bytes[](0));
        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Mint Failed");
        }

        
        response = HederaTokenService.associateToken(_receiver, tokenAddress);
        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Mint Failed");
        }

        require(msg.value >= 1230000000,"Send more HBAR");
        response = HederaTokenService.transferToken(tokenAddress, address(this), _receiver, _amount);
        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Transfer Failed");
        }
    }
    
    }


