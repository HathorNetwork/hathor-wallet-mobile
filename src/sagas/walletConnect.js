/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 *  ┌──────────────────────┐     ┌────────┐     ┌───────────┐
 *  │                      │     │        │     │   SETUP   │
 *  │ START_WALLET_SUCCESS ├─────►  INIT  ├─────►           │
 *  │                      │     │        │     │ LISTENERS │
 *  └──────────────────────┘     └────────┘     └───────────┘
 *
 *  ┌──────────────┐    ┌─────────────────┐
 *  │              │    │                 │
 *  │ DAPP REQUEST ├────► SESSION_REQUEST │
 *  │              │    │                 │
 *  └──────────────┘    └─────────────────┘
 *
 *  ┌──────────────┐     ┌────────────────┐
 *  │              │     │                │
 *  │ RESET_WALLET ├─────► CLEAR_SESSIONS │
 *  │              │     │                │
 *  └──────────────┘     └────────────────┘
 *
 *  ┌──────────────┐   ┌──────────────────┐
 *  │              │   │                  │
 *  │ URI_INPUTTED ├─┬─► SESSION_PROPOSAL │
 *  │              │ │ │                  │
 *  └──────────────┘ │ └──────────────────┘
 *                   │
 *  ┌────────────┐   │
 *  │            │   │
 *  │ QR_SCANNED ├───┘
 *  │            │
 *  └────────────┘
 *
 * SESSION_REQUEST: Handles new messages published on the cloud message queue
 * for the current session by the dApp.
 * SESSION_PROPOSAL: Handles a new dApp connection, initialized by the pair method
 * on web3wallet
 * RESET_WALLET: This action is dispatched when the user resets his wallet.
 * START_WALLET_SUCCESS: This action is dispatched when the wallet is successfully
 * loaded.
 */

import '@walletconnect/react-native-compat';
import {
  call,
  fork,
  take,
  all,
  put,
  cancel,
  cancelled,
  takeLatest,
  takeLeading,
  takeEvery,
  select,
  race,
  spawn,
} from 'redux-saga/effects';
import { t } from 'ttag';
import { eventChannel } from 'redux-saga';
import { get, values } from 'lodash';

import { WalletConnectModalTypes } from '../components/WalletConnect/WalletConnectModal';
import {
  WALLET_CONNECT_PROJECT_ID,
  WALLET_CONNECT_FEATURE_TOGGLE,
} from '../constants';
import {
  types,
  setWalletConnect,
  setWalletConnectModal,
  setWalletConnectSessions,
  onExceptionCaptured,
  setWCConnectionFailed,
  showSignMessageWithAddressModal,
  showNanoContractSendTxModal,
  setNewNanoContractStatusLoading,
  setNewNanoContractStatusReady,
  setNewNanoContractStatusFailure,
  setNewNanoContractStatusSuccess,
  showPinScreenForResult,
} from '../actions';
import { checkForFeatureFlag, getNetworkSettings } from './helpers';
import { store } from '../reducers/reducer.init';
import NavigationService from '../NavigationService';

const AVAILABLE_METHODS = {
  HATHOR_SIGN_MESSAGE: 'htr_signWithAddress',
  HATHOR_SEND_NANO_TX: 'htr_sendNanoContractTx',
};
const AVAILABLE_EVENTS = [];

/**
 * Those are the only ones we are currently using, extracted from
 * https://docs.walletconnect.com/2.0/specs/clients/sign/error-codes
 */
const ERROR_CODES = {
  UNAUTHORIZED_METHODS: 3001,
  USER_DISCONNECTED: 6000,
  USER_REJECTED: 5000,
  USER_REJECTED_METHOD: 5002,
  INVALID_PAYLOAD: 5003,
};

// We're mocking it here because we don't want to add the walletconnect
// libraries in our production build. If you really want to add it, just run the
// src/walletconnect.sh script
const Core = class {};
const Web3Wallet = class {};

function* isWalletConnectEnabled() {
  const walletConnectEnabled = yield call(checkForFeatureFlag, WALLET_CONNECT_FEATURE_TOGGLE);

  return walletConnectEnabled;
}

function* init() {
  try {
    const walletConnectEnabled = yield call(isWalletConnectEnabled);

    if (!walletConnectEnabled) {
      return;
    }

    const core = new Core({
      projectId: WALLET_CONNECT_PROJECT_ID,
    });

    const metadata = {
      name: 'Hathor',
      description: 'Hathor Mobile Wallet',
      url: 'https://hathor.network/',
    };

    const web3wallet = yield call(Web3Wallet.init, {
      core,
      metadata,
    });

    yield put(setWalletConnect({
      web3wallet,
      core,
    }));

    yield fork(setupListeners, web3wallet);

    // Refresh redux with the active sessions, loaded from storage
    yield call(refreshActiveSessions);

    // If the wallet is reset, we should cancel all listeners
    yield take(types.RESET_WALLET);

    yield cancel();
  } catch (error) {
    console.error('Error loading wallet connect', error);
    yield put(onExceptionCaptured(error));
  }
}

