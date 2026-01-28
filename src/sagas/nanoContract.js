/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ncApi,
} from '@hathor/wallet-lib';
import {
  getBlueprintId as libGetBlueprintId,
} from '@hathor/wallet-lib/lib/nano_contracts/utils';
import {
  takeEvery,
  select,
  all,
  put,
  call,
  debounce,
} from 'redux-saga/effects';
import { t } from 'ttag';
import { NanoRequest404Error } from '@hathor/wallet-lib/lib/errors';
import { getRegisteredNanoContracts, safeEffect } from './helpers';
import {
  nanoContractBlueprintInfoFailure,
  nanoContractBlueprintInfoSuccess,
  nanoContractHistoryClean,
  nanoContractHistoryFailure,
  nanoContractHistoryLoading,
  nanoContractHistorySuccess,
  nanoContractRegisterFailure,
  nanoContractRegisterSuccess,
  nanoContractUnregisterSuccess,
  onExceptionCaptured,
  types,
} from '../actions';
import { logger } from '../logger';
import { NANO_CONTRACT_TX_HISTORY_SIZE } from '../constants';
import { isNanoContractsEnabled, getResultHelper } from '../utils';

const log = logger('nano-contract-saga');

/**
 * Synchronous lock mechanism to prevent race conditions in concurrent history requests.
 * Maps ncId -> Set of currently loading request types ('initial', 'before', 'after').
 *
 * This is necessary because the Redux state check (historyMeta.isLoading) has a race window
 * between `yield select()` and `yield put()` where multiple sagas can pass the guard.
 *
 * @type {Map<string, Set<'initial' | 'before' | 'after'>>}
 */
const loadingByNcId = new Map();

/**
 * Gets or creates the Set of loading request types for a given ncId.
 * @param {string} ncId Nano Contract ID
 * @returns {Set<string>}
 */
function getLoadingSet(ncId) {
  if (!loadingByNcId.has(ncId)) {
    loadingByNcId.set(ncId, new Set());
  }
  return loadingByNcId.get(ncId);
}

/**
 * Removes a request type from the loading set and cleans up if empty.
 * @param {string} ncId Nano Contract ID
 * @param {string} requestType The request type to remove
 */
function cleanupLoading(ncId, requestType) {
  const loading = loadingByNcId.get(ncId);
  if (loading) {
    loading.delete(requestType);
    if (loading.size === 0) {
      loadingByNcId.delete(ncId);
    }
  }
}

export const failureMessage = {
  alreadyRegistered: t`Nano Contract already registered.`,
  walletNotReadyError: t`Wallet is not ready yet to register a Nano Contract.`,
  addressNotMine: t`The informed address does not belong to the wallet.`,
  nanoContractStateNotFound: t`Nano Contract not found.`,
  nanoContractFailure: t`Error while trying to register Nano Contract.`,
  nanoContractInvalid: t`Invalid transaction to register as Nano Contract.`,
  blueprintInfoNotFound: t`Blueprint not found.`,
  blueprintInfoFailure: t`Couldn't get Blueprint info.`,
  notRegistered: t`Nano Contract not registered.`,
  nanoContractHistoryFailure: t`Error while trying to download Nano Contract transactions history.`,
};

/**
 * Call the async wallet method `isAddressMine` considering the type of wallet.
 *
 * @param {Object} wallet A wallet instance
 * @param {string} address A wallet address to check
 * @param {boolean} useWalletService A flag that determines if wallet service is in use
 */
export const isAddressMine = async (wallet, address, useWalletService) => {
  // XXX: Wallet Service doesn't implement isAddressMine.
  // See issue: https://github.com/HathorNetwork/hathor-wallet-lib/issues/732
  // Default to `false` if using Wallet Service.
  if (useWalletService) {
    return false;
  }

  const isMine = await wallet.isAddressMine(address);
  return isMine;
};

