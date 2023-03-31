/* eslint-disable max-len */
/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { chunk } from 'lodash';
import {
  constants as hathorLibConstants,
  metadataApi,
} from '@hathor/wallet-lib';
import {
  METADATA_CONCURRENT_DOWNLOAD,
} from './constants';
import { mapTokenHistory } from './utils';

export const types = {
  PARTIALLY_UPDATE_HISTORY_AND_BALANCE: 'PARTIALLY_UPDATE_HISTORY_AND_BALANCE',
  SET_TEMP_PIN: 'SET_TEMP_PIN',
  SET_RECOVERING_PIN: 'SET_RECOVERING_PIN',
  HISTORY_UPDATE: 'HISTORY_UPDATE',
  NEW_TX: 'NEW_TX',
  BALANCE_UPDATE: 'BALANCE_UPDATE',
  NEW_INVOICE: 'NEW_INVOICE',
  CLEAR_INVOICE: 'CLEAR_INVOICE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CLEAR_NETWORK_ERROR: 'CLEAR_NETWORK_ERROR',
  RESET_DATA: 'RESET_DATA',
  UPDATE_SELECTED_TOKEN: 'UPDATE_SELECTED_TOKEN',
  NEW_TOKEN: 'NEW_TOKEN',
  SET_TOKENS: 'SET_TOKENS',
  FETCH_HISTORY_BEGIN: 'FETCH_HISTORY_BEGIN',
  FETCH_HISTORY_SUCCESS: 'FETCH_HISTORY_SUCCESS',
  FETCH_HISTORY_ERROR: 'FETCH_HISTORY_ERROR',
  UPDATE_TOKEN_HISTORY: 'UPDATE_TOKEN_HISTORY',
  SET_LOAD_HISTORY_STATUS: 'SET_LOAD_HISTORY_STATUS',
  SET_IS_ONLINE: 'SET_IS_ONLINE',
  SET_SERVER_INFO: 'SET_SERVER_INFO',
  ACTIVATE_FETCH_HISTORY: 'ACTIVATE_FETCH_HISTORY',
  SET_LOCK_SCREEN: 'SET_LOCK_SCREEN',
  SET_RESET_ON_LOCK_SCREEN: 'SET_RESET_ON_LOCK_SCREEN',
  SET_INIT_WALLET: 'SET_INIT_WALLET',
  UPDATE_HEIGHT: 'UPDATE_HEIGHT',
  SHOW_ERROR_MODAL: 'SHOW_ERROR_MODAL',
  HIDE_ERROR_MODAL: 'HIDE_ERROR_MODAL',
  SET_WALLET: 'SET_WALLET',
  RESET_WALLET: 'RESET_WALLET',
  RESET_WALLET_SUCCESS: 'RESET_WALLET_SUCCESS',
  RESET_LOADED_DATA: 'RESET_LOADED_DATA',
  UPDATE_LOADED_DATA: 'UPDATE_LOADED_DATA',
  SET_USE_WALLET_SERVICE: 'SET_USE_WALLET_SERVICE',
  TOKEN_METADATA_UPDATED: 'TOKEN_METADATA_UPDATED',
  TOKEN_METADATA_REMOVED: 'TOKEN_METADATA_REMOVED',
  TOKEN_METADATA_LOADED: 'TOKEN_METADATA_LOADED',
  SET_UNIQUE_DEVICE_ID: 'SET_UNIQUE_DEVICE_ID',
  SET_IS_SHOWING_PIN_SCREEN: 'SET_IS_SHOWING_PIN_SCREEN',
  TOKEN_FETCH_METADATA_REQUESTED: 'TOKEN_FETCH_METADATA_REQUESTED',
  TOKEN_FETCH_METADATA_SUCCESS: 'TOKEN_FETCH_METADATA_SUCCESS',
  TOKEN_FETCH_METADATA_FAILED: 'TOKEN_FETCH_METADATA_FAILED',
  TOKEN_FETCH_BALANCE_REQUESTED: 'TOKEN_FETCH_BALANCE_REQUESTED',
  TOKEN_FETCH_BALANCE_SUCCESS: 'TOKEN_FETCH_BALANCE_SUCCESS',
  TOKEN_FETCH_BALANCE_FAILED: 'TOKEN_FETCH_BALANCE_FAILED',
  TOKEN_INVALIDATE_BALANCE: 'TOKEN_INVALIDATE_BALANCE',
  TOKEN_FETCH_HISTORY_REQUESTED: 'TOKEN_FETCH_HISTORY_REQUESTED',
  TOKEN_FETCH_HISTORY_SUCCESS: 'TOKEN_FETCH_HISTORY_SUCCESS',
  TOKEN_FETCH_HISTORY_FAILED: 'TOKEN_FETCH_HISTORY_FAILED',
  TOKEN_INVALIDATE_HISTORY: 'TOKEN_INVALIDATE_HISTORY',
  ON_START_WALLET_LOCK: 'ON_START_WALLET_LOCK',
  RELOAD_WALLET_REQUESTED: 'RELOAD_WALLET_REQUESTED',
  START_WALLET_REQUESTED: 'START_WALLET_REQUESTED',
  START_WALLET_SUCCESS: 'START_WALLET_SUCCESS',
  START_WALLET_FAILED: 'START_WALLET_FAILED',
  START_WALLET_NOT_STARTED: 'START_WALLET_NOT_STARTED',
  WALLET_STATE_READY: 'WALLET_STATE_READY',
  WALLET_STATE_ERROR: 'WALLET_STATE_ERROR',
  WALLET_RELOADING: 'WALLET_RELOADING',
  CAMERA_PERMISSION_REQUESTED: 'CAMERA_PERMISSION_REQUESTED',
  SET_CAMERA_AVAILABLE: 'SET_CAMERA_AVAILABLE',
  // Push Notification actions
  INIT_PUSH_NOTIFICATION: 'INIT_PUSH_NOTIFICATION',
  SET_AVAILABLE_PUSH_NOTIFICATION: 'SET_AVAILABLE_PUSH_NOTIFICATION',
  PUSH_ASK_OPT_IN_QUESTION: 'PUSH_ASK_OPT_IN_QUESTION',
  PUSH_DISMISS_OPT_IN_QUESTION: 'PUSH_DISMISS_OPT_IN_QUESTION',
  PUSH_ASK_REGISTRATION_REFRESH_QUESTION: 'PUSH_ASK_REGISTRATION_REFRESH_QUESTION',
  PUSH_DISMISS_REGISTRATION_REFRESH_QUESTION: 'PUSH_DISMISS_REGISTRATION_REFRESH_QUESTION',
  PUSH_SET_STATE: 'PUSH_SET_STATE',
  PUSH_UPDATE_DEVICE_ID: 'PUSH_UPDATE_DEVICE_ID',
  PUSH_API_READY: 'PUSH_API_READY',
  PUSH_WALLET_LOAD_REQUESTED: 'PUSH_WALLET_LOAD_REQUESTED',
  PUSH_WALLET_LOAD_SUCCESS: 'PUSH_WALLET_LOAD_SUCCESS',
  PUSH_WALLET_LOAD_FAILED: 'PUSH_WALLET_LOAD_FAILED',
  PUSH_REGISTRATION_REQUESTED: 'PUSH_REGISTRATION_REQUESTED',
  PUSH_REGISTER_SUCCESS: 'PUSH_REGISTER_SUCCESS',
  PUSH_REGISTER_FAILED: 'PUSH_REGISTER_FAILED',
  PUSH_TX_DETAILS_REQUESTED: 'PUSH_TX_DETAILS_REQUESTED',
  PUSH_TX_DETAILS_SUCCESS: 'PUSH_TX_DETAILS_SUCCESS',
  PUSH_CLEAN_TX_DETAILS: 'PUSH_CLEAN_TX_DETAILS',
  PUSH_RESET: 'PUSH_RESET',
  WALLET_REFRESH_SHARED_ADDRESS: 'WALLET_REFRESH_SHARED_ADDRESS',
  SHARED_ADDRESS_UPDATE: 'SHARED_ADDRESS_UPDATE',
  EXCEPTION_CAPTURED: 'EXCEPTION_CAPTURED',
  SET_UNLEASH_CLIENT: 'SET_UNLEASH_CLIENT',
  SET_FEATURE_TOGGLES: 'SET_FEATURE_TOGGLES',
  FEATURE_TOGGLE_INITIALIZED: 'FEATURE_TOGGLE_INITIALIZED',
  SET_WALLET_CONNECT: 'SET_WALLET_CONNECT',
  SET_WALLET_CONNECT_MODAL: 'SET_WALLET_CONNECT_MODAL',
  SET_WALLET_CONNECT_SESSIONS: 'SET_WALLET_CONNECT_SESSIONS',
  WC_QRCODE_READ: 'WC_QRCODE_READ',
  SET_UNLEASH_CLIENT: 'SET_UNLEASH_CLIENT',
  SET_FEATURE_TOGGLES: 'SET_FEATURE_TOGGLES',
  FEATURE_TOGGLE_INITIALIZED: 'FEATURE_TOGGLE_INITIALIZED',
};

