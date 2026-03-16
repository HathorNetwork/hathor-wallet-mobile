import { put, call } from 'redux-saga/effects';
import { jest, test, expect, beforeEach, describe } from '@jest/globals';
import {
  saveNetworkTokens,
  restoreNetworkTokens,
  updateNetworkTokenSnapshot,
} from '../../src/sagas/tokens';
import { tokensSavedForNetwork } from '../../src/actions';
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

    // feed registered tokens, should call STORE.saveTokensForNetwork
    const result = gen.next(mockTokens);

    // should dispatch tokensSavedForNetwork
    expect(result.value).toStrictEqual(put(tokensSavedForNetwork()));

    // should have saved to store
    const saved = STORE.getTokensForNetwork(GENESIS_HASH);
    expect(saved).toStrictEqual(mockTokens);

    // saga should end
    expect(gen.next().done).toBe(true);
  });

  test('dispatches tokensSavedForNetwork even without genesis hash', () => {
    const gen = saveNetworkTokens();

    // select serverInfo
    gen.next();
    // feed serverInfo with no genesis hash
    const result = gen.next({ genesis_block_hash: null });

    // should still dispatch tokensSavedForNetwork
    expect(result.value).toStrictEqual(put(tokensSavedForNetwork()));

    // nothing saved
    expect(STORE.getTokensForNetwork(GENESIS_HASH)).toBeNull();

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
  test('restores tokens for current network', () => {
    // Pre-save tokens for this genesis hash
    STORE.saveTokensForNetwork(GENESIS_HASH, mockTokens);

    const gen = restoreNetworkTokens();

    // select serverInfo
    gen.next();
    // feed serverInfo, then select wallet (after storeGenesisHash)
    gen.next({ genesis_block_hash: GENESIS_HASH });

    // feed wallet, then call isTokenRegistered for token1
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

    // advance, saga should end
    expect(gen.next().done).toBe(true);
  });

  test('skips already registered tokens', () => {
    STORE.saveTokensForNetwork(GENESIS_HASH, {
      token1: mockTokens.token1,
    });

    const gen = restoreNetworkTokens();

    // select serverInfo
    gen.next();
    // feed serverInfo
    gen.next({ genesis_block_hash: GENESIS_HASH });
    // feed wallet
    gen.next(mockWallet);

    // feed isTokenRegistered=true for token1
    const result = gen.next(true);

    // should NOT call registerToken, saga ends
    expect(result.done).toBe(true);
  });

  test('does nothing without genesis hash', () => {
    const gen = restoreNetworkTokens();

    // select serverInfo
    gen.next();
    // feed serverInfo with no genesis hash — saga should return
    const result = gen.next({ genesis_block_hash: null });

    expect(result.done).toBe(true);
  });

  test('does nothing without saved tokens', () => {
    const gen = restoreNetworkTokens();

    // select serverInfo
    gen.next();
    // feed serverInfo
    gen.next({ genesis_block_hash: GENESIS_HASH });
    // no saved tokens — saga should return after selecting wallet
    const result = gen.next(mockWallet);

    expect(result.done).toBe(true);
  });
});

describe('updateNetworkTokenSnapshot', () => {
  test('updates snapshot when genesis hash and wallet available', () => {
    const gen = updateNetworkTokenSnapshot();

    // select serverInfo
    gen.next();
    // feed serverInfo, then select wallet
    gen.next({ genesis_block_hash: GENESIS_HASH });
    // feed wallet, then call getRegisteredTokens
    gen.next(mockWallet);

    // feed tokens — should save to store
    gen.next(mockTokens);

    const saved = STORE.getTokensForNetwork(GENESIS_HASH);
    expect(saved).toStrictEqual(mockTokens);

    expect(gen.next().done).toBe(true);
  });

  test('does nothing without genesis hash', () => {
    const gen = updateNetworkTokenSnapshot();

    // select serverInfo
    gen.next();
    // feed serverInfo without genesis hash
    const result = gen.next({});

    expect(result.done).toBe(true);
  });

  test('does nothing when wallet is not ready', () => {
    const gen = updateNetworkTokenSnapshot();

    // select serverInfo
    gen.next();
    // feed serverInfo
    gen.next({ genesis_block_hash: GENESIS_HASH });
    // feed wallet that is not ready
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
