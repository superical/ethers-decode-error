# ethers-decode-error

[![Release][gha-badge]][gha-ci] [![TypeScript version][ts-badge]][typescript-5-0]
[![License: Apache 2.0][license-badge]][license]

[gha-ci]: https://github.com/superical/ethers-decode-error/actions/workflows/release.yml
[gha-badge]: https://github.com/superical/ethers-decode-error/actions/workflows/release.yml/badge.svg
[ts-badge]: https://img.shields.io/badge/TypeScript-5.0-blue.svg
[typescript-5-0]: https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/
[license-badge]: https://img.shields.io/badge/license-Apache_2.0-blue.svg
[license]: https://github.com/superical/ethers-decode-error/blob/main/LICENSE

For those who've grappled with extracting the actual error message or reason from the JSON RPC when a transaction fails
or a smart contract reverts, you'll certainly appreciate how cumbersome it could at times.

This is a simple utility library to help simplify the process of determining the actual errors from smart contract. You simply pass in the error object and you will get the actual error message and a bunch of other information about the error. It works with the regular revert errors, panic errors, Metamask rejection error and custom
errors.

## Installation

```bash
npm install ethers-decode-error --save
```

You will need to install ethers.js in your project if you have not:

```bash
npm install ethers@^6 --save
```

> 💡 If you wish to use it with ethers v5 instead, you may want to refer to [v1](../../tree/1.x).

## Usage

This library decodes an ethers error object reverted from a smart contract into results that lets you decide the best course of action from there.

Start by creating an instance of the `ErrorDecoder`:

```typescript
import { ErrorDecoder } from 'ethers-decode-error'

const errorDecoder = ErrorDecoder.create()
```

