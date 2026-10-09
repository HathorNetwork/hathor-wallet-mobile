/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect } from '@jest/globals';
import React from 'react';
import { ActivityIndicator } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import { reducer } from '../../../src/reducers/reducer';
import { shieldedUnlockStatusUpdate, types } from '../../../src/actions';
import { AMOUNT_FORMAT } from '../../../src/constants';
import { renderHomeValue } from '../../../src/utils';
import { SHIELDED_UNLOCK_PROGRESS } from '../../../src/shielded/unlockState';
import ShieldedBalanceSplit from '../../../src/components/Shielded/ShieldedBalanceSplit';

const capability = ({ undecoded, ...rest } = {}) => ({
  level: 'full',
  reason: null,
  cause: null,
  canReceive: true,
  canSpend: true,
  historyComplete: true,
  ...rest,
  undecoded: {
    txIds: [], locked: 0, unreadable: 0, error: 0, ...undecoded,
  },
});
const locked = (count, cause = 'wrong-pin') => capability({
  level: 'watch',
  reason: 'locked',
  cause,
  canReceive: false,
  canSpend: false,
  undecoded: { locked: count },
});

async function render(props, { progress } = {}) {
  const actions = [];
  const recordActions = () => (next) => (action) => {
    actions.push(action);
    return next(action);
  };
  const store = createStore(reducer, applyMiddleware(recordActions));
  if (progress) {
    store.dispatch(shieldedUnlockStatusUpdate(progress));
  }
  actions.length = 0;
  const navigation = { navigate: jest.fn() };

  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}>
        <ShieldedBalanceSplit
          available={1050n}
          privateAvailable={250n}
          capability={capability()}
          isNFT={false}
          decimalPlaces={2}
          amountFormat={AMOUNT_FORMAT.EXPANDED}
          navigation={navigation}
          {...props}
        />
      </Provider>,
    );
  });
  const texts = () => renderer.root.findAll(
    (node) => node.type === 'Text' && typeof node.props.children !== 'undefined',
  ).map((node) => [].concat(node.props.children).join(''));
  const buttonTitles = () => renderer.root
    .findAll((node) => typeof node.props.title === 'string' && typeof node.props.onPress === 'function')
    .map((node) => node.props.title);
  const press = (title) => act(async () => {
    renderer.root.find(
      (node) => node.props.title === title && typeof node.props.onPress === 'function',
    ).props.onPress();
  });
  return {
    renderer, actions, navigation, texts, buttonTitles, press,
  };
}

describe('ShieldedBalanceSplit', () => {
  test('splits the available balance into private and public parts that add up', async () => {
    const { texts, buttonTitles } = await render();

    expect(texts()).toEqual(['2.50', 'Private', '8.00', 'Public']);
    expect(buttonTitles()).toEqual([]);
  });

  test('renders the values for the home screen, in the amount format', async () => {
    const homeValue = (amount, format) => renderHomeValue(amount, false, 8, format);
    const { texts } = await render({
      available: 100000000n,
      privateAvailable: 5n,
      decimalPlaces: 8,
      amountFormat: AMOUNT_FORMAT.COMPRESSED,
    });

    expect(texts()).toEqual([
      homeValue(5n, AMOUNT_FORMAT.COMPRESSED),
      'Private',
      homeValue(99999995n, AMOUNT_FORMAT.COMPRESSED),
      'Public',
    ]);
    expect(texts()[0]).not.toBe(homeValue(5n, AMOUNT_FORMAT.EXPANDED));
  });

  test.each([
    ['unknown', undefined],
    ['unreadable', null],
  ])('renders nothing while the private part is %s', async (_label, privateAvailable) => {
    const { renderer } = await render({ privateAvailable });

    expect(renderer.toJSON()).toBeNull();
  });

  test.each([
    ['no capability yet', null],
    ['a wallet with no usable shielded keys', capability({ level: 'none', reason: 'needs-password' })],
  ])('renders nothing for %s', async (_label, current) => {
    const { renderer } = await render({ capability: current });

    expect(renderer.toJSON()).toBeNull();
  });

  test.each([
    [1, '1 private output is locked'],
    [3, '3 private outputs are locked'],
  ])('counts %s locked output, and offers to unlock them', async (count, hint) => {
    const { texts, buttonTitles } = await render({ capability: locked(count) });

    expect(texts()).toContain(hint);
    expect(buttonTitles()).toEqual(['Unlock private balance']);
  });

  test('offers the unlock to a locked wallet with nothing locked yet', async () => {
    const { texts, buttonTitles } = await render({ capability: locked(0) });

    expect(texts().join(' ')).not.toContain('locked');
    expect(buttonTitles()).toEqual(['Unlock private balance']);
  });

  test('offers no unlock for a scan key no PIN can unlock', async () => {
    const { texts, buttonTitles } = await render({ capability: locked(2, 'corrupt-key') });

    expect(texts()).toContain('2 private outputs are locked');
    expect(texts()).toContain('Private transfers are not available for this wallet.');
    expect(buttonTitles()).toEqual([]);
  });

  test('offers a retry of the private funds it could not read', async () => {
    const { texts, press, actions } = await render({
      capability: capability({ undecoded: { error: 2 } }),
    });

    expect(texts()).toContain('Some private funds could not be read.');
    await press('Retry');
    expect(actions).toEqual([{ type: types.SHIELDED_REPROCESS_REQUESTED }]);
  });

  test.each([
    SHIELDED_UNLOCK_PROGRESS.UNLOCKING,
    SHIELDED_UNLOCK_PROGRESS.DECODING,
  ])('shows a spinner instead of the actions while %s', async (status) => {
    const { renderer, buttonTitles } = await render(
      { capability: capability({ undecoded: { error: 2 } }) },
      { progress: { status } },
    );

    expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(buttonTitles()).toEqual([]);
  });

  test('says when the private balance may be incomplete', async () => {
    const { texts } = await render({ capability: capability({ historyComplete: false }) });

    expect(texts()).toContain('Your private balance may be incomplete.');
  });
});
