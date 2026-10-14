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
  setAddressMode,
  setUseWalletService,
  setWallet,
  startWalletSuccess,
} from '../../src/actions';
import {
  ADDRESS_MODE,
  PRE_SETTINGS_SHIELDED_TESTNET,
  PRE_SETTINGS_TESTNET,
  networkSettingsKeyMap,
} from '../../src/constants';
import { STORE } from '../../src/store';
import { RadioGroup } from '../../src/components/Radio';
import AddressMode from '../../src/screens/AddressMode';

const NETWORK_NOTE = 'Single address mode is not available on this network.';
const IN_USE_NOTE = "You can't switch to single address mode because other addresses in your wallet are already in use.";

let mounted = null;

afterEach(async () => {
  jest.restoreAllMocks();
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
});

/**
 * Renders the Address Mode screen for a ready wallet in multi-address mode, on the fullnode
 * facade, on the network given.
 */
async function render({ networkSettings, walletMeta = null, hasTxOutside = false }) {
  jest.spyOn(STORE, 'getItem').mockImplementation(
    (key) => (key === networkSettingsKeyMap.networkSettings ? networkSettings : null),
  );
  jest.spyOn(STORE, 'getWalletMeta').mockReturnValue(walletMeta);
  const store = createStore(reducer);
  store.dispatch(setWallet({ hasTxOutsideFirstAddress: jest.fn(async () => hasTxOutside) }));
  store.dispatch(setUseWalletService(false));
  store.dispatch(startWalletSuccess());
  store.dispatch(setAddressMode(ADDRESS_MODE.MULTI));

  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}><AddressMode navigation={{ goBack: jest.fn() }} /></Provider>,
    );
  });
  mounted = renderer;

  const single = () => renderer.root.findByType(RadioGroup).props.options
    .find((option) => option.value === ADDRESS_MODE.SINGLE);
  const text = () => JSON.stringify(renderer.toJSON());
  return { single, text };
}

describe('AddressMode', () => {
  test('keeps a seed wallet on the shielded testnet out of single-address mode, and says why', async () => {
    const { single, text } = await render({ networkSettings: PRE_SETTINGS_SHIELDED_TESTNET });

    expect(single().disabled).toBe(true);
    expect(text()).toContain(NETWORK_NOTE);
    expect(text()).not.toContain(IN_USE_NOTE);
  });

  test('offers single-address mode on the public testnet', async () => {
    const { single, text } = await render({ networkSettings: PRE_SETTINGS_TESTNET });

    expect(single().disabled).toBe(false);
    expect(text()).not.toContain(NETWORK_NOTE);
  });

  test('still says when other addresses of the wallet are in use', async () => {
    const { single, text } = await render({
      networkSettings: PRE_SETTINGS_TESTNET,
      hasTxOutside: true,
    });

    expect(single().disabled).toBe(true);
    expect(text()).toContain(IN_USE_NOTE);
    expect(text()).not.toContain(NETWORK_NOTE);
  });

  test('offers it to a passkey wallet, which gets no shielded chain', async () => {
    const { single } = await render({
      networkSettings: PRE_SETTINGS_SHIELDED_TESTNET,
      walletMeta: { walletType: 'passkey', xpub: 'xpub-passkey-wallet' },
    });

    expect(single().disabled).toBe(false);
  });
});
