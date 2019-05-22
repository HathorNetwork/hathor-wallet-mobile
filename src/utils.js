/**
 * Returns the balance for each token in tx, if the input/output belongs to this wallet
 */
export const getMyTxBalance = (tx, myKeys) => {
  const balance = {}
  for (let txout of tx.outputs) {
    // TODO authority outputs
    // does it belong to our wallet?
    if (txout.decoded && txout.decoded.address
        && txout.decoded.address in myKeys) {
      if (!balance[txout.token]) {
          balance[txout.token] = 0;
      }
      balance[txout.token] += txout.value;
    }
  }

  for (let txin of tx.inputs) {
    // TODO authority inputs
    // does it belong to our wallet?
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
  return value * (10 ** global.hathorLib.constants.DECIMAL_PLACES)
}

export const getDecimalsAmount = value => {
  return value / (10 ** global.hathorLib.constants.DECIMAL_PLACES)
}

export const getBalance = (tokenUid) => {
  // TODO should have a method in the lib to get balance by token
  // TODO utils should not have method accessing hathorLib 
  const data = global.hathorLib.wallet.getWalletData();
  const historyTransactions = 'historyTransactions' in data ? data['historyTransactions'] : {};
  const filteredArray = global.hathorLib.wallet.filterHistoryTransactions(historyTransactions, tokenUid);
  const balance = global.hathorLib.wallet.calculateBalance(filteredArray, tokenUid);
  return balance;
}
