import hathorLib from '@hathor/wallet-lib';


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
  SEND_TX_BEGIN: 'SEND_TX_BEGIN',
  SEND_TX_SUCCESS: 'SEND_TX_SUCCESS',
  SEND_TX_ERROR: 'SEND_TX_ERROR',
  SEND_TX_DISMISS: 'SEND_TX_DISMISS',
  FETCH_HISTORY_BEGIN: 'FETCH_HISTORY_BEGIN',
  FETCH_HISTORY_SUCCESS: 'FETCH_HISTORY_SUCCESS',
  FETCH_HISTORY_ERROR: 'FETCH_HISTORY_ERROR',
  SET_LOAD_HISTORY_STATUS: 'SET_LOAD_HISTORY_STATUS',
  SET_IS_ONLINE: 'SET_IS_ONLINE',
  SET_SERVER_INFO: 'SET_SERVER_INFO',
  ACTIVATE_FETCH_HISTORY: 'ACTIVATE_FETCH_HISTORY',
  SET_LOCK_SCREEN: 'SET_LOCK_SCREEN',
  SET_INIT_WALLET: 'SET_INIT_WALLET',
};

/**
 * status {bool} True for connected, and False for disconnected.
 * */
export const setIsOnline = status => ({ type: types.SET_IS_ONLINE, payload: status });

/**
 * version {str} version of the connected server (e.g., 0.26.0-beta)
 * network {str} network of the connected server (e.g., mainnet, testnet)
 * */
export const setServerInfo = ({ version, network }) => ({ type: types.SET_SERVER_INFO, payload: { version, network } });

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
export const newInvoice = (address, amount, token) => ({ type: types.NEW_INVOICE, payload: { address, amount, token } });

export const clearInvoice = () => ({ type: types.CLEAR_INVOICE });

export const resetData = () => ({ type: types.RESET_DATA });

/**
 * selectedToken {Object} new token selected
 */
export const updateSelectedToken = selectedToken => ({ type: types.UPDATE_SELECTED_TOKEN, payload: selectedToken });

/**
 * newToken {Object} new token added
 */
export const newToken = newToken => ({ type: types.NEW_TOKEN, payload: newToken });

/**
 * tokens {Array} list of tokens to update state
 */
export const setTokens = tokens => ({ type: types.SET_TOKENS, payload: tokens });

export const sendTxBegin = () => ({ type: types.SEND_TX_BEGIN });

export const sendTxSuccess = () => ({ type: types.SEND_TX_SUCCESS });

/**
 * error {String} error message when trying to send tx
 */
export const sendTxError = error => ({ type: types.SEND_TX_ERROR, payload: error });

export const sendTxDismiss = () => ({ type: types.SEND_TX_DISMISS });

export const fetchHistoryBegin = () => ({ type: types.FETCH_HISTORY_BEGIN });

/**
 * history {Object} history of this wallet (including txs from all tokens)
 * addresses {Array} this wallet addresses
 */
export const fetchHistorySuccess = (history, addresses) => ({ type: types.FETCH_HISTORY_SUCCESS, payload: { history, addresses } });

export const fetchHistoryError = () => ({ type: types.FETCH_HISTORY_ERROR });

export const setLoadHistoryStatus = (active, error) => ({ type: types.SET_LOAD_HISTORY_STATUS, payload: { active, error } });

export const activateFetchHistory = () => ({ type: types.ACTIVATE_FETCH_HISTORY });

export const unlockScreen = () => ({ type: types.SET_LOCK_SCREEN, payload: false });

export const lockScreen = () => ({ type: types.SET_LOCK_SCREEN, payload: true });

/**
 * addresses {Array} wallet words
 * history {String} Pin chosen by user
 */
export const setInitWallet = (words, pin) => ({ type: types.SET_INIT_WALLET, payload: { words, pin } });

export const clearInitWallet = () => ({ type: types.SET_INIT_WALLET, payload: null });


/**
 * amount {int} amount to be sent
 * address {String} destination address
 * token {Object} token being sent
 * pinCode {String} user's pin
 * onSuccess {function} callback after tx is sent
 */
export const sendTx = (amount, address, token, pinCode, onSuccess) => (dispatch) => {
  dispatch(sendTxBegin());
  const data = {};
  const isHathorToken = token.uid === hathorLib.constants.HATHOR_TOKEN_CONFIG.uid;
  data.tokens = isHathorToken ? [] : [token.uid];
  data.inputs = [];
  data.outputs = [{
    address, value: amount, timelock: null, tokenData: isHathorToken ? 0 : 1,
  }];
  const walletData = hathorLib.wallet.getWalletData();
  const historyTransactions = 'historyTransactions' in walletData ? walletData.historyTransactions : {};
  const ret = hathorLib.wallet.prepareSendTokensData(data, token, true, historyTransactions, [token]);
  if (ret.success) {
    try {
      hathorLib.transaction.sendTransaction(ret.data, pinCode).then(() => {
        dispatch(sendTxSuccess());
        onSuccess();
      }, (error) => {
        dispatch(sendTxError(error));
      });
    } catch (e) {
      if (e instanceof hathorLib.errors.AddressError || e instanceof hathorLib.errors.OutputValueError) {
        dispatch(sendTxError(e.message));
      }
    }
  } else {
    dispatch(sendTxError(ret.message));
  }
};

export const loadHistory = () => (dispatch) => {
  dispatch(fetchHistoryBegin());
  hathorLib.version.checkApiVersion().then((data) => {
    // Save server info.
    dispatch(setServerInfo({
      version: data.version,
      network: data.network,
    }));

    // Load address history.
    hathorLib.wallet.loadAddressHistory(0, hathorLib.constants.GAP_LIMIT).then(() => {
      const data = hathorLib.wallet.getWalletData();
      // Update historyTransactions with new one
      const historyTransactions = data.historyTransactions || {};
      const { keys } = hathorLib.wallet.getWalletData();
      dispatch(fetchHistorySuccess(historyTransactions, keys));
    }, (error) => {
      dispatch(fetchHistoryError());
    });
  }, (error) => {
    dispatch(fetchHistoryError());
  });
};
