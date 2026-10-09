/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';
import React from 'react';
import { TouchableWithoutFeedback } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { constants as hathorLibConstants } from '@hathor/wallet-lib';
import { reducer } from '../../src/reducers/reducer';
import { saga as tokensSaga } from '../../src/sagas/tokens';
import {
  onWalletReload,
  setFeatureToggles,
  setFullNodeNetworkName,
  setTokens,
  setUseWalletService,
  setWallet,
  shieldedCapabilityUpdate,
  shieldedProviderUpdate,
  startWalletRequested,
  startWalletSuccess,
  tokenFetchBalanceSuccess,
  types,
  updateSelectedToken,
} from '../../src/actions';
import {
  DEFAULT_TOKEN,
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
} from '../../src/constants';
import MainScreen from '../../src/screens/MainScreen';

const FULL = {
  level: 'full',
  reason: null,
  cause: null,
  canReceive: true,
  canSpend: true,
  historyComplete: true,
  undecoded: { txIds: [], locked: 0, unreadable: 0, error: 0 },
};

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
});

/**
 * Renders the selected token's screen on the shielded testnet, with a ready provider and a
 * wallet at level full, and the selected token's balance as given.
 */
async function render({ flag = true, balance }) {
  const actions = [];
  const recordActions = () => (next) => (action) => {
    actions.push(action);
    return next(action);
  };
  const store = createStore(reducer, applyMiddleware(recordActions));
  store.dispatch(setFeatureToggles({
    ...FEATURE_TOGGLE_DEFAULTS,
    [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag,
  }));
  store.dispatch(setFullNodeNetworkName(FULL_NETWORK_SHIELDED_TESTNET));
  store.dispatch(shieldedProviderUpdate({ status: SHIELDED_PROVIDER_STATUS.READY }));
  store.dispatch(shieldedCapabilityUpdate(FULL));
  // The app opens this screen once the wallet's start has loaded its balances.
  store.dispatch(startWalletSuccess());
  store.dispatch(tokenFetchBalanceSuccess(DEFAULT_TOKEN.uid, balance));
  actions.length = 0;
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };

  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}><MainScreen navigation={navigation} /></Provider>,
    );
  });
  mounted = renderer;

  const text = () => JSON.stringify(renderer.toJSON());
  const balanceRequests = () => actions.filter(
    (action) => action.type === types.TOKEN_FETCH_BALANCE_REQUESTED,
  );
  const expand = () => act(async () => {
    renderer.root.findByType(TouchableWithoutFeedback).props.onPress();
  });
  return {
    store, text, balanceRequests, expand,
  };
}

/**
 * Turns the shielded UI flag on or off, as an Unleash update does.
 */
