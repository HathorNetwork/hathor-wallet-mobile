import { put } from 'redux-saga/effects';
import { ncApi, addressUtils, transactionUtils } from '@hathor/wallet-lib';
import { jest, test, expect, beforeEach, describe } from '@jest/globals';
import {
  failureMessage,
  requestHistoryNanoContract,
  fetchHistory
} from '../../../src/sagas/nanoContract';
import {
  nanoContractHistoryFailure,
  nanoContractHistoryRequest,
  nanoContractHistorySuccess,
  onExceptionCaptured
} from '../../../src/actions';
import { STORE } from '../../../src/store';
import { fixtures } from './fixtures';

jest.mock('@hathor/wallet-lib');

beforeEach(() => {
  jest.clearAllMocks();
  STORE.clearItems();
});

describe('sagas/nanoContract/fetchHistory', () => {
  test('success', async () => {
    // arrange wallet mock
    const mockedWallet = {
      getNetworkObject: jest.fn(),
      storage: {
        isAddressMine: jest.fn(),
      },
    };
    // arrange ncApi mock
    const mockedNcApi = jest.mocked(ncApi);
    mockedNcApi.getNanoContractHistory
      .mockReturnValue(fixtures.ncApi.getNanoContractHistory.successResponse);
    // arrange addressUtils mock
    const mockedAddressUtils = jest.mocked(addressUtils);
    mockedAddressUtils.getAddressFromPubkey
      .mockResolvedValue('123');
    // arrange transactionUtils
    const mockedTransactionUtils = jest.mocked(transactionUtils);
    mockedTransactionUtils.getTxBalance
      .mockResolvedValue({});

    // call fetchHistory
    const count = 1;
    const after = null;
    const result = await fetchHistory(fixtures.ncId, count, after, mockedWallet);

    // assert result is defined
    expect(result.history).toBeDefined();
    expect(result.next).toBeDefined();
    // assert next value is a txId from the last element of history
    expect(result.next).toBe(fixtures.ncSaga.fetchHistory.successResponse.history[0].txId);
    // assert call count to API
    expect(mockedNcApi.getNanoContractHistory).toBeCalledTimes(1);
  });

  test('failure', async () => {
    // arrange ncApi mock
    const mockedNcApi = jest.mocked(ncApi);
    mockedNcApi.getNanoContractHistory
      .mockReturnValue(fixtures.ncApi.getNanoContractHistory.failureResponse);

    // call fetchHistory and assert exception
    const count = 1;
    const after = null;
    await expect(fetchHistory(fixtures.ncId, count, after)).rejects.toThrow('Failed to fetch nano contract history');
  });
});

describe('sagas/nanoContract/requestHistoryNanoContract', () => {
  test('history loading', () => {
    // arrange Nano Contract registration inputs
    const { ncId } = fixtures;

    // call effect to request history
    const gen = requestHistoryNanoContract(nanoContractHistoryRequest({ ncId }));
    // select wallet
    gen.next();
    // feed back historyMeta
    gen.next({ [ncId]: { isLoading: true, after: null } });

    // assert termination
    expect(gen.next().value).toBeUndefined();
  });

  test('history without registered contract', () => {
    // arrange Nano Contract registration inputs
    const { ncId } = fixtures;

    // call effect to request history
    const gen = requestHistoryNanoContract(nanoContractHistoryRequest({ ncId }));
    // select wallet
    gen.next();
    // feed back historyMeta
    gen.next({});
    // feed back wallet
    gen.next(fixtures.wallet.readyAndMine);

    // expect failure
    // feed back isNanoContractRegistered
    expect(gen.next(false).value).toStrictEqual(
      put(nanoContractHistoryFailure({ ncId, error: failureMessage.notRegistered }))
    );
  });

  test('fetch history fails', () => {
    // arrange Nano Contract registration inputs
    const { ncId } = fixtures;
    const storage = STORE.getStorage();
    storage.registerNanoContract(ncId, { ncId });

    // call effect to request history
    const gen = requestHistoryNanoContract(nanoContractHistoryRequest({ ncId }));
    // select wallet
    gen.next();
    // feed back historyMeta
    gen.next({});
    // feed back wallet
    gen.next(fixtures.wallet.readyAndMine);
    // feed back isNanoContractRegistered
    const fetchHistoryCall = gen.next(true).value;

    // throws on fetchHistory call
    const failureCall = gen.throw(new Error('history')).value;
    const onErrorCall = gen.next().value;

    // assert failure
    expect(fetchHistoryCall.payload.fn).toBe(fetchHistory);
    expect(failureCall).toStrictEqual(
      put(nanoContractHistoryFailure({ ncId, error: failureMessage.nanoContractHistoryFailure }))
    );
    expect(onErrorCall).toStrictEqual(put(onExceptionCaptured(new Error('history'), false)));
  });

  test('history with success', () => {
    // arrange Nano Contract registration inputs
    const { ncId } = fixtures;

    // call effect to request history
    const gen = requestHistoryNanoContract(nanoContractHistoryRequest({ ncId }));
    // select wallet
    gen.next();
    // feed back historyMeta
    gen.next({});
    // feed back wallet
    gen.next(fixtures.wallet.readyAndMine);
    // feed back isNanoContractRegistered
    const fetchHistoryCall = gen.next(true).value;
    // feed back fetchHistory
    const sucessCall = gen.next(fixtures.ncSaga.fetchHistory.successResponse).value;

    // assert success
    const expectedHistory = fixtures.ncSaga.fetchHistory.successResponse.history;
    expect(fetchHistoryCall.payload.fn).toBe(fetchHistory);
    expect(sucessCall.payload).toHaveProperty('action.payload.ncId');
    expect(sucessCall.payload).toHaveProperty('action.payload.history');
    expect(sucessCall.payload.action.payload.ncId).toStrictEqual(ncId);
    expect(sucessCall.payload.action.payload.history).toStrictEqual(expectedHistory);
    expect(sucessCall).toStrictEqual(
      put(nanoContractHistorySuccess({ ncId, history: expectedHistory, after: null }))
    );
    // assert termination
    expect(gen.next().value).toBeUndefined();
  });
});