export const featureToggleInitialized = () => ({
  type: types.FEATURE_TOGGLE_INITIALIZED,
});

/**
 * toggles {Object} Key value object where the key is the feature toggle name and the value
 * indicates whether it is on (true) or off (false)
 */
export const setFeatureToggles = (toggles) => ({
  type: types.SET_FEATURE_TOGGLES,
  payload: toggles,
});

/**
 * unleashClient {UnleashClient} The unleash client to store
 */
export const setUnleashClient = (unleashClient) => ({
  type: types.SET_UNLEASH_CLIENT,
  payload: unleashClient,
});

export const setWalletConnectSessions = (sessions) => ({
  type: types.SET_WALLET_CONNECT_SESSIONS,
  payload: sessions,
});

export const setWalletConnectModal = (modal) => ({
  type: types.SET_WALLET_CONNECT_MODAL,
  payload: modal,
});

/**
 * isShowingPinScreen {bool}
 * */
export const setIsShowingPinScreen = (isShowingPinScreen) => ({
  type: types.SET_IS_SHOWING_PIN_SCREEN,
  payload: isShowingPinScreen,
});

/**
 * status {bool} True for connected, and False for disconnected.
 * */
export const setIsOnline = (status) => ({ type: types.SET_IS_ONLINE, payload: status });

