/**
 * Unit tests for the wallet lifecycle reducer actions.
 *
 * Tests the full start → ready/failed cycle and the reset cycle,
 * verifying that Redux state transitions match expectations.
 */
import { reducer } from '../../src/reducers/reducer';
import {
  startWalletRequested,
  startWalletSuccess,
  startWalletFailed,
  setWallet,
  resetData,
  resetWalletSuccess,
  newToken,
  setTokens,
  updateSelectedToken,
  types,
} from '../../src/actions';
import { WALLET_STATUS } from '../../src/sagas/wallet';
import { DEFAULT_TOKEN, INITIAL_TOKENS } from '../../src/constants';

// Helper: get initial state from the reducer
const getInitialState = () => reducer(undefined, { type: '@@INIT' });

// ─── Wallet Start Lifecycle ────────────────────────────────────────────────
describe('wallet start lifecycle', () => {
  it('starts in NOT_STARTED state', () => {
    const state = getInitialState();
    expect(state.walletStartState).toBe(WALLET_STATUS.NOT_STARTED);
  });

  it('transitions to LOADING on START_WALLET_REQUESTED', () => {
    const state = getInitialState();
    const next = reducer(state, startWalletRequested({ words: 'test', pin: '123456' }));
    expect(next.walletStartState).toBe(WALLET_STATUS.LOADING);
  });

  it('transitions to READY on START_WALLET_SUCCESS', () => {
    // Start from LOADING state
    let state = reducer(getInitialState(), startWalletRequested({ words: 'test', pin: '123456' }));
    state = reducer(state, startWalletSuccess());
    expect(state.walletStartState).toBe(WALLET_STATUS.READY);
  });

  it('transitions to FAILED on START_WALLET_FAILED', () => {
    let state = reducer(getInitialState(), startWalletRequested({ words: 'test', pin: '123456' }));
    state = reducer(state, startWalletFailed());
    expect(state.walletStartState).toBe(WALLET_STATUS.FAILED);
  });

  it('full lifecycle: NOT_STARTED → LOADING → READY', () => {
    let state = getInitialState();
    expect(state.walletStartState).toBe(WALLET_STATUS.NOT_STARTED);

    state = reducer(state, startWalletRequested({ words: 'test', pin: '123456' }));
    expect(state.walletStartState).toBe(WALLET_STATUS.LOADING);

    state = reducer(state, startWalletSuccess());
    expect(state.walletStartState).toBe(WALLET_STATUS.READY);
  });
});

// ─── SET_WALLET ────────────────────────────────────────────────────────────
describe('SET_WALLET', () => {
  it('sets wallet instance in state', () => {
    const mockWallet = { id: 'test-wallet' };
    const state = reducer(getInitialState(), setWallet(mockWallet));
    expect(state.wallet).toBe(mockWallet);
  });

  it('can set wallet to null', () => {
    const state = reducer(
      { ...getInitialState(), wallet: { id: 'existing' } },
      setWallet(null),
    );
    expect(state.wallet).toBeNull();
  });
});

// ─── Token Operations (populated during wallet start) ──────────────────────
describe('token operations', () => {
  it('adds a new token via NEW_TOKEN', () => {
    const token = { uid: 'token123', name: 'TestCoin', symbol: 'TST' };
    const state = reducer(getInitialState(), newToken(token));
    expect(state.tokens['token123']).toEqual(token);
    // Initial default token should still be present
    expect(state.tokens[DEFAULT_TOKEN.uid]).toBeDefined();
  });

  it('sets full token map via SET_TOKENS', () => {
    const tokens = {
      [DEFAULT_TOKEN.uid]: DEFAULT_TOKEN,
      token123: { uid: 'token123', name: 'TestCoin', symbol: 'TST' },
    };
    const state = reducer(getInitialState(), setTokens(tokens));
    expect(Object.keys(state.tokens)).toHaveLength(2);
    expect(state.tokens['token123'].name).toBe('TestCoin');
  });

  it('resets selectedToken to DEFAULT_TOKEN if unregistered via SET_TOKENS', () => {
    // Select a non-default token first
    const customToken = { uid: 'custom', name: 'Custom', symbol: 'CUS' };
    let state = reducer(getInitialState(), updateSelectedToken(customToken));
    expect(state.selectedToken.uid).toBe('custom');

    // Now set tokens without the custom one → should reset to default
    state = reducer(state, setTokens({ [DEFAULT_TOKEN.uid]: DEFAULT_TOKEN }));
    expect(state.selectedToken.uid).toBe(DEFAULT_TOKEN.uid);
  });

  it('keeps selectedToken if still present in SET_TOKENS', () => {
    const customToken = { uid: 'custom', name: 'Custom', symbol: 'CUS' };
    let state = reducer(getInitialState(), updateSelectedToken(customToken));
    state = reducer(state, setTokens({
      [DEFAULT_TOKEN.uid]: DEFAULT_TOKEN,
      custom: customToken,
    }));
    expect(state.selectedToken.uid).toBe('custom');
  });
});

