/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { reducer } from '../../src/reducers/reducer';
import {
  networkSettingsUpdateState,
  setFeatureToggles,
  setFullNodeNetworkName,
  setUseWalletService,
  shieldedCapabilityUpdate,
  shieldedProviderUpdate,
} from '../../src/actions';
import {
  AMOUNT_FORMAT_FEATURE_TOGGLE,
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  PRE_SETTINGS_SHIELDED_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
} from '../../src/constants';
import { ListMenu } from '../../src/components/HathorList';
import Settings from '../../src/screens/Settings';

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
});

/**
 * Renders the settings of a seed wallet on the shielded testnet with the amount format flag on.
 * By default the shielded UI is available: the flag is on, the fullnode reports the shielded
 * testnet, and the provider passed its self-test.
 */
async function render({
  flag = true,
  networkName = FULL_NETWORK_SHIELDED_TESTNET,
  providerStatus = SHIELDED_PROVIDER_STATUS.READY,
  useWalletService = false,
  level = 'full',
} = {}) {
  const store = createStore(reducer);
  store.dispatch(networkSettingsUpdateState(PRE_SETTINGS_SHIELDED_TESTNET));
  store.dispatch(setFeatureToggles({
    ...FEATURE_TOGGLE_DEFAULTS,
    [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag,
    [AMOUNT_FORMAT_FEATURE_TOGGLE]: true,
  }));
  store.dispatch(setFullNodeNetworkName(networkName));
  store.dispatch(setUseWalletService(useWalletService));
  store.dispatch(shieldedProviderUpdate({ status: providerStatus }));
  store.dispatch(shieldedCapabilityUpdate(capability(level)));

  const navigation = { navigate: jest.fn() };
  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}><Settings navigation={navigation} /></Provider>,
    );
  });
  mounted = renderer;

  const menus = () => renderer.root.findAllByType(ListMenu);
  const titles = () => menus().map((node) => node.props.title);
  return { navigation, menus, titles };
}

describe('Settings', () => {
  test('offers Privacy in the advanced settings, after Amount format', async () => {
    const { titles } = await render();

    const order = titles();
    expect(order).toContain('Privacy');
    expect(order.indexOf('Amount format')).toBe(order.indexOf('Privacy') - 1);
    expect(order.indexOf('Reset wallet')).toBe(order.indexOf('Privacy') + 1);
  });

  test('opens the privacy settings, with no params', async () => {
    const { menus, navigation } = await render();

    await act(async () => {
      menus().find((node) => node.props.title === 'Privacy').props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate.mock.calls[0]).toEqual(['PrivacySettings']);
  });

  test('offers it while the private balance is locked', async () => {
    const { titles } = await render({ level: 'watch' });

    expect(titles()).toContain('Privacy');
  });

  test.each([
    ['with the flag off', { flag: false }],
    ['on another network', { networkName: 'testnet' }],
    ['on the wallet-service facade', { useWalletService: true }],
    ['where no provider was registered, as for a passkey wallet', {
      providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED,
    }],
    ['where the provider failed its self-test', {
      providerStatus: SHIELDED_PROVIDER_STATUS.FAILED,
    }],
  ])('offers no Privacy %s', async (_label, options) => {
    const { titles } = await render(options);

    expect(titles()).not.toContain('Privacy');
    expect(titles()).toContain('Amount format');
  });
});