/**
 * version {str} version of the connected server (e.g., 0.26.0-beta)
 * network {str} network of the connected server (e.g., mainnet, testnet)
 * */
export const setServerInfo = ({ version, network }) => (
  { type: types.SET_SERVER_INFO, payload: { version, network } }
);

/**
 * tx {Object} the new transaction
 * updatedBalanceMap {Object} balance map updated for each token in this tx
 */
export const newTx = (tx, updatedBalanceMap) => (
  { type: types.NEW_TX, payload: { tx, updatedBalanceMap } }
);

/**
 * address {String} address to each payment should be sent
 * amount {int} amount to be paid
 * token {Object} token we're expecting to receive
 */
export const newInvoice = (address, amount, token) => (
  { type: types.NEW_INVOICE, payload: { address, amount, token } }
);

export const clearInvoice = () => ({ type: types.CLEAR_INVOICE });

export const resetData = () => ({ type: types.RESET_DATA });

/**
 * selectedToken {Object} new token selected
 */
export const updateSelectedToken = (selectedToken) => (
  { type: types.UPDATE_SELECTED_TOKEN, payload: selectedToken }
);

/**
 * newToken {Object} new token added
 */
export const newToken = (token) => ({ type: types.NEW_TOKEN, payload: token });

/**
 * tokens {Array} list of tokens to update state
 */
export const setTokens = (tokens) => ({ type: types.SET_TOKENS, payload: tokens });

export const fetchHistoryBegin = () => ({ type: types.FETCH_HISTORY_BEGIN });

/**
 * data {Object} { tokensHistory, tokensBalance } history and balance for each token
 */
export const fetchHistorySuccess = (data) => (
  { type: types.FETCH_HISTORY_SUCCESS, payload: data }
);

