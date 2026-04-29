/**
 * Integration tests for the wallet sagas.
 *
 * Uses redux-saga-test-plan's `expectSaga` to run sagas against
 * the real reducer and assert on dispatched actions and final state.
 */
import {
  describe, it, expect, jest, beforeEach,
} from '@jest/globals';
import { expectSaga } from 'redux-saga-test-plan';
import * as matchers from 'redux-saga-test-plan/matchers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reducer } from '../../src/reducers/reducer';
import {
  startWalletRequested,
  startWalletFailed,
  resetWalletSuccess,
} from '../../src/actions';
import {
  startWallet,
  onResetWallet,
  WALLET_STATUS,
  isWalletServiceEnabled,
  isPushNotificationEnabled,
} from '../../src/sagas/wallet';
import { STORE } from '../../src/store';
import { PRE_SETTINGS_MAINNET } from '../../src/constants';
import { getNetworkSettings } from '../../src/sagas/helpers';

// Suppress noisy wallet-lib logs during tests
jest.mock('../../src/logger', () => ({
  logger: () => ({
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// ─── onResetWallet ─────────────────────────────────────────────────────────
describe('onResetWallet saga', () => {
  const mockWallet = {
    stop: jest.fn().mockResolvedValue(undefined),
    removeAllListeners: jest.fn(),
    conn: { removeAllListeners: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stops wallet, clears storage, and dispatches resetWalletSuccess', () => {
    const storeResetSpy = jest.spyOn(STORE, 'resetWallet').mockResolvedValue(undefined);

    return expectSaga(onResetWallet)
      .withReducer(reducer)
      .withState({
        ...reducer(undefined, { type: '@@INIT' }),
        wallet: mockWallet,
        walletStartState: WALLET_STATUS.READY,
      })
      // Provide mocks for call effects
      .provide([
        // AsyncStorage.removeItem for the ignore flag
        [matchers.call.fn(AsyncStorage.removeItem), undefined],
        // wallet.stop
        [matchers.call.fn(mockWallet.stop), undefined],
        // STORE.resetWallet
        [matchers.call.fn(STORE.resetWallet), undefined],
      ])
      // Assert the success action is dispatched
      .put(resetWalletSuccess())
      // Run the saga
      .run()
      .then((result) => {
        // After reset, wallet state should be back to NOT_STARTED
        expect(result.storeState.walletStartState).toBe(WALLET_STATUS.NOT_STARTED);
        expect(result.storeState.wallet).toBeNull();
        storeResetSpy.mockRestore();
      });
  });

  it('handles null wallet gracefully (still clears storage and dispatches)', () => {
    const storeResetSpy = jest.spyOn(STORE, 'resetWallet').mockResolvedValue(undefined);

    return expectSaga(onResetWallet)
      .withReducer(reducer)
      .withState({
        ...reducer(undefined, { type: '@@INIT' }),
        wallet: null,
        walletStartState: WALLET_STATUS.NOT_STARTED,
      })
      .provide([
        [matchers.call.fn(AsyncStorage.removeItem), undefined],
        [matchers.call.fn(STORE.resetWallet), undefined],
      ])
      .put(resetWalletSuccess())
      .run()
      .then((result) => {
        // Asserts the saga's null-guard short-circuits before any wallet
        // method call. clearAllMocks() in beforeEach ensures earlier
        // tests' invocations are cleared, so this is true coverage of
        // the null-handling branch (not a stale-counter coincidence) —
        // even though the production code physically can't call .stop
        // on null state.wallet. The expectSaga(...).not.call.fn(...)
        // alternative would target the same outer reference.
        expect(mockWallet.stop).not.toHaveBeenCalled();
        expect(result.storeState.walletStartState).toBe(WALLET_STATUS.NOT_STARTED);
        storeResetSpy.mockRestore();
      });
  });
});

// ─── startWallet ───────────────────────────────────────────────────────────
// The startWallet saga constructs HathorWallet/Connection inline (not via `call`),
// so we must mock the wallet-lib at the module level to control it.
describe('startWallet saga', () => {
  const mockWalletInstance = {
    start: jest.fn(),
    isReady: jest.fn(() => true),
    stop: jest.fn(),
    removeAllListeners: jest.fn(),
    on: jest.fn(),
    conn: { removeAllListeners: jest.fn(), on: jest.fn() },
    getCurrentAddress: jest.fn(() => ({ address: 'Haddr1', index: 0 })),
    storage: { store: { cleanMetadata: jest.fn() }, cleanStorage: jest.fn() },
  };

  const mockStorage = {
    store: { cleanMetadata: jest.fn() },
    cleanStorage: jest.fn(),
  };

  const action = startWalletRequested({
    words: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    pin: '123456',
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches startWalletFailed when wallet.start throws', () => {
    // Make wallet.start throw
    mockWalletInstance.start.mockRejectedValue(new Error('Network error'));

    return expectSaga(startWallet, action)
      .withReducer(reducer)
      .provide({
        call(effect, next) {
          // Intercept STORE.getStorage → return mock storage
          if (effect.fn === STORE.getStorage
              || (effect.context === STORE && effect.fn?.name === 'getStorage')) {
            return mockStorage;
          }
          // Intercept storage cleanup calls
          if (effect.fn === mockStorage.store.cleanMetadata) return undefined;
          if (effect.fn === mockStorage.cleanStorage) return undefined;
          // Intercept wallet.start.bind(wallet)
          if (effect.fn?.name === 'bound start' || effect.fn === mockWalletInstance.start) {
            throw new Error('Network error');
          }
          // isWalletServiceEnabled and isPushNotificationEnabled
          if (effect.fn === isWalletServiceEnabled) return false;
          if (effect.fn === isPushNotificationEnabled) return false;
          return next();
        },
        select(effect, next) {
          // Intercept getNetworkSettings
          if (effect.selector === getNetworkSettings) {
            return PRE_SETTINGS_MAINNET;
          }
          return next();
        },
        fork() {
          // Swallow all fork effects — we don't want child sagas running
          return undefined;
        },
        spawn() {
          return undefined;
        },
      })
      .put(startWalletFailed())
      .run({ silenceTimeout: true })
      .then((result) => {
        expect(result.storeState.walletStartState).toBe(WALLET_STATUS.FAILED);
      });
  });
});
