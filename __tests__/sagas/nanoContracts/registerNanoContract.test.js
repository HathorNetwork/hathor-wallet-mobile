import { put } from 'redux-saga/effects';
import { ncApi } from '@hathor/wallet-lib';
import { jest, test, expect, beforeEach, describe } from '@jest/globals';
import { getNanoContractState, registerNanoContract, formatNanoContractRegistryEntry, failureMessage } from '../../../src/sagas/nanoContract';
import { nanoContractRegisterFailure, nanoContractRegisterRequest, types } from '../../../src/actions';
import { STORE } from '../../../src/store';
import { nanoContractKey } from '../../../src/constants';

jest.mock('@hathor/wallet-lib');

const fixtures = {
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
        }
      }
    }
  },
  ncSaga: {
    getNanoContractState: {
      errorResponse: {
        error: new Error('API call error')
      },
      successResponse: {
        ncState: {
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
          }
        },
      }
    },
  },
  wallet: {
    notReady: {
      isReady: () => false,
    },
    addressNotMine: {
      isReady: () => true,
      isAddressMine: jest.fn().mockReturnValue(false),
    },
    readyAndMine: {
      isReady: () => true,
      isAddressMine: jest.fn().mockReturnValue(true),
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  STORE.clearItems();
});

describe('sagas/nanoContract/getNanoContractState', () => {
  test('success', async () => {
    // arrange ncApi mock
    const mockedNcApi = jest.mocked(ncApi);
    mockedNcApi.getNanoContractState
      .mockReturnValue(fixtures.ncApi.getNanoContractState.successResponse);

    // call getNanoContractState
    const result = await getNanoContractState(fixtures.ncId);

    // assert
    expect(result.ncState).toBeDefined();
    expect(result.error).toBeUndefined();
    expect(mockedNcApi.getNanoContractState).toBeCalledTimes(1);
  });

  test('failure', async () => {
    // arrange ncApi mock
    const mockedNcApi = jest.mocked(ncApi);
    mockedNcApi.getNanoContractState.mockRejectedValue(new Error('api call failure'));

    // call getNanoContractState
    const result = await getNanoContractState(fixtures.ncId);

    // assert
    expect(result.ncState).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(mockedNcApi.getNanoContractState).toBeCalledTimes(1);
  });
});

describe('sagas/nanoContract/registerNanoContract', () => {
  test('contract already registered', async () => {
    // arrange Nano Contract registration inputs
    const { address, ncId } = fixtures;

    // add an entry to registeredContracts
    const ncEntry = formatNanoContractRegistryEntry(address, ncId);
    STORE.setItem(nanoContractKey.registeredContracts, { [ncEntry]: {} });

    // call effect to register nano contract
    const gen = registerNanoContract(nanoContractRegisterRequest({ address, ncId }));

    // assert failure
    expect(gen.next().value)
      .toStrictEqual(put(nanoContractRegisterFailure(failureMessage.alreadyRegistered)))
    // assert termination
    expect(gen.next().value).toBeUndefined();
  });

  test('wallet not ready', async () => {
    // arrange Nano Contract registration inputs
    const { address, ncId } = fixtures;

    // call effect to register nano contract
    const gen = registerNanoContract(nanoContractRegisterRequest({ address, ncId }));
    // emmit selector effect
    gen.next();

    // assert failure
    // feed back the selector and advance generator to failure
    expect(gen.next(fixtures.wallet.notReady).value)
      .toStrictEqual(put(nanoContractRegisterFailure(failureMessage.walletNotReady)))
    // assert termination
    expect(gen.next().value).toBeUndefined();
  });

  test('address not mine', async () => {
    // arrange Nano Contract registration inputs
    const { address, ncId } = fixtures;

    // call effect to register nano contract
    const gen = registerNanoContract(nanoContractRegisterRequest({ address, ncId }));
    // emmit selector effect
    gen.next();
    // feed back the selector
    gen.next(fixtures.wallet.addressNotMine);

    // assert failure
    // resume isAddressMine call and advance generator to failure
    expect(gen.next(fixtures.wallet.addressNotMine.isAddressMine()).value)
      .toStrictEqual(put(nanoContractRegisterFailure(failureMessage.addressNotMine)))
    // assert termination
    expect(gen.next().value).toBeUndefined();
  });

  test('getNanoContractState error', async () => {
    // arrange Nano Contract registration inputs
    const { address, ncId } = fixtures;

    // call effect to register nano contract
    const gen = registerNanoContract(nanoContractRegisterRequest({ address, ncId }));
    // emmit selector effect
    gen.next();
    // feed back the selector
    gen.next(fixtures.wallet.readyAndMine);
    // resume isAddressMine call
    gen.next(fixtures.wallet.readyAndMine.isAddressMine());

    // assert failure
    // resume getNanoContractState call and advance generator to failure
    expect(gen.next(fixtures.ncSaga.getNanoContractState.errorResponse).value)
      .toStrictEqual(put(nanoContractRegisterFailure(failureMessage.nanoContractStateFailure)))
    // assert termination
    expect(gen.next().value).toBeUndefined();
  });

  test('register with success', async () => {
    // arrange Nano Contract registration inputs
    const { address, ncId } = fixtures;

    // call effect to register nano contract
    const gen = registerNanoContract(nanoContractRegisterRequest({ address, ncId }));
    // emmit selector effect
    gen.next();
    // feed back the selector
    gen.next(fixtures.wallet.readyAndMine);
    // resume isAddressMine call
    gen.next(fixtures.wallet.readyAndMine.isAddressMine());
    // resume getNanoContractState call and advance generator to success
    const actionResult = gen.next(fixtures.ncSaga.getNanoContractState.successResponse).value;

    // assert success
    expect(actionResult.payload.action.type)
      .toBe(types.NANOCONTRACT_REGISTER_SUCCESS);
    expect(actionResult.payload.action.payload.entryKey)
      .toBe(formatNanoContractRegistryEntry(address, ncId));
    expect(actionResult.payload.action.payload.entryValue)
      .toBeDefined();
    // assert termination
    expect(gen.next().value).toBeUndefined();

    // assert nano contract persistence
    const registeredContracts = STORE.getItem(nanoContractKey.registeredContracts);
    expect(registeredContracts).toBeDefined();
    expect(actionResult.payload.action.payload.entryKey).toBeDefined();
  });
});
