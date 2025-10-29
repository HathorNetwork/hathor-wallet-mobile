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
  cancel,
  cancelled,
  all,
  put,
  call,
  race,
  take,
  fork,
  spawn,
} from 'redux-saga/effects';
import { get, isEmpty } from 'lodash';
import {
  types,
  tokenSwapFetchAllowedTokensError,
  tokenSwapSetAllowedTokens,
  tokenSwapFetchSwapDataError,
  tokenSwapFetchSwapQuoteSuccess,
} from '../actions';

const ALLOWED_TOKENS_URL = 'https://httpbin.org/json'

export function* handleFetchAllowedTokensRequest() {
  const obj = {
    pool_manager: 'fake-contract-id',
    tokens: [
      { symbol: 'HTR', name: 'Hathor', uid: '00' },
      { symbol: 'CTHOR', name: 'Cathor', uid: '00000000f76262bb1cca969d952ac2f0e85f88ec34c31f26a13eb3c31e29d4ed' },
    ],
  };
  yield put(tokenSwapSetAllowedTokens({
    networks: {
      testnet: obj,
      mainnet: obj,
    }
  }));
  return;

  // XXX: We could have an AbortionController for cancellation
  let allowedTokenContents;
  try {
    const response = yield call(() => fetch(ALLOWED_TOKENS_URL));
    if (!response.ok) {
      console.error(`[allowed-tokens] request failed with ${response.status}`);
      yield put(tokenSwapFetchAllowedTokensError());
      return;
    }

    allowedTokenContents = response.json();
  } catch (err) {
    // Some error happened
    console.error(err);
    yield put(tokenSwapFetchAllowedTokensError());
    return;
  }

  yield put(tokenSwapSetAllowedTokens(allowedTokenContents));
}


export function* handleFetchSwapQuoteRequest() {
  try {
    const swapQuote = yield call(getSwapQuote);
    // put swap quote and calculate amount?
    yield put(tokenSwapFetchSwapQuoteSuccess(swapQuote));
  } catch (err) {
    // Some error happened
    console.error(err);
    yield put(tokenSwapFetchSwapDataError());
  } finally {
    if (yield cancelled()) {
      // This task has been cancelled, we should just ignore changes?
    }
  }
}

export function* saga() {
  yield all([
    takeLatest(types.TOKEN_SWAP_FETCH_ALLOWED_TOKENS, handleFetchAllowedTokensRequest),
    // takeLatest(types.TOKEN_SWAP_FETCH_SWAP_QUOTE, handleFetchAllowedTokensRequest),
    // takeEvery(types.TOKEN_SWAP_START_SWAP, handleFetchAllowedTokensRequest),
  ]);
}
