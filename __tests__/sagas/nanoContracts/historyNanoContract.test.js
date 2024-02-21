import { put } from 'redux-saga/effects';
import { ncApi } from '@hathor/wallet-lib';
import { jest, test, expect, beforeEach, describe } from '@jest/globals';
import {
  formatNanoContractRegistryEntry,
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
import { nanoContractKey } from '../../../src/constants';
import { fixtures } from './fixtures';

jest.mock('@hathor/wallet-lib');

beforeEach(() => {
  jest.clearAllMocks();
  STORE.clearItems();
});

function addNanoContractEntry(address, ncId) {
  // add an entry to registeredContracts
  const ncEntry = formatNanoContractRegistryEntry(address, ncId);
  STORE.setItem(nanoContractKey.registeredContracts, { [ncEntry]: {} });
  return ncEntry;
}

describe('sagas/nanoContract/fetchHistory', () => {
  test('success', async () => {
    // arrange ncApi mock
    const mockedNcApi = jest.mocked(ncApi);
    mockedNcApi.getNanoContractHistory
      .mockReturnValue(fixtures.ncApi.getNanoContractHistory.successResponse);

    // call fetchHistory
    const count = 1;
    const after = null;
    const result = await fetchHistory(fixtures.ncId, count, after);

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
  test('history without registered contract', () => {
    // arrange Nano Contract registration inputs
    const { address, ncId } = fixtures;

    // call effect to request history
    const gen = requestHistoryNanoContract(nanoContractHistoryRequest({ address, ncId }));

    // expect failure
    expect(gen.next().value)
      .toStrictEqual(put(nanoContractHistoryFailure(failureMessage.notRegistered)));
  });

  test('fetch history fails', () => {
    // arrange Nano Contract registration inputs
    const { address, ncId } = fixtures;
    addNanoContractEntry(address, ncId);

    // call effect to request history
    const gen = requestHistoryNanoContract(nanoContractHistoryRequest({ address, ncId }));
    // advances to fetchHistory
    const fetchHistoryCall = gen.next();
    // advances to failure
    const failureCall = gen.throw(new Error('history'));
    const onErrorCall = gen.next();

    // assert failure
    expect(fetchHistoryCall.value.payload.fn).toBe(fetchHistory);
    expect(failureCall.value).toStrictEqual(put(nanoContractHistoryFailure(failureMessage.nanoContractHistoryFailure, new Error('history'))));
    expect(onErrorCall.value).toStrictEqual(put(onExceptionCaptured(new Error('history'), false)));
  });

  test('history with success', () => {
    // arrange Nano Contract registration inputs
    const { address, ncId } = fixtures;
    const ncEntry = addNanoContractEntry(address, ncId);

    // call effect to request history
    const gen = requestHistoryNanoContract(nanoContractHistoryRequest({ address, ncId }));
    // advances to fetchHistory
    const fetchHistoryCall = gen.next();
    // feed back fetchHistory and advances to history load
    const historyLoadCall = gen.next(fixtures.ncSaga.fetchHistory.successResponse);
    // advances to success
    const sucessCall = gen.next();

    // assert success
    expect(fetchHistoryCall.value.payload.fn).toBe(fetchHistory);
    expect(historyLoadCall.value.payload).toHaveProperty('action.payload.history');
    expect(historyLoadCall.value.payload).toHaveProperty('action.payload.ncEntry');
    expect(sucessCall.value).toStrictEqual(put(nanoContractHistorySuccess()));
    // assert termination
    expect(gen.next().value).toBeUndefined();

    // assert nano contract history persistence
    const registeredContracts = STORE.getItem(nanoContractKey.registeredContracts);
    expect(registeredContracts).toBeDefined();
    expect(registeredContracts[ncEntry]).toHaveProperty('history');
    expect(registeredContracts[ncEntry].history)
      .toStrictEqual(fixtures.ncSaga.fetchHistory.successResponse.history);
  });
});
