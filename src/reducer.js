import { createStore, applyMiddleware } from 'redux';
import thunk from "redux-thunk";

import { getBalance, getMyTxBalance } from './utils';
import { INITIAL_TOKENS, SELECTED_TOKEN } from './constants';
import { types } from './actions.js';

import { TxHistory } from './models';

import hathorLib from '@hathor/wallet-lib';


/**
 * tokensBalance {Object} stores the balance for each token (Dict[tokenUid: str, {available: int, locked: int}])
 * loadHistoryStatus {Object} progress on loading tx history {
 *   loading {boolean} indicates we're loading the tx history
 *   transactions {int} transactions loaded
 *   addresses {int} addresses loaded
 *   error {boolean} error loading history
 * }
 * latestInvoice {Object} tracks the latest payment request created ({address: {string}, amount: {int}, token: {Object}})
 * invoicePayment {Object} null if not paid or the tx that settles latestInvoice
 * tokens {Array} array of tokens added [{name, symbol, uid}]
 * selectedToken {Object} token currently selected by the user
 * sendTx {Object} used for sendTx modal
 * isOnline {bool} Indicates whether the wallet is connected to the fullnode's websocket
 * serverInfo {Object} {
 *   version {str} version of the connected server (e.g., 0.26.0-beta)
 *   network {str} network of the connected server (e.g., mainnet, testnet)
 * }
 */
const initialState = {
  tokensHistory: {},
  tokensBalance: {},
  loadHistoryStatus: {loading: false, transactions: 0, addresses: 0, error: false},
  latestInvoice: null,
  invoicePayment: null,
  tokens: INITIAL_TOKENS,
  selectedToken: SELECTED_TOKEN,
  sendTx: {loading: false, error: null},
  isOnline: false,
  serverInfo: { version: '', network: '' },
}

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
    case types.SEND_TX_BEGIN:
      return onSendTxBegin(state, action);
    case types.SEND_TX_SUCCESS:
      return onSendTxSuccess(state, action);
    case types.SEND_TX_ERROR:
      return onSendTxError(state, action);
    case types.SEND_TX_DISMISS:
      return onSendTxDismiss(state, action);
    case types.FETCH_HISTORY_BEGIN:
      return onFetchHistoryBegin(state, action);
    case types.FETCH_HISTORY_SUCCESS:
      return onFetchHistorySuccess(state, action);
    case types.FETCH_HISTORY_ERROR:
      return onFetchHistoryError(state, action);
    case types.UPDATE_HISTORY_LOADING_STATUS:
      return onUpdateHistoryLoadingStatus(state, action);
    case types.SET_IS_ONLINE:
      return onSetIsOnline(state, action);
    case types.SET_SERVER_INFO:
      return onSetServerInfo(state, action);
    default:
      return state;
  }
}

const onSetServerInfo = (state, action) => {
  return {
    ...state,
    serverInfo: {
      network: action.payload.network,
      version: action.payload.version,
    }
  }
};

const onSetIsOnline = (state, action) => {
  return {
    ...state,
    isOnline: action.payload,
  };
};

/**
 * Updates the history and balance when a new tx arrives. Also checks
 * if this tx settles an open invoice.
 */
