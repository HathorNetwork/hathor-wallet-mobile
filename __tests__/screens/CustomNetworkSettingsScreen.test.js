/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';
import React from 'react';
import { TextInput } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { reducer } from '../../src/reducers/reducer';
import { networkSettingsUpdateState, setFeatureToggles } from '../../src/actions';
import { FEATURE_TOGGLE_DEFAULTS, PRE_SETTINGS_TESTNET } from '../../src/constants';
import { CustomNetworkSettingsScreen } from '../../src/screens/NetworkSettings/CustomNetworkSettingsScreen';
import { PortalProvider } from '../../src/components/Portal';

// Longer than the field on a phone.
const LONG_NODE_URL = 'https://legacy-node.devnet-alpha.samba.hathor.network/v1a/';

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
});

async function render() {
  const store = createStore(reducer);
  store.dispatch(setFeatureToggles(FEATURE_TOGGLE_DEFAULTS));
  store.dispatch(networkSettingsUpdateState({ ...PRE_SETTINGS_TESTNET, nodeUrl: LONG_NODE_URL }));
  await act(async () => {
    mounted = create(
      <Provider store={store}>
        <PortalProvider>
          <CustomNetworkSettingsScreen navigation={{ goBack: jest.fn() }} />
        </PortalProvider>
      </Provider>,
    );
  });
  const field = (label) => mounted.root
    .find((node) => node.props.label === label)
    .findByType(TextInput);
  return { fields: () => mounted.root.findAllByType(TextInput), field };
}

describe('the custom network URL fields', () => {
  test('wrap, so a URL longer than the field shows whole', async () => {
    const { fields, field } = await render();
    expect(fields().length).toBeGreaterThanOrEqual(4);
    for (const input of fields()) {
      expect(input.props.multiline).toBe(true);
      // Return closes the keyboard instead of breaking the line.
      expect(input.props.blurOnSubmit).toBe(true);
    }
    expect(field('Node URL').props.value).toBe(LONG_NODE_URL);
  });

  test('drop a line break pasted into one', async () => {
    const { field } = await render();
    await act(async () => {
      field('Node URL').props.onChangeText('https://node.test/\nv1a/\r\n');
    });
    expect(field('Node URL').props.value).toBe('https://node.test/v1a/');
  });
});
