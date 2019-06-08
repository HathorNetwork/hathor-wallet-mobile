import { createStore } from 'redux';

import {getBalance, getMyTxBalance } from './utils';
import { INITIAL_TOKENS, SELECTED_TOKEN } from './constants';

const types = {
  HISTORY_UPDATE: "HISTORY_UPDATE",
  NEW_TX: "NEW_TX",
  BALANCE_UPDATE: "BALANCE_UPDATE",
  NEW_INVOICE: "NEW_INVOICE",
  CLEAR_INVOICE: "CLEAR_INVOICE",
  NETWORK_ERROR: "NETWORK_ERROR",
  CLEAR_NETWORK_ERROR: "CLEAR_NETWORK_ERROR",
  RESET_DATA: "RESET_DATA",
  UPDATE_SELECTED_TOKEN: "UPDATE_SELECTED_TOKEN",
  NEW_TOKEN: "NEW_TOKEN",
  SET_TOKENS: "SET_TOKENS",
};

export const historyUpdate = (history, keys) => ({type: types.HISTORY_UPDATE, payload: {history, keys}});

export const newTx = (tx, keys) => ({type: types.NEW_TX, payload: {tx, keys}});

export const balanceUpdate = (balance) => ({type: types.BALANCE_UPDATE, payload: balance});

export const newInvoice = (address, amount, token) => ({type: types.NEW_INVOICE, payload: {address, amount, token}});

export const clearInvoice = () => ({type: types.CLEAR_INVOICE});

export const networkError = (timestamp) => ({type: types.NETWORK_ERROR, payload: timestamp});

export const clearNetworkError = () => ({type: types.CLEAR_NETWORK_ERROR});

export const resetData = () => ({type: types.RESET_DATA});

export const updateSelectedToken = (selectedToken) => ({type: types.UPDATE_SELECTED_TOKEN, payload: selectedToken});

export const newToken = (newToken) => ({type: types.NEW_TOKEN, payload: newToken});

export const setTokens = (tokens) => ({type: types.SET_TOKENS, payload: tokens});


const initialState = {
  txList: null,
  balance: {available: 0, locked: 0},
  invoice: null,            // {address: "WZehGjcMZvgLe7XYgxAKeSQeCiuvwPmsNy", amount: 10, token: {name, symbol, uid}}
  invoicePayment: null,     // null if not paid or the tx it was received
  networkError: null,
  tokens: INITIAL_TOKENS,
  selectedToken: SELECTED_TOKEN,
}

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case types.HISTORY_UPDATE: {
      const txList = []
      const history = action.payload.history;
      const keys = action.payload.keys;
      for (const tx of Object.values(history)) {
        balances = getMyTxBalance(tx, keys);
        if (state.selectedToken.uid in balances) {
          txList.push({tx_id: tx.tx_id, timestamp: tx.timestamp, balance: balances[state.selectedToken.uid], is_voided: tx.is_voided});
        }
      }
      txList.sort((elem1, elem2) => {
        return elem2.timestamp - elem1.timestamp
      });

      const balance = getBalance(state.selectedToken.uid);
      return {
        ...state,
        txList: txList,
        balance,
      };
    }
    case types.NEW_TX: {
      const tx = action.payload.tx;
      const keys = action.payload.keys;

      // if we have the invoice modal, check if this tx settles it
      let invoicePayment = null;
      if (state.invoice && state.invoice.amount) {
        for (let txout of tx.outputs) {
          // TODO authority outputs
          if (txout.decoded && txout.decoded.address
              && txout.decoded.address === state.invoice.address
              && txout.value === state.invoice.amount
              && txout.token === state.invoice.token.uid) {
            invoicePayment = tx;
          }
        }
      }

      const balance = getBalance(state.selectedToken.uid);
      // update balance and tx list
      balances = getMyTxBalance(tx, keys);
      if (state.selectedToken.uid in balances) {
        let index = 0;
        let duplicated = false;
        for (let i = 0; i < state.txList.length; i++) {
          if (tx.tx_id === state.txList[i].tx_id) {
            //TODO we may receive the same tx several times on websocket. Lib should handle it.
            //TODO it may not be duplicated, but the tx may have been voided or vice-versa
            duplicated = true;
            break;
          }
          if (tx.timestamp > state.txList[i].timestamp) {
            break;
          } else if (state.txList[i].timestamp > tx.timestamp) {
            index = i + 1;
          }
        }
        if (!duplicated) {
          // only update state in this case
          state.txList.splice(index, 0, {tx_id: tx.tx_id, timestamp: tx.timestamp, balance: balances[state.selectedToken.uid]});
          return {
            ...state,
            balance,
            invoicePayment: invoicePayment,
            txList: [...state.txList],      // we need a new object so react detects change
          }
        }
      }

      const ret = {
        ...state,
        balance,
      };

      if (invoicePayment !== null) {
        ret['invoicePayment'] = invoicePayment;
      }

      return ret;
    }
    case types.NEW_INVOICE: {
      const address = action.payload.address;
      const amount = action.payload.amount;
      const token = action.payload.token;
      return {
        ...state,
        invoice: {address, amount, token},
      }
    }
    case types.CLEAR_INVOICE: {
      return {
        ...state,
        invoice: null,
        invoicePayment: null,
      }
    }
    case types.NETWORK_ERROR: {
      const timestamp = action.payload;
      if (state.networkError) {
        // if networkError is already set, do not overwrite as we want to
        // keep the earliest timestamp
        return state;
      }
      return {
        ...state,
        networkError: timestamp,
      }
    }
    case types.CLEAR_NETWORK_ERROR: {
      return {
        ...state,
        networkError: null,
      }
    }
    case types.RESET_DATA: {
      return initialState;
    }
    case types.UPDATE_SELECTED_TOKEN: {
      return {
        ...state,
        selectedToken: action.payload,
      }
    }
    case types.NEW_TOKEN: {
      return {
        ...state,
        tokens: [...state.tokens, action.payload]
      }
    }
    case types.SET_TOKENS: {
      return {
        ...state,
        tokens: action.payload,
      }
    }
    default:
      return state;
  }
}

export const store = createStore(reducer);
