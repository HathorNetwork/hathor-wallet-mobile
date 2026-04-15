/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { all, call, put, select, takeLatest } from 'redux-saga/effects';
import {
  TOKEN_ICONS_BASE_URL,
  TOKEN_ICONS_TTL_MS,
  tokenIconsKeyMap,
} from '../constants';
import {
  types,
  tokenIconsManifestUpdated,
  tokenIconsFetchFailed,
} from '../actions';
import { STORE } from '../store';
import { getNetworkSettings } from './helpers';
import { logger } from '../logger';

const log = logger('tokenIcons');

function buildManifestUrl(network) {
  return `${TOKEN_ICONS_BASE_URL}/${network}/icons.json`;
}

/**
 * Builds the absolute URL for a token icon given its filename from the manifest.
 */
export function buildIconUrl(network, filename) {
  return `${TOKEN_ICONS_BASE_URL}/${network}/${filename}`;
}

function* fetchManifest() {
  const networkSettings = yield select(getNetworkSettings);
  const network = networkSettings?.network;
  if (!network) {
    return;
  }

  // Load cached manifest from storage so the UI has something while we (maybe) refetch.
  const cached = STORE.getItem(tokenIconsKeyMap.cache);
  if (cached && cached.network === network) {
    yield put(tokenIconsManifestUpdated({
      manifest: cached.manifest || {},
      network,
      lastFetched: cached.lastFetched || 0,
    }));

    const fresh = Date.now() - (cached.lastFetched || 0) < TOKEN_ICONS_TTL_MS;
    if (fresh) {
      return;
    }
  }

  try {
    const response = yield call(fetch, buildManifestUrl(network));
    if (!response.ok) {
      throw new Error(`manifest request failed: ${response.status}`);
    }
    const body = yield call([response, response.json]);
    const manifest = body?.icons || {};
    const lastFetched = Date.now();

    STORE.setItem(tokenIconsKeyMap.cache, { manifest, network, lastFetched });
    yield put(tokenIconsManifestUpdated({ manifest, network, lastFetched }));
  } catch (e) {
    log.error('Failed to fetch token icons manifest', e);
    yield put(tokenIconsFetchFailed());
  }
}

export function* saga() {
  yield all([
    takeLatest([
      types.TOKEN_ICONS_FETCH_REQUESTED,
      types.START_WALLET_SUCCESS,
      types.NETWORKSETTINGS_UPDATE_SUCCESS,
    ], fetchManifest),
  ]);
}