/**
 * data {Object} { tokensHistory, tokensBalance } history and balance for each token
 */
export const partiallyUpdateHistoryAndBalance = (data) => (
  { type: types.PARTIALLY_UPDATE_HISTORY_AND_BALANCE, payload: data }
);

export const fetchHistoryError = () => ({ type: types.FETCH_HISTORY_ERROR });

export const setLoadHistoryStatus = (active, error) => (
  { type: types.SET_LOAD_HISTORY_STATUS, payload: { active, error } }
);

export const setUseWalletService = (data) => ({
  type: types.SET_USE_WALLET_SERVICE,
  payload: data,
});

export const setUniqueDeviceId = (uniqueId) => ({
  type: types.SET_UNIQUE_DEVICE_ID,
  payload: uniqueId,
});

/**
 * Action to set the screen unlocked.
 * @returns action
 */
export const unlockScreen = () => ({ type: types.SET_LOCK_SCREEN, payload: false });

/**
 * Action to set the screen locked.
 * @returns action
 */
export const lockScreen = () => ({ type: types.SET_LOCK_SCREEN, payload: true });

/**
 * Action to set the reset on screen locked.
 * @returns action
 */
export const resetOnLockScreen = () => ({ type: types.SET_RESET_ON_LOCK_SCREEN, payload: true });

/**
 * Action to drop the reset on screen locked.
 * @returns action
 */
export const dropResetOnLockScreen = () => ({ type: types.SET_RESET_ON_LOCK_SCREEN, payload: false });

/**
 * height {number} new height of the network
 * htrBalance {Object} new balance of HTR
 */
export const updateHeight = (height, htrBalance) => (
  { type: types.UPDATE_HEIGHT, payload: { height, htrBalance } }
);

export const updateTokenHistory = (token, newHistory) => (
  { type: types.UPDATE_TOKEN_HISTORY, payload: { token, newHistory } }
);

/**
 * Get all tokens that this wallet has any transaction and fetch balance/history for each of them
 * We could do a lazy history load only when the user selects to see the token
 * but this would change the behaviour of the wallet and was not the goal of this moment
 * We should do this in the future anwyay
 *
 * wallet {HathorWallet | HathorWalletServiceWallet} wallet object
 */
export const fetchHistoryAndBalance = async (wallet) => {
  // First we get the tokens in the wallet
  const tokens = await wallet.getTokens();

  const tokensHistory = {};
  const tokensBalance = {};
  for (const token of tokens) {
    /* eslint-disable no-await-in-loop */
    const balance = await wallet.getBalance(token);
    const tokenBalance = balance[0].balance;
    tokensBalance[token] = { available: tokenBalance.unlocked, locked: tokenBalance.locked };
    const history = await wallet.getTxHistory({ token_id: token });
    tokensHistory[token] = history.map((element) => mapTokenHistory(element, token));
    /* eslint-enable no-await-in-loop */
  }

  return { tokensHistory, tokensBalance };
};

/**
 * Fetch paginated history for specific token
 *
 * wallet {HathorWallet | HathorWalletServiceWallet} wallet object
 * token {string} Token uid
 * history {Array} current token history array
 */
export const fetchMoreHistory = async (wallet, token, history) => {
  const newHistory = await wallet.getTxHistory({ token_id: token, skip: history.length });
  const newHistoryObjects = newHistory.map((element) => mapTokenHistory(element, token));

  return newHistoryObjects;
};

/**
 * The wallet needs each token metadata to show information correctly
 * So we fetch the tokens metadata and store on redux
 *
 * @param {Array} tokens Array of token uids
 * @param {String} network Network name
 *
 * @memberof Wallet
 * @inner
 */
