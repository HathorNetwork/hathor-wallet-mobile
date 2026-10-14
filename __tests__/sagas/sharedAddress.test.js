/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect } from '@jest/globals';
import { runSaga } from 'redux-saga';
import { refreshSharedAddress } from '../../src/sagas/wallet';
import { sharedAddressUpdate } from '../../src/actions';
import {
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
} from '../../src/constants';

const LEGACY_ADDRESS = 'LEGACY_ADDRESS_2';

/**
 * Runs refreshSharedAddress for a seed wallet on the shielded testnet, on the fullnode facade,
 * with a ready provider, unless told otherwise, and the shielded UI flag as given. The wallet's
 * legacy read waits until the test finishes it.
 */
function run({
  flag,
  network = FULL_NETWORK_SHIELDED_TESTNET,
  providerStatus = SHIELDED_PROVIDER_STATUS.READY,
  useWalletService = false,
}) {
  let finishRead;
  const wallet = {
    getCurrentAddress: jest.fn(() => new Promise((resolve) => { finishRead = resolve; })),
  };
  let state = {
    wallet,
    useWalletService,
    fullNodeNetworkName: network,
    featureToggles: { ...FEATURE_TOGGLE_DEFAULTS, [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag },
    shielded: { providerStatus },
  };
  const dispatched = [];
  const task = runSaga(
    { dispatch: (action) => dispatched.push(action), getState: () => state },
    refreshSharedAddress,
  );
  return {
    wallet,
    dispatched,
    task,
    finishRead: () => finishRead({ address: LEGACY_ADDRESS, index: 2 }),
    setFlag: (next) => {
      state = {
        ...state,
        featureToggles: { ...state.featureToggles, [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: next },
      };
    },
  };
}

describe('refreshSharedAddress', () => {
  test.each([
    ['the shielded UI is off', { flag: false }],
    ['the node reports another network', {
      flag: true,
      network: 'testnet',
      providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED,
    }],
    ['the wallet runs on the wallet-service facade', { flag: true, useWalletService: true }],
  ])('shares the wallet\'s current legacy address while %s', async (_label, options) => {
    const { wallet, dispatched, task, finishRead } = run(options);

    finishRead();
    await task.toPromise();

    expect(wallet.getCurrentAddress).toHaveBeenCalledWith();
    expect(dispatched).toEqual([sharedAddressUpdate(LEGACY_ADDRESS, 2)]);
  });

  test('leaves the shared address to the shielded saga in the shielded environment', async () => {
    const { wallet, dispatched, task } = run({ flag: true });

    await task.toPromise();

    expect(wallet.getCurrentAddress).not.toHaveBeenCalled();
    expect(dispatched).toEqual([]);
  });

  test('drops the legacy address when the shielded UI turned on during the read', async () => {
    const { dispatched, task, finishRead, setFlag } = run({ flag: false });

    setFlag(true);
    finishRead();
    await task.toPromise();

    expect(dispatched).toEqual([]);
  });
});
