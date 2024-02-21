import {
  ncApi,
} from '@hathor/wallet-lib';
import {
  takeEvery,
  select,
  all,
  put,
  call,
} from 'redux-saga/effects';
import { t } from 'ttag';
import { STORE } from '../store';
import {
  nanoContractHistoryFailure,
  nanoContractHistoryLoad,
  nanoContractHistoryRequest,
  nanoContractHistorySuccess,
  nanoContractRegisterFailure,
  nanoContractRegisterSuccess,
  onExceptionCaptured,
  types,
} from '../actions';
import { nanoContractKey, NANO_CONTRACT_TX_HISTORY_SIZE } from '../constants';
import { logger } from '../logger';

const log = logger('nano-contract-saga');

export const failureMessage = {
  alreadyRegistered: t`Nano Contract already registered.`,
  walletNotReady: t`Wallet is not ready yet.`,
  walletNotReadyError: t`Wallet is not ready yet to register a Nano Contract.`,
  addressNotMine: t`The informed address do not belongs to the wallet.`,
  nanoContractStateFailure: t`Error while trying to get Nano Contract state.`,
  notRegistered: t`Nano Contract not registered.`,
  nanoContractHistoryFailure: t`Error while trying to fetch Nano Contract history.`,
};

/**
 * Nano Contract registration has finished with success.
 * @param {string} address Address used to bind with Nano Contract
 * @param {string} ncId Nano Contract ID
 * @returns {string} An entry key to points to the registered Nano Contract
 */
export function formatNanoContractRegistryEntry(address, ncId) {
  return `${address}.${ncId}`;
}

/**
 * Calls Nano Contract API to retrive Nano Contract state.
 * @param {string} ncId Nano Contract ID
 * @returns {{
 *   ncState?: Object,
 *   error?: Error,
 * }} Returns either an object containing ncState or an error.
 */
export async function getNanoContractState(ncId) {
  try {
    const state = await ncApi.getNanoContractState(ncId);
    return { ncState: { ...state } };
  } catch (err) {
    return { error: err };
  }
}

/**
 * Process Nano Contract registration request.
 * @param {{
 *   payload: {
 *     address: string,
 *     ncId: string,
 *   }
 * }} action with request payload.
 */
export function* registerNanoContract({ payload }) {
  const { address, ncId } = payload;
  const ncEntryKey = formatNanoContractRegistryEntry(address, ncId);
  const storage = STORE.getStorage();

  // check the Nano Contract is already registered
  const isRegistered = storage.isNanoContractRegistered(ncEntryKey);
  if (isRegistered) {
    yield put(nanoContractRegisterFailure(failureMessage.alreadyRegistered));
    return;
  }

  // validate address belongs to the wallet
  const wallet = yield select((state) => state.wallet);
  if (!wallet.isReady()) {
    yield put(nanoContractRegisterFailure(failureMessage.walletNotReady));
    // This will show user an error modal with the option to send the error to sentry.
    yield put(onExceptionCaptured(new Error(failureMessage.walletNotReadyError), false));
    return;
  }

  // validate address belongs to the wallet
  const isAddressMine = yield call(wallet.isAddressMine.bind(wallet), address);
  if (!isAddressMine) {
    yield put(nanoContractRegisterFailure(failureMessage.addressNotMine));
    return;
  }

  // validate nanocontract exists
  const { ncState, error } = yield call(getNanoContractState, ncId)
  if (error) {
    yield put(nanoContractRegisterFailure(failureMessage.nanoContractStateFailure));
    return;
  }

  // persist using the pair address-nanocontract as key
  const ncEntryValue = {
    address,
    ncId,
    blueprintId: ncState.blueprint_id,
    blueprintName: ncState.blueprint_name
  };
  storage.registerNanoContract(ncEntryKey, ncEntryValue);

  // emit action NANOCONTRACT_REGISTER_SUCCESS
  yield put(nanoContractRegisterSuccess({ entryKey: ncEntryKey, entryValue: ncEntryValue }));
}

