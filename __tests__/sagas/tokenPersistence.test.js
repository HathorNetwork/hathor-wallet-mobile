import { put, call } from 'redux-saga/effects';
import { jest, test, expect, beforeEach, describe } from '@jest/globals';
import {
  saveNetworkTokens,
  restoreNetworkTokens,
  updateNetworkTokenSnapshot,
} from '../../src/sagas/tokens';
import {
  tokensSavedForNetwork,
  setTokens,
  tokenFetchBalanceRequested,
} from '../../src/actions';
import { STORE } from '../../src/store';

const GENESIS_HASH = 'abc123def456genesis';

const mockTokens = {
  token1: { uid: 'token1', name: 'Token One', symbol: 'TK1' },
  token2: { uid: 'token2', name: 'Token Two', symbol: 'TK2' },
};

const mockWallet = {
  isReady: () => true,
  storage: {
    isTokenRegistered: jest.fn(),
    registerToken: jest.fn(),
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  STORE.clearItems();
});

describe('saveNetworkTokens', () => {
  test('saves tokens when genesis hash is available', () => {
    const gen = saveNetworkTokens();

    // select serverInfo
    gen.next();
    // feed serverInfo, then select wallet
    gen.next({ genesis_block_hash: GENESIS_HASH });
    // feed wallet, then call getRegisteredTokens
    gen.next(mockWallet);

    // feed registered tokens, expect call to STORE.saveTokensForNetwork
    const saveCall = gen.next(mockTokens);
    expect(saveCall.value).toStrictEqual(
      call([STORE, STORE.saveTokensForNetwork], GENESIS_HASH, mockTokens),
    );

    // advance past save, should dispatch tokensSavedForNetwork
    const result = gen.next();
    expect(result.value).toStrictEqual(put(tokensSavedForNetwork()));

    expect(gen.next().done).toBe(true);
  });

  test('dispatches tokensSavedForNetwork even without genesis hash', () => {
    const gen = saveNetworkTokens();

    // select serverInfo
    gen.next();
    // feed serverInfo with no genesis hash
    const result = gen.next({ genesis_block_hash: null });

    expect(result.value).toStrictEqual(put(tokensSavedForNetwork()));
    expect(gen.next().done).toBe(true);
  });

  test('dispatches tokensSavedForNetwork even without wallet', () => {
    const gen = saveNetworkTokens();

    // select serverInfo
    gen.next();
    // feed serverInfo, then select wallet
    gen.next({ genesis_block_hash: GENESIS_HASH });
    // feed null wallet
    const result = gen.next(null);

    expect(result.value).toStrictEqual(put(tokensSavedForNetwork()));
    expect(gen.next().done).toBe(true);
  });
});

describe('restoreNetworkTokens', () => {
  test('restores tokens for current network and updates Redux', () => {
    const gen = restoreNetworkTokens();

    // select serverInfo
    gen.next();
    // feed serverInfo, expect call to STORE.getTokensForNetwork
    const getCall = gen.next({ genesis_block_hash: GENESIS_HASH });
    expect(getCall.value).toStrictEqual(
      call([STORE, STORE.getTokensForNetwork], GENESIS_HASH),
    );

    // feed saved tokens, then select wallet
    gen.next(mockTokens);

    // feed wallet, then isTokenRegistered for token1
    gen.next(mockWallet);

    // feed isTokenRegistered=false for token1, expect registerToken call
    const registerCall = gen.next(false);
    expect(registerCall.value).toStrictEqual(
      call(
        [mockWallet.storage, mockWallet.storage.registerToken],
        mockTokens.token1,
      ),
    );

    // advance past registerToken, then isTokenRegistered for token2
    gen.next();

    // feed isTokenRegistered=false for token2, expect registerToken call
    const registerCall2 = gen.next(false);
    expect(registerCall2.value).toStrictEqual(
      call(
        [mockWallet.storage, mockWallet.storage.registerToken],
        mockTokens.token2,
      ),
    );

    // advance past registerToken, expect getRegisteredTokens call
    gen.next();

    // feed all registered tokens, expect setTokens dispatch
    const allTokens = { ...mockTokens, htr: { uid: '00', name: 'HTR', symbol: 'HTR' } };
    const setTokensEffect = gen.next(allTokens);
    expect(setTokensEffect.value).toStrictEqual(put(setTokens(allTokens)));

    // expect tokenFetchBalanceRequested for each saved token
    const fetchBalance1 = gen.next();
    expect(fetchBalance1.value).toStrictEqual(put(tokenFetchBalanceRequested('token1')));

    const fetchBalance2 = gen.next();
    expect(fetchBalance2.value).toStrictEqual(put(tokenFetchBalanceRequested('token2')));

    expect(gen.next().done).toBe(true);
  });

  test('skips already registered tokens', () => {
    const gen = restoreNetworkTokens();

    // select serverInfo
    gen.next();
    // feed serverInfo, expect STORE.getTokensForNetwork call
    gen.next({ genesis_block_hash: GENESIS_HASH });
    // feed saved tokens with one token
    gen.next({ token1: mockTokens.token1 });
    // feed wallet
    gen.next(mockWallet);

    // feed isTokenRegistered=true for token1, saga should end
    const result = gen.next(true);
    expect(result.done).toBe(true);
  });

  test('does nothing without genesis hash', () => {
    const gen = restoreNetworkTokens();

    // select serverInfo
    gen.next();
    // feed serverInfo with no genesis hash
    const result = gen.next({ genesis_block_hash: null });

    expect(result.done).toBe(true);
  });

  test('does nothing without saved tokens', () => {
    const gen = restoreNetworkTokens();

    // select serverInfo
    gen.next();
    // feed serverInfo
    gen.next({ genesis_block_hash: GENESIS_HASH });
    // feed null saved tokens
    const result = gen.next(null);

    expect(result.done).toBe(true);
  });
});

