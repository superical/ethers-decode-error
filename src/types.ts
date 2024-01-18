import { ErrorType } from './enums'
import { Result } from 'ethers'

export type DecodedError = {
  type: ErrorType
  error: string
  data: string | undefined
  args?: Result
}
