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
// The status bar's height, which the keyboard offset of the screen counts.
jest.mock('react-native-status-bar-height', () => ({ getStatusBarHeight: () => 20 }));

/* eslint-disable import/first */
import React from 'react';
import { KeyboardAvoidingView, TextInput, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { reducer } from '../../src/reducers/reducer';
import { networkSettingsUpdateState } from '../../src/actions';
import { PRE_SETTINGS_TESTNET } from '../../src/constants';
import { STYLE } from '../../src/styles/themes';
import HathorHeader from '../../src/components/HathorHeader';
import SendAddressInput from '../../src/screens/SendAddressInput';
/* eslint-enable import/first */

// Testnet addresses built with wallet-lib's address encoders from fixed keys.
const P2PKH = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const P2SH = 'wYcywVdpeZCGzVW9DBQetyvXzWFnQXkhBf';

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
 * Renders the send address input of a wallet on the testnet.
 */
async function render() {
  const store = createStore(reducer);
  store.dispatch(networkSettingsUpdateState(PRE_SETTINGS_TESTNET));
  const element = () => <Provider store={store}><SendAddressInput /></Provider>;

  let renderer;
  await act(async () => {
    renderer = create(element());
  });
  mounted = renderer;

  const input = () => renderer.root.findByType(TextInput);
  const type = (text) => act(async () => { input().props.onChangeText(text); });
  const nextButton = () => renderer.root.find(
    (node) => node.props.title === 'Next' && typeof node.props.onPress === 'function',
  );
  // The screen gets the focus back, with the route params of the QR code scanner.
  const rerender = () => act(async () => { renderer.update(element()); });
  const texts = () => renderer.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
  return {
    renderer,
    input,
    type,
    nextButton,
    rerender,
    texts,
  };
}

describe('SendAddressInput', () => {
  test('opens the send flow, with the QR code scanner in its header', async () => {
    const { renderer } = await render();

    const header = renderer.root.findByType(HathorHeader);
    expect(header.props.title).toBe('SEND TOKENS');
    // It is the first screen of the send flow: there is nothing to go back to.
    expect(header.props.onBackPress).toBeUndefined();

    const scan = renderer.root.findAllByType(TouchableOpacity)
      .find((node) => node.props.accessibilityLabel === 'Scan QR code');
    expect(scan).toBeDefined();
    await act(async () => { scan.props.onPress(); });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('SendScanQRCode');
  });

  test('takes the address in a field that wraps it, to paste or type', async () => {
    const { input, texts } = await render();

    expect(texts()).toContain('Address to send');
    expect(input().props).toEqual(expect.objectContaining({
      placeholder: 'Paste or type address',
      multiline: true,
      autoFocus: true,
      autoCorrect: false,
      autoCapitalize: 'none',
    }));
  });

  test('enables Next only for a valid address', async () => {
    const { type, nextButton } = await render();

    expect(nextButton().props.disabled).toBe(true);
    await type('not an address');
    expect(nextButton().props.disabled).toBe(true);

    await type(P2PKH);
    expect(nextButton().props.disabled).toBe(false);
    await act(async () => { nextButton().props.onPress(); });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('SendAmountInput', { address: P2PKH });
  });

  test('fills in the address the QR code scanner returns', async () => {
    mockRouteParams = { address: P2PKH };
    const { input, rerender, nextButton } = await render();

    expect(input().props.value).toBe(P2PKH);

    mockRouteParams = { address: P2SH };
    await rerender();
    expect(input().props.value).toBe(P2SH);
    expect(nextButton().props.disabled).toBe(false);
  });

  test('keeps the button above the keyboard, under the header', async () => {
    const { renderer } = await render();

    expect(renderer.root.findByType(KeyboardAvoidingView).props.keyboardVerticalOffset)
      .toBe(20 + STYLE.headerHeight);
  });
});
