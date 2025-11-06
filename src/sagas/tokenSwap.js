/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { bigIntUtils } from '@hathor/wallet-lib';
import {
  takeLatest,
  takeEvery,
  select,
  all,
  put,
  call,
  cancelled,
} from 'redux-saga/effects';
import {
  types,
  tokenSwapFetchAllowedTokensError,
  tokenSwapSetAllowedTokens,
  tokenSwapFetchQuoteSuccess,
  tokenSwapFetchQuoteFailed,
} from '../actions';
import { logger } from '../logger';
import { selectTokenSwapContractId } from '../utils';
import { findBestTokenSwap } from '../utils/tokenSwap';

const log = logger('token-swap-saga');

const ALLOWED_TOKENS_URL = 'https://wallet.swap.allowed-tokens.hathor.network'

export function* handleFetchAllowedTokensRequest() {
  const abortController = new AbortController();
  try {
    const response = yield call(fetch, ALLOWED_TOKENS_URL, { signal: abortController.signal });
    if (!response.ok) {
      log.error(`[allowed-tokens] request failed with ${response.status}`);
      yield put(tokenSwapFetchAllowedTokensError());
      return;
    }

    const allowedTokenContents = yield call(() => response.json());
    yield put(tokenSwapSetAllowedTokens(allowedTokenContents));
  } catch (err) {
    // Some error happened
    log.error(err);
    yield put(tokenSwapFetchAllowedTokensError());
    return;
  } finally {
    if (yield cancelled()) {
      abortController.abort();
    }
  }
}

function* fetchTokenSwapQuote(action) {
  const { direction, amountStr, tokenIn, tokenOut } = action.payload;
  const amount = BigInt(amountStr);

  try {
    const contractId = yield select(selectTokenSwapContractId);
    const quote = yield call(findBestTokenSwap, direction, contractId, amount, tokenIn, tokenOut);

    log.debug(`Success fetching token swap quote.`);
    yield put(tokenSwapFetchQuoteSuccess(quote));
  } catch (e) {
    log.error('Error while fetching token swap quote.', e);
    yield put(tokenSwapFetchQuoteFailed());
  } finally {
    if (yield cancelled()) {
      log.debug('token swap quote saga cancelled.');
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
    takeLatest(types.TOKEN_SWAP_FETCH_SWAP_QUOTE, fetchTokenSwapQuote),
    takeEvery(types.TOKEN_SWAP_FETCH_ALLOWED_TOKENS, handleFetchAllowedTokensRequest),
  ]);
}
