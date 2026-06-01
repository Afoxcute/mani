// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AgentDelegator} from "./AgentDelegator.sol";

interface IERC3009 {
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external;
}

/// @notice Action router that keeps all visible app actions on one contract page.
///
/// This contract inherits AgentDelegator so the same deployed address can be used for:
/// - ERC-7702 delegation
/// - session grants and delegated execution
/// - payment settlement forwarding via transferWithAuthorization
contract ActionRouter is AgentDelegator {
    event PaymentSettled(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256 value,
        bytes32 nonce
    );

    error PaymentTransferFailed();

    /// @notice Forward an EIP-3009 payment to the token contract.
    /// @dev This keeps the visible settlement transaction on the router contract
    ///      while the token transfer is executed internally.
    function settlePayment(
        address token,
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external {
        IERC3009(token).transferWithAuthorization(
            from,
            to,
            value,
            validAfter,
            validBefore,
            nonce,
            signature
        );

        emit PaymentSettled(token, from, to, value, nonce);
    }
}
