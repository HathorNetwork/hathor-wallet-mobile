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
import { reducer } from '../../src/reducers/reducer';
import {
  setFeatureToggles,
  setFullNodeNetworkName,
  shieldedCapabilityUpdate,
  shieldedProviderUpdate,
  tokenFetchBalanceSuccess,
  types,
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
});
