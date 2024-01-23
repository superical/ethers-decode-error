// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.23;

import "./MockNestedContract.sol";

contract MockContract {
    error CustomErrorNoParam();
    error CustomErrorWithParams(address param1, uint256 param2);

    uint256 public value;

    function revertWithReason(string memory message) public {
        value++;
        revert(message);
    }

    function revertWithoutReason() public {
        value++;
        revert();
    }

    function panicUnderflow() public {
        value++;
        uint8 num = 0;
        num--;
    }

    function revertWithCustomErrorNoParam() public {
        value++;
        revert CustomErrorNoParam();
    }

    function revertWithCustomErrorWithParams(address param1, uint256 param2) public {
        value++;
        revert CustomErrorWithParams(param1, param2);
    }

    function revertWithCustomNestedError(address target, uint256 param) public {
        value++;
        MockNestedContract(target).revertNestedError(param);
    }
}
