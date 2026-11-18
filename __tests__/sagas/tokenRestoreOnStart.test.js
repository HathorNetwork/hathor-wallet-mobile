/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// fetchTokenData waits for the balance and history sagas, which these tests don't run.
jest.mock('../../src/sagas/tokens', () => ({
  ...jest.requireActual('../../src/sagas/tokens'),
  fetchTokenData: jest.fn(),
}));

/* eslint-disable import/first */
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { constants as hathorLibConstants } from '@hathor/wallet-lib';
import { reducer } from '../../src/reducers/reducer';
import {
  setServerInfo,
  setWallet,
  tokenImportFetchRequested,
  tokenImportNewTxTokens,
  types,
} from '../../src/actions';
import { loadTokens } from '../../src/sagas/wallet';
import { saga as tokenImportSaga } from '../../src/sagas/tokenImport';
import { STORE } from '../../src/store';
/* eslint-enable import/first */

const HTR = hathorLibConstants.NATIVE_TOKEN_UID;
const GENESIS_HASH = '000001b7d5abc44d3828529654e8d830eeca1cd0e313032be1b8e9dfe31052ee';
const tokenOf = (n) => ({
  uid: `${String(n).padStart(4, '0')}${'ab'.repeat(30)}`,
  name: `Token ${n}`,
  symbol: `TK${n}`,
});
// The tokens the user registered on the network, saved before a network change wiped them.
const SAVED = [1, 2, 3, 4, 5, 6].map(tokenOf);

/**
 * A running wallet that holds HTR and the saved tokens, with none registered: its storage was
 * wiped by the network change. Storage calls resolve on a later tick, as wallet-lib's do.
 */
function wipedWallet() {
  const registered = new Map([[HTR, { uid: HTR, name: 'Hathor', symbol: 'HTR' }]]);
  const tick = () => new Promise((resolve) => { setTimeout(resolve, 0); });
  return {
    registered,
    isReady: () => true,
    getTokens: jest.fn(async () => {
      await tick();
      return [HTR, ...SAVED.map((token) => token.uid)];
    }),
    storage: {
      isTokenRegistered: jest.fn(async (uid) => { await tick(); return registered.has(uid); }),
      registerToken: jest.fn(async (token) => { await tick(); registered.set(token.uid, token); }),
      async* getRegisteredTokens() {
        for (const token of [...registered.values()]) {
          // eslint-disable-next-line no-await-in-loop
          await tick();
          yield token;
        }
      },
      getToken: jest.fn(async (uid) => SAVED.find((token) => token.uid === uid) ?? null),
    },
  };
}

/**
 * Runs the wallet start's token steps: loadTokens, then the scan for unregistered tokens the
 * start requests once it ends.
 */
async function startWith(wallet, { listed = {} } = {}) {
  const sagaMiddleware = createSagaMiddleware();
  const store = createStore(reducer, applyMiddleware(sagaMiddleware));
  store.dispatch(setServerInfo({ genesis_block_hash: GENESIS_HASH }));
  store.dispatch(setWallet(wallet));
  if (Object.keys(listed).length > 0) {
    store.dispatch({ type: types.TOKEN_IMPORT_NEW_DETECTED, payload: listed });
  }
  sagaMiddleware.run(tokenImportSaga);

  await sagaMiddleware.run(loadTokens).toPromise();
  store.dispatch(tokenImportFetchRequested());
  await new Promise((resolve) => { setTimeout(resolve, 50); });
  return store.getState();
}

beforeEach(() => {
  STORE.saveTokensForNetwork(
    GENESIS_HASH,
    Object.fromEntries(SAVED.map((token) => [token.uid, token])),
  );
});

describe('the start after a network change', () => {
  test('registers the saved tokens before it lists the unregistered ones', async () => {
    const wallet = wipedWallet();

    const state = await startWith(wallet);

    expect([...wallet.registered.keys()]).toEqual([HTR, ...SAVED.map((token) => token.uid)]);
    expect(Object.keys(state.tokens))
      .toEqual(expect.arrayContaining(SAVED.map((token) => token.uid)));
    expect(state.tokenImport.unregisteredTokens).toEqual({});
  });

  test('takes a restored token off the import list', async () => {
    const wallet = wipedWallet();
    const [first] = SAVED;

    const state = await startWith(wallet, { listed: { [first.uid]: first } });

    expect(state.tokenImport.unregisteredTokens).toEqual({});
  });
});

describe('a token detected in a tx', () => {
  test('is not listed when it is registered while its details load', async () => {
    const wallet = wipedWallet();
    const [token] = SAVED;
    let detailsAsked;
    const askedForDetails = new Promise((resolve) => { detailsAsked = resolve; });
    let giveDetails;
    wallet.storage.getToken.mockImplementation(() => {
      detailsAsked();
      return new Promise((resolve) => { giveDetails = () => resolve(token); });
    });
    const sagaMiddleware = createSagaMiddleware();
    const store = createStore(reducer, applyMiddleware(sagaMiddleware));
    store.dispatch(setWallet(wallet));
    sagaMiddleware.run(tokenImportSaga);

    store.dispatch(tokenImportNewTxTokens([token.uid]));
    await askedForDetails;
    // The user registers it meanwhile.
    wallet.registered.set(token.uid, token);
    giveDetails();
    await new Promise((resolve) => { setTimeout(resolve, 20); });

    expect(store.getState().tokenImport.unregisteredTokens).toEqual({});
  });

  test('is listed when it stays unregistered', async () => {
    const wallet = wipedWallet();
    const [token] = SAVED;
    const sagaMiddleware = createSagaMiddleware();
    const store = createStore(reducer, applyMiddleware(sagaMiddleware));
    store.dispatch(setWallet(wallet));
    sagaMiddleware.run(tokenImportSaga);

    store.dispatch(tokenImportNewTxTokens([token.uid]));
    await new Promise((resolve) => { setTimeout(resolve, 20); });

    expect(Object.keys(store.getState().tokenImport.unregisteredTokens)).toEqual([token.uid]);
  });
});
