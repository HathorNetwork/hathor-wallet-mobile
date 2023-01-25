/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createStore, applyMiddleware } from 'redux';
import createSagaMiddleware from 'redux-saga';
import thunk from 'redux-thunk';
import hathorLib from '@hathor/wallet-lib';
import { get } from 'lodash';
import { INITIAL_TOKENS, DEFAULT_TOKEN } from './constants';
import { types } from './actions';
import rootSagas from './sagas';
import { TOKEN_DOWNLOAD_STATUS } from './sagas/tokens';
import { WALLET_STATUS } from './sagas/wallet';

/**
 * tokensBalance {Object} stores the balance for each token (Dict[tokenUid: str, {
*    status: string,
*    oldStatus: string,
*    updatedAt: int,
*    data: {
*      available: int,
*      locked: int
*    }
 * }])
 * tokensHistory {Object} stores the history for each token (Dict[tokenUid: str, {
 *  status: string,
 *  oldStatus: string,
 *  updatedAt: int,
 *  data: TxHistory[]
 * }])
 * loadHistoryStatus {Object} progress on loading tx history {
 *   active {boolean} indicates we're loading the tx history
 *   error {boolean} error loading history
 * }
 * latestInvoice {Object} tracks the latest payment request created {
 *   address {string} address where we're expecting the payment
 *   amount {int} admount to be paid
 *   token {Object} payment should be made in this token
 * }
 * invoicePayment {Object} null if not paid or the tx that settles latestInvoice
 * tokens {Array} array of tokens added [{name, symbol, uid}]
 * selectedToken {Object} token currently selected by the user
 * isOnline {bool} Indicates whether the wallet is connected to the fullnode's websocket
 * serverInfo {Object} {
 *   version {str} version of the connected server (e.g., 0.26.0-beta)
 *   network {str} network of the connected server (e.g., mainnet, testnet)
 * }
 * lockScreen {bool} Indicates screen is locked
 *
 * useWalletService {boolean} if should use wallet service facade
 * (feature flag that should be updated from rollout service)
 *
 * tokenMetadata {Object} Metadata of tokens {uid: {metaObject}}
 * metadataLoaded {boolean} If metadata was fully loaded from the explorer service
 *
 * errorHandler {Object} Information on the captured erorr {
 *   showAlert {boolean} Indicates if we need to show the alert dialog
 *   showModal {boolean} Indicates if we need to show the alert modal
 *   errorReported {boolean} Indicates if the user reported the alert to Sentry
 *   isFatal {boolean} Indicates if the error is fatal
 *   error {Error} Error object with the stacktrace, to be sent to Sentry
 * }
 *
 * lastSharedAddress {string} The current address to use
 * lastSharedIndex {int} The current address index to use
 */
