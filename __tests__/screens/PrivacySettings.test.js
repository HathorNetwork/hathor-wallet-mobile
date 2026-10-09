/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';
import React from 'react';
import { Switch } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { runSaga } from 'redux-saga';
import { reducer } from '../../src/reducers/reducer';
import {
  networkSettingsUpdateState,
  privacyDefaultModeSet,
  setFeatureToggles,
  setFullNodeNetworkName,
  setServerInfo,
  shieldedCapabilityUpdate,
  shieldedProviderUpdate,
} from '../../src/actions';
import {
  DEFAULT_PRIVACY_MODE,
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  PRE_SETTINGS_SHIELDED_TESTNET,
  PRIVACY_MODE,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
  privacyDefaultModeKey,
} from '../../src/constants';
import { STORE } from '../../src/store';
import { loadPrivacyDefaultMode } from '../../src/sagas/wallet';
import { PortalProvider } from '../../src/components/Portal';
import PrivacySettings from '../../src/screens/PrivacySettings';

const KEY = privacyDefaultModeKey(PRE_SETTINGS_SHIELDED_TESTNET);

const capability = (level) => ({
  level,
  reason: level === 'full' ? null : 'locked',
  cause: level === 'full' ? null : 'wrong-pin',
  canReceive: level === 'full',
  canSpend: level === 'full',
  historyComplete: true,
  undecoded: { txIds: [], locked: 0, unreadable: 0, error: 0 },
});

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  jest.restoreAllMocks();
  STORE.removeItem(KEY);
});

/**
 * Renders the screen for a seed wallet on the shielded testnet, with a ready provider, at a
 * capability level, with the flag on unless `flag` is false, and the network's saved default.
 */
async function render({ flag = true, level = 'full', saved = null } = {}) {
  const store = createStore(reducer);
  store.dispatch(networkSettingsUpdateState(PRE_SETTINGS_SHIELDED_TESTNET));
  store.dispatch(setServerInfo({ decimal_places: 2, native_token: { name: 'Hathor', symbol: 'HTR' } }));
  store.dispatch(setFeatureToggles({
    ...FEATURE_TOGGLE_DEFAULTS,
    [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag,
  }));
  store.dispatch(setFullNodeNetworkName(FULL_NETWORK_SHIELDED_TESTNET));
  store.dispatch(shieldedProviderUpdate({ status: SHIELDED_PROVIDER_STATUS.READY }));
  store.dispatch(shieldedCapabilityUpdate(capability(level)));
  if (saved) {
    store.dispatch(privacyDefaultModeSet(saved));
  }

  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}>
        <PortalProvider>
          <PrivacySettings navigation={navigation} />
        </PortalProvider>
      </Provider>,
    );
  });
  mounted = renderer;

  const texts = () => renderer.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
  const switches = () => renderer.root.findAllByType(Switch);
  const switchOn = (index) => act(async () => {
    switches()[index].props.onValueChange(true);
  });
  return { store, navigation, texts, switches, switchOn };
}

describe('PrivacySettings', () => {
  test('offers the private modes as the default of sends to private addresses', async () => {
    const { texts, switches } = await render();

    expect(texts()).toEqual(expect.arrayContaining([
      'PRIVACY SETTINGS',
      'The default applies to your sends to private addresses. You can change it for each send.',
      'DEFAULT FOR SENDS TO PRIVATE ADDRESSES',
      'Private',
      'Amount hidden on new sends to private addresses. The token is hidden among the tokens each send spends, but never when it is HTR.',
      'Fee: 0.02 HTR per private output',
      'Hide amount',
      'Token visible, amount hidden on new sends to private addresses',
      'Fee: 0.01 HTR per private output',
    ]));
    expect(texts()).not.toContain('Public');
    // Private, then Hide amount, the default when none is saved.
    expect(DEFAULT_PRIVACY_MODE).toBe(PRIVACY_MODE.HIDE_AMOUNT);
    expect(switches().map((node) => node.props.value)).toEqual([false, true]);
  });

  test('shows the default saved for the network', async () => {
    const { switches } = await render({ saved: PRIVACY_MODE.PRIVATE });

    expect(switches().map((node) => node.props.value)).toEqual([true, false]);
  });

  test('saves a mode as the default of the network as soon as it is switched on', async () => {
    const setItem = jest.spyOn(STORE, 'setItem');
    const { store, switches, switchOn } = await render();

    await switchOn(0);

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(KEY, PRIVACY_MODE.PRIVATE);
    expect(store.getState().privacyDefaultMode).toBe(PRIVACY_MODE.PRIVATE);
    expect(switches().map((node) => node.props.value)).toEqual([true, false]);
  });

  test('saves it where the next start of the wallet reads it', async () => {
    const { switchOn } = await render();
    await switchOn(0);

    const dispatched = [];
    await runSaga(
      { dispatch: (action) => dispatched.push(action) },
      loadPrivacyDefaultMode,
      PRE_SETTINGS_SHIELDED_TESTNET,
    ).toPromise();

    expect(dispatched).toEqual([privacyDefaultModeSet(PRIVACY_MODE.PRIVATE)]);
  });

  test('saves nothing for the default it already has', async () => {
    const setItem = jest.spyOn(STORE, 'setItem');
    const { store, switchOn } = await render({ saved: PRIVACY_MODE.PRIVATE });

    await switchOn(0);

    expect(setItem).not.toHaveBeenCalled();
    expect(store.getState().privacyDefaultMode).toBe(PRIVACY_MODE.PRIVATE);
  });

  test('stays open while the private balance is locked', async () => {
    const { navigation, switches } = await render({ level: 'watch' });

    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(switches()).toHaveLength(2);
  });

  test('goes back where the shielded UI is not available', async () => {
    const { navigation } = await render({ flag: false });

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  test('goes back when the shielded UI stops being available', async () => {
    const { store, navigation } = await render();
    expect(navigation.goBack).not.toHaveBeenCalled();

    await act(async () => {
      store.dispatch(shieldedProviderUpdate({
        status: SHIELDED_PROVIDER_STATUS.FAILED,
        error: 'self-test failed',
      }));
    });

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});