// ─── Reset Cycle ───────────────────────────────────────────────────────────
describe('wallet reset', () => {
  it('RESET_DATA returns full initial state', () => {
    // Build up a modified state
    let state = reducer(getInitialState(), startWalletRequested({ words: 'test', pin: '123456' }));
    state = reducer(state, startWalletSuccess());
    state = reducer(state, setWallet({ id: 'wallet' }));
    state = reducer(state, newToken({ uid: 'token123', name: 'Test', symbol: 'TST' }));
    expect(state.walletStartState).toBe(WALLET_STATUS.READY);

    // Nuclear reset
    const resetState = reducer(state, resetData());
    expect(resetState.walletStartState).toBe(WALLET_STATUS.NOT_STARTED);
    expect(resetState.wallet).toBeNull();
    expect(resetState.tokens).toEqual(INITIAL_TOKENS);
    expect(resetState.selectedToken).toEqual(DEFAULT_TOKEN);
    expect(resetState.isOnline).toBe(false);
  });

  it('RESET_WALLET_SUCCESS resets state but preserves feature toggles', () => {
    // Build up state with feature toggles set
    let state = getInitialState();
    // Simulate feature toggles being initialized
    state = {
      ...state,
      unleashClient: { mock: true },
      featureTogglesInitialized: true,
      featureToggles: { someFlag: true },
      wallet: { id: 'wallet' },
      walletStartState: WALLET_STATUS.READY,
    };

    const resetState = reducer(state, resetWalletSuccess());

    // Wallet state should be reset
    expect(resetState.walletStartState).toBe(WALLET_STATUS.NOT_STARTED);
    expect(resetState.wallet).toBeNull();
    expect(resetState.tokens).toEqual(INITIAL_TOKENS);

    // Feature toggles should be preserved
    expect(resetState.unleashClient).toEqual({ mock: true });
    expect(resetState.featureTogglesInitialized).toBe(true);
    expect(resetState.featureToggles).toEqual({ someFlag: true });
  });

  it('RESET_WALLET_SUCCESS clears tokens and balances', () => {
    let state = getInitialState();
    state = reducer(state, newToken({ uid: 'tok1', name: 'A', symbol: 'A' }));
    state = { ...state, tokensBalance: { tok1: { data: { available: 100n } } } };

    const resetState = reducer(state, resetWalletSuccess());
    expect(resetState.tokens).toEqual(INITIAL_TOKENS);
    expect(resetState.tokensBalance).toEqual({});
  });
});

// ─── START_WALLET_NOT_STARTED ──────────────────────────────────────────────
// No exported action creator; dispatched as a raw action by the wallet saga.
describe('START_WALLET_NOT_STARTED', () => {
  it('resets walletStartState to NOT_STARTED from READY', () => {
    let state = reducer(getInitialState(), startWalletRequested({ words: 't', pin: '123456' }));
    state = reducer(state, startWalletSuccess());
    expect(state.walletStartState).toBe(WALLET_STATUS.READY);

    state = reducer(state, { type: types.START_WALLET_NOT_STARTED });
    expect(state.walletStartState).toBe(WALLET_STATUS.NOT_STARTED);
  });
});

// ─── Initial-State Shape Contract ──────────────────────────────────────────
// Pins the SHAPE (top-level keys) of the in-scope sub-trees. A future
// RTK-slices refactor must preserve this shape OR consciously update this
// snapshot. Catches accidental shape drift that behavior tests would miss.
describe('initial state shape contract (in-scope sub-trees)', () => {
  it('exposes each in-scope top-level key', () => {
    const state = getInitialState();
    ['reown', 'selectedToken', 'tokens', 'wallet', 'walletStartState'].forEach((key) => {
      expect(state).toHaveProperty(key);
    });
  });

  it('walletStartState starts at NOT_STARTED', () => {
    expect(getInitialState().walletStartState).toBe(WALLET_STATUS.NOT_STARTED);
  });

  it('wallet starts as null', () => {
    expect(getInitialState().wallet).toBeNull();
  });

  it('tokens starts equal to INITIAL_TOKENS', () => {
    expect(getInitialState().tokens).toEqual(INITIAL_TOKENS);
  });

  it('selectedToken starts equal to DEFAULT_TOKEN', () => {
    expect(getInitialState().selectedToken).toEqual(DEFAULT_TOKEN);
  });
});

// ─── Action-Type Contract ──────────────────────────────────────────────────
// Pins the literal `.type` of every in-scope action creator. Catches RTK's
// default `slice/action` auto-renaming, which would silently break saga
// listeners keyed off the current strings.
describe('action-type contract (in-scope action creators)', () => {
  it('startWalletRequested.type', () => {
    expect(startWalletRequested({ words: '', pin: '' }).type).toBe('START_WALLET_REQUESTED');
  });
  it('startWalletSuccess.type', () => {
    expect(startWalletSuccess().type).toBe('START_WALLET_SUCCESS');
  });
  it('startWalletFailed.type', () => {
    expect(startWalletFailed().type).toBe('START_WALLET_FAILED');
  });
  it('setWallet.type', () => {
    expect(setWallet(null).type).toBe('SET_WALLET');
  });
  it('resetData.type', () => {
    expect(resetData().type).toBe('RESET_DATA');
  });
  it('resetWalletSuccess.type', () => {
    expect(resetWalletSuccess().type).toBe('RESET_WALLET_SUCCESS');
  });
  it('newToken.type', () => {
    expect(newToken({ uid: 'a', name: 'A', symbol: 'A' }).type).toBe('NEW_TOKEN');
  });
  it('setTokens.type', () => {
    expect(setTokens({}).type).toBe('SET_TOKENS');
  });
  it('updateSelectedToken.type', () => {
    expect(updateSelectedToken(DEFAULT_TOKEN).type).toBe('UPDATE_SELECTED_TOKEN');
  });
  it('START_WALLET_NOT_STARTED type constant (no creator exported)', () => {
    expect(types.START_WALLET_NOT_STARTED).toBe('START_WALLET_NOT_STARTED');
  });
});
