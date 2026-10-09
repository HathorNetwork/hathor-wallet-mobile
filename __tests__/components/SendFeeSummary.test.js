/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect, afterEach } from '@jest/globals';
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import { AMOUNT_FORMAT } from '../../src/constants';
import { PortalProvider } from '../../src/components/Portal';
import FeeBreakdown from '../../src/components/Shielded/FeeBreakdown';
import SendFeeSummary from '../../src/components/SendFeeSummary';

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
});

async function render(fees) {
  let renderer;
  await act(async () => {
    renderer = create(
      <PortalProvider>
        <SendFeeSummary
          fees={fees}
          symbol='HTR'
          decimalPlaces={2}
          amountFormat={AMOUNT_FORMAT.EXPANDED}
        />
      </PortalProvider>,
    );
  });
  mounted = renderer;
  const texts = () => renderer.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
  const breakdown = () => renderer.root.findByType(FeeBreakdown);
  // The row of the total toggles the breakdown; the info icon opens the sheet.
  const [totalRow, infoIcon] = renderer.root.findAllByType(TouchableOpacity);
  const toggle = () => act(async () => { totalRow.props.onPress(); });
  const openInfo = async () => {
    await act(async () => { infoIcon.props.onPress(); });
    // BackdropModal shows its content 100 ms after it opens.
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 150); }); });
  };
  return { texts, breakdown, toggle, openInfo };
}

describe('SendFeeSummary', () => {
  test('shows the total, and expands into the network fee and the privacy fee of each output', async () => {
    const { texts, toggle } = await render({
      total: 4n, network: 1n, privacy: 3n, privateOutputs: 2,
    });

    expect(texts()).toEqual(['Fees', '0.04 HTR']);

    await toggle();
    expect(texts()).toEqual([
      'Fees', '0.04 HTR',
      'Network fee', '0.01 HTR',
      'Privacy fee', '2 private outputs', '0.03 HTR',
    ]);
  });

  test('counts a single private output in the singular', async () => {
    const { texts, toggle } = await render({
      total: 2n, network: 0n, privacy: 2n, privateOutputs: 1,
    });

    await toggle();
    expect(texts()).toEqual(['Fees', '0.02 HTR', 'Privacy fee', '1 private output', '0.02 HTR']);
  });

  test('explains the privacy fee in its info sheet', async () => {
    const { texts, openInfo } = await render({
      total: 3n, network: 0n, privacy: 3n, privateOutputs: 2,
    });

    expect(texts()).not.toContain('Transaction fees');

    await openInfo();
    expect(texts()).toContain('Transaction fees');
    expect(texts().join('\n')).toMatch(/keeps its change private, so it can pay a privacy fee even when the payment is public/);
  });

  test('passes the fees to the breakdown the tx details use', async () => {
    const { breakdown } = await render({
      total: 3n, network: 0n, privacy: 3n, privateOutputs: 2,
    });

    expect(breakdown().props).toEqual(expect.objectContaining({
      total: 3n,
      network: 0n,
      privacy: 3n,
      privateOutputs: 2,
      symbol: 'HTR',
      decimalPlaces: 2,
    }));
  });
});
