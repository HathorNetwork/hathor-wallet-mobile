/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';

import hathorLib from '@hathor/wallet-lib';
import { INITIAL_TOKENS, DEFAULT_TOKEN } from './constants';
import { types } from './actions';
import { TxHistory } from './models';


/**
 * tokensBalance {Object} stores the balance for each
 *   token (Dict[tokenUid: str, {available: int, locked: int}])
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
 * initWallet {Object} Information on wallet initialization (if not needed, set to null) {
 *   words {str} wallet words
 *   pin {str} pin selected by user
 * }
 *
 * showErrorModal {boolean} if app should show a modal after the error alert
 * errorReported {boolean} if user reported the error to Sentry
 * useWalletService {boolean} if should use wallet service facade
 * (feature flag that should be updated from rollout service)
 *
 * tokenMetadata {Object} Metadata of tokens {uid: {metaObject}}
 * metadataLoaded {boolean} If metadata was fully loaded from the explorer service
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
  initWallet: null,
  height: 0,
  showErrorModal: false,
  errorReported: false,
  wallet: null,
  loadedData: { transactions: 0, addresses: 0 },
  useWalletService: false,
  tokenMetadata: {},
  metadataLoaded: false,
};

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case types.NEW_TX:
      return onNewTx(state, action);
    case types.UPDATE_TX:
      return onUpdateTx(state, action);
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
    case types.FETCH_HISTORY_BEGIN:
      return onFetchHistoryBegin(state, action);
    case types.FETCH_HISTORY_SUCCESS:
      return onFetchHistorySuccess(state, action);
    case types.FETCH_HISTORY_ERROR:
      return onFetchHistoryError(state, action);
    case types.UPDATE_TOKEN_HISTORY:
      return onUpdateTokenHistory(state, action);
    case types.ACTIVATE_FETCH_HISTORY:
      return onActivateFetchHistory(state, action);
    case types.SET_LOAD_HISTORY_STATUS:
      return onSetLoadHistoryStatus(state, action);
    case types.SET_IS_ONLINE:
      return onSetIsOnline(state, action);
    case types.SET_SERVER_INFO:
      return onSetServerInfo(state, action);
    case types.SET_LOCK_SCREEN:
      return onSetLockScreen(state, action);
    case types.SET_INIT_WALLET:
      return onSetInitWallet(state, action);
    case types.CLEAR_INIT_WALLET:
      return onSetInitWallet(state, action);
    case types.UPDATE_HEIGHT:
      return onUpdateHeight(state, action);
    case types.SET_ERROR_MODAL:
      return onSetErrorModal(state, action);
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

/**
 * Updates the history and balance when a new tx arrives. Also checks
 * if this tx settles an open invoice.
 */
const onNewTx = (state, action) => {
  const { tx, updatedBalanceMap } = action.payload;

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

  const updatedHistoryMap = {};
  const balances = state.wallet.getTxBalance(tx, { includeAuthorities: true });

  // we now loop through all tokens present in the new tx to get the new history and balance
  for (const [tokenUid, tokenTxBalance] of Object.entries(balances)) {
    // we may not have this token yet, so state.tokensHistory[tokenUid] would return undefined
    const currentHistory = state.tokensHistory[tokenUid] || [];
    const newTokenHistory = addTxToSortedList(tokenUid, tx, tokenTxBalance, currentHistory);
    updatedHistoryMap[tokenUid] = newTokenHistory;
  }
  const newTokensHistory = Object.assign({}, state.tokensHistory, updatedHistoryMap);
  const newTokensBalance = Object.assign({}, state.tokensBalance, updatedBalanceMap);

  return {
    ...state,
    invoicePayment: invoicePayment || state.invoicePayment,
    tokensHistory: newTokensHistory,
    tokensBalance: newTokensBalance,
  };
};

/**
 * Updates the balance and history data when a tx is updated
 * because it might have been voided
 */
const onUpdateTx = (state, action) => {
  const { tx, updatedBalanceMap } = action.payload;

  const updatedHistoryMap = {};
  const balances = state.wallet.getTxBalance(tx, { includeAuthorities: true });

  for (const [tokenUid, tokenTxBalance] of Object.entries(balances)) {
    const currentHistory = state.tokensHistory[tokenUid] || [];
    const txIndex = currentHistory.findIndex((el) => el.tx_id === tx.tx_id);

    const newHistory = [...currentHistory];
    newHistory[txIndex] = getTxHistoryFromTx(tx, tokenUid, tokenTxBalance);
    updatedHistoryMap[tokenUid] = newHistory;
  }

  const newTokensHistory = Object.assign({}, state.tokensHistory, updatedHistoryMap);
  const newTokensBalance = Object.assign({}, state.tokensBalance, updatedBalanceMap);

  return Object.assign({}, state, {
    tokensHistory: newTokensHistory,
    tokensBalance: newTokensBalance,
  });
};

/**
 * Update token history after fetching more data in pagination
 */
const onUpdateTokenHistory = (state, action) => {
  const { token, newHistory } = action.payload;
  const currentHistory = state.tokensHistory[token] || [];

  const updatedHistoryMap = {};
  updatedHistoryMap[token] = [...currentHistory, ...newHistory];
  const newTokensHistory = Object.assign({}, state.tokensHistory, updatedHistoryMap);
  return {
    ...state,
    tokensHistory: newTokensHistory,
  };
};