export function* refreshActiveSessions() {
  const { web3wallet } = yield select((state) => state.walletConnect.client);

  const activeSessions = yield call(() => web3wallet.getActiveSessions());
  yield put(setWalletConnectSessions(activeSessions));
}

/**
 * @param {Web3Wallet} web3wallet The WalletConnect web3wallet instance
 */
export function* setupListeners(web3wallet) {
  const channel = eventChannel((emitter) => {
    const listenerMap = new Map();
    const addListener = (eventName) => {
      const listener = async (data) => {
        emitter({
          type: `WC_${eventName.toUpperCase()}`,
          data,
        });
      };

      web3wallet.on(eventName, listener);
      listenerMap.set(eventName, listener);
    };

    addListener('session_request');
    addListener('session_proposal');
    addListener('session_delete');

    return () => listenerMap.forEach((
      listener,
      eventName,
    ) => web3wallet.removeListener(eventName, listener));
  });

  try {
    while (true) {
      const message = yield take(channel);

      yield put({
        type: message.type,
        payload: message.data,
      });
    }
  } finally {
    if (yield cancelled()) {
      // When we close the channel, it will remove the event listener
      channel.close();
    }
  }
}

/**
 * This saga will publish on the cloud server a RPC message disconnecting
 * the current client.
 */
export function* clearSessions() {
  const { web3wallet } = yield select((state) => state.walletConnect.client);
  const activeSessions = yield call(() => web3wallet.getActiveSessions());

  for (const key of Object.keys(activeSessions)) {
    yield call(() => web3wallet.disconnectSession({
      topic: activeSessions[key].topic,
      reason: {
        code: ERROR_CODES.USER_DISCONNECTED,
        message: '',
      },
    }));
  }

  yield call(refreshActiveSessions);
}

/**
 * This saga will be called (dispatched from the event listener) when a session
 * is requested from a dApp
 */
export function* onSessionRequest(action) {
  const { payload } = action;
  const { params } = payload;

  const wallet = yield select((state) => state.wallet);

  const { web3wallet } = yield select((state) => state.walletConnect.client);
  const activeSessions = yield call(() => web3wallet.getActiveSessions());
  const requestSession = activeSessions[payload.topic];

  if (!requestSession) {
    console.error('Could not identify the request session, ignoring request..');
    return;
  }

  const data = {
    icon: get(requestSession.peer, 'metadata.icons[0]', null),
    proposer: get(requestSession.peer, 'metadata.name', ''),
    url: get(requestSession.peer, 'metadata.url', ''),
    description: get(requestSession.peer, 'metadata.description', ''),
  };

  try {
    const response = yield call(handleRpcRequest, params.request, wallet, data, promptHandler);

    switch (response.type) {
      case RpcResponseTypes.SendNanoContractTxResponse:
        yield put(setNewNanoContractStatusSuccess());
        break;
      default:
        break;
    }

    yield call(() => web3wallet.respondSessionRequest({
      topic: payload.topic,
      response: {
        id: payload.id,
        jsonrpc: '2.0',
        result: response,
      }
    }));
  } catch (e) {
    let shouldAnswer = true;
    switch (e.constructor) {
      case SendNanoContractTxFailure: {
        yield put(setNewNanoContractStatusFailure());

        // User might try again, wait for it.
        const { retry } = yield race({
          retry: take(types.WALLETCONNECT_NEW_NANOCONTRACT_RETRY),
          dismiss: take(types.WALLETCONNECT_NEW_NANOCONTRACT_RETRY_DISMISS),
        });

        if (retry) {
          shouldAnswer = false;
          // Retry the action, exactly as it came:
          yield spawn(onSessionRequest, action);
        }
      } break;
      default:
        break;
    }

    if (shouldAnswer) {
      console.log('Error: ', e);
      yield call(() => web3wallet.respondSessionRequest({
        topic: payload.topic,
        response: {
          id: payload.id,
          jsonrpc: '2.0',
          error: {
            code: ERROR_CODES.USER_REJECTED_METHOD,
            message: 'Rejected by the user',
          },
        },
      }));
    }
  }
}

