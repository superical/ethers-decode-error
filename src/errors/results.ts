import { ErrorDescription, ErrorFragment, Result } from 'ethers'
import { DecodedError } from '../types'
import { ErrorType } from '../common/enums'

type ErrorResultFormatterParam = {
  data: string
  reason?: string
  args?: Result
  fragment?: ErrorFragment
  selector?: string
  name?: string
}

type ErrorResultFormatter = (params: ErrorResultFormatterParam) => DecodedError

const baseErrorResult: (
  params: ErrorResultFormatterParam & { type: ErrorType },
) => DecodedError = ({ type, data, reason, fragment, args, selector, name }) => {
  let res: DecodedError = {
    type,
    reason: reason ?? null,
    data: data ?? null,
    fragment: null,
    args: args ?? new Result(),
    selector: selector ?? null,
    name: name ?? null,
    signature: null,
  }
  if (fragment) {
    const desc = new ErrorDescription(fragment, fragment.selector, args)
    res = {
      ...res,
      ...desc,
    }
  }
  return res
}

export const emptyErrorResult: ErrorResultFormatter = ({ data }) =>
  baseErrorResult({
    type: ErrorType.EmptyError,
    data,
  })

export const userRejectErrorResult: ErrorResultFormatter = ({ data = null, reason }) =>
  baseErrorResult({
    type: ErrorType.UserRejectError,
    reason: reason ?? 'User has rejected the transaction',
    data,
  })

export const revertErrorResult: ErrorResultFormatter = ({ data, reason, fragment, args }) => {
  return baseErrorResult({
    type: ErrorType.RevertError,
    reason,
    data,
    fragment,
    args,
  })
}

export const unknownErrorResult: ErrorResultFormatter = ({ data, reason }) => {
  return baseErrorResult({
    type: ErrorType.UnknownError,
    reason: reason ?? 'Unknown error',
    data,
  })
}

export const panicErrorResult: ErrorResultFormatter = ({ data, reason, args }) =>
  baseErrorResult({
    type: ErrorType.PanicError,
    reason,
    data,
    args,
  })

export const customErrorResult: ErrorResultFormatter = ({ data, reason, fragment, args }) => {
  const selector = data.slice(0, 10)
  return baseErrorResult({
    type: ErrorType.CustomError,
    reason: reason ?? `No ABI for custom error ${selector}`,
    data,
    fragment,
    args,
    selector,
    name: selector,
  })
}

export const rpcErrorResult: ErrorResultFormatter = ({ reason, name }) =>
  baseErrorResult({
    type: ErrorType.RpcError,
    reason: reason ?? 'Error from JSON RPC provider',
    data: null,
    name: name?.toString() ?? null,
  })
