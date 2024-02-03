import { ethers } from 'hardhat'
import { expect } from 'chai'
import sinon from 'sinon'
import type { SinonSpy } from 'sinon'
import { getBytes, hexlify, concat, zeroPadValue } from 'ethers'
import type { ContractFactory } from 'ethers'
import {
  MockContract,
  MockContract__factory,
  MockNestedContract,
  MockNestedContract__factory,
} from '../typechain-types'
import { ErrorDecoder } from '../src'
import { DecodedError, ErrorType } from '../src'

describe('ErrorDecoder', () => {
  let contract: MockContract

  let errorDecoder: ErrorDecoder
  let decodedError: DecodedError

  beforeEach(async () => {
    const contractFactory = (await ethers.getContractFactory(
      'MockContract',
    )) as ContractFactory as MockContract__factory
    contract = await contractFactory.deploy()

    errorDecoder = ErrorDecoder.create()
  })

  describe('When reverted with an unknown error', () => {
    const fakeUnknownError = {}

    beforeEach(async () => {
      decodedError = await errorDecoder.decode(fakeUnknownError)
    })

    it('should return error type as UnknownError', async () => {
      expect(decodedError.type).to.equal(ErrorType.UnknownError)
    })

    it('should use error message if it exists', async () => {
      const fakeErrorMsg = 'Test message'
      decodedError = await errorDecoder.decode({ message: fakeErrorMsg })

      expect(decodedError.reason).to.equal(fakeErrorMsg)
    })

    it('should return error message as Invalid error', async () => {
      expect(decodedError.reason).to.equal('Invalid error')
    })

    it('should return null data', async () => {
      expect(decodedError.data).to.be.null
    })
  })

  describe('When reverted error has no data', () => {
    describe('When reverted due to user rejection', () => {
      const fakeUnknownError = new Error('The user rejected transaction in wallet')

      beforeEach(async () => {
        decodedError = await errorDecoder.decode(fakeUnknownError)
      })

      it('should return error type as UserError', async () => {
        expect(decodedError.type).to.equal(ErrorType.UserRejectError)
      })

      it('should return user rejected error message', async () => {
        expect(decodedError.reason).to.equal(fakeUnknownError.message)
      })

      it('should return null data', async () => {
        expect(decodedError.data).to.be.null
      })
    })

    describe('When reverted due to other reasons', () => {
      const fakeErrorMessage = 'Some other reasons'
      const fakeUnknownError = new Error(fakeErrorMessage)

      beforeEach(async () => {
        decodedError = await errorDecoder.decode(fakeUnknownError)
      })

      it('should return error type as UnknownError', async () => {
        expect(decodedError.type).to.equal(ErrorType.UnknownError)
      })

      it('should return the error message', async () => {
        expect(decodedError.reason).to.equal(fakeErrorMessage)
      })

      it('should return null data', async () => {
        expect(decodedError.data).to.be.null
      })
    })

    describe('When reverted without known reason', () => {
      const fakeUnknownError = new Error()

      beforeEach(async () => {
        decodedError = await errorDecoder.decode(fakeUnknownError)
      })

      it('should return error type as UnknownError', async () => {
        expect(decodedError.type).to.equal(ErrorType.UnknownError)
      })

      it('should return the error message as Unknown error', async () => {
        expect(decodedError.reason).to.equal('Unknown error')
      })

      it('should return null data', async () => {
        expect(decodedError.data).to.be.null
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
          decodedError = await errorDecoder.decode(e)
        }
      })

      it('should return error type as RevertError', async () => {
        expect(decodedError.type).to.equal(ErrorType.RevertError)
      })

      it('should return args with reason', async () => {
        expect(decodedError.args[0]).to.equal('Test message')
      })

      it('should return revert error data', async () => {
        const errorData =
          '0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000c54657374206d6573736167650000000000000000000000000000000000000000'

        expect(decodedError.data).to.equal(errorData)
      })

      it('should capture the revert', async () => {
        expect(decodedError.reason).to.equal('Test message')
      })
    })

    describe('When reverted without reason', () => {
      beforeEach(async () => {
        try {
          await contract.revertWithoutReason()
          expect.fail('Expected to revert')
        } catch (e) {
          decodedError = await errorDecoder.decode(e)
        }
      })

      it('should return error type as EmptyError', async () => {
        expect(decodedError.type).to.equal(ErrorType.EmptyError)
      })

      it('should return empty args', async () => {
        expect(decodedError.args.length).to.equal(0)
      })

      it('should return revert error data', async () => {
        const errorData = '0x'

        expect(decodedError.data).to.equal(errorData)
      })

      it('should capture revert without reasons', async () => {
        expect(decodedError.reason).to.be.null
      })
    })
  })

  describe('When reverted with panic error', () => {
    beforeEach(async () => {
      try {
        await contract.panicUnderflow()
        expect.fail('Expected to revert')
      } catch (e) {
        decodedError = await errorDecoder.decode(e)
      }
    })

    it('should return error type as PanicError', async () => {
      expect(decodedError.type).to.equal(ErrorType.PanicError)
    })

    it('should return args containing panic 0x11n', async () => {
      expect(decodedError.args[0]).to.equal(0x11n)
    })

    it('should return panic error data', async () => {
      const errorData = concat(['0x4e487b71', zeroPadValue(getBytes('0x11'), 32)])

      expect(decodedError.data).to.equal(errorData)
    })

    it('should capture the panic error', async () => {
      expect(decodedError.reason).to.equal(
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

    const testMatrixUseAbiArray = [true, false]
    Object.keys(testMatrixUseAbiArray).forEach((useAbiArray) => {
      beforeEach(async () => {
        errorDecoder = ErrorDecoder.create(
          useAbiArray ? [abi] : [MockContract__factory.createInterface()],
        )
      })

      describe(`When using ${useAbiArray ? 'ABI array' : 'contract interface'}`, () => {
        describe('When custom error has no parameters', () => {
          const errorData = ifaceCustomErrorNoParam

          beforeEach(async () => {
            try {
              await contract.revertWithCustomErrorNoParam()
              expect.fail('Expected to revert')
            } catch (e) {
              decodedError = await errorDecoder.decode(e)
            }
          })

          it('should capture custom errors with no parameters', async () => {
            expect(decodedError.reason).to.equal('CustomErrorNoParam')
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
              errorDecoder = ErrorDecoder.create([[abi[1]]])
              try {
                await contract.revertWithCustomErrorNoParam()
                expect.fail('Expected to revert')
              } catch (e) {
                decodedError = await errorDecoder.decode(e)
              }
            })

            it('should return empty args', async () => {
              expect(decodedError.args.length).to.equal(0)
            })

            it('should return the selector of custom error name as reason', async () => {
              expect(decodedError.reason).to.equal(
                `No ABI for custom error ${ifaceCustomErrorNoParam}`,
              )
            })

            it('should return the selector of custom error as name', async () => {
              expect(decodedError.name).to.equal(ifaceCustomErrorNoParam)
            })

            it('should return custom error data', async () => {
              expect(decodedError.data).to.equal(errorData)
            })

            it('should return error type as CustomError', async () => {
              expect(decodedError.type).to.equal(ErrorType.CustomError)
            })
          })

          describe('When no ABI is supplied for custom error', () => {
            beforeEach(async () => {
              errorDecoder = ErrorDecoder.create()
              try {
                await contract.revertWithCustomErrorNoParam()
                expect.fail('Expected to revert')
              } catch (e) {
                decodedError = await errorDecoder.decode(e)
              }
            })

            it('should return the selector of custom error name as reason', async () => {
              expect(decodedError.reason).to.equal(
                `No ABI for custom error ${ifaceCustomErrorNoParam}`,
              )
            })

            it('should return the selector of custom error as name', async () => {
              expect(decodedError.name).to.equal(ifaceCustomErrorNoParam)
            })

            it('should return empty args', async () => {
              expect(decodedError.args.length).to.equal(0)
            })

            it('should return custom error data', async () => {
              expect(decodedError.data).to.equal(errorData)
            })

            it('should return error type as CustomError', async () => {
              expect(decodedError.type).to.equal(ErrorType.CustomError)
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
              decodedError = await errorDecoder.decode(e)
            }
          })

          it('should capture custom errors with parameters', async () => {
            expect(decodedError.reason).to.equal('CustomErrorWithParams')
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
              errorDecoder = ErrorDecoder.create([[abi[0]]])
              try {
                await contract.revertWithCustomErrorWithParams(fakeAddress, fakeUint)
                expect.fail('Expected to revert')
              } catch (e) {
                decodedError = await errorDecoder.decode(e)
              }
            })

            it('should return empty args', async () => {
              expect(decodedError.args.length).to.equal(0)
            })

            it('should return the selector of custom error name as reason', async () => {
              expect(decodedError.reason).to.equal(
                `No ABI for custom error ${ifaceCustomErrorWithParams}`,
              )
            })

            it('should return the selector of custom error as name', async () => {
              expect(decodedError.name).to.equal(ifaceCustomErrorWithParams)
            })

            it('should return custom error data', async () => {
              expect(decodedError.data).to.equal(errorData)
            })

            it('should return error type as CustomError', async () => {
              expect(decodedError.type).to.equal(ErrorType.CustomError)
            })
          })

          describe('When no ABI is supplied for custom error', () => {
            beforeEach(async () => {
              errorDecoder = ErrorDecoder.create()
              try {
                await contract.revertWithCustomErrorWithParams(fakeAddress, fakeUint)
                expect.fail('Expected to revert')
              } catch (e) {
                decodedError = await errorDecoder.decode(e)
              }
            })

            it('should return the selector of custom error name as reason', async () => {
              expect(decodedError.reason).to.equal(
                `No ABI for custom error ${ifaceCustomErrorWithParams}`,
              )
            })

            it('should return the selector of custom error as name', async () => {
              expect(decodedError.name).to.equal(ifaceCustomErrorWithParams)
            })

            it('should return empty args', async () => {
              expect(decodedError.args.length).to.equal(0)
            })

            it('should return custom error data', async () => {
              expect(decodedError.data).to.equal(errorData)
            })

            it('should return error type as CustomError', async () => {
              expect(decodedError.type).to.equal(ErrorType.CustomError)
            })
          })
        })
      })
    })

    describe('When reverted with nested custom error', () => {
      let nestedContract: MockNestedContract
      let nestedContractAddress: string

      const nestedErrorAbi = [
        {
          inputs: [
            {
              internalType: 'uint256',
              name: 'param',
              type: 'uint256',
            },
          ],
          name: 'NestedError',
          type: 'error',
        },
      ]

      beforeEach(async () => {
        const nestedContractFactory = (await ethers.getContractFactory(
          'MockNestedContract',
        )) as ContractFactory as MockNestedContract__factory
        nestedContract = await nestedContractFactory.deploy()
        nestedContractAddress = await nestedContract.getAddress()
      })

      describe('When provided only with interface objects', () => {
        beforeEach(async () => {
          errorDecoder = ErrorDecoder.create([
            MockContract__factory.createInterface(),
            MockNestedContract__factory.createInterface(),
          ])
        })

        it('should merge the interfaces the recognise error from MockContract', async () => {
          try {
            await contract.revertWithCustomErrorWithParams(fakeAddress, fakeUint)
            expect.fail('Expected to revert')
          } catch (e) {
            decodedError = await errorDecoder.decode(e)
          }

          expect(decodedError.name).to.equal('CustomErrorWithParams')
        })

        it('should merge the interfaces the recognise error from MockNestedContract', async () => {
          try {
            await contract.revertWithCustomNestedError(nestedContractAddress, fakeUint)
            expect.fail('Expected to revert')
          } catch (e) {
            decodedError = await errorDecoder.decode(e)
          }

          expect(decodedError.name).to.equal('NestedError')
        })
      })

      describe('When provided only with ABIs', () => {
        beforeEach(async () => {
          errorDecoder = ErrorDecoder.create([abi, nestedErrorAbi])
        })

        it('should merge the interfaces the recognise error from MockContract', async () => {
          try {
            await contract.revertWithCustomErrorWithParams(fakeAddress, fakeUint)
            expect.fail('Expected to revert')
          } catch (e) {
            decodedError = await errorDecoder.decode(e)
          }

          expect(decodedError.name).to.equal('CustomErrorWithParams')
        })

        it('should merge the interfaces the recognise error from MockNestedContract', async () => {
          try {
            await contract.revertWithCustomNestedError(nestedContractAddress, fakeUint)
            expect.fail('Expected to revert')
          } catch (e) {
            decodedError = await errorDecoder.decode(e)
          }

          expect(decodedError.name).to.equal('NestedError')
        })
      })

      describe('When provided interface objects and ABIs', () => {
        beforeEach(async () => {
          errorDecoder = ErrorDecoder.create([abi, MockNestedContract__factory.createInterface()])
        })

        it('should merge the interfaces the recognise error from MockContract', async () => {
          try {
            await contract.revertWithCustomErrorWithParams(fakeAddress, fakeUint)
            expect.fail('Expected to revert')
          } catch (e) {
            decodedError = await errorDecoder.decode(e)
          }

          expect(decodedError.name).to.equal('CustomErrorWithParams')
        })

        it('should merge the interfaces the recognise error from MockNestedContract', async () => {
          try {
            await contract.revertWithCustomNestedError(nestedContractAddress, fakeUint)
            expect.fail('Expected to revert')
          } catch (e) {
            decodedError = await errorDecoder.decode(e)
          }

          expect(decodedError.name).to.equal('NestedError')
        })
      })
    })
  })

  describe('When reverted not due to contract errors', () => {
    describe('When decoding RPC errors', () => {
      beforeEach(async () => {
        try {
          await contract.revertWithReason('Test message', {
            gasLimit: 100000,
            gasPrice: '1180820112192848923743894728934',
          })
          expect.fail('Expected to revert')
        } catch (e) {
          decodedError = await errorDecoder.decode(e)
        }
      })

      it('should return error type as RpcError', async () => {
        expect(decodedError.type).to.equal(ErrorType.RpcError)
      })

      it('should return error code as name', async () => {
        expect(decodedError.name).to.equal('-32000')
      })

      it('should return the error reason', async () => {
        expect(decodedError.reason).to.contain("sender doesn't have enough funds to send tx")
      })

      it('should return data as null', async () => {
        expect(decodedError.data).to.be.null
      })

      it('should return empty args', async () => {
        expect(decodedError.args.length).to.equal(0)
      })
    })

    describe('When obtaining the error message in RPC errors', () => {
      const FakeRpcError = class extends Error {
        public constructor(
          public code?: string,
          public info?: { error: { code: number; message: string } },
          public shortMessage?: string,
        ) {
          super('Fake error object message')
        }
      }

      let fakeRpcError = new FakeRpcError()

      beforeEach(async () => {
        fakeRpcError = new FakeRpcError(
          'INSUFFICIENT_FUNDS',
          {
            error: {
              code: -32000,
              message: 'insufficient funds for gas * price + value: balance 0',
            },
          },
          'insufficient funds for intrinsic transaction cost',
        )
      })

      it('should use long error message if exists', async () => {
        decodedError = await errorDecoder.decode(fakeRpcError)

        expect(decodedError.reason).to.equal(fakeRpcError.info.error.message)
      })

      it('should use short message if long error message does not exist', async () => {
        fakeRpcError.info = undefined

        decodedError = await errorDecoder.decode(fakeRpcError)

        expect(decodedError.reason).to.equal(fakeRpcError.shortMessage)
      })

      it('should fallback to using message in error object', async () => {
        fakeRpcError.info = undefined
        fakeRpcError.shortMessage = undefined

        decodedError = await errorDecoder.decode(fakeRpcError)

        expect(decodedError.reason).to.equal(fakeRpcError.message)
      })
    })
  })

  describe('When transaction mined but reverted', () => {
    const FakeTxError = class extends Error {
      public receipt: {
        status: number
        provider: {
          getTransaction: SinonSpy
          call: SinonSpy
        }
      }
      public constructor(public status: number) {
        super('Fake transaction error')
        this.receipt = {
          status,
          provider: {
            getTransaction: sinon.fake(),
            call: sinon.spy(),
          },
        }
      }
    }

    beforeEach(async () => {
      errorDecoder = ErrorDecoder.create()
    })

    describe('When receipt status is zero', () => {
      const fakeTxError = new FakeTxError(0)

      beforeEach(async () => {
        decodedError = await errorDecoder.decode(fakeTxError)
      })

      it('should call transaction for error data', async () => {
        expect(fakeTxError.receipt.provider.call.calledOnce).to.be.true
      })

      it('should return name as error name', async () => {
        expect(decodedError.name).to.equal('Error')
      })

      it('should return reason as error message', async () => {
        expect(decodedError.reason).to.equal('Fake transaction error')
      })
    })

    describe('When receipt status is non-zero', () => {
      const fakeTxError = new FakeTxError(1)

      it('should not call transaction for error data', async () => {
        await errorDecoder.decode(fakeTxError)

        expect(fakeTxError.receipt.provider.call.calledOnce).to.be.false
      })
    })
  })
})
