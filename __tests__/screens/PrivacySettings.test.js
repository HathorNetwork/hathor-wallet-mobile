/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

// The shielded xpubs a passkey wallet stores: each passkey test sets them.
jest.mock('../../src/passkey/shieldedKeys', () => ({
  getPasskeyShieldedXpubs: jest.fn(() => null),
}));

/* eslint-disable import/first */
import React from 'react';
import { Image, Switch, TouchableOpacity } from 'react-native';
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
} from '../../src/constants';
import { PRIVACY_DEFAULT_MODE_KEY, STORE } from '../../src/store';
import { loadPrivacyDefaultMode } from '../../src/sagas/wallet';
import { PortalProvider } from '../../src/components/Portal';
import PrivacySettings from '../../src/screens/PrivacySettings';
import { getPasskeyShieldedXpubs } from '../../src/passkey/shieldedKeys';
/* eslint-enable import/first */

const KEY = PRIVACY_DEFAULT_MODE_KEY;

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
 * capability level, with the flag on unless `flag` is false, and the device's saved default.
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

  const navigation = { navigate: jest.fn(), goBack: jest.fn(), dispatch: jest.fn() };
  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}>
        <PortalProvider>
          <PrivacySettings
            navigation={navigation}
            route={{ key: 'PrivacySettings-test', name: 'PrivacySettings' }}
          />
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
  return {
    store,
    renderer,
    navigation,
    texts,
    switches,
    switchOn,
  };
}

describe('PrivacySettings', () => {
  test('offers the three modes as the default of all new transactions', async () => {
    const { texts, switches } = await render();

    expect(texts()).toEqual([
      'PRIVACY SETTINGS',
      'You can change your default anytime, or switch per transaction when sending.',
      'TRANSACTION DEFAULTS',
      'Private',
      'Token and amount hidden on all new transactions',
      'Fee: 0.02 HTR per output',
      'Hide amount',
      'Token visible, amount hidden on all new transactions',
      'Fee: 0.01 HTR per output',
      'Public',
      'Token and amount visible on all new transactions',
      'No privacy fees',
      'AUDIT',
      'Export privacy keys',
    ]);
    // Private, Hide amount, then Public, the default when none is saved.
    expect(DEFAULT_PRIVACY_MODE).toBe(PRIVACY_MODE.PUBLIC);
    expect(switches().map((node) => node.props.value)).toEqual([false, false, true]);
  });

  test('shows the default saved on the device', async () => {
    const { switches } = await render({ saved: PRIVACY_MODE.PRIVATE });

    expect(switches().map((node) => node.props.value)).toEqual([true, false, false]);
  });

  test('saves a mode as the default of the device as soon as it is switched on', async () => {
    const setItem = jest.spyOn(STORE, 'setItem');
    const { store, switches, switchOn } = await render();

    await switchOn(0);

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(KEY, PRIVACY_MODE.PRIVATE);
    expect(store.getState().privacyDefaultMode).toBe(PRIVACY_MODE.PRIVATE);
    expect(switches().map((node) => node.props.value)).toEqual([true, false, false]);
  });

  test('saves it where the next start of the wallet reads it', async () => {
    const { switchOn } = await render();
    await switchOn(0);

    const dispatched = [];
    await runSaga(
      { dispatch: (action) => dispatched.push(action) },
      loadPrivacyDefaultMode,
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

  // How the screen closes where the shielded UI is not available is tested in a real stack, in
  // PrivacyScreensStack.test.js.
  test('stays open while the private balance is locked', async () => {
    const { navigation, switches } = await render({ level: 'watch' });

    expect(navigation.dispatch).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(switches()).toHaveLength(3);
  });
});

describe('PrivacySettings and the key export', () => {
  // The export's row: a pressable row with its title and a chevron.
  const exportRows = (renderer) => renderer.root.findAllByType(TouchableOpacity).filter(
    (row) => row.findAll(
      (node) => node.type === 'Text' && node.props.children === 'Export privacy keys',
    ).length > 0,
  );

  test('shows the export as a row with a chevron, under AUDIT', async () => {
    const { renderer } = await render();

    const [row] = exportRows(renderer);
    expect(row.findAllByType(Image)).toHaveLength(1);
  });

  test('opens the export of the privacy keys, with no params', async () => {
    const { renderer, texts, navigation } = await render();

    expect(texts()).toContain('AUDIT');
    await act(async () => { exportRows(renderer)[0].props.onPress(); });

    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate.mock.calls[0]).toEqual(['ExportPrivacyKeys']);
  });

  test('offers no export to a passkey wallet without shielded keys', async () => {
    jest.spyOn(STORE, 'isPasskeyWallet').mockReturnValue(true);
    getPasskeyShieldedXpubs.mockReturnValue(null);
    const { renderer, texts } = await render();

    expect(exportRows(renderer)).toEqual([]);
    expect(texts()).not.toContain('AUDIT');
  });

  // Its passkey derives the keys to export.
  test('offers the export to a passkey wallet with shielded keys', async () => {
    jest.spyOn(STORE, 'isPasskeyWallet').mockReturnValue(true);
    getPasskeyShieldedXpubs.mockReturnValue({ scanXpubkey: 'xpub-scan', spendXpubkey: 'xpub-spend' });
    const { renderer, texts } = await render();

    expect(exportRows(renderer)).toHaveLength(1);
    expect(texts()).toContain('AUDIT');
    getPasskeyShieldedXpubs.mockReturnValue(null);
  });
});
