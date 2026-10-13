/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

// The camera isn't available in tests: the reader is a stub the test calls onSuccess of.
jest.mock('../../src/components/QRCodeReader', () => () => null);

/* eslint-disable import/first */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { reducer } from '../../src/reducers/reducer';
import HathorHeader from '../../src/components/HathorHeader';
import QRCodeReader from '../../src/components/QRCodeReader';
import SendScanQRCode from '../../src/screens/SendScanQRCode';
/* eslint-enable import/first */

// A testnet address built with wallet-lib's address encoders from fixed keys.
const P2PKH = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

let mounted = null;

afterEach(async () => {
  jest.clearAllMocks();
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
});

async function render() {
  const store = createStore(reducer);
  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}><SendScanQRCode navigation={navigation} /></Provider>,
    );
  });
  mounted = renderer;
  return renderer;
}

describe('SendScanQRCode', () => {
  test('goes back to the address input, and offers no other way to it', async () => {
    const renderer = await render();

    const header = renderer.root.findByType(HathorHeader);
    expect(header.props.title).toBe('SEND');
    expect(header.props.rightElement).toBeUndefined();
    expect(renderer.root.findAll((node) => node.props.title === 'Manual info')).toEqual([]);

    await act(async () => { header.props.onBackPress(); });
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('hands the scanned address to the address input', async () => {
    const renderer = await render();

    await act(async () => {
      await renderer.root.findByType(QRCodeReader).props.onSuccess({ data: `hathor:${P2PKH}` });
    });
    expect(navigation.navigate).toHaveBeenCalledWith('SendAddressInput', { address: P2PKH });
  });
});
