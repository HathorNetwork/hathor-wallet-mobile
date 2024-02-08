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
import { STORE } from '../store';
import {
  nanoContractRegisterFailure,
  nanoContractRegisterSuccess,
  types,
} from '../actions';
import { nanoContractKey } from '../constants';

export const failureMessage = {
  alreadyRegistered: 'Nano Contract already registered.',
  walletNotReady: 'Wallet is not ready yet.',
  addressNotMine: 'The informed address do not belongs to the wallet.',
  nanoContractStateFailure: 'Error while trying to get Nano Contract state.',
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
    return { ncState: {...state} };
  }
  catch (err) {
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

  // check the Nano Contract is already registered
  let registeredNanoContracts = STORE.getItem(nanoContractKey.registeredContracts) || {};
  if (ncEntryKey in registeredNanoContracts) {
    yield put(nanoContractRegisterFailure(failureMessage.alreadyRegistered));
    return;
  }

  // validate address belongs to the wallet
  const wallet = yield select((state) => state.wallet);
  if (!wallet.isReady()) {
    yield put(nanoContractRegisterFailure(failureMessage.walletNotReady));
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
  
  // persist the pair address-nanocontract
  const ncEntryValue = {
    address: address,
    ncId: ncId,
    blueprintId: ncState.blueprint_id,
    blueprintName: ncState.blueprint_name
  };
  registeredNanoContracts = STORE.getItem(nanoContractKey.registeredContracts) || {};
  registeredNanoContracts[ncEntryKey] = ncEntryValue;
  STORE.setItem(nanoContractKey.registeredContracts, registeredNanoContracts)

  // emit action NANOCONTRACT_REGISTER_SUCCESS
  yield put(nanoContractRegisterSuccess({ entryKey: ncEntryKey, entryValue: ncEntryValue }));
}

export function* saga() {
  yield all([
    takeEvery(types.NANOCONTRACT_REGISTER_REQUEST, registerNanoContract),
  ]);
}