const initialState = {
  tokensHistory: {},
  tokensBalance: {},
  loadHistoryStatus: { active: true, error: false },
  latestInvoice: null,
  invoicePayment: null,
  tokens: INITIAL_TOKENS,
  selectedToken: DEFAULT_TOKEN,
  isOnline: false,
  serverInfo: { version: '', network: '' },
  lockScreen: true,
  height: 0,
  errorHandler: {
    showAlert: false,
    showModal: false,
    errorReported: null,
    isFatal: null,
    error: null,
  },
  wallet: null,
  loadedData: { transactions: 0, addresses: 0 },
  useWalletService: false,
  tokenMetadata: {},
  metadataLoaded: false,
  uniqueDeviceId: null,
  // If recoveringPin is set, the app will display
  // the RecoverPin screen instead of the default navigator
  recoveringPin: false,
  // tempPin is used to hold the user PIN when recovering the
  // PIN that encrypted the data on accessData on the RecoverPin
  // screen
  tempPin: null,
  isShowingPinScreen: false,
  walletStartState: WALLET_STATUS.NOT_STARTED,
  lastSharedAddress: null,
  lastSharedIndex: null,
};

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case types.NEW_TX:
      return onNewTx(state, action);
    case types.NEW_INVOICE:
      return onNewInvoice(state, action);
    case types.CLEAR_INVOICE:
      return onClearInvoice(state, action);
    case types.RESET_DATA:
      return initialState;
    case types.UPDATE_SELECTED_TOKEN:
      return onUpdateSelectedToken(state, action);
    case types.NEW_TOKEN:
      return onNewToken(state, action);
    case types.SET_TOKENS:
      return onSetTokens(state, action);
    case types.UPDATE_TOKEN_HISTORY:
      return onUpdateTokenHistory(state, action);
    case types.SET_LOAD_HISTORY_STATUS:
      return onSetLoadHistoryStatus(state, action);
    case types.SET_IS_ONLINE:
      return onSetIsOnline(state, action);
    case types.SET_SERVER_INFO:
      return onSetServerInfo(state, action);
    case types.SET_LOCK_SCREEN:
      return onSetLockScreen(state, action);
    case types.SHOW_ERROR_MODAL:
      return onShowErrorModal(state, action);
    case types.HIDE_ERROR_MODAL:
      return onHideErrorModal(state);
    case types.SET_WALLET:
      return onSetWallet(state, action);
    case types.RESET_WALLET:
      return onResetWallet(state, action);
    case types.RESET_LOADED_DATA:
      return onResetLoadedData(state, action);
    case types.UPDATE_LOADED_DATA:
      return onUpdateLoadedData(state, action);
    case types.SET_USE_WALLET_SERVICE:
      return onSetUseWalletService(state, action);
    case types.TOKEN_METADATA_UPDATED:
      return onTokenMetadataUpdated(state, action);
    case types.TOKEN_METADATA_REMOVED:
      return onTokenMetadataRemoved(state, action);
    case types.TOKEN_METADATA_LOADED:
      return onTokenMetadataLoaded(state, action);
    case types.SET_UNIQUE_DEVICE_ID:
      return onSetUniqueDeviceId(state, action);
    case types.SET_RECOVERING_PIN:
      return onSetRecoveringPin(state, action);
    case types.SET_TEMP_PIN:
      return onSetTempPin(state, action);
    case types.PARTIALLY_UPDATE_HISTORY_AND_BALANCE:
      return partiallyUpdateHistoryAndBalance(state, action);
    case types.SET_IS_SHOWING_PIN_SCREEN:
      return onSetIsShowingPinScreen(state, action);
    case types.TOKEN_FETCH_BALANCE_REQUESTED:
      return onTokenFetchBalanceRequested(state, action);
    case types.TOKEN_FETCH_BALANCE_SUCCESS:
      return onTokenFetchBalanceSuccess(state, action);
    case types.TOKEN_FETCH_BALANCE_FAILED:
      return onTokenFetchBalanceFailed(state, action);
    case types.TOKEN_FETCH_HISTORY_REQUESTED:
      return onTokenFetchHistoryRequested(state, action);
    case types.TOKEN_FETCH_HISTORY_SUCCESS:
      return onTokenFetchHistorySuccess(state, action);
    case types.TOKEN_FETCH_HISTORY_FAILED:
      return onTokenFetchHistoryFailed(state, action);
    case types.TOKEN_INVALIDATE_HISTORY:
      return onTokenInvalidateHistory(state, action);
    case types.TOKEN_INVALIDATE_BALANCE:
      return onTokenInvalidateBalance(state, action);
    case types.ON_START_WALLET_LOCK:
      return onStartWalletLock(state);
    case types.START_WALLET_REQUESTED:
      return onStartWalletRequested(state, action);
    case types.START_WALLET_SUCCESS:
      return onStartWalletSuccess(state);
    case types.START_WALLET_FAILED:
      return onStartWalletFailed(state);
    case types.START_WALLET_NOT_STARTED:
      return onStartWalletNotStarted(state);
    case types.WALLET_BEST_BLOCK_UPDATE:
      return onWalletBestBlockUpdate(state, action);
    case types.EXCEPTION_CAPTURED:
      return onExceptionCaptured(state, action);
    case types.WALLET_RELOADING:
      return onWalletReloading(state);
    case types.SHARED_ADDRESS_UPDATE:
      return onSharedAddressUpdate(state, action);
    default:
      return state;
  }
};

const onSetServerInfo = (state, action) => ({
  ...state,
  serverInfo: {
    network: action.payload.network,
    version: action.payload.version,
  },
});

const onSetIsOnline = (state, action) => ({
  ...state,
  isOnline: action.payload,
});

const onSetIsShowingPinScreen = (state, action) => ({
  ...state,
  isShowingPinScreen: action.payload,
});

/**
 * Updates the history and balance when a new tx arrives. Also checks
 * if this tx settles an open invoice.
 */
const onNewTx = (state, action) => {
  const { tx } = action.payload;

  // if we have the invoice modal, check if this tx settles it
  let invoicePayment = null;
  if (state.latestInvoice && state.latestInvoice.amount) {
    for (const txout of tx.outputs) {
      // Don't consider authority outputs
      if (hathorLib.wallet.isAuthorityOutput(txout)) {
        continue;
      }

      if (txout.decoded && txout.decoded.address
          && txout.decoded.address === state.latestInvoice.address
          && txout.value === state.latestInvoice.amount
          && txout.token === state.latestInvoice.token.uid) {
        invoicePayment = tx;
        break;
      }
    }
  }

  return {
    ...state,
    invoicePayment: invoicePayment || state.invoicePayment,
  };
};

/**
 * Update token history after fetching more data in pagination
 */
