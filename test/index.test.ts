import { DecodedError, decodeError, ErrorType } from '../src'
import { ethers } from 'hardhat'
import { getBytes, hexlify, concat, zeroPadValue } from 'ethers'
import type { ContractFactory } from 'ethers'
import { MockContract, MockContract__factory } from '../typechain-types'
import { expect } from 'chai'

describe('decodeError function', () => {
  let contract: MockContract

  let decodedError: DecodedError

  beforeEach(async () => {
    const contractFactory = (await ethers.getContractFactory(
      'MockContract',
    )) as ContractFactory as MockContract__factory
    contract = await contractFactory.deploy()
  })

  describe('When reverted with an unknown error', () => {
    const fakeUnknownError = {}

    beforeEach(async () => {
      decodedError = decodeError(fakeUnknownError)
    })

    it('should return error type as UnknownError', async () => {
      expect(decodedError.type).to.equal(ErrorType.UnknownError)
    })

    it('should use error message if it exists', async () => {
      const fakeErrorMsg = 'Test message'
      decodedError = decodeError({ message: fakeErrorMsg })

      expect(decodedError.error).to.equal(fakeErrorMsg)
    })

    it('should return error message as Unexpected error', async () => {
      expect(decodedError.error).to.equal('Unexpected error')
    })

    it('should return undefined data', async () => {
      expect(decodedError.data).to.be.undefined
    })
  })

  describe('When reverted error has no data', () => {
    describe('When reverted due to user rejection', () => {
      const fakeUnknownError = new Error('The user rejected transaction in wallet')

      beforeEach(async () => {
        decodedError = decodeError(fakeUnknownError)
      })

      it('should return error type as UserError', async () => {
        expect(decodedError.type).to.equal(ErrorType.UserError)
      })

      it('should return user rejected error message', async () => {
        expect(decodedError.error).to.equal('User has rejected the transaction')
      })

      it('should return undefined data', async () => {
        expect(decodedError.data).to.be.undefined
      })
    })

    describe('When reverted due to other reasons', () => {
      const fakeErrorMessage = 'Some other reasons'
      const fakeUnknownError = new Error(fakeErrorMessage)

      beforeEach(async () => {
        decodedError = decodeError(fakeUnknownError)
      })

      it('should return error type as UnknownError', async () => {
        expect(decodedError.type).to.equal(ErrorType.UnknownError)
      })

      it('should return the error message', async () => {
        expect(decodedError.error).to.equal(fakeErrorMessage)
      })

      it('should return undefined data', async () => {
        expect(decodedError.data).to.be.undefined
      })
    })

    describe('When reverted without known reason', () => {
      const fakeUnknownError = new Error()

      beforeEach(async () => {
        decodedError = decodeError(fakeUnknownError)
      })

      it('should return error type as UnknownError', async () => {
        expect(decodedError.type).to.equal(ErrorType.UnknownError)
      })

      it('should return the error message as Unknown error', async () => {
        expect(decodedError.error).to.equal('Unknown error')
      })

      it('should return undefined data', async () => {
        expect(decodedError.data).to.be.undefined
      })
    })
  })

  describe('When reverted with normal revert', () => {
    describe('When reverted with reason', () => {
      beforeEach(async () => {
        try {
          await contract.revertWithReason('Test message')
          expect.fail('Expected to revert')
        } catch (e) {
          decodedError = decodeError(e)
        }
      })

      it('should return error type as RevertError', async () => {
        expect(decodedError.type).to.equal(ErrorType.RevertError)
      })

      it('should return args as undefined', async () => {
        expect(decodedError.args).to.be.undefined
      })

      it('should return revert error data', async () => {
        const errorData =
          '0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000c54657374206d6573736167650000000000000000000000000000000000000000'

        expect(decodedError.data).to.equal(errorData)
      })

      it('should capture the revert', async () => {
        expect(decodedError.error).to.equal('Test message')
      })
    })

    describe('When reverted without reason', () => {
      beforeEach(async () => {
        try {
          await contract.revertWithoutReason()
          expect.fail('Expected to revert')
        } catch (e) {
          decodedError = decodeError(e)
        }
      })

      it('should return error type as EmptyError', async () => {
        expect(decodedError.type).to.equal(ErrorType.EmptyError)
      })

      it('should return args as undefined', async () => {
        expect(decodedError.args).to.be.undefined
      })

      it('should return revert error data', async () => {
        const errorData = '0x'

        expect(decodedError.data).to.equal(errorData)
      })

      it('should capture revert without reasons', async () => {
        expect(decodedError.error).to.be.null
      })
    })
  })

  describe('When reverted with panic error', () => {
    beforeEach(async () => {
      try {
        await contract.panicUnderflow()
        expect.fail('Expected to revert')
      } catch (e) {
        decodedError = decodeError(e)
      }
    })

    it('should return error type as PanicError', async () => {
      expect(decodedError.type).to.equal(ErrorType.PanicError)
    })

    it('should return args as undefined', async () => {
      expect(decodedError.args).to.be.undefined
    })

    it('should return panic error data', async () => {
      const errorData = concat(['0x4e487b71', zeroPadValue(getBytes('0x11'), 32)])

      expect(decodedError.data).to.equal(errorData)
    })

    it('should capture the panic error', async () => {
      expect(decodedError.error).to.equal(
        'Arithmetic operation underflowed or overflowed outside of an unchecked block',
      )
    })
  })

  describe('When reverted with custom error', () => {
    const ifaceCustomErrorNoParam = '0xec7240f7'
    const ifaceCustomErrorWithParams = '0x74649f48'

    const fakeAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
    const fakeUint = '12345'

    const abi = [
      {
        name: 'CustomErrorNoParam', // 0xec7240f7
        type: 'error',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'param1',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'param2',
            type: 'uint256',
          },
        ],
        name: 'CustomErrorWithParams', // 0x74649f48
        type: 'error',
      },
    ]

    describe('When custom error has no parameters', () => {
      const errorData = ifaceCustomErrorNoParam

      beforeEach(async () => {
        try {
          await contract.revertWithCustomErrorNoParam()
          expect.fail('Expected to revert')
        } catch (e) {
          decodedError = decodeError(e, abi)
        }
      })

      it('should capture custom errors with no parameters', async () => {
        expect(decodedError.error).to.equal('CustomErrorNoParam')
      })

      it('should return custom error data', async () => {
        expect(decodedError.data).to.equal(errorData)
      })

      it('should return empty args', async () => {
        expect(decodedError.args.length).to.equal(0)
      })

      it('should return error type as CustomError', async () => {
        expect(decodedError.type).to.equal(ErrorType.CustomError)
      })

      describe('When reverted custom error is not in ABI', () => {
        beforeEach(async () => {
          try {
            await contract.revertWithCustomErrorNoParam()
            expect.fail('Expected to revert')
          } catch (e) {
            decodedError = decodeError(e, [abi[1]])
          }
        })

        it('should return undefined args', async () => {
          expect(decodedError.args).to.be.undefined
        })

        it('should return the first 4 bytes of custom error name as error', async () => {
          expect(decodedError.error).to.equal(ifaceCustomErrorNoParam)
        })

        it('should return custom error data', async () => {
          expect(decodedError.data).to.equal(errorData)
        })
      })

      describe('When no ABI is supplied for custom error', () => {
        beforeEach(async () => {
          try {
            await contract.revertWithCustomErrorNoParam()
            expect.fail('Expected to revert')
          } catch (e) {
            decodedError = decodeError(e)
          }
        })

        it('should return the first 4 bytes of custom error name as error', async () => {
          expect(decodedError.error).to.equal(ifaceCustomErrorNoParam)
        })

        it('should return undefined args', async () => {
          expect(decodedError.args).to.be.undefined
        })

        it('should return custom error data', async () => {
          expect(decodedError.data).to.equal(errorData)
        })
      })
    })

    describe('When custom error has parameters', () => {
      const errorData = concat([
        ifaceCustomErrorWithParams,
        zeroPadValue(getBytes(fakeAddress), 32),
        zeroPadValue(hexlify(`0x${BigInt(fakeUint).toString(16)}`), 32),
      ])

      beforeEach(async () => {
        try {
          await contract.revertWithCustomErrorWithParams(fakeAddress, fakeUint)
          expect.fail('Expected to revert')
        } catch (e) {
          decodedError = decodeError(e, abi)
        }
      })

      it('should capture custom errors with parameters', async () => {
        expect(decodedError.error).to.equal('CustomErrorWithParams')
      })

      it('should return custom error data', async () => {
        expect(decodedError.data).to.equal(errorData)
      })

      it('should return custom error parameters in args', async () => {
        expect(decodedError.args[0]).to.equal(fakeAddress)
        expect(decodedError.args[1]).to.equal(fakeUint)

        expect(decodedError.args['param1']).to.equal(fakeAddress)
        expect(decodedError.args['param2']).to.equal(fakeUint)
      })

      it('should return error type as CustomError', async () => {
        expect(decodedError.type).to.equal(ErrorType.CustomError)
      })

      describe('When reverted custom error is not in ABI', () => {
        beforeEach(async () => {
          try {
            await contract.revertWithCustomErrorWithParams(fakeAddress, fakeUint)
            expect.fail('Expected to revert')
          } catch (e) {
            decodedError = decodeError(e, [abi[0]])
          }
        })

        it('should return undefined args', async () => {
          expect(decodedError.args).to.be.undefined
        })

        it('should return the first 4 bytes of custom error name as error', async () => {
          expect(decodedError.error).to.equal(ifaceCustomErrorWithParams)
        })

        it('should return custom error data', async () => {
          expect(decodedError.data).to.equal(errorData)
        })
      })

      describe('When no ABI is supplied for custom error', () => {
        beforeEach(async () => {
          try {
            await contract.revertWithCustomErrorWithParams(fakeAddress, fakeUint)
            expect.fail('Expected to revert')
          } catch (e) {
            decodedError = decodeError(e)
          }
        })

        it('should return the first 4 bytes of custom error name as error', async () => {
          expect(decodedError.error).to.equal(ifaceCustomErrorWithParams)
        })

        it('should return undefined args', async () => {
          expect(decodedError.args).to.be.undefined
        })

        it('should return custom error data', async () => {
          expect(decodedError.data).to.equal(errorData)
        })
      })
    })
  })
})