const onNewTx = (state, action) => {
  const tx = action.payload.tx;
  const addresses = action.payload.addresses;

  // if we have the invoice modal, check if this tx settles it
  let invoicePayment = null;
  if (state.latestInvoice && state.latestInvoice.amount) {
    for (let txout of tx.outputs) {
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
  const updatedBalanceMap = {};
  const balances = getMyTxBalance(tx, addresses);

  // we now loop through all tokens present in the new tx to get the new history and balance
  for (const [tokenUid, tokenTxBalance] of Object.entries(balances)) {
    // we may not have this token yet, so state.tokensHistory[tokenUid] would return undefined
    const currentHistory = state.tokensHistory[tokenUid] || [];
    const newTokenHistory = addTxToSortedList(tokenUid, tx, tokenTxBalance, currentHistory);
    updatedHistoryMap[tokenUid] = newTokenHistory;
    // totalBalance should not be confused with tokenTxBalance. The latter is the balance of the new
    // tx, while the former is the total balance of the token, considering all tx history
    const totalBalance = getBalance(tokenUid);
    updatedBalanceMap[tokenUid] = totalBalance;
  }
  const newTokensHistory = Object.assign({}, state.tokensHistory, updatedHistoryMap);
  const newTokensBalance = Object.assign({}, state.tokensBalance, updatedBalanceMap);

  return {
    ...state,
    invoicePayment: invoicePayment || state.invoicePayment,
    tokensHistory: newTokensHistory,
    tokensBalance: newTokensBalance,
  };
}

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
  for (let i = 0; i < currentHistory.length; i++) {
    if (tx.tx_id === currentHistory[i].tx_id) {
      // If is_voided changed, we update the tx in the history
      // otherwise we just return the currentHistory without change
      if (tx.is_voided !== currentHistory[i].is_voided) {
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
}

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
 **/
const getTxHistoryFromTx = (tx, tokenUid, tokenTxBalance) => {
  return new TxHistory({
    tx_id: tx.tx_id,
    timestamp: tx.timestamp,
    token_uid: tokenUid,
    balance: tokenTxBalance,
    is_voided: tx.is_voided,
  });
}

/**
 * Create a new payment request
 */
const onNewInvoice = (state, action) => {
  const address = action.payload.address;
  const amount = action.payload.amount;
  const token = action.payload.token;
  return {
    ...state,
    latestInvoice: {address, amount, token},
  }
}

/**
 * When the user leaves the invoice screen, clear the invoice information
 */
const onClearInvoice = (state, action) => {
  return {
    ...state,
    latestInvoice: null,
    invoicePayment: null,
  }
}

/**
 * Switch the selected token
 */
const onUpdateSelectedToken = (state, action) => {
  return {
    ...state,
    selectedToken: action.payload,
  }
}

/**
 * Add a new token to the list of available tokens in this wallet
 */
const onNewToken = (state, action) => {
  return {
    ...state,
    tokens: [...state.tokens, action.payload]
  }
}

/**
 * Set the list of tokens added in this wallet
 */
const onSetTokens = (state, action) => {
  let selectedToken = state.selectedToken;
  if (action.payload.indexOf(selectedToken) === -1) {
    // We have unregistered this token
    selectedToken = SELECTED_TOKEN;
  }
  return {
    ...state,
    tokens: [...action.payload],
    selectedToken
  }
}

/**
 * Start sending the tx. This means clear any send errors and show loading
 */
const onSendTxBegin = (state, action) => {
  return {
    ...state,
    sendTx: {loading: true, error: null},
  }
}

/**
 * Send succeeded
 */
const onSendTxSuccess = (state, action) => {
  return {
    ...state,
    sendTx: {loading: false, error: null},
  }
}

/**
 * Error sending transaction
 */
const onSendTxError = (state, action) => {
  return {
    ...state,
    sendTx: {loading: false, error: action.payload},
  }
}

/**
 * When leaving the send tx screen, clear the state so it's not there when we go back to this screen
 */
const onSendTxDismiss = (state, action) => {
  return {
    ...state,
    sendTx: {loading: false, error: null},
  }
}

/**
 * Start fetching history. This means clear any past errors and show loading
 */
const onFetchHistoryBegin = (state, action) => {
  return {
    ...state,
    loadHistoryStatus: {loading: true, transactions: 0, addresses: 0, error: false},
  }
}

/**
 * Got history. Update history and balance for each token.
 */
const onFetchHistorySuccess = (state, action) => {
  const history = action.payload.history;
  const addresses = action.payload.addresses;
  const tokensHistory = {};
  const tokensBalance = {};
  // iterate through all txs received and map all tokens this wallet has, with
  // its history and balance
  for (const tx of Object.values(history)) {
    // we first get all tokens present in this tx (that belong to the user) and the corresponding balances
    const balances = getMyTxBalance(tx, addresses);
    for (const [tokenUid, tokenTxBalance] of Object.entries(balances)) {
      let tokenHistory = tokensHistory[tokenUid];
      if (tokenHistory === undefined) {
        tokenHistory = [];
        tokensHistory[tokenUid] = tokenHistory;
      }
      // add this tx to the history of the corresponding token
      tokenHistory.push(getTxHistoryFromTx(tx, tokenUid, tokenTxBalance));
      const totalBalance = getBalance(tokenUid);
      // update token total balance
      tokensBalance[tokenUid] = totalBalance;
    }
  }

  // in the end, sort (in place) all tx lists in descending order by timestamp
  for (const txList of Object.values(tokensHistory)) {
    txList.sort((elem1, elem2) => {
      return elem2.timestamp - elem1.timestamp
    });
  }

  return {
    ...state,
    tokensHistory,
    tokensBalance,
    loadHistoryStatus: {loading: false, transactions: 0, addresses: 0, error: false},
  };
}

/**
 * Error fetching history
 */
const onFetchHistoryError = (state, action) => {
  return {
    ...state,
    loadHistoryStatus: {
      loading: false,
      transactions: action.payload.transactions,
      addresses: action.payload.addresses,
      error: true,
    }
  }
}

/**
 * Update history loading status
 */
const onUpdateHistoryLoadingStatus = (state, action) => {
  return {
    ...state,
    loadHistoryStatus: {
      loading: state.loadHistoryStatus.loading,
      transactions: action.payload.transactions,
      addresses: action.payload.addresses,
      error: false,
    }
  }
}

export const store = createStore(reducer, applyMiddleware(thunk));
