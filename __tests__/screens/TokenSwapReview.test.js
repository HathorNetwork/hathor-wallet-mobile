/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};
const TOKEN_IN = { uid: '00', name: 'Hathor', symbol: 'HTR' };
const TOKEN_OUT = { uid: '0000abcd', name: 'Token', symbol: 'TKN' };
jest.mock('../../src/hooks/navigation', () => ({
  useNavigation: () => mockNavigation,
  useParams: () => ({ quote: { path: [] }, tokenIn: TOKEN_IN, tokenOut: TOKEN_OUT }),
}));
// The swap's method and data, built for the caller; this test checks only who the caller is.
const mockSwap = ['swap', { ncId: 'pool-manager', actions: [], args: [] }];
jest.mock('../../src/utils/tokenSwap', () => ({
  ...jest.requireActual('../../src/utils/tokenSwap'),
  buildTokenSwap: jest.fn(() => mockSwap),
  selectTokenSwapContractId: () => 'pool-manager',
}));

/* eslint-disable import/first */
import React from 'react';
import { errors } from '@hathor/wallet-lib';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { reducer } from '../../src/reducers/reducer';
import {
  setFeatureToggles,
  setFullNodeNetworkName,
  setWallet,
  shieldedProviderUpdate,
} from '../../src/actions';
import {
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
} from '../../src/constants';
import { buildTokenSwap } from '../../src/utils/tokenSwap';
import { PortalProvider } from '../../src/components/Portal';
import TokenSwapReview from '../../src/screens/TokenSwapReview';
/* eslint-enable import/first */

// Testnet addresses built with wallet-lib's address encoders from fixed keys.
const P2PKH = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const SHIELDED = 'K3KokZRo7DyNRRiyijpsVix2VADrd4HeA8vWLR5itAj81BVC4Vv7xoXbrYyKYwsLMWhefXqXKgJvC6HcVkDuJ7AJ7qUMS7fVc';

// A wallet whose address at index 0 is the new address on the shielded chain, legacy otherwise.
// It fails to build the swap, which ends the screen's build.
const createWallet = () => ({
  getAddressAtIndex: jest.fn(async (index, opts) => (opts?.legacy === false ? SHIELDED : P2PKH)),
  createNanoContractTransaction: jest.fn(async () => { throw new Error('stopped by the test'); }),
});

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

/**
 * Renders the swap review of a seed wallet on the shielded testnet, on the fullnode facade, with
 * a ready provider: the shielded environment while the flag is on.
 */
async function render(wallet, { flag = true } = {}) {
  let renderer;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const store = createStore(reducer);
  store.dispatch(setFeatureToggles({
    ...FEATURE_TOGGLE_DEFAULTS,
    [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag,
  }));
  store.dispatch(setFullNodeNetworkName(FULL_NETWORK_SHIELDED_TESTNET));
  store.dispatch(shieldedProviderUpdate({ status: SHIELDED_PROVIDER_STATUS.READY }));
  store.dispatch(setWallet(wallet));

  await act(async () => {
    renderer = create(
      <Provider store={store}><PortalProvider><TokenSwapReview /></PortalProvider></Provider>,
    );
  });
  mounted = renderer;
  // BackdropModal shows its content 100 ms after it opens.
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 150); }); });
  const texts = () => renderer.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
  return { texts };
}

// A swap is a nano contract call: its caller is the legacy address at index 0 on every network.
describe('TokenSwapReview', () => {
  test.each([
    ['in the shielded environment', true],
    ['while the shielded UI is off', false],
  ])('swaps with the legacy address of the wallet %s', async (_label, flag) => {
    const wallet = createWallet();
    await render(wallet, { flag });

    expect(wallet.getAddressAtIndex).toHaveBeenCalledWith(0);
    expect(buildTokenSwap).toHaveBeenCalledWith(
      'pool-manager',
      P2PKH,
      expect.anything(),
      TOKEN_IN.uid,
      TOKEN_OUT.uid,
      expect.anything(),
    );
    expect(wallet.createNanoContractTransaction).toHaveBeenCalledWith(
      mockSwap[0],
      P2PKH,
      mockSwap[1],
      { signTx: false },
    );
  });

  test('says it could not build the swap when the address can not be read', async () => {
    const wallet = createWallet();
    wallet.getAddressAtIndex.mockRejectedValue(
      new errors.ShieldedKeyError('shielded-no-keys', 'The wallet record has no shielded keys.'),
    );
    const { texts } = await render(wallet);

    expect(wallet.createNanoContractTransaction).not.toHaveBeenCalled();
    expect(texts()).toContain('Could not build the swap transaction. Please try again.');
  });
});
