/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

const mockNavigation = { navigate: jest.fn(), goBack: jest.fn() };
let mockRouteParams = {};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

/* eslint-disable import/first */
import React from 'react';
import { TextInput } from 'react-native';
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
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  PRE_SETTINGS_SHIELDED_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
} from '../../src/constants';
import { shieldedAddressNotSupportedText } from '../../src/utils';
import SendAddressInput from '../../src/screens/SendAddressInput';
/* eslint-enable import/first */

// Testnet addresses built with wallet-lib's address encoders from fixed keys.
const P2PKH = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const SHIELDED = 'K3KokZRo7DyNRRiyijpsVix2VADrd4HeA8vWLR5itAj81BVC4Vv7xoXbrYyKYwsLMWhefXqXKgJvC6HcVkDuJ7AJ7qUMS7fVc';

// The capability at a level: below 'full', locked unless another reason is given.
const capability = (level, cause = null, reason = level === 'full' ? null : 'locked') => ({
  level,
  reason,
  cause,
  canReceive: level === 'full',
  canSpend: level === 'full',
  historyComplete: true,
  undecoded: { txIds: [], locked: 0, unreadable: 0, error: 0 },
});

let mounted = null;

afterEach(async () => {
  jest.clearAllMocks();
  mockRouteParams = {};
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
});

/**
 * Renders the send address input of a seed wallet on the shielded testnet, on the fullnode
 * facade, with a ready provider, unless the options say otherwise. The wallet-service facade's
 * wallets have no provider.
 */
async function render({
  flag = true,
  level = capability('full'),
  providerStatus = SHIELDED_PROVIDER_STATUS.READY,
  useWalletService = false,
  fullNodeNetworkName = FULL_NETWORK_SHIELDED_TESTNET,
} = {}) {
  const store = createStore(reducer);
  store.dispatch(networkSettingsUpdateState(PRE_SETTINGS_SHIELDED_TESTNET));
  store.dispatch(setFeatureToggles({
    ...FEATURE_TOGGLE_DEFAULTS,
    [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag,
  }));
  store.dispatch(setUseWalletService(useWalletService));
  store.dispatch(setFullNodeNetworkName(fullNodeNetworkName));
  store.dispatch(shieldedProviderUpdate({ status: providerStatus }));
  store.dispatch(shieldedCapabilityUpdate(level));

  let renderer;
  await act(async () => {
    renderer = create(<Provider store={store}><SendAddressInput /></Provider>);
  });
  mounted = renderer;

  const type = (text) => act(async () => {
    renderer.root.findByType(TextInput).props.onChangeText(text);
  });
  const next = () => act(async () => {
    renderer.root.find((node) => node.props.title === 'Next' && node.props.onPress).props.onPress();
  });
  const texts = () => renderer.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
  return { type, next, texts };
}

describe('SendAddressInput with private sends', () => {
  test('takes a private address where the wallet sends privately', async () => {
    const { type, next } = await render();

    await type(SHIELDED);
    await next();

    expect(mockNavigation.navigate).toHaveBeenCalledWith('SendAmountInput', { address: SHIELDED });
  });

  test('takes a scanned private address the same way', async () => {
    mockRouteParams = { address: SHIELDED };
    const { next } = await render();

    await next();

    expect(mockNavigation.navigate).toHaveBeenCalledWith('SendAmountInput', { address: SHIELDED });
  });

  test('takes a private address while the private balance is locked by a PIN', async () => {
    const { type, next } = await render({ level: capability('watch', 'wrong-pin') });

    await type(SHIELDED);
    await next();

    expect(mockNavigation.navigate).toHaveBeenCalledWith('SendAmountInput', { address: SHIELDED });
  });

  test.each([
    ['the flag is off', { flag: false }],
    ['on the wallet-service facade', {
      useWalletService: true,
      providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED,
      level: capability('none', null, 'wallet-service'),
    }],
    ['on another network', {
      fullNodeNetworkName: 'testnet',
      providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED,
      level: capability('none', null, 'no-provider'),
    }],
  ])('rejects a private address as unsupported when %s', async (_label, options) => {
    const { type, next, texts } = await render(options);

    await type(SHIELDED);
    await next();

    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(texts()).toContain(shieldedAddressNotSupportedText);
  });

  // A public send to a private address pays the address of its spend key, which needs no crypto
  // provider and no private transfers.
  test.each([
    ['the crypto provider failed its self-test', {
      providerStatus: SHIELDED_PROVIDER_STATUS.FAILED,
      level: capability('none', null, 'no-provider'),
    }],
    ['the wallet has no crypto provider', {
      level: capability('none', null, 'no-provider'),
    }],
    ['no PIN can unlock the private balance', {
      level: capability('watch', 'corrupt-key'),
    }],
    ['the shielded keys of the wallet do not match', {
      level: capability('none', 'key-mismatch', 'integrity'),
    }],
    ['the wallet has no shielded keys', {
      level: capability('none', null, 'needs-password'),
    }],
  ])('takes a private address where private transfers are unavailable: %s', async (_label, options) => {
    const { type, next } = await render(options);

    await type(SHIELDED);
    await next();

    expect(mockNavigation.navigate).toHaveBeenCalledWith('SendAmountInput', { address: SHIELDED });
  });

  test('takes a scanned private address where private transfers are unavailable', async () => {
    mockRouteParams = { address: SHIELDED };
    const { next } = await render({
      providerStatus: SHIELDED_PROVIDER_STATUS.FAILED,
      level: capability('none', null, 'no-provider'),
    });

    await next();

    expect(mockNavigation.navigate).toHaveBeenCalledWith('SendAmountInput', { address: SHIELDED });
  });

  test('still takes a public address where private transfers are unavailable', async () => {
    const { type, next } = await render({
      providerStatus: SHIELDED_PROVIDER_STATUS.FAILED,
      level: capability('none', null, 'no-provider'),
    });

    await type(P2PKH);
    await next();

    expect(mockNavigation.navigate).toHaveBeenCalledWith('SendAmountInput', { address: P2PKH });
  });

  test('still takes a public address', async () => {
    const { type, next } = await render({ flag: false });

    await type(P2PKH);
    await next();

    expect(mockNavigation.navigate).toHaveBeenCalledWith('SendAmountInput', { address: P2PKH });
  });
});
