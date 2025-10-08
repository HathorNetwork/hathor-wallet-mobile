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
  // XXX: We could have an AbortionController for cancellation
  let allowedTokenContents;
  try {
    const response = yield call(() => fetch(ALLOWED_TOKENS_URL));
    if (!response.ok) {
      throw new Error();
    }

    allowedTokenContents = response.json();
  } catch (err) {
    // Some error happened
    console.error(err);
    yield put(tokenSwapFetchAllowedTokensError());
  }

  // Allowed tokens were fetched, we need to get the correct list from our current network
  const network = 'testnet'; // XXX: get network from wallet?
  const networkConfig = get(allowedTokenContents, `networks.${network}`);
  if (!networkConfig) {
    // We do not have the current network configured
    console.warn(`${network} network is not configured on the swap tokens file.`);
    yield put(tokenSwapFetchAllowedTokensError());
  }
  
  const contractId = networkConfig['swap_contract'];
  const allowedTokens = networkConfig['tokens'];

  yield put(tokenSwapSetAllowedTokens(contractId, allowedTokens));
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
