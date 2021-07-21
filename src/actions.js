/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Keychain from 'react-native-keychain';
import { Connection, HathorWallet, HathorWalletServiceWallet, Network, wallet as walletUtil, constants as hathorLibConstants } from '@hathor/wallet-lib';
import { KEYCHAIN_USER, STORE } from './constants';
import { TxHistory } from './models';

export const types = {
  HISTORY_UPDATE: 'HISTORY_UPDATE',
  NEW_TX: 'NEW_TX',
  UPDATE_TX: 'UPDATE_TX',
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
 * updatedBalanceMap {Object} balance map updated for each token in this tx
 */
export const newTx = (tx, updatedBalanceMap) => (
  { type: types.NEW_TX, payload: { tx, updatedBalanceMap } }
);

/**
 * tx {Object} the new transaction
 * updatedBalanceMap {Object} balance map updated for each token in this tx
 */
export const updateTx = (tx, updatedBalanceMap) => (
  { type: types.UPDATE_TX, payload: { tx, updatedBalanceMap } }
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

export const fetchHistoryError = () => ({ type: types.FETCH_HISTORY_ERROR });

export const setLoadHistoryStatus = (active, error) => (
  { type: types.SET_LOAD_HISTORY_STATUS, payload: { active, error } }
);

export const activateFetchHistory = () => ({ type: types.ACTIVATE_FETCH_HISTORY });

export const unlockScreen = () => ({ type: types.SET_LOCK_SCREEN, payload: false });

export const lockScreen = () => ({ type: types.SET_LOCK_SCREEN, payload: true });

/**
 * height {number} new height of the network
 * htrBalance {Object} new balance of HTR
 */
export const updateHeight = (height, htrBalance) => (
  { type: types.UPDATE_HEIGHT, payload: { height, htrBalance } }
);

/**
 * words {String} wallet words
 * pin {String} Pin chosen by user
 */
export const setInitWallet = (words, pin) => (
  { type: types.SET_INIT_WALLET, payload: { words, pin } }
);

export const clearInitWallet = () => ({ type: types.SET_INIT_WALLET, payload: null });

export const updateTokenHistory = (token, newHistory) => (
  { type: types.UPDATE_TOKEN_HISTORY, payload: { token, newHistory } }
);

/**
 * wallet {HathorWallet} Wallet object from redux
 * amount {int} amount to be sent
 * address {String} destination address
 * token {Object} token being sent
 * pin {String} User PIN
 */
export const sendTx = (wallet, amount, address, token, pin) => () => (
  wallet.sendTransactionEvents(address, amount, token, { pinCode: pin })
);

export const fetchHistoryAndBalance = async (wallet) => {
  // First we get the tokens in the wallet
  const tokens = await wallet.getTokens();

  const tokensHistory = {};
  const tokensBalance = {};
  for (const token of tokens) {
    const balance = await wallet.getBalance(token);
    const tokenBalance = balance[0].balance;
    tokensBalance[token] = { available: tokenBalance.unlocked, locked: tokenBalance.locked };
    const history = await wallet.getTxHistory({ token_id: token });
    tokensHistory[token] = history.map((element) => new TxHistory(element));
  }

  return { tokensHistory, tokensBalance };
}

export const fetchMoreHistory = async (wallet, token, history) => {
  const newHistory = await wallet.getTxHistory({ token_id: token, skip: history.length });
  const newHistoryObjects = newHistory.map((element) => new TxHistory(element));

  return newHistoryObjects;
}

export const startWallet = (words, pin) => (dispatch) => {
  // If we've lost redux data, we could not properly stop the wallet object
  // then we don't know if we've cleaned up the wallet data in the storage
  walletUtil.cleanLoadedData();

  const connection = new Connection({
    network: 'testnet', // app currently connects only to mainnet
    servers: ['https://node1.foxtrot.testnet.hathor.network/v1a/'],
  });

  let wallet;
  if (useWalletService) {
    const network = new Network(networkName);
    wallet = new HathorWalletServiceWallet(words, network);
  } else {
    const connection = new Connection({
      network: networkName, // app currently connects only to mainnet
      servers: ['https://mobile.wallet.hathor.network/v1a/'],
    });

    const beforeReloadCallback = () => {
      dispatch(activateFetchHistory());
    };

    const walletConfig = {
      seed: words,
      store: STORE,
      connection,
      beforeReloadCallback
    };

    wallet = new HathorWallet(walletConfig);
  }

  dispatch(setWallet(wallet));

  dispatch(fetchHistoryBegin());

  wallet.start({ pinCode: pin, password: pin }).then((serverInfo) => {
    dispatch(setServerInfo(serverInfo));
    wallet.on('state', (state) => {
      if (state === HathorWallet.ERROR) {
        // ERROR
        dispatch(fetchHistoryError());
      } else if (state === HathorWallet.READY) {
        // READY
        fetchHistoryAndBalance(wallet).then((data) => {
          dispatch(fetchHistorySuccess(data));
        });
      }
    });

    /*wallet.on('new-tx', (tx) => {
      dispatch(newTx(tx));
    });

    wallet.on('update-tx', (tx) => {
      dispatch(updateTx(tx));
    });

    connection.on('best-block-update', (height) => {
      dispatch(updateHeight(height));
    });*/

    connection.on('state', (state) => {
      let isOnline;
      if (state === Connection.CONNECTED) {
        isOnline = true;
      } else {
        isOnline = false;
      }
      dispatch(setIsOnline(isOnline));
    });

  wallet.start({ pinCode: pin, password: pin }).then((serverInfo) => {
    walletUtil.storePasswordHash(pin);
    walletUtil.storeEncryptedWords(words, pin);
    dispatch(setServerInfo({ version: null, network: networkName }));

    if (!useWalletService) {
      wallet.on('new-tx', (tx) => {
        fetchNewTxTokenBalance(wallet, tx).then((updatedBalanceMap) => {
          if (updatedBalanceMap) {
            dispatch(newTx(tx, updatedBalanceMap));
          }
        });
      });

      wallet.on('update-tx', (tx) => {
        fetchNewTxTokenBalance(wallet, tx).then((updatedBalanceMap) => {
          if (updatedBalanceMap) {
            dispatch(updateTx(tx, updatedBalanceMap));
          }
        });
      });

      wallet.conn.on('best-block-update', (height) => {
        fetchNewHTRBalance(wallet).then((data) => {
          if (data) {
            dispatch(updateHeight(height, data));
          }
        });
      });

      wallet.conn.on('state', (state) => {
        let isOnline;
        if (state === Connection.CONNECTED) {
          isOnline = true;
        } else {
          isOnline = false;
        }
        dispatch(setIsOnline(isOnline));
      });

      wallet.conn.on('wallet-load-partial-update', (data) => {
        const transactions = Object.keys(data.historyTransactions).length;
        const addresses = data.addressesFound;
        dispatch(updateLoadedData({ transactions, addresses }));
      });
    }
  });


  Keychain.setGenericPassword(KEYCHAIN_USER, pin, {
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
    acessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
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
  const balances = wallet.getTxBalance(tx);
  // we now loop through all tokens present in the new tx to get the new balance
  for (const [tokenUid, tokenTxBalance] of Object.entries(balances)) {
    /* eslint-disable no-await-in-loop */
    updatedBalanceMap[tokenUid] = await fetchTokenBalance(wallet, tokenUid);
    /* eslint-enable no-await-in-loop */
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
    // as soon as the wallet gets ready
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
