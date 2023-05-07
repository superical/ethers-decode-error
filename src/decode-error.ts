import { Interface } from '@ethersproject/abi'
import { BigNumber, utils } from 'ethers'
import { panicErrorCodeToReason } from './panic'
import { ErrorType } from './enums'
import { DecodedError } from './types'

// Error(string)
const ERROR_STRING_PREFIX = '0x08c379a0'

// Panic(uint256)
const PANIC_CODE_PREFIX = '0x4e487b71'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getReturnDataFromError(error: any): string {
  const errorData = error.data ?? error.error?.data

  if (errorData === undefined) {
    throw error
  }

  let returnData = typeof errorData === 'string' ? errorData : errorData.data

  if (typeof returnData === 'object' && returnData.data) {
    returnData = returnData.data
  }

  if (returnData === undefined || typeof returnData !== 'string') {
    throw error
  }

  return returnData
}

export const decodeError = <T extends Interface>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any,
  abiOrInterface?: T | ConstructorParameters<typeof utils.Interface>[0],
): DecodedError => {
  if (!(error instanceof Error)) {
    return {
      type: ErrorType.UnknownError,
      error: error.message ?? 'Unexpected error',
      data: undefined,
    }
  }

  let returnData
  try {
    returnData = getReturnDataFromError(error)
  } catch (e) {
    if (error.message) {
      if (error.message.includes('user rejected transaction')) {
        return {
          type: ErrorType.UserError,
          error: 'User has rejected the transaction',
          data: returnData,
        }
      }
      return {
        type: ErrorType.UnknownError,
        error: error.message,
        data: returnData,
      }
    }
    return {
      type: ErrorType.UnknownError,
      error: 'Unknown error',
      data: returnData,
    }
  }

  if (returnData === '0x') {
    return {
      type: ErrorType.EmptyError,
      error: 'Empty error data returned',
      data: returnData,
    }
  } else if (returnData.startsWith(ERROR_STRING_PREFIX)) {
    const encodedReason = returnData.slice(ERROR_STRING_PREFIX.length)
    try {
      const reason = utils.defaultAbiCoder.decode(['string'], `0x${encodedReason}`)[0]
      return {
        type: ErrorType.RevertError,
        error: reason,
        data: returnData,
      }
    } catch (e) {
      return {
        type: ErrorType.UnknownError,
        error: 'Unknown error returned',
        data: returnData,
      }
    }
  } else if (returnData.startsWith(PANIC_CODE_PREFIX)) {
    const encodedReason = returnData.slice(PANIC_CODE_PREFIX.length)
    try {
      const code = utils.defaultAbiCoder.decode(['uint256'], `0x${encodedReason}`)[0] as BigNumber
      const reason = panicErrorCodeToReason(code) ?? 'Unknown panic code'
      return {
        type: ErrorType.PanicError,
        error: reason,
        data: returnData,
      }
    } catch (e) {
      return {
        type: ErrorType.UnknownError,
        error: 'Unknown panic error',
        data: returnData,
      }
    }
  } else {
    if (!abiOrInterface) {
      return {
        type: ErrorType.CustomError,
        error: returnData.slice(0, 10),
        data: returnData,
      }
    }
    let iface: Interface
    if (abiOrInterface instanceof utils.Interface) {
      iface = abiOrInterface
    } else {
      iface = new utils.Interface(abiOrInterface)
    }
    const customError = iface.parseError(returnData)
    return {
      type: ErrorType.CustomError,
      error: customError.name,
      args: customError.args,
      data: returnData,
    }
  }
}
