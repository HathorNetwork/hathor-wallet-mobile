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
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import { reducer } from '../../src/reducers/reducer';
import { setFeatureToggles, types } from '../../src/actions';
import {
  FEATURE_TOGGLE_DEFAULTS,
  PRE_SETTINGS_SHIELDED_TESTNET,
  SHIELDED_NETWORK_PRESET_FEATURE_TOGGLE,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
} from '../../src/constants';
import { NetworkPreSettingsScreen } from '../../src/screens/NetworkSettings/NetworkPreSettingsScreen';
import { PortalProvider } from '../../src/components/Portal';

const SHIELDED_TESTNET_TITLE = 'Shielded Testnet';

let mounted = null;

// Pressing a preset opens a feedback modal, which starts a timer: unmount to clear it.
afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
});

async function render({ presetFlag = false, shieldedFlag = false }) {
  const actions = [];
  const recordActions = () => (next) => (action) => {
    actions.push(action);
    return next(action);
  };
  const store = createStore(reducer, applyMiddleware(recordActions));
  store.dispatch(setFeatureToggles({
    ...FEATURE_TOGGLE_DEFAULTS,
    [SHIELDED_NETWORK_PRESET_FEATURE_TOGGLE]: presetFlag,
    [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: shieldedFlag,
  }));
  const navigation = { goBack: jest.fn(), push: jest.fn() };

  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}>
        <PortalProvider><NetworkPreSettingsScreen navigation={navigation} /></PortalProvider>
      </Provider>,
    );
  });
  mounted = renderer;
  const presetTitles = renderer.root
    .findAll((node) => typeof node.props.title === 'string' && typeof node.props.url === 'string')
    .map((node) => node.props.title);
  const findPreset = (title) => renderer.root.find(
    (node) => node.props.title === title && typeof node.props.onPress === 'function',
  );
  return { actions, presetTitles, findPreset };
}

describe('NetworkPreSettingsScreen', () => {
  test('offers no Shielded Testnet while both flags are off', async () => {
    const { presetTitles } = await render({});
    expect(presetTitles).toEqual(['Mainnet', 'Testnet']);
  });

  test('offers the Shielded Testnet while its preset flag is on', async () => {
    const { presetTitles } = await render({ presetFlag: true });
    expect(presetTitles).toEqual(['Mainnet', 'Testnet', SHIELDED_TESTNET_TITLE]);
  });

  // The shielded outputs flag is for the shielded UI, on the shielded testnet: on the networks
  // the user switches from it is off, so it doesn't show the preset either way.
  test('offers no Shielded Testnet for the shielded outputs flag alone', async () => {
    const { presetTitles } = await render({ shieldedFlag: true });
    expect(presetTitles).toEqual(['Mainnet', 'Testnet']);
  });

  test('saves the Shielded Testnet preset when it is pressed', async () => {
    const { actions, findPreset } = await render({ presetFlag: true });

    await act(async () => {
      findPreset(SHIELDED_TESTNET_TITLE).props.onPress();
    });

    const persisted = actions.filter(
      (action) => action.type === types.NETWORKSETTINGS_PERSIST_STORE,
    );
    expect(persisted).toEqual([{
      type: types.NETWORKSETTINGS_PERSIST_STORE,
      payload: PRE_SETTINGS_SHIELDED_TESTNET,
    }]);
  });
});
