// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.23;

import "./MockNestedContract.sol";

contract MockContract {
    error CustomErrorNoParam();
    error CustomErrorWithParams(address param1, uint256 param2);

    function revertWithReason(string memory message) pure public {
        revert(message);
    }

    function revertWithoutReason() pure public {
        revert();
    }

    function panicUnderflow() pure public {
        uint8 num = 0;
        num--;
    }

    function revertWithCustomErrorNoParam() pure public {
        revert CustomErrorNoParam();
    }

    function revertWithCustomErrorWithParams(address param1, uint256 param2) pure public {
        revert CustomErrorWithParams(param1, param2);
    }

    function revertWithCustomNestedError(address target, uint256 param) pure public {
        MockNestedContract(target).revertNestedError(param);
    }
}