/**
 * This method adds a new tx to the history of a token (we have one history per token)
 *
 * tokenUid {string} uid of the token being updated
 * tx {Object} the new transaction
 * tokenBalance {int} balance of this token in the new transaction
 * currentHistory {Array} currenty history of the token, sorted by timestamp descending
 */
const addTxToSortedList = (tokenUid, tx, txTokenBalance, currentHistory) => {
  let index = 0;
  for (let i = 0; i < currentHistory.length; i += 1) {
    if (tx.tx_id === currentHistory[i].txId) {
      // If is_voided changed, we update the tx in the history
      // otherwise we just return the currentHistory without change
      if (tx.is_voided !== currentHistory[i].isVoided) {
        const txHistory = getTxHistoryFromTx(tx, tokenUid, txTokenBalance);
        // return new object so redux triggers update
        const newHistory = [...currentHistory];
        newHistory[i] = txHistory;
        return newHistory;
      }
      return currentHistory;
    }
    if (tx.timestamp > currentHistory[i].timestamp) {
      // we're past the timestamp from this new tx, so stop the search
      break;
    } else if (currentHistory[i].timestamp > tx.timestamp) {
      // we only update the index in this situation beacause we want to add the new tx to the
      // beginning of the list if it has the same timestamp as others. We cannot break the
      // first time the timestamp matches because we gotta check if it's not a duplicate tx
      index = i + 1;
    }
  }
  const txHistory = getTxHistoryFromTx(tx, tokenUid, txTokenBalance);
  // return new object so redux triggers update
  const newHistory = [...currentHistory];
  newHistory.splice(index, 0, txHistory);
  return newHistory;
};

/**
 * Return an object to be saved in the history.
 *
 * tx: {
 *   tx_id: str,
 *   timestamp: int,
 *   is_voided: bool,
 *   inputs: [
 *     index: int,
 *     script: str,
 *     token: str,
 *     token_data: int,
 *     tx_id: str,
 *     value: int,
 *     decoded: {
 *       address: str,
 *       timelock: Optional[int],
 *       type: str,
 *     }
 *   ],
 *   outputs: [
 *     value: int,
 *     token_data: int,
 *     token: str,
 *     spent_by: Optional[str],
 *     script: str,
 *     decoded: {
 *       address: str,
 *       timelock: Optional[int],
 *       type: str,
 *     }
 *   ]
 * }
 * */
const getTxHistoryFromTx = (tx, tokenUid, tokenTxBalance) => new TxHistory({
  txId: tx.tx_id,
  timestamp: tx.timestamp,
  tokenUid,
  balance: tokenTxBalance,
  isVoided: tx.is_voided,
});

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
 * Start fetching history. This means clear any past errors and show loading
 */
const onFetchHistoryBegin = (state, action) => ({
  ...state,
  loadHistoryStatus: {
    active: true,
    error: false,
  },
});

/**
 * Got history. Update history and balance for each token.
 */
const onFetchHistorySuccess = (state, action) => {
  const { tokensHistory, tokensBalance } = action.payload;
  return {
    ...state,
    tokensHistory,
    tokensBalance,
    loadHistoryStatus: {
      active: false,
      error: false,
    },
  };
};

/**
 * Error fetching history
 */
const onFetchHistoryError = (state, action) => ({
  ...state,
  loadHistoryStatus: {
    active: true,
    error: true,
  },
});

/**
 * Activate fetch history screen
 */
const onActivateFetchHistory = (state, action) => ({
  ...state,
  loadHistoryStatus: {
    active: true,
    error: false,
  },
});

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

/**
 * Update information about wallet initialization
 */
const onSetInitWallet = (state, action) => ({
  ...state,
  initWallet: action.payload,
});


/**
 * Update height value on redux
 * If value is different from last value we also update HTR balance
 */
const onUpdateHeight = (state, action) => {
  if (action.payload.height !== state.height) {
    const tokensBalance = {};
    const { uid } = hathorLib.constants.HATHOR_TOKEN_CONFIG;
    tokensBalance[uid] = action.payload.htrBalance;
    const newTokensBalance = Object.assign({}, state.tokensBalance, tokensBalance);
    return {
      ...state,
      tokensBalance: newTokensBalance,
      height: action.payload.height,
    };
  }

  return state;
};

const onSetWallet = (state, action) => {
  if (state.wallet && state.wallet.state !== hathorLib.HathorWallet.CLOSED) {
    // Wallet was not closed
    state.wallet.stop();
  }

  return {
    ...state,
    wallet: action.payload
  };
};

const onSetUseWalletService = (state, action) => ({
  ...state,
  useWalletService: action.payload,
});

const onResetWallet = (state, action) => {
  if (state.wallet) {
    // Stop wallet
    state.wallet.stop();
  }

  return {
    ...state,
    wallet: null,
  };
};

const onSetErrorModal = (state, action) => ({
  ...state,
  showErrorModal: true,
  errorReported: action.payload.errorReported,
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

export const store = createStore(reducer, applyMiddleware(thunk));
