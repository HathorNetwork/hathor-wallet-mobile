/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import { AMOUNT_FORMAT } from '../../../src/constants';
import { renderValue } from '../../../src/utils';
import FeeBreakdown from '../../../src/components/Shielded/FeeBreakdown';

async function render(props) {
  let renderer;
  await act(async () => {
    renderer = create(
      <FeeBreakdown
        total={3n}
        network={1n}
        privacy={2n}
        symbol='HTR'
        decimalPlaces={2}
        amountFormat={AMOUNT_FORMAT.EXPANDED}
        {...props}
      />,
    );
  });
  const texts = () => renderer.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
  const toggle = () => act(async () => {
    renderer.root.findByType(TouchableOpacity).props.onPress();
  });
  // The style of the innermost view that holds the expanded network and privacy fees.
  const breakdownStyle = () => {
    const holds = (node, text) => node.findAll(
      (child) => child.type === 'Text' && child.props.children === text,
    ).length > 0;
    const views = renderer.root.findAll(
      (node) => node.type === 'View' && holds(node, 'Network fee') && holds(node, 'Privacy fee'),
    );
    return StyleSheet.flatten(views[views.length - 1].props.style);
  };
  return { texts, toggle, breakdownStyle };
}

describe('FeeBreakdown', () => {
  test('shows the total, and expands into the network and the privacy fee', async () => {
    const { texts, toggle } = await render();

    expect(texts()).toEqual(['Fees', '0.03 HTR']);

    await toggle();
    expect(texts()).toEqual([
      'Fees', '0.03 HTR', 'Network fee', '0.01 HTR', 'Privacy fee', '0.02 HTR',
    ]);

    await toggle();
    expect(texts()).toEqual(['Fees', '0.03 HTR']);
  });

  test.each([
    ['network fee', { total: 2n, network: 0n, privacy: 2n }, ['Privacy fee', '0.02 HTR']],
    ['privacy fee', { total: 1n, network: 1n, privacy: 0n }, ['Network fee', '0.01 HTR']],
  ])('hides a zero %s', async (_label, fees, shown) => {
    const { texts, toggle } = await render(fees);

    await toggle();
    expect(texts().slice(2)).toEqual(shown);
  });

  test('styles the expanded fees with breakdownStyle', async () => {
    const { toggle, breakdownStyle } = await render({ breakdownStyle: { paddingTop: 8 } });

    await toggle();

    expect(breakdownStyle()).toEqual(expect.objectContaining({
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 8,
      paddingBottom: 8,
    }));
  });

  test('renders amounts with the network\'s decimal places, amount format and symbol', async () => {
    const amount = 5n;
    const { texts } = await render({
      total: amount,
      decimalPlaces: 8,
      amountFormat: AMOUNT_FORMAT.COMPRESSED,
      symbol: 'XHTR',
    });

    expect(texts()).toEqual([
      'Fees',
      `${renderValue(amount, false, 8, AMOUNT_FORMAT.COMPRESSED)} XHTR`,
    ]);
  });
});
