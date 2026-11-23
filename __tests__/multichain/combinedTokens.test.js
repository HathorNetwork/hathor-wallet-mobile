/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

/* eslint-disable import/first */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { reducer } from '../../src/reducers/reducer';
import { useCombinedTokens } from '../../src/multichain/hooks';
import * as gating from '../../src/multichain/gating';
import * as tokens from '../../src/multichain/tokens';
/* eslint-enable import/first */

// The Dashboard's list of both chains is built only with the side chain connected. Every user's
// Dashboard runs the hook, and a wallet's balances update one token at a time as they load.
describe('the Dashboard\'s list of both chains', () => {
  let mounted = null;
  let lists = [];
  afterEach(async () => {
    if (mounted) {
      await act(async () => { mounted.unmount(); });
      mounted = null;
    }
    lists = [];
    jest.restoreAllMocks();
  });

  const Probe = () => {
    lists.push(useCombinedTokens());
    return null;
  };

  // A store whose balances the test changes, as tokens loading one by one do.
  const render = async () => {
    const store = createStore((state, action) => (
      action.type === 'TEST_BALANCES' ? { ...state, tokensBalance: action.balances } : reducer(state, action)
    ));
    await act(async () => {
      mounted = create(<Provider store={store}><Probe /></Provider>);
    });
    for (let n = 1; n <= 3; n += 1) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        store.dispatch({ type: 'TEST_BALANCES', balances: { [`token-${n}`]: { status: 'ready' } } });
      });
    }
  };

  test('is never built while the side chain is not connected, however the balances change', async () => {
    const build = jest.spyOn(tokens, 'combinedTokenList');
    jest.spyOn(gating, 'isSideChainConnected').mockReturnValue(false);
    await render();
    expect(build).not.toHaveBeenCalled();
    expect(lists.length).toBeGreaterThan(3);
    expect(new Set(lists).size).toBe(1);
    expect(lists[0]).toEqual([]);
  });

  test('is built from the state once it is connected, again as the balances change', async () => {
    const list = [{ uid: 'row' }];
    const build = jest.spyOn(tokens, 'combinedTokenList').mockReturnValue(list);
    jest.spyOn(gating, 'isSideChainConnected').mockReturnValue(true);
    await render();
    expect(build).toHaveBeenCalledTimes(4);
    expect(lists[lists.length - 1]).toBe(list);
  });
});
