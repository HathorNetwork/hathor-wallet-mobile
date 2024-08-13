import { jest } from '@jest/globals';

export const fixtures = {
  address: 'HTeZeYTCv7cZ8u7pBGHkWsPwhZAuoq5j3V',
  ncId: '3cb032600bdf7db784800e4ea911b10676fa2f67591f82bb62628c234e771595',
  ncApi: {
    getNanoContractState: {
      successResponse: {
        success: true,
        nc_id: '3cb032600bdf7db784800e4ea911b10676fa2f67591f82bb62628c234e771595',
        blueprint_name: 'Bet',
        fields: {
          token_uid: { value: '00' },
          total: { value: 300 },
          final_result: { value: '1x0' },
          oracle_script: { value: '76a91441c431ff7ad5d6ce5565991e3dcd5d9106cfd1e288ac' },
          'withdrawals.a\'Wi8zvxdXHjaUVAoCJf52t3WovTZYcU9aX6\'': { value: 300 },
          'address_details.a\'Wi8zvxdXHjaUVAoCJf52t3WovTZYcU9aX6\'': { value: { '1x0': 100 } },
        },
      },
    },
    getNanoContractHistory: {
      failureResponse: {
        success: false,
      },
      errorResponse: {
        error: new Error('API call error'),
      },
      successResponse: {
        success: true,
        history: [
          {
            hash: '000000203e87e8575f121de16d0eb347bd1473eedd9f46cc76c1bc8d4e5a5fce',
            nonce: 2104638,
            timestamp: 1708356261,
            version: 4,
            weight: 21.89480540500889,
            signal_bits: 0,
            parents: [
              '0000008fbebdf8d78be50c88aceebf3c6b9e92f4affd7dfc96d48a7a49f23e69',
              '00000121c46366b19de5efa8e6c23f62895322486395a0e31e987f9073025989'
            ],
            inputs: [
              {
                tx_id: '0000008fbebdf8d78be50c88aceebf3c6b9e92f4affd7dfc96d48a7a49f23e69',
                index: 0,
                data: 'RjBEAiBtWa0q8uzMvBfkh83Y+t4Tv5OeyJSD8NazaGp19Hc2UwIgbV2m5unBEHlTAcLJsZLsCBlnfpua8LrUkVORiW/t4OQhAolqAR4yFaeCBeu/kOG1SwWnRj2X62zT9mU+Deutnbqq'
              }
            ],
            outputs: [
              {
                value: 78500,
                token_data: 1,
                script: 'dqkU5W5CR9734WcxaZMJkuToO8XlD3mIrA=='
              },
              {
                value: 300,
                token_data: 2,
                script: 'dqkU5W5CR9734WcxaZMJkuToO8XlD3mIrA=='
              }
            ],
            tokens: [
              '00000117b0502e9eef9ccbe987af65f153aa899d6eba88d50a6c89e78644713d',
              '0000038c49253f86e6792006dd9124e2c50e6487fde3296b7bd637e3e1a497e7'
            ],
            nc_id: '000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a',
            nc_method: 'swap',
            nc_args: '',
            nc_pubkey: '020b120c8ad037ceb2e5b51b3edda7cd15a44f843b56e49880f6647fa9aadadffa'
          },
        ],
      },
    },
  },
  ncSaga: {
    getNanoContractState: {
      errorResponse: {
        error: new Error('API call error'),
      },
      successResponse: {
        ncState: {
          success: true,
          nc_id: '3cb032600bdf7db784800e4ea911b10676fa2f67591f82bb62628c234e771595',
          blueprint_id: '000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a',
          blueprint_name: 'Bet',
          fields: {
            token_uid: { value: '00' },
            total: { value: 300 },
            final_result: { value: '1x0' },
            oracle_script: { value: '76a91441c431ff7ad5d6ce5565991e3dcd5d9106cfd1e288ac' },
            'withdrawals.a\'Wi8zvxdXHjaUVAoCJf52t3WovTZYcU9aX6\'': { value: 300 },
            'address_details.a\'Wi8zvxdXHjaUVAoCJf52t3WovTZYcU9aX6\'': { value: { '1x0': 100 } },
          },
        },
      },
    },
    fetchHistory: {
      successResponse: {
        history: [
          {
            txId: '000000203e87e8575f121de16d0eb347bd1473eedd9f46cc76c1bc8d4e5a5fce',
            timestamp: 1708356261,
            tokens: [
              '00000117b0502e9eef9ccbe987af65f153aa899d6eba88d50a6c89e78644713d',
              '0000038c49253f86e6792006dd9124e2c50e6487fde3296b7bd637e3e1a497e7'
            ],
            isVoided: false, // review
            ncId: '000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a',
            ncMethod: 'swap',
          },
        ],
        next: null,
      },
    },
  },
  wallet: {
    notReady: {
      isReady: () => false,
    },
    addressNotMine: {
      isReady: () => true,
      isAddressMine: jest.fn().mockReturnValue(false),
      storage: {
        isNanoContractRegistered: jest.fn(),
        registerNanoContract: jest.fn(),
      },
    },
    readyAndMine: {
      isReady: () => true,
      isAddressMine: jest.fn().mockReturnValue(true),
      storage: {
        isNanoContractRegistered: jest.fn(),
        registerNanoContract: jest.fn(),
        getNanoContract: jest.fn(),
      },
    },
  },
  store: {
    nanoContractAddressAlreadyRegistered: {
      ncId: '3cb032600bdf7db784800e4ea911b10676fa2f67591f82bb62628c234e771595',
      blueprintName: 'Bet',
      addresses: new Set(['HTeZeYTCv7cZ8u7pBGHkWsPwhZAuoq5j3V']),
    },
  },
};
