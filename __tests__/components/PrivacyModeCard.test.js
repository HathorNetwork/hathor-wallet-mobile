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
import TextFmt from '../../src/components/TextFmt';
import PrivacyModeCard, { PRIVACY_MODE_CARD_VARIANT } from '../../src/components/PrivacyModeCard';
import PrivacyModeSelector from '../../src/components/PrivacyModeSelector';
import TransactionPrivacyModal from '../../src/components/TransactionPrivacyModal';

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
      'Token and amount hidden',
      'Fee: 0.02 HTR per output',
      'Hide amount',
      'Token visible, amount hidden',
      'Fee: 0.01 HTR per output',
      'Public',
      'Token and amount visible',
      'No privacy fees',
    ]);
  });

  test("shows the fees with the network's decimal places", async () => {
    const { texts } = await render(
      <PrivacyModeCard selectedMode={PRIVACY_MODE.PUBLIC} onSelect={jest.fn()} />,
      { decimalPlaces: 4 },
    );

    expect(texts()).toContain('Fee: 0.0002 HTR per output');
    expect(texts()).toContain('Fee: 0.0001 HTR per output');
  });

  test('switches on the selected mode only', async () => {
    const { renderer } = await render(
      <PrivacyModeCard selectedMode={PRIVACY_MODE.HIDE_AMOUNT} onSelect={jest.fn()} />,
    );

    expect(renderer.root.findAllByType(Switch).map((node) => node.props.value))
      .toEqual([false, true, false]);
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
  test('says the choice is only for this transaction, and where the default is', async () => {
    const { renderer, texts } = await render(
      <TransactionPrivacyModal
        visible
        onDismiss={jest.fn()}
        selectedMode={PRIVACY_MODE.PUBLIC}
        onConfirm={jest.fn()}
      />,
    );
    await waitForSheetContent();

    expect(texts()).toEqual(expect.arrayContaining([
      'Transaction privacy',
      'You can change your default on advanced settings',
    ]));
    expect(renderer.root.findByType(TextFmt).props.children)
      .toBe("Choose what's hidden **only for this transaction**");
    expect(renderer.root.findAll((node) => node.props.title === 'DONE' && node.props.onPress))
      .toHaveLength(1);
  });

  test('applies the mode chosen in the sheet only on DONE', async () => {
    const onConfirm = jest.fn();
    const { renderer } = await render(
      <TransactionPrivacyModal
        visible
        onDismiss={jest.fn()}
        selectedMode={PRIVACY_MODE.HIDE_AMOUNT}
        onConfirm={onConfirm}
      />,
    );
    await waitForSheetContent();

    await act(async () => {
      renderer.root.findAllByType(Switch)[0].props.onValueChange(true);
    });
    expect(onConfirm).not.toHaveBeenCalled();

    await act(async () => {
      renderer.root.find((node) => node.props.title === 'DONE' && node.props.onPress).props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith(PRIVACY_MODE.PRIVATE);
  });

  test('offers the three modes, whatever the recipient', async () => {
    const { renderer, texts } = await render(
      <TransactionPrivacyModal
        visible
        onDismiss={jest.fn()}
        selectedMode={PRIVACY_MODE.PUBLIC}
        onConfirm={jest.fn()}
      />,
    );
    await waitForSheetContent();

    expect(renderer.root.findAllByType(Switch)).toHaveLength(3);
    expect(texts()).toEqual(expect.arrayContaining(['Private', 'Hide amount', 'Public']));
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

  test('describes each mode as the sheet does', async () => {
    const { texts } = await render(
      <PrivacyModeSelector mode={PRIVACY_MODE.PRIVATE} onPress={jest.fn()} />,
    );

    expect(texts()).toEqual(['Private', 'Token and amount hidden']);
  });
});

describe('PrivacyModeCard for the default privacy mode', () => {
  test('says the default applies to all new transactions, with each fee', async () => {
    const { texts } = await render(
      <PrivacyModeCard
        selectedMode={PRIVACY_MODE.HIDE_AMOUNT}
        onSelect={jest.fn()}
        variant={PRIVACY_MODE_CARD_VARIANT.DEFAULT}
      />,
      { decimalPlaces: 4 },
    );

    expect(texts()).toEqual([
      'Private',
      'Token and amount hidden on all new transactions',
      'Fee: 0.0002 HTR per output',
      'Hide amount',
      'Token visible, amount hidden on all new transactions',
      'Fee: 0.0001 HTR per output',
      'Public',
      'Token and amount visible on all new transactions',
      'No privacy fees',
    ]);
  });

  test("keeps a send's copy for the per-send variant", async () => {
    const { texts } = await render(
      <PrivacyModeCard
        selectedMode={PRIVACY_MODE.HIDE_AMOUNT}
        onSelect={jest.fn()}
        variant={PRIVACY_MODE_CARD_VARIANT.PER_SEND}
      />,
    );

    expect(texts()).toContain('Token visible, amount hidden');
    expect(texts().join('\n')).not.toContain('new transactions');
  });
});
