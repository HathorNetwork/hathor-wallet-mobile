import { put, call } from 'redux-saga/effects';
import { jest, test, expect, beforeEach, describe } from '@jest/globals';
import {
  saveNetworkNanoContracts,
  restoreNetworkNanoContracts,
  updateNetworkNanoContractSnapshot,
} from '../../src/sagas/nanoContract';
import {
  nanoContractsSavedForNetwork,
  nanoContractRegisterSuccess,
} from '../../src/actions';
import { STORE } from '../../src/store';

const GENESIS_HASH = 'abc123def456genesis';

const contract1 = {
  ncId: 'nc1', address: 'addr1', blueprintId: 'bp1', blueprintName: 'Blueprint One',
};
const contract2 = {
  ncId: 'nc2', address: 'addr2', blueprintId: 'bp2', blueprintName: 'Blueprint Two',
};
// Map keyed by ncId, the shape persisted per-network.
const mockContractsMap = { nc1: contract1, nc2: contract2 };
// Array shape returned by getRegisteredNanoContracts(wallet).
const mockContractsArray = [contract1, contract2];

const mockWallet = {
  isReady: () => true,
  storage: {
    isNanoContractRegistered: jest.fn(),
    registerNanoContract: jest.fn(),
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  STORE.clearItems();
});

describe('saveNetworkNanoContracts', () => {
  test('saves registered nano contracts when genesis hash is available', () => {
    const gen = saveNetworkNanoContracts();

    // select serverInfo
    gen.next();
    // feed serverInfo, then select wallet
    gen.next({ genesis_block_hash: GENESIS_HASH });
    // feed wallet, then call getRegisteredNanoContracts
    gen.next(mockWallet);

    // feed registered contracts array, expect call to STORE.saveNanoContractsForNetwork
    // with the array flattened into a map keyed by ncId
    const saveCall = gen.next(mockContractsArray);
    expect(saveCall.value).toStrictEqual(
      call([STORE, STORE.saveNanoContractsForNetwork], GENESIS_HASH, mockContractsMap),
    );

    // advance past save, should dispatch nanoContractsSavedForNetwork
    const result = gen.next();
    expect(result.value).toStrictEqual(put(nanoContractsSavedForNetwork()));

    expect(gen.next().done).toBe(true);
  });

  test('dispatches nanoContractsSavedForNetwork even without genesis hash', () => {
    const gen = saveNetworkNanoContracts();

    // select serverInfo
    gen.next();
    // feed serverInfo with no genesis hash
    const result = gen.next({ genesis_block_hash: null });

    expect(result.value).toStrictEqual(put(nanoContractsSavedForNetwork()));
    expect(gen.next().done).toBe(true);
  });

  test('dispatches nanoContractsSavedForNetwork even without wallet', () => {
    const gen = saveNetworkNanoContracts();

    // select serverInfo
    gen.next();
    // feed serverInfo, then select wallet
    gen.next({ genesis_block_hash: GENESIS_HASH });
    // feed null wallet
    const result = gen.next(null);

    expect(result.value).toStrictEqual(put(nanoContractsSavedForNetwork()));
    expect(gen.next().done).toBe(true);
  });
});

describe('restoreNetworkNanoContracts', () => {
  test('restores nano contracts for current network and updates Redux', () => {
    const gen = restoreNetworkNanoContracts();

    // select isNanoContractsEnabled
    gen.next();
    // feed enabled=true, then select serverInfo
    gen.next(true);
    // feed serverInfo, expect call to STORE.getNanoContractsForNetwork
    const getCall = gen.next({ genesis_block_hash: GENESIS_HASH });
    expect(getCall.value).toStrictEqual(
      call([STORE, STORE.getNanoContractsForNetwork], GENESIS_HASH),
    );

    // feed saved contracts, then select wallet
    gen.next(mockContractsMap);

    // feed wallet, then isNanoContractRegistered for nc1
    const isRegCall1 = gen.next(mockWallet);
    expect(isRegCall1.value).toStrictEqual(
      call([mockWallet.storage, mockWallet.storage.isNanoContractRegistered], 'nc1'),
    );

    // feed isRegistered=false for nc1, expect registerNanoContract call
    const registerCall1 = gen.next(false);
    expect(registerCall1.value).toStrictEqual(
      call([mockWallet.storage, mockWallet.storage.registerNanoContract], 'nc1', contract1),
    );

    // advance past registerNanoContract, expect nanoContractRegisterSuccess dispatch
    const successPut1 = gen.next();
    expect(successPut1.value).toStrictEqual(
      put(nanoContractRegisterSuccess({ entryKey: 'nc1', entryValue: contract1 })),
    );

    // next loop iteration: isNanoContractRegistered for nc2
    const isRegCall2 = gen.next();
    expect(isRegCall2.value).toStrictEqual(
      call([mockWallet.storage, mockWallet.storage.isNanoContractRegistered], 'nc2'),
    );

    // feed isRegistered=false for nc2, expect registerNanoContract call
    const registerCall2 = gen.next(false);
    expect(registerCall2.value).toStrictEqual(
      call([mockWallet.storage, mockWallet.storage.registerNanoContract], 'nc2', contract2),
    );

    const successPut2 = gen.next();
    expect(successPut2.value).toStrictEqual(
      put(nanoContractRegisterSuccess({ entryKey: 'nc2', entryValue: contract2 })),
    );

    expect(gen.next().done).toBe(true);
  });

  test('skips already registered nano contracts', () => {
    const gen = restoreNetworkNanoContracts();

    // select isNanoContractsEnabled
    gen.next();
    // feed enabled, then select serverInfo
    gen.next(true);
    // feed serverInfo, expect STORE.getNanoContractsForNetwork call
    gen.next({ genesis_block_hash: GENESIS_HASH });
    // feed saved contracts with one contract
    gen.next({ nc1: contract1 });
    // feed wallet
    gen.next(mockWallet);

    // feed isNanoContractRegistered=true for nc1, saga should end
    const result = gen.next(true);
    expect(result.done).toBe(true);
  });

  test('does nothing when nano contracts feature is disabled', () => {
    const gen = restoreNetworkNanoContracts();

    // select isNanoContractsEnabled
    gen.next();
    // feed enabled=false, saga should end
    const result = gen.next(false);
    expect(result.done).toBe(true);
  });

  test('does nothing without genesis hash', () => {
    const gen = restoreNetworkNanoContracts();

    // select isNanoContractsEnabled
    gen.next();
    // feed enabled, then select serverInfo
    gen.next(true);
    // feed serverInfo with no genesis hash
    const result = gen.next({ genesis_block_hash: null });
    expect(result.done).toBe(true);
  });

  test('does nothing without saved contracts', () => {
    const gen = restoreNetworkNanoContracts();

    // select isNanoContractsEnabled
    gen.next();
    // feed enabled, then select serverInfo
    gen.next(true);
    // feed serverInfo
    gen.next({ genesis_block_hash: GENESIS_HASH });
    // feed null saved contracts
    const result = gen.next(null);
    expect(result.done).toBe(true);
  });
});

