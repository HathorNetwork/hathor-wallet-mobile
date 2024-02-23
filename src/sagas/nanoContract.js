import {
  ncApi
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
  nanoContractRegisterFailure,
  nanoContractRegisterSuccess,
  onExceptionCaptured,
  types,
} from '../actions';

export const failureMessage = {
  alreadyRegistered: t`Nano Contract already registered.`,
  walletNotReady: t`Wallet is not ready yet.`,
  walletNotReadyError: t`Wallet is not ready yet to register a Nano Contract.`,
  addressNotMine: t`The informed address do not belongs to the wallet.`,
  nanoContractStateFailure: t`Error while trying to get Nano Contract state.`,
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

export function* saga() {
  yield all([
    takeEvery(types.NANOCONTRACT_REGISTER_REQUEST, registerNanoContract),
  ]);
}
