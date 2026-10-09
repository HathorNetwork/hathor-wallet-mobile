/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { reducer } from '../../src/reducers/reducer';
import { privacyDefaultModeSet, resetWalletSuccess } from '../../src/actions';
import { DEFAULT_PRIVACY_MODE, PRIVACY_MODE } from '../../src/constants';

// initialState is not exported; derive it by initializing the reducer.
const getInitialState = () => reducer(undefined, { type: '@@INIT' });

describe('privacyDefaultMode reducer', () => {
  test('starts at the default privacy mode', () => {
    expect(getInitialState().privacyDefaultMode).toBe(DEFAULT_PRIVACY_MODE);
  });

  test('sets the default privacy mode', () => {
    const next = reducer(getInitialState(), privacyDefaultModeSet(PRIVACY_MODE.PRIVATE));

    expect(next.privacyDefaultMode).toBe(PRIVACY_MODE.PRIVATE);
  });

  test('goes back to the default privacy mode on a wallet reset', () => {
    const set = reducer(getInitialState(), privacyDefaultModeSet(PRIVACY_MODE.PRIVATE));

    expect(reducer(set, resetWalletSuccess()).privacyDefaultMode).toBe(DEFAULT_PRIVACY_MODE);
  });
});