export function* init() {
  const isEnabled = yield select(isNanoContractsEnabled);
  if (!isEnabled) {
    log.debug('Halting nano contract initialization because the feature flag is disabled.');
    return;
  }

  const wallet = yield select((state) => state.wallet);
  const contracts = yield call(getRegisteredNanoContracts, wallet);
  for (const contract of contracts) {
    yield put(nanoContractRegisterSuccess({ entryKey: contract.ncId, entryValue: contract }));
  }
  log.debug('Registered Nano Contracts loaded.');
}

/**
 * Retrieves the blueprint ID for a nano contract by its ID.
 *
 * The priority is to get the data from the getFullTxById API because
 * it gets contract txs that are still to be confirmed by a block. If it fails,
 * the contract might have been created by another contract, so we fallback to the state
 * API, which gets the information correctly in that case.
 *
 * @returns A promise resolving to the blueprint ID or null if ncId is not a contract
 */
export async function getBlueprintId(wallet, ncId) {
  const [txError, blueprintId] = (await getResultHelper(() => libGetBlueprintId(ncId, wallet)));

  if (txError || !blueprintId) {
    // The saga method will handle the error in this case
    return null;
  }

  return blueprintId;
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

  const isAddrMine = yield call([wallet, wallet.isAddressMine], address);

  if (!isAddrMine) {
    log.debug('Fail registering Nano Contract because address do not belongs to this wallet.');
    yield put(nanoContractRegisterFailure(failureMessage.addressNotMine));
    return;
  }

  const blueprintId = yield call(getBlueprintId, wallet, ncId);

  if (!blueprintId) {
    log.debug('Fail registering Nano Contract while getting full transaction by ID.');
    yield put(nanoContractRegisterFailure(failureMessage.nanoContractFailure));
    return;
  }

  let blueprintName = null;
  try {
    const blueprintInfo = yield call([ncApi, ncApi.getBlueprintInformation], blueprintId);
    blueprintName = blueprintInfo.name;
    // Also set blueprint on store
    yield put(nanoContractBlueprintInfoSuccess(blueprintId, blueprintInfo));
  } catch (error) {
    if (error instanceof NanoRequest404Error) {
      yield put(nanoContractRegisterFailure(failureMessage.blueprintInfoNotFound));
    } else {
      log.error('Error while registering Nano Contract.', error);
      yield put(nanoContractRegisterFailure(failureMessage.blueprintInfoFailure));
    }
    return;
  }

  const nc = {
    address,
    ncId,
    blueprintId,
    blueprintName,
  };
  yield call(wallet.storage.registerNanoContract.bind(wallet.storage), ncId, nc);

  log.debug(`Success registering Nano Contract. nc = ${nc}`);
  // emit action NANOCONTRACT_REGISTER_SUCCESS with feedback to user
  yield put(nanoContractRegisterSuccess({ entryKey: ncId, entryValue: nc, hasFeedback: true }));
}

/**
 * Effect invoked by safeEffect if an unexpected error occurs.
 *
 * @param {Object} error The error captured.
 */
