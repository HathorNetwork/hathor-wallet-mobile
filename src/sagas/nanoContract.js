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
  types,
} from '../actions';

async function getNanoContractState(ncId) {
  try {
    const state = await ncApi.getNanoContractState(ncId);
    return { ncState: {...state} };
  }
  catch (err) {
    return { error: err }; 
  }
}

function* registerNanoContract(payload) {
  const { address, ncId } = payload;
  const ncEntry = `${address}.${ncId}`;

  // check the Nano Contract is already registered
  let registeredNanoContracts = STORE.getItem('nanocontract:registeredNanoContracts') || {};
  if (ncEntry in registeredNanoContracts) {
    yield put({ type: types.NANOCONTRACT_REGISTER_FAILURE, payload: { error: 'already exists.' }});
  }

  // validate address belongs to the wallet
  const wallet = yield select((state) => state.wallet);
  if (!wallet.isReady()) {
    yield put({ type: types.NANOCONTRACT_REGISTER_FAILURE, payload: { error: 'wallet is not ready yet.' }});
  }

  const isAddressMine = yield call(wallet.isAddressMine.bind(wallet), address);
  if (!isAddressMine) {
    yield put({ type: types.NANOCONTRACT_REGISTER_FAILURE, payload: { error: 'address do not belongs to the wallet.' }});
  }

  // validate nanocontract exists
  const { ncState, error } = yield call(getNanoContractState, ncId)
  if (error) {
    yield put({ type: types.NANOCONTRACT_REGISTER_FAILURE, payload: { error: 'error while trying to get Nano Contract state.' }});
  }
  
  // persist the pair address-nanocontract
  const ncPayload = {
    address: address,
    ncId: ncId,
    blueprintId: ncState.blueprint_id,
    blueprintName: ncState.blueprint_name
  };
  registeredNanoContracts = STORE.getItem('nanocontract:registeredNanoContracts') || {};
  registeredNanoContracts[ncEntry] = ncPayload;
  STORE.setItem('nanocontract:registeredNanoContracts', registeredNanoContracts)

  // emit action NANOCONTRACT_REGISTER_SUCCESS
  yield put({ type: types.NANOCONTRACT_REGISTER_SUCCESS, payload: ncPayload });
}

export function* saga() {
  yield all([
    takeEvery(types.NANOCONTRACT_REGISTER_REQUEST, registerNanoContract),
  ]);
}
