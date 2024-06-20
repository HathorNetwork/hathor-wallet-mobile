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
  METADATA_CONCURRENT_DOWNLOAD, WALLETCONNECT_NEW_NANOCONTRACT_TX_STATUS,
} from './constants';
import { mapToTxHistory } from './utils';

// TODO: We should apply the agreed taxonomy to all the actions.
// See: https://github.com/HathorNetwork/hathor-wallet-mobile/issues/334
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
  /* It initiates download of tokens metadata. */
  TOKENS_FETCH_METADATA_REQUESTED: 'TOKENS_FETCH_METADATA_REQUESTED',
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
  PUSH_DEVICE_REGISTERED: 'PUSH_DEVICE_REGISTERED',
  WALLET_REFRESH_SHARED_ADDRESS: 'WALLET_REFRESH_SHARED_ADDRESS',
  SHARED_ADDRESS_UPDATE: 'SHARED_ADDRESS_UPDATE',
  EXCEPTION_CAPTURED: 'EXCEPTION_CAPTURED',
  SET_FEATURE_TOGGLES: 'SET_FEATURE_TOGGLES',
  // Feature Toggle actions
  FEATURE_TOGGLE_INITIALIZED: 'FEATURE_TOGGLE_INITIALIZED',
  FEATURE_TOGGLE_UPDATE: 'FEATURE_TOGGLE_UPDATE',
  FEATURE_TOGGLE_UPDATED: 'FEATURE_TOGGLE_UPDATED',
  FEATURE_TOGGLE_READY: 'FEATURE_TOGGLE_READY',
  FEATURE_TOGGLE_ERROR: 'FEATURE_TOGGLE_ERROR',
  SET_WALLET_CONNECT: 'SET_WALLET_CONNECT',
  SET_WALLET_CONNECT_MODAL: 'SET_WALLET_CONNECT_MODAL',
  SET_WALLET_CONNECT_SESSIONS: 'SET_WALLET_CONNECT_SESSIONS',
  WALLET_CONNECT_ACCEPT: 'WALLET_CONNECT_ACCEPT',
  WALLET_CONNECT_REJECT: 'WALLET_CONNECT_REJECT',
  SET_NEW_NANO_CONTRACT_TRANSACTION: 'SET_NEW_NANO_CONTRACT_TRANSACTION',
  SET_UNLEASH_CLIENT: 'SET_UNLEASH_CLIENT',
  WC_URI_INPUTTED: 'WC_URI_INPUTTED',
  WC_CANCEL_SESSION: 'WC_CANCEL_SESSION',
  WC_SET_CONNECTION_FAILED: 'WC_SET_CONNECTION_FAILED',
  // Network Settings actions
  // NOTE: These actions follows a taxonomy that should be applied
  // to all other actions.
  // See: https://github.com/HathorNetwork/hathor-wallet-mobile/issues/334
  /* It initiates an update of the network settings based on user input from a form. */
  NETWORKSETTINGS_UPDATE_REQUEST: 'NETWORK_SETTINGS_UPDATE_REQUEST',
  /* It updates the redux state */
  NETWORKSETTINGS_UPDATE_STATE: 'NETWORKSETTINGS_UPDATE_STATE',
  /* It persists the complete structure of network settings in the app storage and updates the redux store. */
  NETWORKSETTINGS_PERSIST_STORE: 'NETWORKSETTINGS_PERSIST_STORE',
  /* It indicates the persistence is complete and the wallet will be reloaded. */
  NETWORKSETTINGS_UPDATE_WAITING: 'NETWORKSETTINGS_UPDATE_WAITING',
  /* It indicates the update is complete after the wallet reloads. */
  NETWORKSETTINGS_UPDATE_SUCCESS: 'NETWORK_SETTINGS_UPDATE_SUCCESS',
  /* It indicates the update request has invalid inputs. */
  NETWORKSETTINGS_UPDATE_INVALID: 'NETWORKSETTINGS_UPDATE_INVALID',
  /* It indicates the update request has failed. */
  NETWORKSETTINGS_UPDATE_FAILURE: 'NETWORK_SETTINGS_UPDATE_FAILURE',
  /* It updates the redux state of network settings status. */
  NETWORKSETTINGS_UPDATE_READY: 'NETWORK_SETTINGS_UPDATE_READY',
  /* It signals Nano Contract initialization. */
  NANOCONTRACT_INIT: 'NANOCONTRACT_INIT',
  /* It initiates a registration process of a Nano Contract. */
  NANOCONTRACT_REGISTER_REQUEST: 'NANOCONTRACT_REGISTER_REQUEST',
  /* It indicates a Nano Contract registration is couldn't complete. */
  NANOCONTRACT_REGISTER_FAILURE: 'NANOCONTRACT_REGISTER_FAILURE',
  /* It indicates a Nano Contract registration is complete. */
  NANOCONTRACT_REGISTER_SUCCESS: 'NANOCONTRACT_REGISTER_SUCCESS',
  /* It updates the redux state of nano contract register status to ready. */
  NANOCONTRACT_REGISTER_READY: 'NANOCONTRACT_REGISTER_READY',
  /* It indicates a Nano Contract hitory was requested to load. */
  NANOCONTRACT_HISTORY_REQUEST: 'NANOCONTRACT_HISTORY_REQUEST',
  /* It indicates a Nano Contract history is processing. */
  NANOCONTRACT_HISTORY_LOADING: 'NANOCONTRACT_HISTORY_LOADING',
  /* It indicates a Nano Contract history was successfully loaded. */
  NANOCONTRACT_HISTORY_SUCCESS: 'NANOCONTRACT_HISTORY_SUCCESS',
  /* It indicates a Nano Contract history failed to load. */
  NANOCONTRACT_HISTORY_FAILURE: 'NANOCONTRACT_HISTORY_FAILURE',
  /* It indicates a Nano Contract history clean. */
  NANOCONTRACT_HISTORY_CLEAN: 'NANOCONTRACT_HISTORY_CLEAN',
  /* It initiates an unregistration process of a Nano Contract. */
  NANOCONTRACT_UNREGISTER_REQUEST: 'NANOCONTRACT_UNREGISTER_REQUEST',
  /* It signals a successful completion of unregistration process. */
  NANOCONTRACT_UNREGISTER_SUCCESS: 'NANOCONTRACT_UNREGISTER_SUCCESS',
  /* It initiates a process to change the address on registered Nano Contract. */
  NANOCONTRACT_ADDRESS_CHANGE_REQUEST: 'NANOCONTRACT_ADDRESS_CHANGE_REQUEST',
  /* It triggers a process to fetch all wallet addresses. */
  SELECTADDRESS_ADDRESSES_REQUEST: 'SELECTADDRESS_ADDRESSES_REQUEST',
  /* It signals the fetch has loaded all the addresses with success. */
  SELECTADDRESS_ADDRESSES_SUCCESS: 'SELECTADDRESS_ADDRESSES_SUCCESS',
  /* It signals a fetch failure due to an error. */
  SELECTADDRESS_ADDRESSES_FAILURE: 'SELECTADDRESS_ADDRESSES_FAILURE',
  /* It triggers a process to fetch the first wallet address. */
  FIRSTADDRESS_REQUEST: 'FIRSTADDRESS_REQUEST',
  /* It signals the fetch has loaded the first address with success. */
  FIRSTADDRESS_SUCCESS: 'FIRSTADDRESS_SUCCESS',
  /* It signals a fetch failure due to an error. */
  FIRSTADDRESS_FAILURE: 'FIRSTADDRESS_FAILURE',
  /* It updates the redux state of new nano contract transaction status on wallet connect register. */
  WALLETCONNECT_NEW_NANOCONTRACT_STATUS: 'WALLETCONNECT_NEW_NANOCONTRACT_STATUS',
};

