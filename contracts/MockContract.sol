// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.23;

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
}
