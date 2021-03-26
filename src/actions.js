/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Connection, HathorWallet, wallet as walletUtil } from '@hathor/wallet-lib';
import { KEYCHAIN_USER, STORE } from './constants';

import * as Keychain from 'react-native-keychain';

export const types = {
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
  SET_LOAD_HISTORY_STATUS: 'SET_LOAD_HISTORY_STATUS',
  SET_IS_ONLINE: 'SET_IS_ONLINE',
  SET_SERVER_INFO: 'SET_SERVER_INFO',
  ACTIVATE_FETCH_HISTORY: 'ACTIVATE_FETCH_HISTORY',
  SET_LOCK_SCREEN: 'SET_LOCK_SCREEN',
  SET_INIT_WALLET: 'SET_INIT_WALLET',
  UPDATE_HEIGHT: 'UPDATE_HEIGHT',
  SET_ERROR_MODAL: 'SET_ERROR_MODAL',
  SET_WALLET: 'SET_WALLET',
  RESET_WALLET: 'RESET_WALLET',
  RESET_LOADED_DATA: 'RESET_LOADED_DATA',
  UPDATE_LOADED_DATA: 'UPDATE_LOADED_DATA',
};

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
 * addresses {Array} this wallet addresses
 */
export const newTx = (tx, addresses) => ({ type: types.NEW_TX, payload: { tx, addresses } });

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
 * history {Object} history of this wallet (including txs from all tokens)
 * addresses {Array} this wallet addresses
 */
export const fetchHistorySuccess = (history, addresses) => (
  { type: types.FETCH_HISTORY_SUCCESS, payload: { history, addresses } }
);

export const fetchHistoryError = () => ({ type: types.FETCH_HISTORY_ERROR });

export const setLoadHistoryStatus = (active, error) => (
  { type: types.SET_LOAD_HISTORY_STATUS, payload: { active, error } }
);

export const activateFetchHistory = () => ({ type: types.ACTIVATE_FETCH_HISTORY });

export const unlockScreen = () => ({ type: types.SET_LOCK_SCREEN, payload: false });

export const lockScreen = () => ({ type: types.SET_LOCK_SCREEN, payload: true });

export const updateHeight = (height) => ({ type: types.UPDATE_HEIGHT, payload: height });

/**
 * words {String} wallet words
 * pin {String} Pin chosen by user
 */
export const setInitWallet = (words, pin) => (
  { type: types.SET_INIT_WALLET, payload: { words, pin } }
);

export const clearInitWallet = () => ({ type: types.SET_INIT_WALLET, payload: null });


/**
 * amount {int} amount to be sent
 * address {String} destination address
 * token {Object} token being sent
 */
export const sendTx = (wallet, amount, address, token) => () => {
  return wallet.sendTransaction(address, amount, token);
};

export const startWallet = (words, pin) => (dispatch) => {
  // If we've lost redux data, we could not properly stop the wallet object
  // then we don't know if we've cleaned up the wallet data in the storage
  walletUtil.cleanLoadedData();

  const connection = new Connection({
    network: 'mainnet', // app currently connects only to mainnet
    servers: ['https://mobile.wallet.hathor.network/v1a/'],
  });

  const beforeReloadCallback = () => {
    dispatch(activateFetchHistory());
  }

  const walletConfig = {
    seed: words,
    store: STORE,
    connection,
    password: pin,
    pinCode: pin,
    beforeReloadCallback
  }

  const wallet = new HathorWallet(walletConfig);

  dispatch(setWallet(wallet));

  dispatch(fetchHistoryBegin());

  wallet.start().then((serverInfo) => {
    dispatch(setServerInfo(serverInfo));
    wallet.on('state', (state) => {
      if (state === HathorWallet.ERROR) {
        // ERROR
        dispatch(fetchHistoryError());
      } else if (state === HathorWallet.READY) {
        // READY
        const historyTransactions = wallet.getTxHistory();
        const addresses = wallet.getAllAddresses()
        dispatch(fetchHistorySuccess(historyTransactions, addresses));
      }
    })

    wallet.on('new-tx', (tx) => {
      const addresses = wallet.getAllAddresses()
      dispatch(newTx(tx, addresses));
    });

    wallet.on('update-tx', (tx) => {
      const addresses = wallet.getAllAddresses()
      dispatch(newTx(tx, addresses));
    });

    connection.on('best-block-update', (height) => {
      dispatch(updateHeight(height));
    });

    connection.on('state', (state) => {
      let isOnline;
      if (state === Connection.CONNECTED) {
        isOnline = true;
      } else {
        isOnline = false;
      }
      dispatch(setIsOnline(isOnline));
    });

    connection.on('addresses-loaded', (data) => {
      const transactions = Object.keys(data.historyTransactions).length;
      const addresses = data.addressesFound;
      dispatch(updateLoadedData({ transactions, addresses }))
    });
  });;


  Keychain.setGenericPassword(KEYCHAIN_USER, pin, {
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
    acessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
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
export const setErrorModal = (errorReported) => (
  { type: types.SET_ERROR_MODAL, payload: { errorReported } }
);

/**
 * wallet {HathorWallet} wallet object
 */
export const setWallet = (wallet) => (
  { type: types.SET_WALLET, payload: wallet }
);

export const resetWallet = () => (
  { type: types.RESET_WALLET }
);
