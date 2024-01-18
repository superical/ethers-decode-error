import { ErrorType } from './enums'
import { Result } from 'ethers'

export type DecodedError = {
  type: ErrorType
  error: string | null
  data: string | undefined
  args?: Result
}