describe('updateNetworkTokenSnapshot', () => {
  test('updates snapshot when wallet start state is ready', () => {
    const gen = updateNetworkTokenSnapshot();

    // select walletStartState
    gen.next();
    // feed walletStartState='ready', then select wallet (guard)
    gen.next('ready');
    // feed wallet (guard passes), then select serverInfo (from persistTokensForCurrentNetwork)
    gen.next(mockWallet);
    // feed serverInfo, then select wallet (from persistTokensForCurrentNetwork)
    gen.next({ genesis_block_hash: GENESIS_HASH });
    // feed wallet, then call getRegisteredTokens
    gen.next(mockWallet);

    // feed tokens, expect call to STORE.saveTokensForNetwork
    const saveCall = gen.next(mockTokens);
    expect(saveCall.value).toStrictEqual(
      call([STORE, STORE.saveTokensForNetwork], GENESIS_HASH, mockTokens),
    );

    expect(gen.next().done).toBe(true);
  });

  test('does nothing when walletStartState is not ready', () => {
    const gen = updateNetworkTokenSnapshot();

    // select walletStartState
    gen.next();
    // feed walletStartState='loading' — should exit early
    const result = gen.next('loading');

    expect(result.done).toBe(true);
  });

  test('does nothing without genesis hash', () => {
    const gen = updateNetworkTokenSnapshot();

    // select walletStartState
    gen.next();
    // feed walletStartState='ready', then select wallet (guard)
    gen.next('ready');
    // feed wallet (guard passes), then select serverInfo (from persistTokensForCurrentNetwork)
    gen.next(mockWallet);
    // feed serverInfo without genesis hash — should exit early
    const result = gen.next({});

    expect(result.done).toBe(true);
  });

  test('does nothing when wallet is not ready', () => {
    const gen = updateNetworkTokenSnapshot();

    // select walletStartState
    gen.next();
    // feed walletStartState='ready', then select wallet (guard)
    gen.next('ready');
    // feed wallet that is not ready — should exit early
    const result = gen.next({ isReady: () => false });

    expect(result.done).toBe(true);
  });
});

describe('STORE network tokens persistence', () => {
  test('saveTokensForNetwork and getTokensForNetwork roundtrip', () => {
    expect(STORE.getTokensForNetwork(GENESIS_HASH)).toBeNull();

    STORE.saveTokensForNetwork(GENESIS_HASH, mockTokens);
    expect(STORE.getTokensForNetwork(GENESIS_HASH))
      .toStrictEqual(mockTokens);
  });

  test('different genesis hashes are independent', () => {
    const otherHash = 'other_genesis_hash';
    STORE.saveTokensForNetwork(GENESIS_HASH, mockTokens);
    STORE.saveTokensForNetwork(otherHash, {
      token3: { uid: 'token3', name: 'Three', symbol: 'TK3' },
    });

    expect(STORE.getTokensForNetwork(GENESIS_HASH))
      .toStrictEqual(mockTokens);
    expect(STORE.getTokensForNetwork(otherHash))
      .toStrictEqual({
        token3: { uid: 'token3', name: 'Three', symbol: 'TK3' },
      });
  });

  test('returns null for unknown genesis hash', () => {
    expect(STORE.getTokensForNetwork('unknown')).toBeNull();
  });

  test('returns null for null/undefined genesis hash', () => {
    expect(STORE.getTokensForNetwork(null)).toBeNull();
    expect(STORE.getTokensForNetwork(undefined)).toBeNull();
  });

  test('cleared on wallet reset', async () => {
    STORE.saveTokensForNetwork(GENESIS_HASH, mockTokens);
    expect(STORE.getTokensForNetwork(GENESIS_HASH))
      .toStrictEqual(mockTokens);

    await STORE.resetWallet();
    expect(STORE.getTokensForNetwork(GENESIS_HASH)).toBeNull();
  });
});
