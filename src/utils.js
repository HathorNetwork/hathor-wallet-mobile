import hathorLib from '@hathor/wallet-lib';

/**
 * Returns the balance for each token in tx, if the input/output belongs to this wallet
 */
export const getMyTxBalance = (tx, myKeys) => {
  const balance = {}
  for (let txout of tx.outputs) {
    if (hathorLib.wallet.isAuthorityOutput(txout)) {
      continue;
    }
    if (txout.decoded && txout.decoded.address
        && txout.decoded.address in myKeys) {
      if (!balance[txout.token]) {
          balance[txout.token] = 0;
      }
      balance[txout.token] += txout.value;
    }
  }

  for (let txin of tx.inputs) {
    if (hathorLib.wallet.isAuthorityOutput(txin)) {
      continue;
    }
    if (txin.decoded && txin.decoded.address
        && txin.decoded.address in myKeys) {
      if (!balance[txin.token]) {
          balance[txin.token] = 0;
      }
      balance[txin.token] -= txin.value;
    }
  }

  return balance;
}

export const getShortHash = hash => {
  return `${hash.substring(0,4)}...${hash.substring(60,64)}`;
}

export const getNoDecimalsAmount = value => {
  return value * (10 ** hathorLib.constants.DECIMAL_PLACES)
}

export const getDecimalsAmount = value => {
  return value / (10 ** hathorLib.constants.DECIMAL_PLACES)
}

export const getBalance = (tokenUid) => {
  // TODO should have a method in the lib to get balance by token
  const data = hathorLib.wallet.getWalletData();
  const historyTransactions = 'historyTransactions' in data ? data['historyTransactions'] : {};
  const filteredArray = hathorLib.wallet.filterHistoryTransactions(historyTransactions, tokenUid, false);
  const balance = hathorLib.wallet.calculateBalance(filteredArray, tokenUid);
  return balance;
}

export const getAmountParsed = (text) => {
  let parts = [];
  let separator = '';
  if (text.indexOf(".") > -1) {
    parts = text.split(".");
    separator = '.';
  } else if (text.indexOf(",") > -1) {
    parts = text.split(",");
    separator = ',';
  }

  if (parts[1]) {
    if (parts[1].length > hathorLib.constants.DECIMAL_PLACES) {
      return `${parts[0]}${separator}${parts[1].slice(0,2)}`;
    }
  }
  return text;
}

export const getTokenLabel = (token) => {
  return `${token.name} (${token.symbol})`;
}

export const setSupportedBiometry = (type) => {
  hathorLib.storage.setItem('mobile:supportedBiometry', type);
}

export const getSupportedBiometry = () => {
  return hathorLib.storage.getItem('mobile:supportedBiometry');
}

export const setBiometryEnabled = (value) => {
  hathorLib.storage.setItem('mobile:isBiometryEnabled', value);
}

export const isBiometryEnabled = () => {
  return hathorLib.storage.getItem('mobile:isBiometryEnabled') || false;
}
