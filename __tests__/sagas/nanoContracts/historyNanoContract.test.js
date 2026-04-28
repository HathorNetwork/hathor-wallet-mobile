import { put } from 'redux-saga/effects';
import { ncApi } from '@hathor/wallet-lib';
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

describe('sagas/nanoContract/fetchHistory', () => {
  test('success', async () => {
    // arrange ncApi mock
    const mockedNcApi = jest.mocked(ncApi);
    mockedNcApi.getNanoContractHistory
      .mockReturnValue(fixtures.ncApi.getNanoContractHistory.successResponse);

    // arrange wallet mock — production calls wallet.isAddressMine(address)
    // through isAddressMine() helper. Returning true exercises the success path.
    const mockedWallet = {
      isAddressMine: jest.fn().mockResolvedValue(true),
    };

    // call fetchHistory directly with the new request-object signature
    const req = {
      wallet: mockedWallet,
      useWalletService: false,
      ncId: fixtures.ncId,
      count: 1,
      after: null,
    };
    const result = await fetchHistory(req);

    // assert result has history
    expect(result.history).toBeDefined();
    expect(result.history).toHaveLength(1);

    // assert tx-shape transform: snake_case API fields → camelCase NcTxHistory
    const tx = result.history[0];
    const rawTx = fixtures.ncApi.getNanoContractHistory.successResponse.history[0];
    expect(tx.txId).toBe(rawTx.hash);
    expect(tx.ncId).toBe(rawTx.nc_id);
    expect(tx.ncMethod).toBe(rawTx.nc_method);
    expect(tx.caller).toBe(rawTx.nc_address);
    expect(tx.isVoided).toBe(rawTx.is_voided);
    expect(tx.blueprintId).toBe(rawTx.nc_blueprint_id);
    expect(tx.firstBlock).toBe(rawTx.first_block);
    expect(tx.isMine).toBe(true);

    // assert action transform: grant_authority with mint+melt → 'mint, melt'
    expect(tx.actions).toHaveLength(2);
    expect(tx.actions[0]).toEqual({
      type: 'deposit', uid: '00', amount: 100, authority: null,
    });
    expect(tx.actions[1]).toEqual({
      type: 'grant_authority',
      uid: '00000117b0502e9eef9ccbe987af65f153aa899d6eba88d50a6c89e78644713d',
      amount: 0,
      authority: 'mint, melt',
    });

    // assert call count to API — pins one request maps to one API call
    expect(mockedNcApi.getNanoContractHistory).toHaveBeenCalledTimes(1);
  });

  test('failure', async () => {
    // arrange ncApi mock to return success: false
    const mockedNcApi = jest.mocked(ncApi);
    mockedNcApi.getNanoContractHistory
      .mockReturnValue(fixtures.ncApi.getNanoContractHistory.failureResponse);

    // call fetchHistory and assert it throws with the documented message
    const req = {
      wallet: { isAddressMine: jest.fn() },
      useWalletService: false,
      ncId: fixtures.ncId,
      count: 1,
      after: null,
    };
    await expect(fetchHistory(req)).rejects.toThrow('Failed to fetch nano contract history');
  });
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
    const fetchHistoryCall = gen.next(false).value;
    // pin that the saga calls the actual fetchHistory function reference, not
    // any function with a matching shape — protects against accidental rename
    // or replacement during refactors.
    expect(fetchHistoryCall.payload.fn).toBe(fetchHistory);

    // throw error on fetchHistory call → enters catch block → yield put(failure)
    const failureResult = gen.throw(new Error('network error')).value;
    expect(failureResult).toStrictEqual(
      put(nanoContractHistoryFailure({ ncId, error: failureMessage.nanoContractHistoryFailure }))
    );

    // Next should be onExceptionCaptured.
    // Note: toStrictEqual compares Error instances structurally (by name +
    // message) since Jest 24, so two `new Error('network error')` match here
    // — no need to capture and reuse the original Error reference.
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
    const fetchHistoryCall = gen.next(false).value;
    // pin the reference (same rationale as the error test above)
    expect(fetchHistoryCall.payload.fn).toBe(fetchHistory);

    // 7. feed fetchHistory result → yield put(success)
    const successResult = gen.next({ history: mockHistory }).value;

    // shape contract: the put payload exposes ncId and history at the
    // documented locations. toStrictEqual below pins the values; these
    // toHaveProperty checks pin the *paths*, surfacing breakage if a
    // future refactor moves keys (e.g. nesting them under .data).
    expect(successResult.payload).toHaveProperty('action.payload.ncId');
    expect(successResult.payload).toHaveProperty('action.payload.history');
    expect(successResult).toStrictEqual(
      put(nanoContractHistorySuccess({ ncId, history: mockHistory }))
    );

    // saga should terminate after the success put (the finally block
    // releases the lock but yields nothing observable to the caller).
    expect(gen.next().value).toBeUndefined();
  });

  test('duplicate in-flight request is short-circuited by the lock', () => {
    const { ncId } = fixtures;

    // Run the first saga past its synchronous lock acquisition. The lock is
    // taken BEFORE the first yield, so a single .next() leaves the lock held
    // and pauses the generator at `yield put(nanoContractHistoryLoading)`.
    const firstGen = requestHistoryNanoContract(nanoContractHistoryRequest({ ncId }));
    firstGen.next();

    // Start a second saga for the SAME ncId + same (initial) request type.
    // The synchronous lock check at the top of requestHistoryNanoContract
    // must observe the held lock and `return` immediately — no put(loading),
    // no select, no anything observable.
    const secondGen = requestHistoryNanoContract(nanoContractHistoryRequest({ ncId }));
    const firstYield = secondGen.next();

    // `done: true` with `value: undefined` is a generator that returned
    // without yielding. That is exactly what the lock short-circuit does.
    expect(firstYield).toEqual({ value: undefined, done: true });
  });
});
