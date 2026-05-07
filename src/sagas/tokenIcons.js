/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { all, put, select, takeEvery, takeLatest } from 'redux-saga/effects';
import { TOKEN_ICONS_CACHE_KEY } from '../constants';
import {
  types,
  tokenIconsLoaded,
  tokenIconUpdated,
} from '../actions';
import { STORE } from '../store';
import { logger } from '../logger';

const log = logger('tokenIcons');

/**
 * Load cached icon URLs from storage into Redux so icons render immediately.
 */
function* loadCachedIcons() {
  try {
    const cached = STORE.getItem(TOKEN_ICONS_CACHE_KEY);
    if (cached && typeof cached === 'object') {
      yield put(tokenIconsLoaded(cached));
    }
  } catch (e) {
    log.error('Failed to read token icons cache', e);
  }
}

/**
 * Clear the persisted icon cache so stale icons from a previous network
 * are not loaded on next wallet start.
 */
function clearIconCache() {
  try {
    STORE.removeItem(TOKEN_ICONS_CACHE_KEY);
  } catch (e) {
    log.error('Failed to clear token icons cache', e);
  }
}

/**
 * When a token metadata response includes an icon URL, store it in Redux.
 */
function* onMetadataSuccess({ tokenId, data }) {
  if (data?.icon) {
    yield put(tokenIconUpdated(tokenId, data.icon));
  }
}

/**
 * After all metadata is fetched, persist the current icon map to storage.
 * This overwrites the previous cache, so unregistered tokens are pruned.
 */
function* persistIcons() {
  const tokenIcons = yield select((state) => state.tokenIcons);
  try {
    STORE.setItem(TOKEN_ICONS_CACHE_KEY, tokenIcons);
  } catch (e) {
    log.error('Failed to persist token icons cache', e);
  }
}

export function* saga() {
  yield all([
    takeLatest(types.START_WALLET_SUCCESS, loadCachedIcons),
    takeEvery(types.TOKEN_FETCH_METADATA_SUCCESS, onMetadataSuccess),
    takeLatest(types.TOKEN_METADATA_UPDATED, persistIcons),
    takeLatest(types.RESET_DATA, clearIconCache),
  ]);
}
