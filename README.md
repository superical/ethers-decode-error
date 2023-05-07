# ethers-decode-error

[![TypeScript version][ts-badge]][typescript-5-0]
[![License: Apache 2.0][license-badge]][license]

[ts-badge]: https://img.shields.io/badge/TypeScript-5.0-blue.svg
[typescript-5-0]: https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/
[license-badge]: https://img.shields.io/badge/license-Apache_2.0-blue.svg
[license]: https://github.com/superical/ethers-decode-error/blob/main/LICENSE
[gha-ci]: https://github.com/superical/ethers-decode-error/actions/workflows/release.yml
[gha-badge]: https://github.com/superical/ethers-decode-error/actions/workflows/release.yml/badge.svg

For those who've grappled with extracting the actual error message or reason from the JSON RPC when a transaction fails
or a smart contract reverts, you'll certainly appreciate how cumbersome it could at times.

This utility library can help to simplify the process for you. You simply pass in the error object, the library will
return the actual error message. It works with the regular revert errors, panic errors, Metamask errors and custom
errors.

## Installation

```bash
npm install ethers-decode-error --save
```

You will need to install ethers.js in your project if you have not:
```bash
npm install ethers@^5 --save
```

## Usage

To decode an error, pass it as the first argument to the `decodeError` function. This will provide you with the
decoded error, allowing you to decide the best course of action from there.

### Revert/Require Errors

```typescript
import { decodeError } from 'ethers-decode-error'

const WETH = new ethers.Contract('0xC02aa...756Cc2', abi, provider)
try {
  const tx = await WETH.transfer('0x0', amount)
  await tx.wait()
} catch (err) {
  const { error } = decodeError(err)
  // Prints "ERC20: transfer to the zero address"
  console.log('Revert reason:', error)
}
```

### Panic Errors

```typescript
import { decodeError } from 'ethers-decode-error'

const MyWeirdContract = new ethers.Contract('0x12345678', abi, provider)
try {
  const tx = await MyWeirdContract.add(123)
  await tx.wait()
} catch (err) {
  const { error } = decodeError(err)
  // Prints "Arithmetic operation underflowed or overflowed outside of an unchecked block"
  console.log('Panic message:', error)
}
```

### Custom Errors

```typescript
import { decodeError, DecodedError } from 'ethers-decode-error'

const abi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
    ],
    name: 'InvalidSwapToken',
    type: 'error',
  },
]

const MyCustomErrorContract = new ethers.Contract('0x12345678', abi, provider)
try {
  const tx = await MyCustomErrorContract.swap('0xabcd', 123)
  await tx.wait()
} catch (err) {
  const decodedError = decodeError(err, abi)
  const reason = customReasonMapper(decodedError)
  // Prints "Invalid swap with token contract address 0xabcd."
  console.log('Custom error reason:', reason)
}

const customReasonMapper = ({ error, args }: DecodedError): string => {
  switch (error) {
    case 'InvalidSwapToken':
      return `Invalid swap with token contract address ${args[0]}.`
    default:
      return 'The transaction has reverted.'
  }
}
```

If you're using TypeChain in your project, simply pass the contract's `Interface` to the `decodeError` function so that
it can decode all custom errors that the contract could possibly revert with:

```typescript
const decodedError = decodeError(err, MyCustomErrorContract__factory.createInterface())
// Prints "Invalid swap with token contract address 0xabcd."
console.log('Custom error reason:', reason)
```

## Contributing

Feel free to open an issue or PR for any bugs/improvements.