describe('updateNetworkNanoContractSnapshot', () => {
  test('updates snapshot when wallet start state is ready', () => {
    const gen = updateNetworkNanoContractSnapshot();

    // select walletStartState
    gen.next();
    // feed walletStartState='ready', then select wallet (guard)
    gen.next('ready');
    // feed wallet (guard passes), then select serverInfo (from persist)
    gen.next(mockWallet);
    // feed serverInfo, then select wallet (from persist)
    gen.next({ genesis_block_hash: GENESIS_HASH });
    // feed wallet, then call getRegisteredNanoContracts
    gen.next(mockWallet);

    // feed contracts array, expect call to STORE.saveNanoContractsForNetwork
    const saveCall = gen.next(mockContractsArray);
    expect(saveCall.value).toStrictEqual(
      call([STORE, STORE.saveNanoContractsForNetwork], GENESIS_HASH, mockContractsMap),
    );

    expect(gen.next().done).toBe(true);
  });

  test('does nothing when walletStartState is not ready', () => {
    const gen = updateNetworkNanoContractSnapshot();

    // select walletStartState
    gen.next();
    // feed walletStartState='loading' — should exit early
    const result = gen.next('loading');
    expect(result.done).toBe(true);
  });

  test('does nothing without genesis hash', () => {
    const gen = updateNetworkNanoContractSnapshot();

    // select walletStartState
    gen.next();
    // feed walletStartState='ready', then select wallet (guard)
    gen.next('ready');
    // feed wallet (guard passes), then select serverInfo (from persist)
    gen.next(mockWallet);
    // feed serverInfo without genesis hash — should exit early
    const result = gen.next({});
    expect(result.done).toBe(true);
  });

  test('does nothing when wallet is not ready', () => {
    const gen = updateNetworkNanoContractSnapshot();

    // select walletStartState
    gen.next();
    // feed walletStartState='ready', then select wallet (guard)
    gen.next('ready');
    // feed wallet that is not ready — should exit early
    const result = gen.next({ isReady: () => false });
    expect(result.done).toBe(true);
  });
});

describe('STORE network nano contracts persistence', () => {
  test('saveNanoContractsForNetwork and getNanoContractsForNetwork roundtrip', () => {
    expect(STORE.getNanoContractsForNetwork(GENESIS_HASH)).toBeNull();

    STORE.saveNanoContractsForNetwork(GENESIS_HASH, mockContractsMap);
    expect(STORE.getNanoContractsForNetwork(GENESIS_HASH))
      .toStrictEqual(mockContractsMap);
  });

  test('different genesis hashes are independent', () => {
    const otherHash = 'other_genesis_hash';
    STORE.saveNanoContractsForNetwork(GENESIS_HASH, mockContractsMap);
    STORE.saveNanoContractsForNetwork(otherHash, { nc3: { ncId: 'nc3' } });

    expect(STORE.getNanoContractsForNetwork(GENESIS_HASH))
      .toStrictEqual(mockContractsMap);
    expect(STORE.getNanoContractsForNetwork(otherHash))
      .toStrictEqual({ nc3: { ncId: 'nc3' } });
  });

  test('returns null for unknown genesis hash', () => {
    expect(STORE.getNanoContractsForNetwork('unknown')).toBeNull();
  });

  test('returns null for null/undefined genesis hash', () => {
    expect(STORE.getNanoContractsForNetwork(null)).toBeNull();
    expect(STORE.getNanoContractsForNetwork(undefined)).toBeNull();
  });

  test('cleared on wallet reset', async () => {
    STORE.saveNanoContractsForNetwork(GENESIS_HASH, mockContractsMap);
    expect(STORE.getNanoContractsForNetwork(GENESIS_HASH))
      .toStrictEqual(mockContractsMap);

    await STORE.resetWallet();
    expect(STORE.getNanoContractsForNetwork(GENESIS_HASH)).toBeNull();
  });
});
