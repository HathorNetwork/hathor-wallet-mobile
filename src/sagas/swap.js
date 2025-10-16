/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  takeEvery,
  takeLatest,
  select,
  call,
  all,
  put,
} from 'redux-saga/effects';
import { SagaCancellationException } from 'redux-saga';
import { get } from 'lodash';
import { getNetworkSettings } from './helpers';
import { findBestTokenSwap, buildTokenSwap } from '../utils/dozer';
import {
  types,
  tokenSwapFetchQuoteSuccess,
  tokenSwapFetchQuoteFailed,
  tokenSwapSetAllowedTokens,
  tokenSwapFetchAllowedTokensError,
} from '../actions';
import { logger } from '../logger';

const log = logger('swap-saga');

const ALLOWED_TOKENS_URL = '<allowed swap tokens URI>';

function* fetchTokenSwapQuote(action) {
  const { direction, amount, tokenIn, tokenOut } = action;

  try {
    const contractId = yield select((state) => state.tokenSwap.contractId);
    const quote = yield call(findBestTokenSwap, direction, contractId, amount, tokenIn, tokenOut);

    log.debug(`Success fetching token swap quote.`);
    yield put(tokenSwapFetchQuoteSuccess(quote));
  } catch (e) {
    if (e instanceof SagaCancellationException) {
        log.debug('token swap quote saga cancelled.');
    } else {
      log.error('Error while fetching token swap quote.', e);
      yield put(tokenSwapFetchQuoteFailed());
    }
  }
}

export function* handleFetchAllowedTokensRequest() {
  try {
    const response = yield call(() => fetch(ALLOWED_TOKENS_URL));
    if (!response.ok) {
      throw new Error(`Allowed tokens request failed with ${response.status}`);
    }

    const allowedTokenContents = response.json();
    const networkSettings = yield select(getNetworkSettings);
    const network = networkSettings.network;
    const networkConfig = get(allowedTokenContents, `networks.${network}`);
    if (!networkConfig) {
      // We do not have the current network configured
      throw new Error(`${network} network is not configured on the swap tokens file.`);
    }

    const contractId = networkConfig['pool_manager'];
    const allowedTokens = networkConfig['tokens'];

    yield put(tokenSwapSetAllowedTokens(contractId, allowedTokens));
  } catch (err) {
    console.error(err);
    yield put(tokenSwapFetchAllowedTokensError());
  }
}

export function* saga() {
  yield all([
    // takeLatest will cancel any ongoing requests if a new one arrives
    // this resolves the issue of stale quote requests.
    takeLatest(types.TOKEN_SWAP_FETCH_QUOTE, fetchTokenSwapQuote),
    takeEvery(types.TOKEN_SWAP_FETCH_ALLOWED_TOKENS, handleFetchAllowedTokensRequest),
  ]);
}
