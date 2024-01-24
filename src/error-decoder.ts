import { ErrorFragment, Fragment, Interface, JsonFragment, TransactionReceipt } from 'ethers'
import { DecodedError } from './types'
import {
  CustomErrorHandler,
  EmptyErrorHandler,
  ErrorHandler,
  PanicErrorHandler,
  RevertErrorHandler,
  RpcErrorHandler,
  UserRejectionHandler,
} from './errors/handlers'
import { unknownErrorResult } from './errors/results'

export class ErrorDecoder {
  private readonly errorHandlers: ErrorHandler[] = []

  private constructor(
    handlers: ErrorHandler[],
    public readonly errorInterface: Interface | undefined,
  ) {
    this.errorHandlers = handlers.map((handler) => ({
      predicate: handler.predicate,
      handle: handler.handle,
    }))
  }

  private async getContractOrTransactionError(error: Error): Promise<Error> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  private getDataFromError(error: Error): string | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorData = (error as any).data ?? (error as any).error?.data

    if (errorData === undefined) {
      return undefined
    }

    let returnData = typeof errorData === 'string' ? errorData : errorData.data

    if (typeof returnData === 'object' && returnData.data) {
      returnData = returnData.data
    }

    if (returnData === undefined || typeof returnData !== 'string') {
      return undefined
    }

    return returnData
  }

  public async decode(error: unknown | Error): Promise<DecodedError> {
    if (!(error instanceof Error)) {
      return unknownErrorResult({
        data: undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reason: (error as any).message ?? 'Invalid error',
      })
    }

    const targetError = await this.getContractOrTransactionError(error)
    const returnData = this.getDataFromError(targetError)

    for (const { predicate, handle } of this.errorHandlers) {
      if (predicate(returnData, targetError)) {
        return handle(returnData, { errorInterface: this.errorInterface, error: targetError })
      }
    }

    return unknownErrorResult({
      data: returnData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reason: (targetError as any)?.message ?? 'Unexpected error',
      name: targetError?.name,
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
      new UserRejectionHandler(),
      new RpcErrorHandler(),
      ...(additionalErrorHandlers ?? []),
    ]
    return new ErrorDecoder(handlers, errorInterface)
  }
}