const setFlag = (store, flag) => act(async () => {
  store.dispatch(setFeatureToggles({
    ...FEATURE_TOGGLE_DEFAULTS,
    [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag,
  }));
});

describe('the balance split on the token screen', () => {
  test('shows the private and public parts under the available balance', async () => {
    const { text, balanceRequests } = await render({
      balance: { available: 1000n, locked: 50n, privateAvailable: 400n },
    });

    expect(text()).toContain('Available Balance');
    expect(text()).toContain('"Private"');
    expect(text()).toContain('"4.00"');
    expect(text()).toContain('"6.00"');
    expect(balanceRequests()).toEqual([]);
  });

  test('keeps the locked balance in the expanded view, with the split', async () => {
    const { text, expand } = await render({
      balance: { available: 1000n, locked: 50n, privateAvailable: 400n },
    });

    await expand();

    expect(text()).toContain('"Locked"');
    expect(text()).toContain('0.50 HTR');
    expect(text()).toContain('"Private"');
  });

  test('shows the screen as it was while the shielded UI is off', async () => {
    const { text, balanceRequests } = await render({
      flag: false,
      balance: { available: 1000n, locked: 50n },
    });

    expect(text()).toContain('Available Balance');
    expect(text()).not.toContain('"Private"');
    expect(balanceRequests()).toEqual([]);
  });

  test('fetches a balance without its private part once', async () => {
    const { store, balanceRequests } = await render({
      balance: { available: 1000n, locked: 50n },
    });

    expect(balanceRequests()).toEqual([{
      type: types.TOKEN_FETCH_BALANCE_REQUESTED,
      tokenId: DEFAULT_TOKEN.uid,
      force: true,
    }]);

    // The fetch fails the same way: no other request.
    await act(async () => {
      store.dispatch(tokenFetchBalanceSuccess(DEFAULT_TOKEN.uid, {
        available: 1000n,
        locked: 50n,
      }));
    });
    expect(balanceRequests()).toHaveLength(1);
  });

  test('fetches nothing more for a private part that could not be read', async () => {
    const { text, balanceRequests } = await render({
      balance: { available: 1000n, locked: 50n, privateAvailable: null },
    });

    expect(balanceRequests()).toEqual([]);
    expect(text()).not.toContain('"Private"');
  });

  test('fetches the balance again once the flag turns on, for its private part', async () => {
    const { store, text, balanceRequests } = await render({
      flag: false,
      balance: { available: 1000n, locked: 50n },
    });

    await setFlag(store, true);

    expect(balanceRequests()).toEqual([{
      type: types.TOKEN_FETCH_BALANCE_REQUESTED,
      tokenId: DEFAULT_TOKEN.uid,
      force: true,
    }]);

    await act(async () => {
      store.dispatch(tokenFetchBalanceSuccess(DEFAULT_TOKEN.uid, {
        available: 1000n,
        locked: 50n,
        privateAvailable: 400n,
      }));
    });
    expect(text()).toContain('"Private"');
    expect(balanceRequests()).toHaveLength(1);
  });

  test('hides the split while the flag is off, and shows it again once it is on', async () => {
    const { store, text, balanceRequests } = await render({
      balance: { available: 1000n, locked: 50n, privateAvailable: 400n },
    });

    // The private part stays in the balance until its next fetch.
    await setFlag(store, false);

    expect(text()).toContain('Available Balance');
    expect(text()).not.toContain('"Private"');
    expect(text()).not.toContain('"Public"');

    await setFlag(store, true);

    expect(text()).toContain('"Private"');
    expect(text()).toContain('"Public"');
    expect(balanceRequests()).toEqual([]);
  });
});

describe('the balance split while the wallet starts', () => {
  const HTR = hathorLibConstants.NATIVE_TOKEN_UID;
  const TOKEN = {
    uid: '00000943573723a28e3dd980c10e08419d0e00bc647a95f4ca9671ebea7d5669',
    name: 'Shielded Token',
    symbol: 'STK',
  };
  let task = null;
  let debug = null;

  afterEach(() => {
    task?.cancel();
    task = null;
    debug?.mockRestore();
    debug = null;
  });

  // Lets the sagas run the wallet calls they started.
  const settle = () => act(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  });

  test('leaves the private part to the loads of the start, which read the synced balance', async () => {
    debug = jest.spyOn(console, 'debug').mockImplementation(() => {});
    // The token's funds show once the wallet's history synced.
    let synced = false;
    const wallet = {
      isReady: jest.fn(() => true),
      getBalance: jest.fn(async () => [{
        balance: { unlocked: synced ? 500n : 0n, locked: 0n },
      }]),
      getTxHistory: jest.fn(async () => []),
      storage: {
        selectUtxos: jest.fn(async function* select({ token }) {
          if (synced && token === TOKEN.uid) {
            yield { value: 200n };
          }
        }),
      },
    };
    const actions = [];
    const recordActions = () => (next) => (action) => {
      actions.push(action);
      return next(action);
    };
    const sagaMiddleware = createSagaMiddleware();
    const store = createStore(reducer, applyMiddleware(recordActions, sagaMiddleware));
    task = sagaMiddleware.run(tokensSaga);

    // A start on the shielded testnet, with the token's screen open, as after a network change:
    // the balances were cleared, and the provider is ready before the fullnode reports its
    // network, which it does once start() resolves, before the history syncs.
    store.dispatch(startWalletRequested());
    store.dispatch(setFeatureToggles({
      ...FEATURE_TOGGLE_DEFAULTS,
      [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: true,
    }));
    store.dispatch(setUseWalletService(false));
    store.dispatch(setWallet(wallet));
    store.dispatch(shieldedProviderUpdate({ status: SHIELDED_PROVIDER_STATUS.READY }));
    store.dispatch(updateSelectedToken(TOKEN));
    await act(async () => {
      mounted = create(
        <Provider store={store}>
          <MainScreen navigation={{ navigate: jest.fn(), goBack: jest.fn() }} />
        </Provider>,
      );
    });
    await act(async () => {
      store.dispatch(setFullNodeNetworkName(FULL_NETWORK_SHIELDED_TESTNET));
    });
    await settle();

    // The history synced: the start registers the tokens and loads their balances without
    // forcing them, as loadTokens and restoreNetworkTokens do, then ends.
    synced = true;
    await act(async () => {
      store.dispatch(setTokens({ [HTR]: DEFAULT_TOKEN, [TOKEN.uid]: TOKEN }));
      store.dispatch(startWalletSuccess());
    });
    await settle();

    expect(store.getState().tokensBalance[TOKEN.uid].data).toEqual({
      available: 500n,
      locked: 0n,
      privateAvailable: 200n,
    });
    expect(actions.filter(
      (action) => action.type === types.TOKEN_FETCH_BALANCE_REQUESTED && action.force,
    )).toEqual([]);
  });

  test('waits for a reload to end before it fetches a loaded balance again', async () => {
    const { store, balanceRequests } = await render({
      flag: false,
      balance: { available: 1000n, locked: 50n },
    });

    // wallet-lib reloads the wallet's history after a reconnect, and the balances stay. The flag
    // turns on meanwhile.
    await act(async () => { store.dispatch(onWalletReload()); });
    await setFlag(store, true);

    expect(balanceRequests()).toEqual([]);

    await act(async () => { store.dispatch(startWalletSuccess()); });

    expect(balanceRequests()).toEqual([{
      type: types.TOKEN_FETCH_BALANCE_REQUESTED,
      tokenId: DEFAULT_TOKEN.uid,
      force: true,
    }]);
  });
});
