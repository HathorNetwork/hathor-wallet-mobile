/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import hathorLib, { config } from '@hathor/wallet-lib';
import { get } from 'lodash';
import {
  put,
  race,
  take,
  call,
  select,
  delay,
} from 'redux-saga/effects';
import { t } from 'ttag';
import axiosWrapperCreateRequestInstance from '@hathor/wallet-lib/lib/api/axiosWrapper';
import NavigationService from '../NavigationService';
import {
  setIsShowingPinScreen,
  types,
} from '../actions';
import {
  FEATURE_TOGGLE_DEFAULTS,
  INITIAL_TOKENS,
  PUSH_NOTIFICATION_FEATURE_TOGGLE,
  WALLET_SERVICE_FEATURE_TOGGLE,
  WALLET_SERVICE_REQUEST_TIMEOUT,
  networkSettingsKeyMap,
  MAX_RETRIES,
  INITIAL_RETRY_LATENCY,
  LATENCY_MULTIPLIER,
} from '../constants';
import { STORE } from '../store';
import { logger } from '../logger';
import { consumeAsyncIterator } from '../utils';

const log = logger('helper');

export function* waitForFeatureToggleInitialization() {
  const featureTogglesInitialized = yield select((state) => state.featureTogglesInitialized);

  if (!featureTogglesInitialized) {
    // Wait until featureToggle saga completed initialization, which includes
    // downloading the current toggle status for this client.
    yield take(types.FEATURE_TOGGLE_INITIALIZED);
  }
}

export function* checkForFeatureFlag(flag) {
  yield call(waitForFeatureToggleInitialization);

  const featureToggles = yield select((state) => state.featureToggles);

  return get(featureToggles, flag, FEATURE_TOGGLE_DEFAULTS[flag] || false);
}

/**
 * Helper method to be used on take saga effect, will wait until an action
 * with type and payload matching the passed (type, payload)
 *
 * @param {String[] | String} type - String list or a simple string with the action type(s)
 * @param {Object} payload - Object with the keys and values to compare
 */
export const specificTypeAndPayload = (_types, payload) => (action) => {
  let actionTypes = _types;

  if (!Array.isArray(_types)) {
    actionTypes = [_types];
  }

  if (actionTypes.indexOf(action.type) === -1) {
    return false;
  }

  const keys = Object.keys(payload);

  for (const key of keys) {
    const actionKey = get(action, key);
    const payloadKey = get(payload, key);

    if (actionKey !== payloadKey) {
      return false;
    }
  }

  return true;
};

/**
 * Helper method to dispatch an action and wait for the response
 *
 * @param action - The action to dispatch
 * @param successAction - The action to expect as a success
 * @param failureAction - The action to expect as a failure
 */
export function* dispatchAndWait(action, successAction, failureAction) {
  yield put(action);

  return yield race({
    success: take(successAction),
    falure: take(failureAction),
  });
}

/**
 * Handles errors thrown from the main saga (started with call) by yielding
 * an action passed as a parameter
 *
 * @param saga - The saga to call (synchronously)
 * @param failureAction - Yields this action (with put) if the main action throws
 */
export function errorHandler(saga, failureAction) {
  return function* handleAction(action) {
    try {
      yield call(saga, action);
    } catch (e) {
      console.error(`Captured error in ${action.type} saga`, e);
      yield put(failureAction);
    }
  };
}

/**
 * Opens the pin screen and waits for the user to enter the pin.
 * This method is used while processing some action on saga
 * and we need to wait for the user to enter the pin to continue.
 * @param {Function} dispatch - dispatch function from redux
 * @returns {Promise<string>} - Promise that resolves with the pin entered by the user
 */
export const showPinScreenForResult = async (dispatch) => new Promise((resolve) => {
  const params = {
    cb: (_pin) => {
      dispatch(setIsShowingPinScreen(false));
      resolve(_pin);
    },
    canCancel: false,
    screenText: t`Enter your 6-digit pin to authorize operation`,
    biometryText: t`Authorize operation`,
  };

  NavigationService.navigate('PinScreen', params);

  // We should set the global isShowingPinScreen
  dispatch(setIsShowingPinScreen(true));
});

/**
 * Check if the action is about to set screen to unlocked state.
 * @param {{ type: string, payload: boolean }} action
 * @returns {boolean} true if unlocked and false otherwise.
 */
export function isUnlockScreen(action) {
  return action.type === types.SET_LOCK_SCREEN
    && action.payload === false;
}

/**
 * Get registered tokens from the wallet instance.
 * @param {HathorWallet} wallet
 * @param {boolean} excludeHTR If we should exclude the HTR token.
 * @returns {Promise<{
 *   [uid: string]: {
 *     uid: string;
 *     symbol: string;
 *     name: string;
 *   }
 * }>}
 */
export async function getRegisteredTokens(wallet, excludeHTR = false) {
  const htrUid = hathorLib.constants.NATIVE_TOKEN_UID;
  const tokens = {};

  // redux-saga generator magic does not work well with the "for await..of" syntax
  // The asyncGenerator is not recognized as an iterable and it throws an exception
  // So we must iterate manually, awaiting each "next" call
  const iterator = wallet.storage.getRegisteredTokens();
  let next = await iterator.next();
  while (!next.done) {
    const token = next.value;
    if ((!excludeHTR) || token.uid !== htrUid) {
      tokens[token.uid] = { ...token };
    }
    // eslint-disable-next-line no-await-in-loop
    next = await iterator.next();
  }

  // XXX: This will add any default tokens configured, not only HTR
  if (!excludeHTR) {
    return { ...INITIAL_TOKENS, ...tokens };
  }

  return tokens;
}

