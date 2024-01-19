import { ErrorType } from './common/enums'
import { ErrorDescription } from "ethers";

export type DecodedError = ErrorDescription & {
  type: ErrorType
  reason: string | null
  data: string | null
}
