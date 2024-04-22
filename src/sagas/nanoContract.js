import {
  ncApi,
  transactionUtils,
  addressUtils,
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
  nanoContractHistorySuccess,
  nanoContractRegisterFailure,
  nanoContractRegisterSuccess,
  onExceptionCaptured,
  types,
} from '../actions';
import { logger } from '../logger';
import { NANO_CONTRACT_TX_HISTORY_SIZE } from '../constants';

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
    log.debug('Fail registering Nano Contract because wallet is not ready yet.');
    yield put(nanoContractRegisterFailure(failureMessage.walletNotReadyError));
    // This will show user an error modal with the option to send the error to sentry.
    yield put(onExceptionCaptured(new Error(failureMessage.walletNotReadyError), false));
    return;
  }

  const isNanoContractRegisteredFn = wallet.storage.isNanoContractRegistered.bind(wallet.storage);
  const isRegistered = yield call(isNanoContractRegisteredFn, ncId);
  if (isRegistered) {
    log.debug('Fail registering Nano Contract because it is already registered.');
    yield put(nanoContractRegisterFailure(failureMessage.alreadyRegistered));
    return;
  }

  const isAddressMine = yield call(wallet.isAddressMine.bind(wallet), address);
  if (!isAddressMine) {
    log.debug('Fail registering Nano Contract because address do not belongs to this wallet.');
    yield put(nanoContractRegisterFailure(failureMessage.addressNotMine));
    return;
  }

  let ncState = null;
  try {
    ncState = yield call(ncApi.getNanoContractState.bind(ncApi), ncId);
  } catch (error) {
    if (error instanceof NanoRequest404Error) {
      yield put(nanoContractRegisterFailure(failureMessage.nanoContractStateNotFound));
    } else {
      log.error('Error while registering Nano Contract.', error);
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
  yield call(wallet.storage.registerNanoContract.bind(wallet.storage), ncId, nc);

  log.debug('Success registering Nano Contract.');
  // emit action NANOCONTRACT_REGISTER_SUCCESS
  yield put(nanoContractRegisterSuccess({ entryKey: ncId, entryValue: nc }));
}

/**
 * @typedef {Object} RawNcTxHistory
 * @property {string} hash
 * @property {Object[]} inputs
 * @property {Object[]} outputs
 * @property {string} nc_args
 * @property {string} nc_blueprint_id
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
 * @property {boolean} is_voided
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
 * @property {boolean} isMine - flag indicating the caller address belongs to this wallet
 */

/**
 * Fetch history from Nano Contract wallet's API.
 * @param {string} ncId Nano Contract ID
 * @param {number} count Maximum quantity of history items
 * @param {string} after Transaction hash to start to get items
 * @param {Object} wallet Wallet instance from redux state
 *
 * @throws {Error} when request code is greater then 399 or when response's success is false
 */
export async function fetchHistory(ncId, count, after, wallet) {
  /**
   * @type {RawNcTxHistoryResponse} response
   */
  const response = await ncApi.getNanoContractHistory(ncId, count, after);
  const { success, history: rawHistory } = response;

  if (!success) {
    throw new Error('Failed to fetch nano contract history');
  }

  const history = [];
  for (const rawTx of rawHistory) {
    const network = wallet.getNetworkObject();
    const caller = addressUtils.getAddressFromPubkey(rawTx.nc_pubkey, network).base58;
    // eslint-disable-next-line no-await-in-loop
    const isMine = await wallet.isAddressMine(caller);
    const getTxBalanceFn = transactionUtils.getTxBalance.bind(transactionUtils);
    // eslint-disable-next-line no-await-in-loop
    const balance = await getTxBalanceFn(rawTx, wallet.storage);
    const tx = {
      txId: rawTx.hash,
      timestamp: rawTx.timestamp,
      tokens: rawTx.tokens,
      isVoided: rawTx.is_voided,
      ncId: rawTx.nc_id,
      ncMethod: rawTx.nc_method,
      blueprintId: rawTx.nc_blueprint_id,
      caller,
      isMine,
      balance,
    };
    history.push(tx);
  }

  let next = null;
  if (history && history.length === count) {
    next = history[history.length - 1].txId;
  }

  return { history, next };
}

/**
 * Process Nano Contract history request.
 * @param {{
 *   payload: {
 *     ncId: string;
 *     after: string;
 *   }
 * }} action with request payload.
 */
export function* requestHistoryNanoContract({ payload }) {
  const { ncId, after } = payload;
  const count = NANO_CONTRACT_TX_HISTORY_SIZE;

  const historyMeta = yield select((state) => state.nanoContract.historyMeta);
  if (historyMeta[ncId] && historyMeta[ncId].isLoading) {
    // Do nothing if nano contract already loading...
    return;
  }

  const wallet = yield select((state) => state.wallet);
  if (!wallet.isReady()) {
    log.debug('Fail fetching Nano Contract history because wallet is not ready.');
    yield put(nanoContractHistoryFailure({ ncId, error: failureMessage.walletNotReadyError }));
    // This will show user an error modal with the option to send the error to sentry.
    yield put(onExceptionCaptured(new Error(failureMessage.walletNotReadyError), false));
    return;
  }

  const fn = wallet.storage.isNanoContractRegistered.bind(wallet.storage);
  const isNcRegistered = yield call(fn, ncId);
  if (!isNcRegistered) {
    log.debug('Fail fetching Nano Contract history because Nano Contract is not registered yet.');
    yield put(nanoContractHistoryFailure({ ncId, error: failureMessage.notRegistered }));
    return;
  }

  try {
    // fetch from fullnode
    const { history, next } = yield call(fetchHistory, ncId, count, after, wallet);

    log.debug('Success fetching Nano Contract history.');
    yield put(nanoContractHistorySuccess({ ncId, history, after: next }));
  } catch (error) {
    log.error('Error while fetching Nano Contract history.', error);
    // break loading process and give feedback to user
    yield put(
      nanoContractHistoryFailure({ ncId, error: failureMessage.nanoContractHistoryFailure })
    );
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
