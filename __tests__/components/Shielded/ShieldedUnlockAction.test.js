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
import { SHIELDED_UNLOCK_SOURCE } from '../../../src/constants';
import { SHIELDED_UNLOCK_PROGRESS } from '../../../src/shielded/unlockState';
import ShieldedUnlockAction from '../../../src/components/Shielded/ShieldedUnlockAction';

const PIN = '135790';
const UNLOCK = 'Unlock private balance';

async function render(progress) {
  const actions = [];
  const recordActions = () => (next) => (action) => {
    actions.push(action);
    return next(action);
  };
  const store = createStore(reducer, applyMiddleware(recordActions));
  if (progress) {
    store.dispatch(shieldedUnlockStatusUpdate(progress));
  }
  const navigation = { navigate: jest.fn() };

  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}><ShieldedUnlockAction navigation={navigation} /></Provider>,
    );
  });
  const text = () => JSON.stringify(renderer.toJSON());
  const unlockButtons = () => renderer.root.findAll(
    (node) => node.props.title === UNLOCK && typeof node.props.onPress === 'function',
  );
  return { store, actions, navigation, renderer, text, unlockButtons };
}

describe('ShieldedUnlockAction', () => {
  test('asks for the PIN, then requests the unlock with it', async () => {
    const { store, actions, navigation, unlockButtons } = await render();

    await act(async () => { unlockButtons()[0].props.onPress(); });

    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    const [route, params] = navigation.navigate.mock.calls[0];
    expect(route).toBe('PinScreen');
    expect(params).toEqual({
      cb: expect.any(Function),
      canCancel: true,
      screenText: 'Enter your 6-digit pin to unlock your private balance',
      biometryText: UNLOCK,
    });

    await act(async () => { params.cb(PIN); });

    expect(actions.filter((action) => action.type === types.SHIELDED_VIEW_UNLOCK_REQUESTED))
      .toEqual([{
        type: types.SHIELDED_VIEW_UNLOCK_REQUESTED,
        payload: { pinCode: PIN, source: SHIELDED_UNLOCK_SOURCE.USER },
      }]);
    expect(JSON.stringify(store.getState().shielded)).not.toContain(PIN);
  });

  test.each([
    SHIELDED_UNLOCK_PROGRESS.UNLOCKING,
    SHIELDED_UNLOCK_PROGRESS.DECODING,
  ])('shows a spinner instead of the action while %s', async (status) => {
    const { renderer, unlockButtons } = await render({ status });

    expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(unlockButtons()).toHaveLength(0);
  });

  test('says when the unlock failed, and offers it again', async () => {
    const { text, unlockButtons, renderer } = await render({
      status: SHIELDED_UNLOCK_PROGRESS.FAILED,
      errorCode: 'shielded-wrong-pin',
    });

    expect(text()).toContain('Could not unlock your private balance.');
    expect(text()).not.toContain('shielded-wrong-pin');
    expect(unlockButtons()).toHaveLength(1);
    expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  });

  test('shows only the action otherwise', async () => {
    const { text, unlockButtons } = await render();

    expect(unlockButtons()).toHaveLength(1);
    expect(text()).not.toContain('Could not unlock');
  });
});
