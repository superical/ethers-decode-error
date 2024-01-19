// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.23;

contract MockNestedContract {
    error NestedError(uint256 param);

    function revertNestedError(uint256 param) pure public {
        revert NestedError(param);
    }
}