/**
 * @typedef {Object} RawNcTxHistory
 * @property {string} hash
 * @property {Object[]} inputs
 * @property {Object[]} outputs
 * @property {string} nc_args
 * @property {string} nc_id
 * @property {string} nc_method
 * @property {string} nc_pubkey
 * @property {number} nonce
 * @property {Object[]} parents
 * @property {number} signal_bits
 * @property {Date} timestamp
 * @property {string[]} tokens
 * @property {number} version
 * @property {number} weight
 *
 * @typedef {Object} RawNcTxHistoryResponse
 * @property {boolean} success
 * @property {number|null} after
 * @property {RawNcTxHistory} history
 */

/**
 * @typedef {Object} NcTxHistory - Nano Contract's Transactions History
 * @property {string} txId - transaction hash
 * @property {number} timestamp
 * @property {string} tokens - list of token's uid
 * @property {{[uid: string]: Object}} balance - balance per token
 * @property {boolean} isVoided - flag for transaction void
 * @property {string} ncId - ID of Nano Contract
 * @property {string} ncMethod - method called on Nano Contract
 * @property {string} blueprintId - id of the Blueprint instantiated by Nano Contract
 * @property {string} caller - address of the caller
 * @property {'mine'|'nc'|'oracle'|'wallet'} callerOrigin - caller's origin
 */

/**
 * @param {RawNcTxHistory} each
 * @returns {NcTxHistory}
 */
function toNcTxHistory(each) {
  return {
    txId: each.hash,
    timestamp: each.timestamp,
    tokens: each.tokens,
    ncId: each.nc_id,
    ncMethod: each.nc_method,
    // balance: getTxBalance.bind(transactionUtils)(each),
    // isVoided: false,
    // blueprintId: each.blueprintId,
    // caller: getCaller(each),
    // callerOrigin: getCallerOrigin(each),
  };
}

/**
 * Fetch history from Nano Contract wallet's API.
 * @param {string} ncId Nano Contract ID
 * @param {number} count Maximum quantity of history items
 * @param {string} after Transaction hash to start to get items
 */
export async function fetchHistory(ncId, count, after) {
  /**
   * @type {RawNcTxHistoryResponse} response
   */
  const response = await ncApi.getNanoContractHistory(ncId, count, after);
  const { success, history } = response;
  let next = null;

  if (!success) {
    throw new Error('Failed to fetch nano contract history');
  }

  if (history && history.length === count) {
    next = history[history.length - 1].hash;
  }

  return { history: history.map(toNcTxHistory), next };
}

/**
 * Process Nano Contract history request.
 * @param {{
 *   payload: {
 *     address: string;
 *     ncId: string;
 *     after: string;
 *   }
 * }} action with request payload.
 */
export function* requestHistoryNanoContract({ payload }) {
  const { address, ncId, after } = payload;
  const count = NANO_CONTRACT_TX_HISTORY_SIZE;

  const ncEntryKey = formatNanoContractRegistryEntry(address, ncId);
  const allNcs = STORE.getItem(nanoContractKey.registeredContracts) || {};
  if (!allNcs[ncEntryKey]) {
    yield put(nanoContractHistoryFailure(failureMessage.notRegistered));
  }

  try {
    // fetch from fullnode
    const { history, next } = yield call(fetchHistory, ncId, count, after);

    // load into store
    const allNcs = STORE.getItem(nanoContractKey.registeredContracts) || {};
    const currentNc = allNcs[ncEntryKey];
    const historyLoaded = currentNc.history || [];
    currentNc.history = [...historyLoaded, ...history];
    STORE.setItem(nanoContractKey.registeredContracts, allNcs)

    // create an opportunity to load into redux
    yield put(nanoContractHistoryLoad({
      history,
      ncEntry: ncEntryKey,
    }));

    if (!next) {
      // finish loading and give feedback to user
      yield put(nanoContractHistorySuccess());
      return;
    }

    // keep loading the next chunk
    yield put(nanoContractHistoryRequest({ address, ncId, after: next }));
  } catch (error) {
    // break loading process and give feedback to user
    yield put(nanoContractHistoryFailure(failureMessage.nanoContractHistoryFailure));
    // give opportunity for users to send the error to our team
    yield put(onExceptionCaptured(error, false));
  }
}

export function* saga() {
  yield all([
    takeEvery(types.NANOCONTRACT_REGISTER_REQUEST, registerNanoContract),
    takeEvery(types.NANOCONTRACT_HISTORY_REQUEST, requestHistoryNanoContract),
  ]);
}