export const fetchTokensMetadata = async (tokens, network) => {
  const metadataPerToken = {};

  const tokenChunks = chunk(tokens, METADATA_CONCURRENT_DOWNLOAD);
  for (const tokenChunk of tokenChunks) {
    /* eslint-disable no-await-in-loop */
    await Promise.all(tokenChunk.map(async (token) => {
      if (token === hathorLibConstants.HATHOR_TOKEN_CONFIG.uid) {
        return;
      }

      try {
        const data = await metadataApi.getDagMetadata(token, network);
        // When the getDagMetadata method returns null
        // it means that we have no metadata for this token
        if (data) {
          const tokenMeta = data[token];
          metadataPerToken[token] = tokenMeta;
        }
      } catch (e) {
        // Error downloading metadata, then we should wait a few seconds
        // and retry if still didn't reached retry limit
        // eslint-disable-next-line
        console.log('Error downloading metadata of token', token);
      }
    }));
    /* eslint-enable no-await-in-loop */
  }

  return metadataPerToken;
};

/**
 * After a new transaction arrives in the websocket we must
 * fetch the new balance for each token on it and use
 * this new data to update redux info
 *
 * wallet {HathorWallet | HathorWalletServiceWallet} wallet object
 * tx {Object} full transaction object from the websocket
 */
export const fetchNewTxTokenBalance = async (wallet, tx) => {
  if (!wallet.isReady()) {
    return null;
  }
  const updatedBalanceMap = {};
  const balances = await wallet.getTxBalance(tx);
  // we now loop through all tokens present in the new tx to get the new balance
  for (const [tokenUid] of Object.entries(balances)) {
    /* eslint-disable no-await-in-loop */
    updatedBalanceMap[tokenUid] = await fetchTokenBalance(wallet, tokenUid);
  }
  return updatedBalanceMap;
};

/**
 * Method that fetches the balance of a token
 * and pre process for the expected format
 *
 * wallet {HathorWallet | HathorWalletServiceWallet} wallet object
 * uid {String} Token uid to fetch balance
 */
export const fetchTokenBalance = async (wallet, uid) => {
  if (!wallet.isReady()) {
    // We can safely do nothing here since we will fetch all history and balance
    // as soon as the wallets gets ready
    return null;
  }
  const balance = await wallet.getBalance(uid);
  const tokenBalance = balance[0].balance;
  return { available: tokenBalance.unlocked, locked: tokenBalance.locked };
};

/**
 * Fetch HTR balance
 *
 * wallet {HathorWallet | HathorWalletServiceWallet} wallet object
 */
export const fetchNewHTRBalance = async (wallet) => {
  const { uid } = hathorLibConstants.HATHOR_TOKEN_CONFIG;
  return fetchTokenBalance(wallet, uid);
};

export const resetLoadedData = () => (
  { type: types.RESET_LOADED_DATA }
);

export const updateLoadedData = (payload) => (
  { type: types.UPDATE_LOADED_DATA, payload }
);

/**
 * errorReported {boolean} true if user reported the error to sentry
 */
export const showErrorModal = (errorReported) => ({
  type: types.SHOW_ERROR_MODAL,
  payload: errorReported,
});
export const hideErrorModal = () => ({ type: types.HIDE_ERROR_MODAL });

/**
 * wallet {HathorWallet} wallet object
 */
export const setWallet = (wallet) => (
  { type: types.SET_WALLET, payload: wallet }
);

export const resetWallet = () => ({
  type: types.RESET_WALLET,
});

export const resetWalletSuccess = () => ({
  type: types.RESET_WALLET_SUCCESS,
});

/**
 * Update metadata object with new data
 *
 * data {Object} object with token metadata
 */
export const tokenMetadataUpdated = (data) => (
  { type: types.TOKEN_METADATA_UPDATED, payload: { data } }
);

/**
 * Set if metadata was already loaded from the lib
 *
 * data {boolean} If metadata is loaded or not
 */
export const tokenMetadataLoaded = (data) => ({ type: types.TOKEN_METADATA_LOADED, payload: data });

/**
 * Remove token metadata after unregister token
 *
 * data {String} Token uid to remove from metadata
 */
export const tokenMetadataRemoved = (data) => (
  { type: types.TOKEN_METADATA_REMOVED, payload: data }
);

/**
 * Sets or unsets the user PIN
 *
 * data {string} The user PIN or null
 */
export const setTempPin = (data) => (
  { type: types.SET_TEMP_PIN, payload: data }
);

/**
 * tokenId: The tokenId to request history from
 * force: Should we ignore the stored data?
 */