async function promptHandler(request, requestMetadata) {
  // eslint-disable-next-line
  return new Promise(async (resolve, reject) => {
    switch (request.type) {
      case TriggerTypes.SignMessageWithAddressConfirmationPrompt: {
        const signMessageResponseTemplate = (accepted) => () => resolve({
          type: TriggerResponseTypes.SignMessageWithAddressConfirmationResponse,
          data: accepted,
        });
        store.dispatch(showSignMessageWithAddressModal(
          signMessageResponseTemplate(true),
          signMessageResponseTemplate(false),
          request.data,
          requestMetadata,
        ))
      } break;
      case TriggerTypes.SendNanoContractTxConfirmationPrompt: {
        const sendNanoContractTxResponseTemplate = (accepted) => (data) => resolve({
          type: TriggerResponseTypes.SendNanoContractTxConfirmationResponse,
          data: {
            accepted,
            nc: data?.payload,
          }
        });

        store.dispatch(showNanoContractSendTxModal(
          sendNanoContractTxResponseTemplate(true),
          sendNanoContractTxResponseTemplate(false),
          request.data,
          requestMetadata,
        ));
      } break;
      case TriggerTypes.SendNanoContractTxLoadingTrigger:
        store.dispatch(setNewNanoContractStatusLoading());
        resolve();
        break;
      case TriggerTypes.LoadingFinishedTrigger:
        store.dispatch(setNewNanoContractStatusReady());
        resolve();
        break;
      case TriggerTypes.PinConfirmationPrompt:
        store.dispatch(showPinScreenForResult((pinCode) => resolve({
          type: TriggerResponseTypes.PinRequestResponse,
          data: {
            accepted: true,
            pinCode,
          }
        }))); break;
      default: reject(new Error('Invalid request'));
    }
  });
}

export function* onShowPinScreenForResult({ payload }) {
  const { resolve } = payload;

  NavigationService.navigate('PinScreen', {
    canCancel: false,
    dispatchResponse: true,
    screenText: t`Enter your 6-digit pin to authorize operation`,
    biometryText: t`Authorize operation`,
  });

  const resolvedAction = yield take(types.PIN_SCREEN_RESULT);

  resolve(resolvedAction.payload);
}

/**
 * This saga will be called (dispatched from the event listener) when a sign
 * message RPC is published from a dApp
 *
 * @param {String} data.requestId Unique identifier of the request
 * @param {String} data.topic Unique identifier of the connected session
 * @param {String} data.message Message the dApp requested a signature for
 */
export function* onSignMessageRequest({ payload }) {
  const { accept, deny: denyCb, data, dapp } = payload;

  const wallet = yield select((state) => state.wallet);

  if (!wallet.isReady()) {
    console.error('Got a session request but wallet is not ready, ignoring..');
    return;
  }

  yield put(setWalletConnectModal({
    show: true,
    type: WalletConnectModalTypes.SIGN_MESSAGE,
    data: {
      data,
      dapp,
    },
  }));

  const { deny } = yield race({
    accept: take(types.WALLET_CONNECT_ACCEPT),
    deny: take(types.WALLET_CONNECT_REJECT),
  });

  if (deny) {
    denyCb();

    return;
  }

  accept();
}

export function* onSendNanoContractTxRequest({ payload }) {
  const { accept: acceptCb, deny: denyCb, nc, dapp } = payload;

  const wallet = yield select((state) => state.wallet);

  if (!wallet.isReady()) {
    console.error('Got a session request but wallet is not ready, ignoring..');
    return;
  }

  yield put(setWalletConnectModal({
    show: true,
    type: WalletConnectModalTypes.SEND_NANO_CONTRACT_TX,
    data: {
      dapp,
      data: nc,
    },
  }));

  const { deny, accept } = yield race({
    accept: take(types.WALLET_CONNECT_ACCEPT),
    deny: take(types.WALLET_CONNECT_REJECT),
  });

  if (deny) {
    denyCb();

    return;
  }

  acceptCb(accept);
}

/**
 * Listens for the wallet reset action, dispatched from the wallet sagas so we
 * can clear all current sessions.
 */
export function* onWalletReset() {
  const walletConnect = yield select((state) => state.walletConnect);
  if (!walletConnect || !walletConnect.client) {
    // Do nothing, wallet connect might not have been initialized yet
    return;
  }

  yield call(clearSessions);
}

/**
 * This saga will be called (dispatched from the event listener) when a session
 * proposal RPC is sent from a dApp. This happens after the client scans a wallet
 * connect URI
 */