function* registerNanoContractOnError(error) {
  log.error('Unexpected error while registering Nano Contract.', error);
  yield put(nanoContractRegisterFailure(failureMessage.nanoContractFailure));
  yield put(onExceptionCaptured(error, false));
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
 * @property {string} nc_address
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
 * @req {Object} req
 * @param {string} req.ncId Nano Contract ID
 * @param {number} req.count Maximum quantity of items to fetch
 * @param {string} req.before Transaction hash to start to get newer items
 * @param {string} req.after Transaction hash to start to get older items
 * @param {Object} req.wallet Wallet instance from redux state
 * @param {boolean} req.useWalletService A flag that determines if wallet service is in use
 *
 * @returns {{
 *   history: NcTxHistory;
 * }}
 *
 * @throws {Error} when request code is greater then 399 or when response's success is false
 */
export async function fetchHistory(req) {
  const {
    wallet,
    useWalletService,
    ncId,
    count,
    after,
    before,
  } = req;
  /**
   * @type {RawNcTxHistoryResponse} response
   */
  const response = await ncApi.getNanoContractHistory(
    ncId,
    count,
    after || null,
    before || null,
  );
  const { success, history: rawHistory } = response;

  if (!success) {
    throw new Error('Failed to fetch nano contract history');
  }

  // Translate rawNcTxHistory to NcTxHistory
  // Prouce a list ordered from newest to oldest
  const transformedTxHistory = rawHistory.map(async (rawTx) => {
    const caller = rawTx.nc_address;

    const actions = rawTx.nc_context.actions.map((each) => {
      // For authority actions, determine the authority type from mint/melt flags
      let authority = null;
      if (each.type === 'grant_authority' || each.type === 'acquire_authority') {
        if (each.mint && each.melt) {
          authority = 'mint, melt';
        } else if (each.mint) {
          authority = 'mint';
        } else if (each.melt) {
          authority = 'melt';
        }
      }

      const mappedAction = {
        type: each.type,
        uid: each.token_uid,
        amount: each.amount,
        authority,
      };

      return mappedAction;
    });
    const isMine = await isAddressMine(wallet, caller, useWalletService);

    const tx = {
      txId: rawTx.hash,
      timestamp: rawTx.timestamp,
      tokens: rawTx.tokens,
      isVoided: rawTx.is_voided,
      ncId: rawTx.nc_id,
      ncMethod: rawTx.nc_method,
      blueprintId: rawTx.nc_blueprint_id,
      firstBlock: rawTx.first_block,
      caller,
      actions,
      isMine,
    };
    return tx;
  });

  return { history: await Promise.all(transformedTxHistory) };
}

/**
 * Process Nano Contract history request.
 * @param {{
 *   payload: {
 *     ncId: string;
 *     before?: string;
 *     after?: string;
 *   }
 * }} action with request payload.
 */
export function* requestHistoryNanoContract({ payload }) {
  const { ncId, before, after } = payload;
  log.debug('Start processing request for nano contract transaction history...');

  // Determine request type: 'before' (newer txs), 'after' (older txs), or 'initial' (full reload)
  let requestType = 'initial';
  if (before != null) {
    requestType = 'before';
  } else if (after != null) {
    requestType = 'after';
  }
  const loading = getLoadingSet(ncId);

  // Synchronous lock check - prevents race condition between yield select() and yield put()
  // Block conditions:
  // 1. Same request type already in-flight (duplicate request)
  // 2. Initial is loading (it will replace everything, so other requests should wait)
  // 3. This is initial but before/after are in-flight (their results would be lost)
  const shouldBlock = loading.has(requestType)
    || loading.has('initial')
    || (requestType === 'initial' && loading.size > 0);

  if (shouldBlock) {
    log.debug(`Halting: conflicting history load for ncId=${ncId}, type=${requestType}, current=[${[...loading]}]`);
    return;
  }

  // Acquire lock synchronously before any yield
  loading.add(requestType);

  try {
    yield put(nanoContractHistoryLoading({ ncId }));

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

    if (before == null && after == null) {
      // it clean the history when starting load from the beginning
      log.debug('Cleaning previous history to start over.');
      yield put(nanoContractHistoryClean({ ncId }));
    }

    const useWalletService = yield select((state) => state.useWalletService);
    const req = {
      wallet,
      useWalletService,
      ncId,
      before,
      after,
      count: NANO_CONTRACT_TX_HISTORY_SIZE,
    };
    const { history } = yield call(fetchHistory, req);

    log.debug('Success fetching Nano Contract history.');
    if (before != null) {
      log.debug('Adding beforeHistory.');
      yield put(nanoContractHistorySuccess({ ncId, beforeHistory: history }));
    } else if (after != null) {
      log.debug('Adding afterHistory.');
      yield put(nanoContractHistorySuccess({ ncId, afterHistory: history }));
    } else {
      log.debug('Initializing history.');
      yield put(nanoContractHistorySuccess({ ncId, history }));
    }
  } catch (error) {
    log.error('Error while fetching Nano Contract history.', error);
    // break loading process and give feedback to user
    yield put(
      nanoContractHistoryFailure({ ncId, error: failureMessage.nanoContractHistoryFailure })
    );
    // give opportunity for users to send the error to our team
    yield put(onExceptionCaptured(error, false));
  } finally {
    // Always release the lock, even on error or early return
    cleanupLoading(ncId, requestType);
  }
}

/**
 * Process Nano Contract unregister request.
 * @param {{
 *   payload: {
 *     ncId: string;
 *   }
 * }} action with request payload.
 */
export function* unregisterNanoContract({ payload }) {
  const { ncId } = payload;

  const wallet = yield select((state) => state.wallet);
  if (!wallet.isReady()) {
    log.error('Fail unregistering Nano Contract because wallet is not ready yet.');
    // This will show user an error modal with the option to send the error to sentry.
    yield put(onExceptionCaptured(new Error(failureMessage.walletNotReadyError), true));
    return;
  }

  yield call(wallet.storage.unregisterNanoContract.bind(wallet.storage), ncId);

  log.debug(`Success unregistering Nano Contract. ncId = ${ncId}`);
  yield put(nanoContractUnregisterSuccess({ ncId }));
}

/**
 * Process update on registered Nano Contract address to persist on store.
 * @param {{
 *   payload: {
 *     ncId: string;
 *     newAddress: string;
 *   }
 * }}
 */
export function* requestNanoContractAddressChange({ payload }) {
  const { ncId, newAddress } = payload;

  const wallet = yield select((state) => state.wallet);
  if (!wallet.isReady()) {
    log.error('Fail updating Nano Contract address because wallet is not ready yet.');
    // This will show user an error modal with the option to send the error to sentry.
    yield put(onExceptionCaptured(new Error(failureMessage.walletNotReadyError), true));
    return;
  }

  const useWalletService = yield select((state) => state.useWalletService);

  if (useWalletService) {
    // TODO: We should remove this when we refactor the wallet-lib to properly
    // implement this method when on the wallet-service
    wallet.storage.isAddressMine = wallet.isAddressMine.bind(wallet);
  }

  yield call(
    [
      wallet.storage,
      wallet.storage.updateNanoContractRegisteredAddress
    ],
    ncId,
    newAddress,
  );
  log.debug(`Success persisting Nano Contract address update. ncId = ${ncId}`);
}

/**
 * Process request to fetch blueprint info.
 * @param {{
 *   payload: {
 *     id: string;
 *   }
 * }}
 */
export function* requestBlueprintInfo({ payload }) {
  const { id } = payload;
  let blueprintInfo = null;
  try {
    blueprintInfo = yield call([ncApi, ncApi.getBlueprintInformation], id);
  } catch (error) {
    if (error instanceof NanoRequest404Error) {
      yield put(nanoContractBlueprintInfoFailure(id, failureMessage.blueprintInfoNotFound));
    } else {
      log.error('Error while fetching blueprint info.', error);
      yield put(nanoContractBlueprintInfoFailure(id, failureMessage.blueprintInfoFailure));
    }
    return;
  }

  log.debug(`Success fetching blueprint info. id = ${id}`);
  yield put(nanoContractBlueprintInfoSuccess(id, blueprintInfo));
}

export function* saga() {
  yield all([
    debounce(500, [[types.START_WALLET_SUCCESS, types.NANOCONTRACT_INIT]], init),
    takeEvery(
      types.NANOCONTRACT_REGISTER_REQUEST,
      safeEffect(registerNanoContract, registerNanoContractOnError)
    ),
    takeEvery(types.NANOCONTRACT_HISTORY_REQUEST, requestHistoryNanoContract),
    takeEvery(types.NANOCONTRACT_UNREGISTER_REQUEST, unregisterNanoContract),
    takeEvery(types.NANOCONTRACT_ADDRESS_CHANGE_REQUEST, requestNanoContractAddressChange),
    takeEvery(types.NANOCONTRACT_BLUEPRINTINFO_REQUEST, requestBlueprintInfo),
  ]);
}