export const tokenFetchHistoryRequested = (tokenId, force) => ({
  type: types.TOKEN_FETCH_HISTORY_REQUESTED,
  tokenId,
  force,
});

/**
 * tokenId: The tokenId to store history data
 * data: The downloaded history data
 */
export const tokenFetchHistorySuccess = (tokenId, data) => ({
  type: types.TOKEN_FETCH_HISTORY_SUCCESS,
  tokenId,
  data,
});

/**
 * tokenId: The tokenId of the history request
 */
export const tokenFetchHistoryFailed = (tokenId) => ({
  type: types.TOKEN_FETCH_HISTORY_FAILED,
  tokenId,
});

/**
 * tokenId: The tokenId of the invalidate history request
 */
export const tokenInvalidateHistory = (tokenId) => ({
  type: types.TOKEN_INVALIDATE_HISTORY,
  tokenId,
});

/**
 * tokenId: The tokenId to request balance from
 * force: Should we ignore the stored data?
 */
export const tokenFetchBalanceRequested = (tokenId, force) => ({
  type: types.TOKEN_FETCH_BALANCE_REQUESTED,
  tokenId,
  force,
});

/**
 * tokenId: The tokenId to store balance data
 * data: The downloaded history data
 */
export const tokenFetchBalanceSuccess = (tokenId, data) => ({
  type: types.TOKEN_FETCH_BALANCE_SUCCESS,
  tokenId,
  data,
});

/**
 * tokenId: The tokenId of the balance request
 */
export const tokenFetchBalanceFailed = (tokenId) => ({
  type: types.TOKEN_FETCH_BALANCE_FAILED,
  tokenId,
});

export const tokenInvalidateBalance = (tokenId) => ({
  type: types.TOKEN_INVALIDATE_BALANCE,
  tokenId,
});

export const reloadWalletRequested = () => ({
  type: types.RELOAD_WALLET_REQUESTED,
});

export const startWalletRequested = (payload) => ({
  type: types.START_WALLET_REQUESTED,
  payload,
});

export const startWalletFailed = () => ({
  type: types.START_WALLET_FAILED,
});

export const startWalletSuccess = () => ({
  type: types.START_WALLET_SUCCESS,
});

export const onStartWalletLock = () => ({
  type: types.ON_START_WALLET_LOCK,
});

export const walletStateError = () => ({
  type: types.WALLET_STATE_ERROR,
});

export const walletStateReady = () => ({
  type: types.WALLET_STATE_READY,
});

export const onWalletReload = () => ({
  type: types.WALLET_RELOADING,
});

export const requestCameraPermission = () => ({
  type: types.CAMERA_PERMISSION_REQUESTED,
});

/**
 * @param {boolean} isAvailable True if the camera should be skipped
 */
export const setCameraAvailable = (isAvailable) => ({
  type: types.SET_CAMERA_AVAILABLE,
  payload: isAvailable,
});

// Push notification actions

export const initPushNotification = () => ({
  type: types.INIT_PUSH_NOTIFICATION,
});

/**
 * @param {boolean} payload - true if unleash enables the push notification feature
 */
export const setAvailablePushNotification = (payload) => ({
  type: types.SET_AVAILABLE_PUSH_NOTIFICATION,
  payload,
});

/**
 * Ask user if he wants to opt-in push notifications
 */
export const pushAskOptInQuestion = () => ({
  type: types.PUSH_ASK_OPT_IN_QUESTION,
});

/**
 * User will no longer be asked to opt-in push notifications
 */
export const pushDismissOptInQuestion = () => ({
  type: types.PUSH_DISMISS_OPT_IN_QUESTION,
});

/**
 * Ask user to refresh the push notification settings
 */
export const pushAskRegistrationRefreshQuestion = () => ({
  type: types.PUSH_ASK_REGISTRATION_REFRESH_QUESTION,
});

/**
 * Dismiss the modal to refresh the push notification settings
 */
export const pushDismissRegistrationRefreshQuestion = () => ({
  type: types.PUSH_DISMISS_REGISTRATION_REFRESH_QUESTION,
});