/**
 * Retrieve registered Nano Contracts persisted on App's storage.
 * @param {Object} wallet Wallet instance
 * @return {Promise<Object[]>}
 * @async
 */
export async function getRegisteredNanoContracts(wallet) {
  return consumeAsyncIterator(wallet.storage.getRegisteredNanoContracts());
}

/**
 * Flat registered tokens to uid.
 * @param {{ tokens: Object }} Map of registered tokens by uid
 * @returns {string[]} Array of token uid
 */
export function getRegisteredTokenUids({ tokens }) {
  return Object.keys(tokens);
}

/**
 * Check if a token is registered in the context of the saga functions.
 * @param {HathorWallet} wallet
 * @param {string} tokenUid
 * @returns {Promise<boolean>}
 */
export async function isTokenRegistered(wallet, tokenUid) {
  const tokens = await getRegisteredTokens(wallet);
  return tokens[tokenUid] != null;
}

export async function getFullnodeNetwork() {
  try {
    const response = await new Promise((resolve, reject) => {
      hathorLib.versionApi.getVersion(resolve).catch((error) => {
        reject(error);
      });
    });
    return response.network;
  } catch (e) {
    log.error('Error while getting fullnode network version.', e);
    throw new Error('Error getting fullnode version data.');
  }
}

export async function getWalletServiceNetwork() {
  try {
    const timeout = WALLET_SERVICE_REQUEST_TIMEOUT;
    // eslint-disable-next-line max-len
    const instance = axiosWrapperCreateRequestInstance(config.getWalletServiceBaseUrl(), null, timeout);
    const response = await instance.get(`version`, {
      validateStatus(status) {
        return status === 200; // Only 200 status is valid
      }
    });
    // the first 'data' is from axios, the second is from payload
    return response.data.data.network;
  } catch {
    throw new Error('Error getting wallet-service version data.');
  }
}

/**
 * Check if the new custom network settings has a wallet service URL.
 * @param {object} customNetworkSettings the new network settings
 * @return {boolean} true if the new network settings hasn't defined
 *   the wallet service URL, false otherwise.
 */
export function isWalletServiceUnavailable(customNetworkSettings) {
  return customNetworkSettings.walletServiceUrl == null;
}

/**
 * Force disabling features if the custom network settings
 * didn't support them.
 * @param {object} customNetworkSettings the new network settings
 * @param {object} currentFeatureToggles feature toggles current applied
 * @return {object} an object containing the feature toggles to be applied
 */
export function disableFeaturesIfNeeded(customNetworkSettings, currentFeatureToggles) {
  let featureToggles = { ...currentFeatureToggles };
  if (isWalletServiceUnavailable(customNetworkSettings)) {
    featureToggles = {
      ...featureToggles,
      [WALLET_SERVICE_FEATURE_TOGGLE]: false,
      [PUSH_NOTIFICATION_FEATURE_TOGGLE]: false
    };
  }
  return { ...featureToggles };
}

/**
 * Retrieve the networkSettings either from storage or the state.
 * @param {object} state being the redux state containing the current networkSettings.
 */
export function getNetworkSettings(state) {
  // The state is always present, but the stored network settings
  // has precedence, once it indicates a custom network.
  return STORE.getItem(networkSettingsKeyMap.networkSettings) ?? state.networkSettings;
}

/**
 * A request abstraction that applies a progressive retry strategy.
 * One can define how many retries it should make or use the default value.
 *
 * @param {Promise<any>} request The async callback function to be executed.
 * @param {number} maxRetries The max retries allowed, with default value.
 * Notice this param should be at least 1 to make sense.
 * @returns {any} A success object from the request.
 * @throws An error after retries exhausted.
 *
 * @example
 * yield call(progressiveRetryRequest, async () => asyncFn());
 * // use default maxRetries
 *
 * @example
 * yield call(progressiveRetryRequest, async () => asyncFn(), 3);
 * // use custom maxRetries equal to 3
 */
export function* progressiveRetryRequest(request, maxRetries = MAX_RETRIES) {
  let lastError = null;

  // eslint-disable-next-line no-plusplus
  for (let i = 0; i <= maxRetries; i++) {
    try {
      // return if success
      return yield call(request)
    } catch (error) {
      lastError = error;
    }

    // skip delay for last call
    if (i === maxRetries) {
      continue;
    }

    // attempt 0: 300ms
    // attempt 1: 330ms
    // attempt 2: 420ms
    // attempt 3: 570ms
    // attempt 4: 780ms
    // attempt 5: 1050ms
    // attempt 6: 1380ms
    // attempt 7: 1770ms
    yield delay(INITIAL_RETRY_LATENCY + LATENCY_MULTIPLIER * (i * i));
  }

  // throw last error after retries exhausted
  throw lastError;
}

export function* retryHandler(retryAction, dismissAction) {
  const { retry } = yield race({
    retry: take(retryAction),
    dismiss: take(dismissAction),
  });

  return retry != null;
}

/**
 * A wrapper effect to catch unexpected error and provide a binding
 * for the desired handling behavior.
 *
 * @param {Object} effect The targeted effect.
 * @param {(error) => void} onError The error handling effect,
 *    which receives the error object as first argument.
 *
 * @returns An anonymous effect.
 */
export function safeEffect(effect, onError) {
  return function* _safeEffect(payload) {
    try {
      yield call(effect, payload);
    } catch (error) {
      yield call(onError, error);
    }
  }
}
