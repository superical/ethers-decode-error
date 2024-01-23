import {
  ErrorFragment,
  Fragment,
  Interface,
  JsonFragment,
  TransactionReceipt,
} from 'ethers'
import { DecodedError } from './types'
import {
  CustomErrorHandler,
  EmptyErrorHandler,
  ErrorHandler,
  PanicErrorHandler,
  RevertErrorHandler,
} from './errors/handlers'
import { unknownErrorResult, userRejectErrorResult } from './errors/results'

export class ErrorDecoder {
  private readonly errorHandlers: {
    predicate: (data: string) => boolean
    handler: ErrorHandler['handle']
  }[] = []

  private constructor(
    handlers: ErrorHandler[],
    public readonly errorInterface: Interface | undefined,
  ) {
    this.errorHandlers = handlers.map((handler) => ({
      predicate: handler.predicate,
      handler: handler.handle,
    }))
  }

  private async getContractOrTransactionError(error: Error): Promise<Error> {
    const errorReceipt = (error as any).receipt as TransactionReceipt

    if (!errorReceipt) return error

    const resError = await this.getTransactionError(errorReceipt)

    if (!resError) return error

    return resError
  }

  private async getTransactionError(errorReceipt: TransactionReceipt): Promise<Error | null> {
    if (!errorReceipt || errorReceipt.status !== 0) {
      return undefined
    }
    const txHash = errorReceipt.hash
    const provider = errorReceipt.provider
    const tx = await provider.getTransaction(txHash)
    try {
      await provider.call({
        ...tx,
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined,
      })
      return null
    } catch (e) {
      return e as Error
    }
  }

  private getDataFromError(error: Error): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorData = (error as any).data ?? (error as any).error?.data

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

  public async decode(error: unknown | Error): Promise<DecodedError> {
    if (!(error instanceof Error)) {
      return unknownErrorResult({
        data: undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reason: (error as any).message ?? 'Unexpected error',
      })
    }

    let returnData: string
    try {
      const targetError = await this.getContractOrTransactionError(error)
      returnData = this.getDataFromError(targetError)
    } catch (e) {
      if (error.message) {
        if (error.message.includes('rejected transaction')) {
          return userRejectErrorResult({ data: null, reason: error.message })
        }
        return unknownErrorResult({ data: null, reason: error.message })
      }
      return unknownErrorResult({ data: null })
    }

    for (const { predicate, handler } of this.errorHandlers) {
      if (predicate(returnData)) {
        return handler(returnData, this.errorInterface)
      }
    }

    return unknownErrorResult({
      data: returnData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reason: (error as any).message ?? 'Unrecognised error',
    })
  }

  public static create(
    errorInterfaces?: ReadonlyArray<Fragment[] | JsonFragment[] | Interface>,
    opts: {
      additionalErrorHandlers?: ErrorHandler[]
    } = {},
  ): ErrorDecoder {
    const { additionalErrorHandlers } = opts
    let errorInterface: Interface | undefined
    if (errorInterfaces) {
      const errorFragments = errorInterfaces.flatMap((iface) => {
        if (iface instanceof Interface) {
          return iface.fragments.filter((fragment) => ErrorFragment.isFragment(fragment))
        } else {
          return (iface as Fragment[]).filter(
            (fragment) => fragment.type === 'error' || ErrorFragment.isFragment(fragment),
          )
        }
      })
      errorInterface = new Interface(errorFragments)
    }
    const handlers = [
      new EmptyErrorHandler(),
      new RevertErrorHandler(),
      new PanicErrorHandler(),
      new CustomErrorHandler(),
      ...(additionalErrorHandlers ?? []),
    ]
    return new ErrorDecoder(handlers, errorInterface)
  }
}