/**
 * Set push notification state
 * @param {{deviceId: string, settings: { enabled, showAmountEnabled }, enabledAt: number}} payload
 */
export const pushSetState = (payload) => ({
  type: types.PUSH_SET_STATE,
  payload,
});

/**
 * Update the firebase device id
 * @param {{deviceId: string}} payload
 */
export const pushUpdateDeviceId = (payload) => ({
  type: types.PUSH_UPDATE_DEVICE_ID,
  payload,
});

/**
 * Push notification API is ready to be used
 */
export const pushApiReady = () => ({
  type: types.PUSH_API_READY,
});

/**
 * Request to load wallet in order to register push notification
 */
export const pushLoadWalletRequested = () => ({
  type: types.PUSH_WALLET_LOAD_REQUESTED,
});

/**
 * The wallet was loaded with success
 * @param {{ walletService: HathorWalletServiceWallet }} payload
 */
export const pushLoadWalletSuccess = (payload) => ({
  type: types.PUSH_WALLET_LOAD_SUCCESS,
  payload,
});

/**
 * The wallet failed to load
 * @param {{ error }} payload
 */
export const pushLoadWalletFailed = (payload) => ({
  type: types.PUSH_WALLET_LOAD_FAILED,
  payload,
});

/**
 * Request to register push notification device
 * @param {{enabled: boolean, showAmountEnabled: boolean, deviceId: string}} payload
 */
export const pushRegistrationRequested = (payload) => ({
  type: types.PUSH_REGISTRATION_REQUESTED,
  payload,
});

/**
 * Register push notification device succeeded
 * @param {{ enabled: boolean }} data
 */
export const pushRegisterSuccess = (data) => ({
  type: types.PUSH_REGISTER_SUCCESS,
  data,
});

/**
 * Register push notification device failed
 */
export const pushRegisterFailed = () => ({
  type: types.PUSH_REGISTER_FAILED,
});

export const walletRefreshSharedAddress = () => ({
  type: types.WALLET_REFRESH_SHARED_ADDRESS,
});

/**
 * Update address that will be shared with user
 *
 * lastSharedAddress {string} The address to use
 * lastSharedIndex {int} The address index to use
 */
export const sharedAddressUpdate = (lastSharedAddress, lastSharedIndex) => ({
  type: types.SHARED_ADDRESS_UPDATE,
  payload: {
    lastSharedAddress,
    lastSharedIndex,
  },
});

export const setWalletConnect = (walletConnect) => ({
  type: types.SET_WALLET_CONNECT,
  payload: walletConnect,
});

export const walletConnectQRCodeRead = (data) => ({
  type: types.WC_QRCODE_READ,
  payload: data,
});

/**
 * Exception captured, will update the store with the Error
 * instance and whether it should force the user to restart
 * the wallet or not.
 *
 * error {Error} Error object to report
 * isFatal {Boolean} Whether is fatal or not
 */
export const onExceptionCaptured = (error, isFatal) => ({
  type: types.EXCEPTION_CAPTURED,
  payload: {
    error,
    isFatal,
  },
});

/**
 * Request to get the tx details
 * @param {{ txId: string }} payload
 */
export const pushTxDetailsRequested = (payload) => ({
  type: types.PUSH_TX_DETAILS_REQUESTED,
  payload,
});

/**
 * Get the tx details succeeded
 * @param {{ payload: {
 *   isTxFound: boolean,
 *   txId: string,
 *   tx: {
 *     txId: string,
 *     timestamp: number,
 *     voided: boolean
 *   },
 *   tokens: {
 *     uid: string,
 *     name: string,
 *     symbol: string,
 *     balance: number,
 *     isRegistered: boolean
 *   }[],
 * }}} action
 */
export const pushTxDetailsSuccess = (payload) => ({
  type: types.PUSH_TX_DETAILS_SUCCESS,
  payload,
});

/**
 * Clean the txDetails state dismissing the tx details modal.
 */
export const pushCleanTxDetails = () => ({
  type: types.PUSH_CLEAN_TX_DETAILS,
});

/**
 * Reset the push notification state
 */
export const pushReset = () => ({
  type: types.PUSH_RESET,
});