export function* onSessionProposal(action) {
  const { id, params } = action.payload;
  const { web3wallet } = yield select((state) => state.walletConnect.client);

  const wallet = yield select((state) => state.wallet);
  const firstAddress = yield call(() => wallet.getAddressAtIndex(0));

  const data = {
    icon: get(params, 'proposer.metadata.icons[0]', null),
    proposer: get(params, 'proposer.metadata.name', ''),
    url: get(params, 'proposer.metadata.url', ''),
    description: get(params, 'proposer.metadata.description', ''),
    requiredNamespaces: get(params, 'requiredNamespaces', []),
  };

  const onAcceptAction = { type: 'WALLET_CONNECT_ACCEPT' };
  const onRejectAction = { type: 'WALLET_CONNECT_REJECT' };

  yield put(setWalletConnectModal({
    show: true,
    type: WalletConnectModalTypes.CONNECT,
    data,
    onAcceptAction,
    onRejectAction,
  }));

  const { reject } = yield race({
    accept: take(onAcceptAction.type),
    reject: take(onRejectAction.type),
  });

  if (reject) {
    yield call(() => web3wallet.rejectSession({
      id: params.id,
      reason: {
        code: ERROR_CODES.USER_REJECTED,
        message: 'User rejected the session',
      },
    }));
  }

  const networkSettings = yield select(getNetworkSettings);
  try {
    yield call(() => web3wallet.approveSession({
      id,
      relayProtocol: params.relays[0].protocol,
      namespaces: {
        hathor: {
          accounts: [`hathor:${networkSettings.network}:${firstAddress}`],
          chains: [`hathor:${networkSettings.network}`],
          events: AVAILABLE_EVENTS,
          methods: values(AVAILABLE_METHODS),
        },
      },
    }));

    yield call(refreshActiveSessions);
  } catch (error) {
    console.error('Error on sessionProposal: ', error);
    yield put(onExceptionCaptured(error));
  }
}

/**
 * This saga is fired when a URI is inputted either manually or by scanning
 * a QR Code
 */
export function* onUriInputted(action) {
  const { web3wallet, core } = yield select((state) => state.walletConnect.client);

  if (!web3wallet) {
    throw new Error('Wallet connect instance is new and QRCode was read');
  }

  const { payload } = action;

  try {
    yield call(core.pairing.pair, { uri: payload });
  } catch (error) {
    yield put(setWCConnectionFailed(true));
  }
}

/**
 * This saga listens for the feature toggles provider and disables walletconnect
 * if it was enabled and is now disabled
 */
export function* featureToggleUpdateListener() {
  while (true) {
    const oldWalletConnectEnabled = yield call(isWalletConnectEnabled);
    yield take('FEATURE_TOGGLE_UPDATED');
    const newWalletConnectEnabled = yield call(isWalletConnectEnabled);

    if (oldWalletConnectEnabled && !newWalletConnectEnabled) {
      yield put({ type: 'WC_SHUTDOWN' });
    }
  }
}

/**
 * Sends a disconnect session RPC message to the connected cloud server
 */
export function* onCancelSession(action) {
  const { web3wallet } = yield select((state) => state.walletConnect.client);

  const activeSessions = yield call(() => web3wallet.getActiveSessions());

  if (!activeSessions[action.payload]) {
    return;
  }

  yield call(() => web3wallet.disconnectSession({
    topic: activeSessions[action.payload].topic,
    reason: {
      code: ERROR_CODES.USER_DISCONNECTED,
      message: 'User cancelled the session',
    },
  }));

  yield call(refreshActiveSessions);
}

/**
 * This event can be triggered by either the wallet or dapp, indicating the
 * termination of a session. Emitted only after the session has been
 * successfully deleted.
 */
export function* onSessionDelete(action) {
  yield call(onCancelSession, action);
}

export function* saga() {
  yield all([
    fork(featureToggleUpdateListener),
    takeLatest(types.START_WALLET_SUCCESS, init),
    takeLatest(types.SHOW_NANO_CONTRACT_SEND_TX_MODAL, onSendNanoContractTxRequest),
    takeLatest(types.SHOW_SIGN_MESSAGE_REQUEST_MODAL, onSignMessageRequest),
    takeLatest(types.SHOW_PIN_SCREEN_FOR_RESULT, onShowPinScreenForResult),
    takeLeading('WC_SESSION_REQUEST', onSessionRequest),
    takeEvery('WC_SESSION_PROPOSAL', onSessionProposal),
    takeEvery('WC_SESSION_DELETE', onSessionDelete),
    takeEvery('WC_CANCEL_SESSION', onCancelSession),
    takeEvery('WC_SHUTDOWN', clearSessions),
    takeEvery(types.RESET_WALLET, onWalletReset),
    takeLatest(types.WC_URI_INPUTTED, onUriInputted),
  ]);
}
