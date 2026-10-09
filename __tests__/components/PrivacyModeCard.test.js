/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';
import React from 'react';
import { Keyboard, Pressable, Switch } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { reducer } from '../../src/reducers/reducer';
import { setServerInfo } from '../../src/actions';
import { PRIVACY_MODE } from '../../src/constants';
import { PortalProvider } from '../../src/components/Portal';
import PrivacyModeCard from '../../src/components/PrivacyModeCard';
import PrivacyModeSelector from '../../src/components/PrivacyModeSelector';
import TransactionPrivacyModal from '../../src/components/TransactionPrivacyModal';

const PRIVATE_ONLY = [PRIVACY_MODE.HIDE_AMOUNT, PRIVACY_MODE.PRIVATE];

let mounted = null;

afterEach(async () => {
  jest.restoreAllMocks();
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
});

/**
 * Renders an element in a store whose fullnode reports the given decimal places and native
 * token symbol.
 */
async function render(element, { decimalPlaces = 2, symbol = 'HTR' } = {}) {
  const store = createStore(reducer);
  store.dispatch(setServerInfo({
    decimal_places: decimalPlaces,
    native_token: { name: 'Native', symbol },
  }));
  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}><PortalProvider>{element}</PortalProvider></Provider>,
    );
  });
  mounted = renderer;
  const texts = () => renderer.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
  return { renderer, texts };
}

// BackdropModal shows its content 100 ms after it opens.
const waitForSheetContent = () => act(async () => {
  await new Promise((resolve) => { setTimeout(resolve, 150); });
});

describe('PrivacyModeCard', () => {
  test('offers the three modes, most private first, with their privacy fee', async () => {
    const { texts } = await render(
      <PrivacyModeCard selectedMode={PRIVACY_MODE.PUBLIC} onSelect={jest.fn()} />,
    );

    expect(texts()).toEqual([
      'Private',
      'Amount hidden. The token is hidden among the tokens this send spends, but never when it is HTR.',
      'Fee: 0.02 HTR per private output',
      'Hide amount',
      'Token visible, amount hidden',
      'Fee: 0.01 HTR per private output',
      'Public',
      'Token and amount visible',
      'No privacy fee unless the send spends private funds',
    ]);
  });

  test("shows the fees with the network's decimal places and native symbol", async () => {
    const { texts } = await render(
      <PrivacyModeCard selectedMode={PRIVACY_MODE.PUBLIC} onSelect={jest.fn()} />,
      { decimalPlaces: 4, symbol: 'XHT' },
    );

    expect(texts()).toContain('Fee: 0.0002 XHT per private output');
    expect(texts()).toContain('Fee: 0.0001 XHT per private output');
  });

  test('offers only the modes it is given', async () => {
    const { texts, renderer } = await render(
      <PrivacyModeCard
        selectedMode={PRIVACY_MODE.HIDE_AMOUNT}
        onSelect={jest.fn()}
        options={PRIVATE_ONLY}
      />,
    );

    expect(texts()).not.toContain('Public');
    expect(texts().filter((text) => text === 'Private' || text === 'Hide amount'))
      .toEqual(['Private', 'Hide amount']);
    expect(renderer.root.findAllByType(Switch).map((node) => node.props.value))
      .toEqual([false, true]);
  });

  test('reports the mode the user switches on', async () => {
    const onSelect = jest.fn();
    const { renderer } = await render(
      <PrivacyModeCard selectedMode={PRIVACY_MODE.PUBLIC} onSelect={onSelect} />,
    );

    await act(async () => {
      renderer.root.findAllByType(Switch)[0].props.onValueChange(true);
    });
    expect(onSelect).toHaveBeenCalledWith(PRIVACY_MODE.PRIVATE);
  });
});

describe('TransactionPrivacyModal', () => {
  test('applies the mode chosen in the sheet only on Done', async () => {
    const onConfirm = jest.fn();
    const { renderer, texts } = await render(
      <TransactionPrivacyModal
        visible
        onDismiss={jest.fn()}
        selectedMode={PRIVACY_MODE.HIDE_AMOUNT}
        options={PRIVATE_ONLY}
        onConfirm={onConfirm}
      />,
    );
    await waitForSheetContent();

    expect(texts()).toEqual(expect.arrayContaining([
      'Transaction privacy',
      'Choose what this transaction hides.',
    ]));

    await act(async () => {
      renderer.root.findAllByType(Switch)[0].props.onValueChange(true);
    });
    expect(onConfirm).not.toHaveBeenCalled();

    await act(async () => {
      renderer.root.find((node) => node.props.title === 'Done' && node.props.onPress).props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith(PRIVACY_MODE.PRIVATE);
  });

  test('says that a private address only gets private sends', async () => {
    const { texts } = await render(
      <TransactionPrivacyModal
        visible
        onDismiss={jest.fn()}
        selectedMode={PRIVACY_MODE.HIDE_AMOUNT}
        options={PRIVATE_ONLY}
        onConfirm={jest.fn()}
      />,
    );
    await waitForSheetContent();

    expect(texts()).toContain('Payments to a private address are always private.');
    expect(texts()).not.toContain('Public');
  });

  test('points to no default setting', async () => {
    const { texts } = await render(
      <TransactionPrivacyModal
        visible
        onDismiss={jest.fn()}
        selectedMode={PRIVACY_MODE.PUBLIC}
        options={Object.values(PRIVACY_MODE)}
        onConfirm={jest.fn()}
      />,
    );
    await waitForSheetContent();

    expect(texts().join('\n')).not.toMatch(/default|settings/i);
    expect(texts()).not.toContain('Payments to a private address are always private.');
  });
});

describe('PrivacyModeSelector', () => {
  test("shows the send's mode and opens the sheet without the keyboard", async () => {
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss');
    const onPress = jest.fn();
    const { renderer, texts } = await render(
      <PrivacyModeSelector mode={PRIVACY_MODE.HIDE_AMOUNT} onPress={onPress} />,
    );

    expect(texts()).toEqual(['Hide amount', 'Token visible, amount hidden']);

    await act(async () => {
      renderer.root.findByType(Pressable).props.onPress();
    });
    expect(dismissKeyboard).toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('says why it is disabled, and does not open', async () => {
    const { renderer, texts } = await render(
      <PrivacyModeSelector mode={PRIVACY_MODE.PUBLIC} onPress={jest.fn()} disabled />,
    );

    expect(texts()).toEqual([
      'Public',
      'Token and amount visible',
      'Private sends need a private address.',
    ]);
    expect(renderer.root.findByType(Pressable).props.disabled).toBe(true);
  });
});