const onUpdateTokenHistory = (state, action) => {
  const { token, newHistory } = action.payload;

  return {
    ...state,
    tokensHistory: {
      ...state.tokensHistory,
      [token]: {
        ...state.tokensHistory[token],
        data: [
          ...get(state.tokensHistory, `${token}.data`, []),
          ...newHistory,
        ]
      }
    },
  };
};

/**
 * Create a new payment request
 */
const onNewInvoice = (state, action) => {
  const { address } = action.payload;
  const { amount } = action.payload;
  const { token } = action.payload;
  return {
    ...state,
    latestInvoice: { address, amount, token },
  };
};

/**
 * When the user leaves the invoice screen, clear the invoice information
 */
const onClearInvoice = (state, action) => ({
  ...state,
  latestInvoice: null,
  invoicePayment: null,
});

/**
 * Switch the selected token
 */
const onUpdateSelectedToken = (state, action) => ({
  ...state,
  selectedToken: action.payload,
});

/**
 * Add a new token to the list of available tokens in this wallet
 */
const onNewToken = (state, action) => ({
  ...state,
  tokens: [...state.tokens, action.payload],
});

/**
 * Set the list of tokens added in this wallet
 */
const onSetTokens = (state, action) => {
  let { selectedToken } = state;
  if (action.payload.indexOf(selectedToken) === -1) {
    // We have unregistered this token
    selectedToken = DEFAULT_TOKEN;
  }
  return {
    ...state,
    tokens: [...action.payload],
    selectedToken,
  };
};

/**
 * Set loadHistoryStatus
 */
const onSetLoadHistoryStatus = (state, action) => ({
  ...state,
  loadHistoryStatus: action.payload,
});

/**
 * Unlock the wallet
 */
const onSetLockScreen = (state, action) => ({
  ...state,
  lockScreen: action.payload,
});

const onSetRecoveringPin = (state, action) => ({
  ...state,
  recoveringPin: action.payload,
  // Reset temp pin if recovering pin is set to false
  tempPin: !action.payload ? null : state.tempPin,
});

const onSetTempPin = (state, action) => ({
  ...state,
  tempPin: action.payload,
});

const onSetWallet = (state, action) => ({
  ...state,
  wallet: action.payload,
});

const onSetUniqueDeviceId = (state, action) => ({
  ...state,
  uniqueDeviceId: action.payload,
});

const onSetUseWalletService = (state, action) => ({
  ...state,
  useWalletService: action.payload,
});

const onResetWallet = (state) => ({
  ...state,
  wallet: null,
});

const onHideErrorModal = (state) => ({
  ...state,
  errorHandler: initialState.errorHandler,
});

const onShowErrorModal = (state, action) => ({
  ...state,
  errorHandler: {
    ...state.errorHandler,
    errorReported: action.payload,
    showAlert: false,
    showModal: true,
  },
});

const onResetLoadedData = (state, action) => ({
  ...state,
  loadedData: { transactions: 0, addresses: 0 },
});

const onUpdateLoadedData = (state, action) => ({
  ...state,
  loadedData: action.payload,
});

/**
 * Token metadata loaded
 */
const onTokenMetadataLoaded = (state, action) => ({
  ...state,
  metadataLoaded: action.payload,
});

/**
 * Update token metadata
 */
const onTokenMetadataUpdated = (state, action) => {
  const { data } = action.payload;
  const newMeta = Object.assign({}, state.tokenMetadata, data);

  return {
    ...state,
    metadataLoaded: true,
    tokenMetadata: newMeta,
  };
};

/**
 * Remove token metadata
 */
const onTokenMetadataRemoved = (state, action) => {
  const uid = action.payload;

  const newMeta = Object.assign({}, state.tokenMetadata);
  if (uid in newMeta) {
    delete newMeta[uid];
  }

  return {
    ...state,
    tokenMetadata: newMeta,
  };
};

export const partiallyUpdateHistoryAndBalance = (state, action) => {
  const { tokensHistory, tokensBalance } = action.payload;

  return {
    ...state,
    tokensHistory: {
      ...state.tokensHistory,
      ...tokensHistory,
    },
    tokensBalance: {
      ...state.tokensBalance,
      ...tokensBalance,
    },
  };
};

/**
 * @param {String} action.tokenId - The tokenId to mark as loading
 */
export const onTokenFetchBalanceRequested = (state, action) => {
  const { tokenId } = action;
  const oldState = get(state.tokensBalance, tokenId, {});

  return {
    ...state,
    tokensBalance: {
      ...state.tokensBalance,
      [tokenId]: {
        ...oldState,
        status: TOKEN_DOWNLOAD_STATUS.LOADING,
        oldStatus: oldState.status,
      },
    },
  };
};

/**
 * @param {String} action.tokenId - The tokenId to mark as success
 * @param {Object} action.data - The token balance information to store on redux
 */
