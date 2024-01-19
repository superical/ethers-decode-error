import { AbiCoder, ErrorFragment, Interface } from 'ethers'
import { panicErrorCodeToReason } from './panic'
import { DecodedError } from '../types'
import { ERROR_STRING_PREFIX, PANIC_CODE_PREFIX } from '../common/constants'
import {
  customErrorResult,
  emptyErrorResult,
  panicErrorResult,
  revertErrorResult,
  unknownErrorResult,
} from './results'

export interface ErrorHandler {
  predicate: (data: string) => boolean
  handle: (data: string, errorInterface?: Interface) => DecodedError
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
    return data.startsWith(ERROR_STRING_PREFIX)
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
    return data.startsWith(PANIC_CODE_PREFIX)
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
      data !== '0x' && !data.startsWith(ERROR_STRING_PREFIX) && !data.startsWith(PANIC_CODE_PREFIX)
    )
  }

  public handle(data: string, errorInterface?: Interface): DecodedError {
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
