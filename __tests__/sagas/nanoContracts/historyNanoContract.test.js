import { put, call, select } from 'redux-saga/effects';
import { ncApi, addressUtils, transactionUtils } from '@hathor/wallet-lib';
import { jest, test, expect, beforeEach, describe } from '@jest/globals';
import {
  failureMessage,
  requestHistoryNanoContract,
  fetchHistory,
  clearLoadingLocksForTesting,
} from '../../../src/sagas/nanoContract';
import {
  nanoContractHistoryFailure,
  nanoContractHistoryRequest,
  nanoContractHistorySuccess,
  nanoContractHistoryLoading,
  onExceptionCaptured
} from '../../../src/actions';
import { STORE } from '../../../src/store';
import { fixtures } from './fixtures';

jest.mock('@hathor/wallet-lib');

beforeEach(() => {
  jest.clearAllMocks();
  STORE.clearItems();
  // Clear the module-level loading locks between tests
  if (typeof clearLoadingLocksForTesting === 'function') {
    clearLoadingLocksForTesting();
  }
});

describe('sagas/nanoContract/requestHistoryNanoContract', () => {
  test('wallet not ready dispatches failure', () => {
    const { ncId } = fixtures;

    const gen = requestHistoryNanoContract(nanoContractHistoryRequest({ ncId }));
    // The saga starts with lock check (synchronous), then puts nanoContractHistoryLoading
    gen.next();
    // feed back the nanoContractHistoryLoading put
    gen.next();
    // select wallet — feed back a not-ready wallet
    const walletNotReady = { isReady: () => false };
    const result = gen.next(walletNotReady).value;

    // Should dispatch failure because wallet is not ready
    expect(result).toStrictEqual(
      put(nanoContractHistoryFailure({ ncId, error: failureMessage.walletNotReadyError }))
    );
  });

  test('unregistered contract dispatches failure', () => {
    const { ncId } = fixtures;

    const gen = requestHistoryNanoContract(nanoContractHistoryRequest({ ncId }));
    // 1. starts → lock check (sync), lock.add (sync) → yield put(loading)
    gen.next();
    // 2. past put(loading) → yield select(wallet)
    gen.next();
    // 3. feed wallet → wallet.isReady() = true → yield call(isNanoContractRegistered)
    gen.next(fixtures.wallet.readyAndMine);
    // 4. feed isRegistered = false → yield put(failure)
    const result = gen.next(false).value;

    expect(result).toStrictEqual(
      put(nanoContractHistoryFailure({ ncId, error: failureMessage.notRegistered }))
    );
  });

  test('fetchHistory error dispatches failure and captures exception', () => {
    const { ncId } = fixtures;

    const gen = requestHistoryNanoContract(nanoContractHistoryRequest({ ncId }));
    // 1. yield put(loading)
    gen.next();
    // 2. yield select(wallet)
    gen.next();
    // 3. feed wallet → yield call(isNanoContractRegistered)
    gen.next(fixtures.wallet.readyAndMine);
    // 4. feed isRegistered=true → yield put(nanoContractHistoryClean) (initial load)
    gen.next(true);
    // 5. past clean → yield select(useWalletService)
    gen.next();
    // 6. feed useWalletService=false → yield call(fetchHistory, req)
    gen.next(false);

    // throw error on fetchHistory call → enters catch block → yield put(failure)
    const failureResult = gen.throw(new Error('network error')).value;
    expect(failureResult).toStrictEqual(
      put(nanoContractHistoryFailure({ ncId, error: failureMessage.nanoContractHistoryFailure }))
    );

    // Next should be onExceptionCaptured
    const exceptionResult = gen.next().value;
    expect(exceptionResult).toStrictEqual(
      put(onExceptionCaptured(new Error('network error'), false))
    );
  });

  test('successful initial history load', () => {
    const { ncId } = fixtures;
    const mockHistory = fixtures.ncSaga.fetchHistory.successResponse.history;

    const gen = requestHistoryNanoContract(nanoContractHistoryRequest({ ncId }));
    // 1. yield put(loading)
    gen.next();
    // 2. yield select(wallet)
    gen.next();
    // 3. feed wallet → yield call(isNanoContractRegistered)
    gen.next(fixtures.wallet.readyAndMine);
    // 4. feed isRegistered=true → yield put(nanoContractHistoryClean)
    gen.next(true);
    // 5. past clean → yield select(useWalletService)
    gen.next();
    // 6. feed useWalletService=false → yield call(fetchHistory, req)
    gen.next(false);
    // 7. feed fetchHistory result → yield put(success)
    const successResult = gen.next({ history: mockHistory }).value;

    expect(successResult).toStrictEqual(
      put(nanoContractHistorySuccess({ ncId, history: mockHistory }))
    );
  });
});
