import { AbiCoder, ErrorFragment, Interface } from 'ethers'
import { panicErrorCodeToReason } from './panic'
import { DecodedError } from '../types'
import { ERROR_STRING_PREFIX, PANIC_CODE_PREFIX } from '../common/constants'
import {
  customErrorResult,
  emptyErrorResult,
  panicErrorResult,
  revertErrorResult,
  rpcErrorResult,
  unknownErrorResult,
  userRejectErrorResult,
} from './results'

type ErrorHandlerErrorInfo = { errorInterface: Interface; error: Error }

export interface ErrorHandler {
  predicate: (data: string | undefined, error: Error) => boolean
  handle: (data: string | undefined, errorInfo: ErrorHandlerErrorInfo) => DecodedError
}

export class EmptyErrorHandler implements ErrorHandler {
  public predicate(data: string): boolean {
    return data === '0x'
  }

  public handle(data: string): DecodedError {
    return emptyErrorResult({ data })
  }
}

export class RevertErrorHandler implements ErrorHandler {
  public predicate(data: string): boolean {
    return data?.startsWith(ERROR_STRING_PREFIX)
  }

  public handle(data: string): DecodedError {
    const encodedReason = data.slice(ERROR_STRING_PREFIX.length)
    const abi = new AbiCoder()
    try {
      const fragment = ErrorFragment.from('Error(string)')
      const args = abi.decode(fragment.inputs, `0x${encodedReason}`)
      const reason = args[0] as string
      return revertErrorResult({ data, fragment, reason, args })
    } catch (e) {
      return unknownErrorResult({ reason: 'Unknown error returned', data })
    }
  }
}

export class PanicErrorHandler implements ErrorHandler {
  public predicate(data: string): boolean {
    return data?.startsWith(PANIC_CODE_PREFIX)
  }

  public handle(data: string): DecodedError {
    const encodedReason = data.slice(PANIC_CODE_PREFIX.length)
    const abi = new AbiCoder()
    try {
      const fragment = ErrorFragment.from('Panic(uint256)')
      const args = abi.decode(fragment.inputs, `0x${encodedReason}`)
      const reason = panicErrorCodeToReason(args[0] as bigint) ?? 'Unknown panic code'
      return panicErrorResult({ data, fragment, reason, args })
    } catch (e) {
      return unknownErrorResult({ reason: 'Unknown panic error', data })
    }
  }
}

export class CustomErrorHandler implements ErrorHandler {
  public predicate(data: string): boolean {
    return (
      data &&
      data !== '0x' &&
      !data?.startsWith(ERROR_STRING_PREFIX) &&
      !data?.startsWith(PANIC_CODE_PREFIX)
    )
  }

  public handle(data: string, { errorInterface }: ErrorHandlerErrorInfo): DecodedError {
    let result: Parameters<typeof customErrorResult>[0] = { data }
    if (errorInterface) {
      const customError = errorInterface.parseError(data)

      if (customError) {
        const { fragment, args, name: reason } = customError
        result = { ...result, fragment, reason, args }
      }
    }

    return customErrorResult(result)
  }
}

export class UserRejectionHandler implements ErrorHandler {
  public predicate(data: string, error: Error): boolean {
    return !data && error?.message?.includes('rejected transaction')
  }

  public handle(_data: string, { error }: ErrorHandlerErrorInfo): DecodedError {
    return userRejectErrorResult({
      data: null,
      reason: error.message ?? 'The transaction was rejected',
    })
  }
}

export class RpcErrorHandler implements ErrorHandler {
  public predicate(data: string, error: Error): boolean {
    return (
      !data &&
      error.message &&
      !error?.message?.includes('rejected transaction') &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).code !== undefined
    )
  }

  public handle(_data: string, { error }: ErrorHandlerErrorInfo): DecodedError {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcError = error as any
    const reason = rpcError.info?.error?.message ?? rpcError.shortMessage ?? rpcError.message
    return rpcErrorResult({ data: null, name: rpcError.code, reason })
  }
}
