import { ErrorType } from './enums'
import { utils } from 'ethers'

export type DecodedError = {
  type: ErrorType
  error: string
  data: string | undefined
  args?: utils.Result
}
