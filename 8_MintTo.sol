// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.11;
pragma experimental ABIEncoderV2;

import "./HederaTokenService.sol";
import "./HederaResponseCodes.sol";

contract MintTo is HederaTokenService {

    address tokenAddress;

    function setToken(address _tokenAddress) external {
        tokenAddress = _tokenAddress;
    }

    function mintTo(address _receiver) external {

        int64 intOneToken = 1;
        uint64 uIntOneToken = 1;

        (int response, uint64 newTotalSupply, int64[] memory serialNumbers) = HederaTokenService.mintToken(tokenAddress, uIntOneToken, new bytes[](0));

        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Mint Failed");
        }
        response = HederaTokenService.transferToken(tokenAddress, address(this), _receiver, intOneToken);

        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Transfer Failed");
        }
    }
}