export const featureToggleInitialized = () => ({
  type: types.FEATURE_TOGGLE_INITIALIZED,
});

export const featureToggleUpdate = () => ({
  type: types.FEATURE_TOGGLE_UPDATE,
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

/**
 * sessions {Array} List of sessions to store
 */
export const setWalletConnectSessions = (sessions) => ({
  type: types.SET_WALLET_CONNECT_SESSIONS,
  payload: sessions,
});

/**
 * modal {Object} Modal information to display
 * modal.show {boolean} Show or hide the modal
 * modal.type {WalletConnectModalTypes} One of (CONNECT, SIGN_MESSAGE_REQUEST)
 * modal.onAcceptAction {Object} Action to be dispatched on accept
 * modal.onRejectAction {Object} Action to be dispatched on reject
 */
export const setWalletConnectModal = (modal) => ({
  type: types.SET_WALLET_CONNECT_MODAL,
  payload: modal,
});

export const hideWalletConnectModal = () => ({
  type: types.SET_WALLET_CONNECT_MODAL,
  payload: { show: false },
});

/*
 * sessionKey {string} The symKey of the connected Session
 */
export const walletConnectCancelSession = (sessionKey) => ({
  type: types.WC_CANCEL_SESSION,
  payload: sessionKey,
});

/**
 * @param {Object} data Data that the user has accepted.
 */
export const walletConnectAccept = (data) => ({
  type: types.WALLET_CONNECT_ACCEPT,
  payload: data,
});

export const walletWalletReject = () => ({
  type: types.WALLET_CONNECT_REJECT,
});

/**
 * @param {Object} ncRequest
 * @param {boolean} ncRequest.show
 * @param {Object} ncRequest.data
 * @param {Object} ncRequest.data.nc
 * @param {Object} ncRequest.data.dapp
 */
export const setNewNanoContractTransaction = (ncRequest) => ({
  type: types.SET_NEW_NANO_CONTRACT_TRANSACTION,
  payload: ncRequest
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
 * @param {Object.<string, {uid: string, name: string; symbol: string}>} tokens map of tokens to update state
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
    tokensHistory[token] = history.map(mapToTxHistory(token));
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
  const newHistoryObjects = newHistory.map(mapToTxHistory(token));

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
 * @param {string} tokenId: The tokenId to store history data
 * @param {TxHistory} data: The downloaded history data
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

/**
 * Stores the walletConnect instance on the redux store
 *
 * walletConnect {WalletConnect} The WalletConnect instance
 */
export const setWalletConnect = (walletConnect) => ({
  type: types.SET_WALLET_CONNECT,
  payload: walletConnect,
});

/**
 * Dispatched with data when a WalletConnect QRCode is read
 *
 * data {string} The WalletConnect v2 URI
 */
export const walletConnectUriInputted = (data) => ({
  type: types.WC_URI_INPUTTED,
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

/**
 * Request to update the status of registered device.
 * @param { boolean } isRegistered
 */
export const pushDeviceRegistered = (isRegistered) => ({
  type: types.PUSH_DEVICE_REGISTERED,
  payload: isRegistered
});

/**
 * failed {Boolean} Flag indicating whether WC failed or not.
 */
export const setWCConnectionFailed = (failed) => ({
  type: types.WC_SET_CONNECTION_FAILED,
  payload: failed,
});

/**
 * Request the custom network settings input to be processed.
 * @param {{
 *   nodeUrl: string,
 *   explorerUrl: string,
 *   explorerServiceUrl: string,
 *   txMiningServiceUrl: string,
 *   walletServiceUrl?: string
 *   walletServiceWsUrl?: string
 * }} customNetworkRequest Request input
 */
export const networkSettingsUpdateRequest = (customNetworkRequest) => ({
  type: types.NETWORKSETTINGS_UPDATE_REQUEST,
  payload: customNetworkRequest,
});

/**
 * Emits the custom network settings to update the redux store.
 * @param {{
 *   stage: string,
 *   network: string,
 *   nodeUrl: string,
 *   explorerUrl: string,
 *   txMiningServiceUrl: string,
 *   explorerServiceUrl: string,
 *   walletServiceUrl?: string
 *   walletServiceWsUrl?: string
 * }} customNetwork Settings to persist
 */
export const networkSettingsUpdateState = (customNetwork) => ({
  type: types.NETWORKSETTINGS_UPDATE_STATE,
  payload: customNetwork,
});

/**
 * Emits the custom network settings to persist in the app storage and update the redux store.
 * @param {{
 *   stage: string,
 *   network: string,
 *   nodeUrl: string,
 *   explorerUrl: string,
 *   txMiningServiceUrl: string,
 *   explorerServiceUrl: string,
 *   walletServiceUrl?: string
 *   walletServiceWsUrl?: string
 * }} customNetwork Settings to persist
 */
export const networkSettingsPersistStore = (customNetwork) => ({
  type: types.NETWORKSETTINGS_PERSIST_STORE,
  payload: customNetwork,
});

/**
 * Action indicating that the network settings update process
 * is in a waiting state.
 * This is used after persisting custom network configurations,
 * resulting in a wallet reload.
 */
export const networkSettingsUpdateWaiting = () => ({
  type: types.NETWORKSETTINGS_UPDATE_WAITING,
});

/**
 * Action indicating that the network settings update was successful.
 * This serves as a hook for the frontend to provide feedback to the user.
 */
export const networkSettingsUpdateSuccess = () => ({
  type: types.NETWORKSETTINGS_UPDATE_SUCCESS,
});

/**
 * Action indicating a failure state for the custom network settings request.
 * It means the request couldn't be processed due to internal error.
 * This serves as a hook for the frontend to provide feedback to the user.
 */
export const networkSettingsUpdateFailure = () => ({
  type: types.NETWORKSETTINGS_UPDATE_FAILURE,
});

/**
 * Action indicating an invalid state for the custom network settings request inputs.
 * It means the form should present the invalid message on the corresponding inputs.
 * @param {{
 *   message: string,
 *   nodeUrl: string,
 *   explorerUrl: string,
 *   txMiningServiceUrl: string,
 *   explorerServiceUrl: string,
 *   walletServiceUrl?: string
 *   walletServiceWsUrl?: string
 * }} errors The validation errors from custom network settings form
 */
export const networkSettingsUpdateInvalid = (errors) => ({
  type: types.NETWORKSETTINGS_UPDATE_INVALID,
  payload: errors,
});

/**
 * Custom Network Settings form is ready to be used.
 */
export const networkSettingsUpdateReady = () => ({
  type: types.NETWORKSETTINGS_UPDATE_READY,
});

/**
 * It signals Nano Contract initialization.
 */
export const nanoContractInit = () => ({
  type: types.NANOCONTRACT_INIT,
});

/**
 * Request a Nano Contract to be registered.
 * @param {{
 *   address: string,
 *   ncId: string,
 * }} registry Inputs to register a Nano Contract
 */
export const nanoContractRegisterRequest = (registerRequest) => ({
  type: types.NANOCONTRACT_REGISTER_REQUEST,
  payload: registerRequest,
});

/**
 * Nano Contract registration has failed.
 * @param {string} error Registration failure reason.
 */
export const nanoContractRegisterFailure = (error) => ({
  type: types.NANOCONTRACT_REGISTER_FAILURE,
  payload: { error }
});

/**
 * Nano Contract registration has finished with success.
 * @param {{
 *   entryKey: string;
 *   entryValue: Object;
 *   hasFeedback?: boolean;
 * }} ncEntry basic information of Nano Contract registered.
 */
export const nanoContractRegisterSuccess = (ncEntry) => ({
  type: types.NANOCONTRACT_REGISTER_SUCCESS,
  payload: ncEntry,
});

/**
 * Request a change on Nano Contract register status to ready.
 */
export const nanoContractRegisterReady = () => ({
  type: types.NANOCONTRACT_REGISTER_READY,
});

/**
 * Nano Contract request fetch history.
 * @param {{
 *   ncId: string;
 *   after: string;
 * }} ncEntry Basic information of Nano Contract registered.
 */
export const nanoContractHistoryRequest = (ncEntry) => ({
  type: types.NANOCONTRACT_HISTORY_REQUEST,
  payload: ncEntry,
});

/**
 * Nano Contract fetch history is loading.
 * @param {{
 *   ncId: string;
 * }}
 */
export const nanoContractHistoryLoading = (ncEntry) => ({
  type: types.NANOCONTRACT_HISTORY_LOADING,
  payload: ncEntry,
});

/**
 * Nano Contract history has loaded success.
 * @param {Object} payload
 * @param {string} payload.ncId Nano Contract ID.
 * @param {Object[]} payload.history Nano Contract's history chunk as array.
 * @param {string} payload.after A new history chunk will be fetched after this hash.
 */
export const nanoContractHistorySuccess = (payload) => ({
  type: types.NANOCONTRACT_HISTORY_SUCCESS,
  payload,
});

/**
 * Nano Contract history clean signal.
 * @param {Object} payload
 * @param {string} payload.ncId Nano Contract ID.
 */
export const nanoContractHistoryClean = (payload) => ({
  type: types.NANOCONTRACT_HISTORY_CLEAN,
  payload,
});

/**
 * Nano Contract history has failed.
 * @param {Object} payload
 * @param {string} payload.ncId Nano Contract ID.
 * @param {string} payload.error History failure reason.
 */
export const nanoContractHistoryFailure = (payload) => ({
  type: types.NANOCONTRACT_HISTORY_FAILURE,
  payload,
});

/**
 * Request unregistration of a Nano Contract by its key.
 * @param {{
 *   ncId: string,
 * }} Nano Contract ID to unregister.
 */
export const nanoContractUnregisterRequest = (unregisterRequest) => ({
  type: types.NANOCONTRACT_UNREGISTER_REQUEST,
  payload: unregisterRequest,
});

/**
 * Unregistration of a Nano Contract has finished with success.
 * @param {{
 *   ncId: string,
 * }} Nano Contract ID unregistered.
 */
export const nanoContractUnregisterSuccess = (unregistered) => ({
  type: types.NANOCONTRACT_UNREGISTER_SUCCESS,
  payload: unregistered,
});

/**
 * Request a change on the Nano Contract registered.
 * @param {{
 *   ncId: string;
 *   newAddress: string;
 * }} changeAddressRequest
 */
export const nanoContractAddressChangeRequest = (changeAddressRequest) => ({
  type: types.NANOCONTRACT_ADDRESS_CHANGE_REQUEST,
  payload: changeAddressRequest,
});

/**
 * Request to load all wallet addresses.
 */
export const selectAddressAddressesRequest = () => ({
  type: types.SELECTADDRESS_ADDRESSES_REQUEST,
});

/**
 * Signals all wallet addresses were loaded with success.
 * @param {Object} successPayload
 * @param {string[]} successPayload.addresses
 */
export const selectAddressAddressesSuccess = (successPayload) => ({
  type: types.SELECTADDRESS_ADDRESSES_SUCCESS,
  payload: successPayload,
});

/**
 * Signals a failure on wallet addresses loading due to an error.
 * @param {Object} failurePayload
 * @param {string} failurePayload.error
 */
export const selectAddressAddressesFailure = (failurePayload) => ({
  type: types.SELECTADDRESS_ADDRESSES_FAILURE,
  payload: failurePayload,
});

/**
 * Request to load first wallet address.
 */
export const firstAddressRequest = () => ({
  type: types.FIRSTADDRESS_REQUEST,
});

/**
 * Signals first wallet address was loaded with success.
 * @param {Object} successPayload
 * @param {string} successPayload.address
 */
export const firstAddressSuccess = (successPayload) => ({
  type: types.FIRSTADDRESS_SUCCESS,
  payload: successPayload,
});

/**
 * Signals a failure on first wallet address loading due to an error.
 * @param {Object} failurePayload
 * @param {string} failurePayload.error
 */
export const firstAddressFailure = (failurePayload) => ({
  type: types.FIRSTADDRESS_FAILURE,
  payload: failurePayload,
});

/**
 * Request the downalod of token metadata for a list of tokens.
 * @param {string[]} tokens A list of token uid
 */
export const tokensFetchMetadataRequest = (tokens) => ({
  type: types.TOKENS_FETCH_METADATA_REQUESTED,
  tokens
});

/**
 * Signals update on new nano contract status to ready.
 */
export const setNewNanoContractStatusReady = () => ({
  type: types.WALLETCONNECT_NEW_NANOCONTRACT_STATUS,
  payload: WALLETCONNECT_NEW_NANOCONTRACT_TX_STATUS.READY,
});

/**
 * Signals update on new nano contract status to loading.
 */
export const setNewNanoContractStatusLoading = () => ({
  type: types.WALLETCONNECT_NEW_NANOCONTRACT_STATUS,
  payload: WALLETCONNECT_NEW_NANOCONTRACT_TX_STATUS.LOADING,
});

/**
 * Signals update on new nano contract status to failed.
 */
export const setNewNanoContractStatusFailure = () => ({
  type: types.WALLETCONNECT_NEW_NANOCONTRACT_STATUS,
  payload: WALLETCONNECT_NEW_NANOCONTRACT_TX_STATUS.FAILED,
});

/**
 * Signals update on new nano contract status to successful.
 */
export const setNewNanoContractStatusSuccess = () => ({
  type: types.WALLETCONNECT_NEW_NANOCONTRACT_STATUS,
  payload: WALLETCONNECT_NEW_NANOCONTRACT_TX_STATUS.SUCCESSFUL,
});
