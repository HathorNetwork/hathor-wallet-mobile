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
  walletNotReadyError: t`Wallet is not ready yet to register a Nano Contract.`,
  addressNotMine: t`The informed address do not belongs to the wallet.`,
  nanoContractStateFailure: t`Error while trying to get Nano Contract state.`,
};

/**
 * Calls Nano Contract API to retrieve Nano Contract state.
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
  const storage = STORE.getStorage();

  // check the Nano Contract is already registered
  const isRegistered = yield call(storage.isNanoContractRegistered, ncId);
  if (isRegistered) {
    yield put(nanoContractRegisterFailure(failureMessage.alreadyRegistered));
    return;
  }

  // validate address belongs to the wallet
  const wallet = yield select((state) => state.wallet);
  if (!wallet.isReady()) {
    yield put(nanoContractRegisterFailure(failureMessage.walletNotReadyError));
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
  const nc = {
    address,
    ncId,
    blueprintId: ncState.blueprint_id,
    blueprintName: ncState.blueprint_name
  };
  yield call(storage.registerNanoContract, ncId, nc);

  // emit action NANOCONTRACT_REGISTER_SUCCESS
  yield put(nanoContractRegisterSuccess({ entryKey: ncId, entryValue: nc }));
}

export function* saga() {
  yield all([
    takeEvery(types.NANOCONTRACT_REGISTER_REQUEST, registerNanoContract),
  ]);
}