export const onTokenFetchBalanceSuccess = (state, action) => {
  const { tokenId, data } = action;

  return {
    ...state,
    tokensBalance: {
      ...state.tokensBalance,
      [tokenId]: {
        status: TOKEN_DOWNLOAD_STATUS.READY,
        updatedAt: new Date().getTime(),
        data,
      },
    },
  };
};

/**
 * @param {String} action.tokenId - The tokenId to mark as failure
 */
export const onTokenFetchBalanceFailed = (state, action) => {
  const { tokenId } = action;

  return {
    ...state,
    tokensBalance: {
      ...state.tokensBalance,
      [tokenId]: {
        status: TOKEN_DOWNLOAD_STATUS.FAILED,
      },
    },
  };
};

/**
 * @param {String} action.tokenId - The tokenId to mark as success
 * @param {Object} action.data - The token history information to store on redux
 */
export const onTokenFetchHistorySuccess = (state, action) => {
  const { tokenId, data } = action;

  return {
    ...state,
    tokensHistory: {
      ...state.tokensHistory,
      [tokenId]: {
        status: TOKEN_DOWNLOAD_STATUS.READY,
        updatedAt: new Date().getTime(),
        data,
      },
    },
  };
};

/**
 * @param {String} action.tokenId - The tokenId to mark as failed
 */
export const onTokenFetchHistoryFailed = (state, action) => {
  const { tokenId } = action;

  return {
    ...state,
    tokensHistory: {
      ...state.tokensHistory,
      [tokenId]: {
        status: TOKEN_DOWNLOAD_STATUS.FAILED,
      },
    },
  };
};

/**
 * @param {String} action.tokenId - The tokenId to fetch history
 */
export const onTokenFetchHistoryRequested = (state, action) => {
  const { tokenId } = action;

  const oldState = get(state.tokensHistory, tokenId, {});

  return {
    ...state,
    tokensHistory: {
      ...state.tokensHistory,
      [tokenId]: {
        ...oldState,
        status: TOKEN_DOWNLOAD_STATUS.LOADING,
        oldStatus: oldState.status,
      },
    },
  };
};

export const onStartWalletNotStarted = (state) => ({
  ...state,
  walletStartState: WALLET_STATUS.NOT_STARTED,
});

export const onStartWalletFailed = (state) => ({
  ...state,
  walletStartState: WALLET_STATUS.FAILED,
});

export const onStartWalletLock = (state) => ({
  ...state,
  walletStartState: WALLET_STATUS.NOT_STARTED,
});

/**
 * @param {String} action.words - The wallet's words
 * @param {String} action.pin - The wallet's pinCode
 */
export const onStartWalletRequested = (state, action) => ({
  ...state,
  walletStartState: WALLET_STATUS.LOADING,
});

export const onStartWalletSuccess = (state) => ({
  ...state,
  walletStartState: WALLET_STATUS.READY,
});

/**
 * @param {String} action.tokenId - The tokenId to invalidate
 */
export const onTokenInvalidateBalance = (state, action) => {
  const { tokenId } = action;

  return {
    ...state,
    tokensBalance: {
      ...state.tokensBalance,
      [tokenId]: {
        status: TOKEN_DOWNLOAD_STATUS.INVALIDATED,
      },
    },
  };
};

/**
 * @param {String} action.tokenId - The tokenId to invalidate
 */
export const onTokenInvalidateHistory = (state, action) => {
  const { tokenId } = action;

  return {
    ...state,
    tokensHistory: {
      ...state.tokensHistory,
      [tokenId]: {
        status: TOKEN_DOWNLOAD_STATUS.INVALIDATED,
      },
    },
  };
};

/**
 * @param {Number} action.data Best block height
 */
export const onWalletBestBlockUpdate = (state, action) => {
  const { data } = action;

  return {
    ...state,
    height: data,
  };
};

/**
 * @param {Boolean} action.payload.error The captured Error object
 * @param {Boolean} action.payload.isFatal Indicates if the error is fatal
 */
export const onExceptionCaptured = (state, { payload }) => {
  const { error, isFatal } = payload;

  return {
    ...state,
    errorHandler: {
      ...state.errorHandler,
      error,
      isFatal,
      showAlert: true,
      showModal: false,
    },
  };
};

const onWalletReloading = (state) => ({
  ...state,
  walletStartState: WALLET_STATUS.LOADING,
});

/**
 * @param {string} action.payload.lastSharedAddress The current address to use
 * @param {int} action.payload.lastSharedIndex The current address index to use
 */
const onSharedAddressUpdate = (state, action) => ({
  ...state,
  lastSharedAddress: action.payload.lastSharedAddress,
  lastSharedIndex: action.payload.lastSharedIndex,
});

const saga = createSagaMiddleware();
const middlewares = [
  saga,
  thunk,
];

export const store = createStore(reducer, applyMiddleware(...middlewares));

saga.run(rootSagas);
