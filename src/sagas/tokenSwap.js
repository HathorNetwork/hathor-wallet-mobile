/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  takeLatest,
  takeEvery,
  select,
  all,
  put,
  call,
} from 'redux-saga/effects';
import {
  types,
  tokenSwapFetchAllowedTokensError,
  tokenSwapSetAllowedTokens,
  tokenSwapFetchQuoteSuccess,
  tokenSwapFetchSwapDataError,
  tokenSwapFetchSwapQuoteSuccess,
} from '../actions';
import { logger } from '../logger';

const log = logger('token-swap-saga');

const ALLOWED_TOKENS_URL = 'https://wallet.swap.allowed-tokens.hathor.network'

export function* handleFetchAllowedTokensRequest() {
  try {
    const response = yield call(() => fetch(ALLOWED_TOKENS_URL));
    if (!response.ok) {
      log.error(`[allowed-tokens] request failed with ${response.status}`);
      yield put(tokenSwapFetchAllowedTokensError());
      return;
    }

    const allowedTokenContents = response.json();
    yield put(tokenSwapSetAllowedTokens(allowedTokenContents));
  } catch (err) {
    // Some error happened
    log.error(err);
    yield put(tokenSwapFetchAllowedTokensError());
    return;
  }
}

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

export function* saga() {
  yield all([
    /**
     * `takeLatest` will cancel any ongoing requests if a new one arrives.
     * If the user changes any details of the swap (amounts, tokens, etc) a new request will
     * be made, this makes the last request "stale", and if it was still on-going it will be
     * cancelled by `takeLatest` so we do not show a stale quote to the user.
     */
    takeLatest(types.TOKEN_SWAP_FETCH_QUOTE, fetchTokenSwapQuote),
    takeEvery(types.TOKEN_SWAP_FETCH_ALLOWED_TOKENS, handleFetchAllowedTokensRequest),
  ]);
}
