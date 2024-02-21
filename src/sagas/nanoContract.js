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
import { NanoRequest404Error } from '@hathor/wallet-lib/lib/errors';
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
  walletNotReadyError: t`Wallet is not ready yet to register a Nano Contract.`,
  addressNotMine: t`The informed address does not belong to the wallet.`,
  nanoContractStateNotFound: t`Nano Contract not found.`,
  nanoContractStateFailure: t`Error while trying to get Nano Contract state.`,
  notRegistered: t`Nano Contract not registered.`,
  nanoContractHistoryFailure: t`Error while trying to fetch Nano Contract history.`,
};

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

  const wallet = yield select((state) => state.wallet);
  if (!wallet.isReady()) {
    yield put(nanoContractRegisterFailure(failureMessage.walletNotReadyError));
    // This will show user an error modal with the option to send the error to sentry.
    yield put(onExceptionCaptured(new Error(failureMessage.walletNotReadyError), false));
    return;
  }

  const isRegistered = yield call(wallet.storage.isNanoContractRegistered, ncId);
  if (isRegistered) {
    yield put(nanoContractRegisterFailure(failureMessage.alreadyRegistered));
    return;
  }

  const isAddressMine = yield call(wallet.isAddressMine.bind(wallet), address);
  if (!isAddressMine) {
    yield put(nanoContractRegisterFailure(failureMessage.addressNotMine));
    return;
  }

  let ncState = null;
  try {
    ncState = yield call(ncApi.getNanoContractState, ncId);
  } catch (error) {
    if (error instanceof NanoRequest404Error) {
      yield put(nanoContractRegisterFailure(failureMessage.nanoContractStateNotFound));
    } else {
      yield put(nanoContractRegisterFailure(failureMessage.nanoContractStateFailure));
    }
    return;
  }

  const nc = {
    address,
    ncId,
    blueprintId: ncState.blueprint_id,
    blueprintName: ncState.blueprint_name
  };
  yield call(wallet.storage.registerNanoContract, ncId, nc);

  // emit action NANOCONTRACT_REGISTER_SUCCESS
  yield put(nanoContractRegisterSuccess({ entryKey: ncId, entryValue: nc }));
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
