/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { call, put } from 'redux-saga/effects';
import { shieldedProviderUpdate } from '../actions';
import { SHIELDED_PROVIDER_STATUS } from '../constants';
import { loadShieldedCryptoProvider } from '../shielded/cryptoProvider';
import { logger } from '../logger';

const log = logger('shielded-provider');

/**
 * Registers the mobile shielded crypto provider on a wallet that has not started yet, once the
 * provider passed its self-test, and records the result in state.shielded.
 *
 * It fails soft and never throws: when the provider can't be loaded or registered, the wallet
 * starts without one and runs transparent-only, so the private funds it holds stay hidden for
 * this session. The failure goes to the log and to state.shielded.providerError, with no alert
 * and nothing sent to Sentry.
 *
 * @param {HathorWallet} wallet A fullnode-facade wallet, before start()
 */
export function* registerShieldedCryptoProvider(wallet) {
  let failure;
  try {
    const { provider, error } = yield call(loadShieldedCryptoProvider);
    if (provider) {
      yield call([wallet, wallet.setShieldedCryptoProvider], provider);
      yield put(shieldedProviderUpdate({ status: SHIELDED_PROVIDER_STATUS.READY }));
      return;
    }
    failure = error;
  } catch (error) {
    failure = error;
  }

  log.error('The shielded crypto provider is not available. The wallet starts without shielded support.', failure);
  yield put(shieldedProviderUpdate({
    status: SHIELDED_PROVIDER_STATUS.FAILED,
    error: failure?.message ?? String(failure),
  }));
}