The `create` method optionally accepts an array of ABI or contract interface objects as its first argument. Although the ABI is not required for regular reverts, it's recommended to supply the ABI or contract interfaces if you're expecting custom errors. See the examples in [Custom Error ABI and Interfaces](#custom-error-abi-and-interfaces) section for more details.

After creating the instance, you can reuse the `decode` method throughout your code to handle any errors thrown when interacting with smart contracts:

```typescript
import type { DecodedError } from 'ethers-decode-error'

try {
  // Send a transaction that will revert
} catch (err) {
  const decodedError: DecodedError = await errorDecoder.decode(err)
  console.log(`Revert reason: ${decodedError.reason}`)
}
```

### Decoded Error

The `DecodedError` object is the result of the decoded error, which contains the following properties for handling the error occurred:

| Property    | Value Type       | Remarks                                                                                                                                                                                                                                    |
| ----------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`      | `ErrorType`      | The type of the error. See [Error Types](#error-types).                                                                                                                                                                                    |
| `reason`    | `string \| null` | The decoded error message, or `null` if error is unknown or has no message.                                                                                                                                                                |
| `data`      | `string \| null` | The raw data bytes returned from the contract error, or `null` if error is unknown or empty.                                                                                                                                               |
| `args`      | `Array`          | The parameter values of the error if exists. For custom errors, the `args` will always be empty if no ABI or interface is supplied for decoding.                                                                                           |
| `name`      | `string \| null` | The name of the error. This can be used to identify the custom error emitted. If no ABI is supplied for custom error, this will be the selector hex. If error is `RpcError`, this will be the error code. `null` if error is `EmptyError`. |
| `selector`  | `string \| null` | The hexidecimal value of the selector. `null` if error is `EmptyError`.                                                                                                                                                                    |
| `signature` | `string \| null` | The signature of the error. `null` if error is `EmptyError` or no specified ABI for custom error.                                                                                                                                          |
| `fragment`  | `string \| null` | The ABI fragment of the error. `null` if error is `EmptyError` or no specified ABI for custom error.                                                                                                                                       |

### Error Types

These are the possible `ErrorType` that could be returned as the `type` property in the `DecodedError` object:

| Type                        | Description                               |
| --------------------------- | ----------------------------------------- |
| `ErrorType.EmptyError`      | Contract reverted without reason provided |
| `ErrorType.RevertError`     | Contract reverted with reason provided    |
| `ErrorType.PanicError`      | Contract reverted due to a panic error    |
| `ErrorType.CustomError`     | Contract reverted due to a custom error   |
| `ErrorType.UserRejectError` | User rejected the transaction             |
| `ErrorType.RpcError`        | An error from the JSON RPC                |
| `ErrorType.UnknownError`    | An unknown error was thrown               |

## Examples

### Revert/Require Errors

```typescript
import { ErrorDecoder } from 'ethers-decode-error'

const errorDecoder = ErrorDecoder.create()

const WETH = new ethers.Contract('0xC02aa...756Cc2', abi, provider)
try {
  const tx = await WETH.transfer('0x0', amount)
  await tx.wait()
} catch (err) {
  const { reason, type } = await errorDecoder.decode(err)

  // Prints "ERC20: transfer to the zero address"
  console.log('Revert reason:', reason)
  // Prints "true"
  console.log(type === ErrorType.RevertError)
}
```

### Panic Errors

```typescript
import { ErrorDecoder } from 'ethers-decode-error'

const errorDecoder = ErrorDecoder.create()

const OverflowContract = new ethers.Contract('0x12345678', abi, provider)
try {
  const tx = await OverflowContract.add(123)
  await tx.wait()
} catch (err) {
  const { reason, type } = await errorDecoder.decode(err)

  // Prints "Arithmetic operation underflowed or overflowed outside of an unchecked block"
  console.log('Panic message:', reason)
  // Prints "true"
  console.log(type === ErrorType.PanicError)
}
```

### Custom Errors

```typescript
import { ErrorDecoder } from 'ethers-decode-error'
import type { DecodedError } from 'ethers-decode-error'

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
const errorDecoder = ErrorDecoder.create([abi])

const MyCustomErrorContract = new ethers.Contract('0x12345678', abi, provider)
try {
  const tx = await MyCustomErrorContract.swap('0xabcd', 123)
  await tx.wait()
} catch (err) {
  const decodedError = await errorDecoder.decode(err)
  const reason = customReasonMapper(decodedError)

  // Prints "Invalid swap with token contract address 0xabcd."
  console.log('Custom error reason:', reason)
  // Prints "true"
  console.log(type === ErrorType.CustomError)
}

const customReasonMapper = ({ name, args, reason }: DecodedError): string => {
  switch (name) {
    case 'InvalidSwapToken':
      // You can access the error parameters using their index:
      return `Invalid swap with token contract address ${args[0]}.`
      // Or, you could also access the error parameters using their names:
      return `Invalid swap with token contract address ${args['token']}.`

    // You can map any other custom errors here

    default:
      // This handles the non-custom errors
      return reason ?? 'An error has occurred'
  }
}
```

#### Custom Error ABI and Interfaces

Although the ABI or ethers `Interface` object of the contract is not required when decoding normal revert errors, it is recommended to provide it if you're expecting custom errors. This is because the ABI or `Interface` object is needed to decode the custom error name and parameters.

> 💡 It's much more convenient to supply the ABIs and Interface objects for all smart contracts your application may interact with when creating the `ErrorDecoder` instance. You will then only need a single `ErrorDecoder` instance that you can reuse across your codebase to handle any smart contract errors.

If you're expecting custom errors from multiple contracts or from external contracts called within your contract, you can provide the ABIs or interfaces of those contracts:

```typescript
const myContractAbi = [...]
const externalContractAbi = [...]

// From here on, the errorDecoder is aware of all the custom errors throw from these contracts.
const errorDecoder = ErrorDecoder.create([myContractAbi, externalContractAbi])

try {...} catch (err) {
  // It's aware of errors from MyContract, ExternalContract and ExternalContract errors emitted from MyContract.
  const decodedError = await errorDecoder.decode(err)
  // ...
}
```

If you are using TypeChain in your project, it may be more convenient to pass the contract `Interface` objects directly:

```typescript
// If you have the contract instances, you can access their `interface` property
const errorDecoder = ErrorDecoder.create([MyContract.interface, MySecondContract.interface])

// Otherwise, you can use the `createInterface` method from the contract factory
const errorDecoder = ErrorDecoder.create([
  MyContract__factory.createInterface(),
  MySecondContract__factory.createInterface(),
])
```

You can also mix both ABIs and contract `Interface` objects, and the library will sort out the ABIs for you. This can be useful if you just want to append adhoc ABI of external contracts so that their errors can be recognised when decoding:

```typescript
const externalContractFullAbi = [...]
const anotherExternalContractErrorOnlyAbi = [{
    name: 'ExternalContractCustomError1',
    type: 'error',
}]

const errorDecoder = ErrorDecoder.create([MyContract__factory.createInterface(), externalContractFullAbi, anotherExternalContractErrorOnlyAbi])
```

If the ABI of a custom error is not provided, the error name will be the selector of the custom error. In that case, you can check the selector of the error name in your reason mapper to handle the error accordingly:

```typescript
const customReasonMapper = ({ name, args, reason }: DecodedError): string => {
  switch (name) {
    // For custom errors with ABI, you can check the error name directly
    case 'InvalidSwapToken':
      return `Invalid swap with token contract address ${args[0]}.`

    // For custom errors without ABI, you'll have to check the error name against the selector
    // Note that when ABI is not provided, the `args` will always be empty even if the custom error has parameters.
    case '0xec7240f7':
      return 'This is a custom error caught without its ABI provided.'

    default:
      return reason ?? 'An error has occurred'
  }
}
```

## Contributing

Feel free to open an issue or PR for any bugs/improvements.
