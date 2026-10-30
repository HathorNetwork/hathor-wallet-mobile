/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

jest.mock('@react-navigation/native', () => {
  const ReactInMock = jest.requireActual('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    // The screen opens once.
    useFocusEffect: (effect) => ReactInMock.useEffect(() => effect(), []),
  };
});

// Hathor Network's address is today's screen, unchanged: a stand-in shows where it goes.
jest.mock('../../../src/components/ReceiveMyAddress', () => {
  const { Text } = jest.requireActual('react-native');
  return () => <Text>Hathor Network address</Text>;
});

/* eslint-disable import/first */
import React from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { reducer } from '../../../src/reducers/reducer';
import {
  FEATURE_TOGGLE_DEFAULTS,
  MULTICHAIN_FEATURE_TOGGLE,
  PRE_SETTINGS_TESTNET,
} from '../../../src/constants';
import ReceiveScreen from '../../../src/screens/Receive';
import { TwoOptionsToggle } from '../../../src/components/TwoOptionsToggle';
import { PortalProvider } from '../../../src/components/Portal';
import { NEXT_STATUS } from '../../../src/multichain/state';
/* eslint-enable import/first */

const NETWORK = 'testnet-juliet';
const OWN_ADDRESS = `samba:${'cd34'.repeat(32)}`;

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
});

function makeStore({ connected }) {
  const initial = reducer(undefined, { type: '@@INIT' });
  return createStore(reducer, {
    ...initial,
    networkSettings: PRE_SETTINGS_TESTNET,
    featureToggles: { ...FEATURE_TOGGLE_DEFAULTS, [MULTICHAIN_FEATURE_TOGGLE]: true },
    fullNodeNetworkName: NETWORK,
    multichain: {
      ...initial.multichain,
      connectedNetworks: connected ? { [NETWORK]: true } : {},
      next: { ...initial.multichain.next, status: NEXT_STATUS.READY, address: OWN_ADDRESS },
    },
  });
}

async function mount(store) {
  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}>
        <PortalProvider><ReceiveScreen navigation={{ navigate: jest.fn() }} /></PortalProvider>
      </Provider>,
    );
  });
  mounted = renderer;
  return renderer;
}

const textOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).join(''))
  .filter(Boolean);

describe('Receive', () => {
  test('is unchanged without the side chain', async () => {
    const renderer = await mount(makeStore({ connected: false }));
    expect(renderer.root.findAllByType(TwoOptionsToggle)).toHaveLength(0);
    expect(textOf(renderer)).toContain('Hathor Network address');
  });

  test('picks the chain with the side chain connected, Hathor Network first', async () => {
    const renderer = await mount(makeStore({ connected: true }));
    const toggle = renderer.root.findByType(TwoOptionsToggle);
    expect(toggle.props.options.first.value).toBe('Hathor Network');
    expect(toggle.props.options.second.value).toBe('Hathor Next');
    expect(textOf(renderer)).toContain('Hathor Network address');

    await act(async () => { toggle.props.options.second.onTap(); });
    const texts = textOf(renderer);
    expect(texts).not.toContain('Hathor Network address');
    expect(texts).toEqual(expect.arrayContaining([OWN_ADDRESS, 'Share', 'Simulated']));
  });
});
