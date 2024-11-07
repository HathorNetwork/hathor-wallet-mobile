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
 * on walletKit
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
  takeEvery,
  select,
  race,
  actionChannel,
} from 'redux-saga/effects';
import { eventChannel } from 'redux-saga';
import { get, values } from 'lodash';
import { Core } from '@walletconnect/core';
import { WalletKit } from '@reown/walletkit';
import {
  TriggerTypes,
  TriggerResponseTypes,
  RpcResponseTypes,
  handleRpcRequest,
  CreateTokenError,
  SendNanoContractTxError,
} from '@hathor/hathor-rpc-handler';
import { isWalletServiceEnabled, WALLET_STATUS } from './wallet';
import { ReownModalTypes } from '../components/Reown/ReownModal';
import {
  REOWN_PROJECT_ID,
  REOWN_FEATURE_TOGGLE,
} from '../constants';
import {
  types,
  setReown,
  setReownModal,
  setReownSessions,
  onExceptionCaptured,
  setWCConnectionFailed,
  showSignMessageWithAddressModal,
  showNanoContractSendTxModal,
  showCreateTokenModal,
  setNewNanoContractStatusLoading,
  setNewNanoContractStatusReady,
  setNewNanoContractStatusFailure,
  setNewNanoContractStatusSuccess,
  showSignOracleDataModal,
  setCreateTokenStatusLoading,
  setCreateTokenStatusReady,
  setCreateTokenStatusSuccessful,
  setCreateTokenStatusFailed,
} from '../actions';
import { checkForFeatureFlag, getNetworkSettings, retryHandler, showPinScreenForResult } from './helpers';
import { logger } from '../logger';

const log = logger('reown');

const AVAILABLE_METHODS = {
  HATHOR_SIGN_MESSAGE: 'htr_signWithAddress',
  HATHOR_SEND_NANO_TX: 'htr_sendNanoContractTx',
  HATHOR_SIGN_ORACLE_DATA: 'htr_signOracleData',
  HATHOR_CREATE_TOKEN: 'htr_createToken',
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

function* isReownEnabled() {
  const reownEnabled = yield call(checkForFeatureFlag, REOWN_FEATURE_TOGGLE);

  return reownEnabled;
}

function* init() {
  const walletStartState = yield select((state) => state.walletStartState);

  if (walletStartState !== WALLET_STATUS.READY) {
    log.debug('Wallet not ready yet, waiting for START_WALLET_SUCCESS.');
    yield take(types.START_WALLET_SUCCESS);
    log.debug('Starting reown.');
  }

  try {
    const walletServiceEnabled = yield call(isWalletServiceEnabled);
    const reownEnabled = yield call(isReownEnabled);

    if (walletServiceEnabled) {
      log.debug('Wallet Service enabled, skipping reown init.');
      return;
    }

    if (!reownEnabled) {
      log.debug('Reown is not enabled.');
      return;
    }

    const core = new Core({
      projectId: REOWN_PROJECT_ID,
    });

    const metadata = {
      name: 'Hathor',
      description: 'Hathor Mobile Wallet',
      url: 'https://hathor.network/',
    };

    const walletKit = yield call(WalletKit.init, {
      core,
      metadata,
    });

    yield put(setReown({
      walletKit,
      core,
    }));

    yield fork(setupListeners, walletKit);

    // Refresh redux with the active sessions, loaded from storage
    // Pass extend = true so session expiration date get renewed
    yield call(refreshActiveSessions, true);
    yield fork(listenForAppStateChange);
    yield fork(listenForNetworkChange);
    yield fork(requestsListener);

    // If the wallet is reset, we should cancel all listeners
    yield take(types.RESET_WALLET);

    yield call(clearSessions);

    yield cancel();
  } catch (error) {
    log.error('Error loading wallet connect', error);
    yield put(onExceptionCaptured(error));
  }
}

export function* listenForNetworkChange() {
  while (true) {
    // XXX: We should check the fullnode's genesisHash and only reset
    // the sessions if it changed.
    yield take(types.NETWORK_CHANGED);
    log.debug('Network changed, resetting all sessions.');
    yield call(clearSessions);
  }
}

export function* listenForAppStateChange() {
  while (true) {
    const { payload: { oldState, newState } } = yield take(types.APPSTATE_UPDATED);

    if (oldState === 'background'
      && newState === 'active') {
      // Refresh and extend sessions
      yield call(refreshActiveSessions, true);
      // Check for pending requests
      yield call(checkForPendingRequests);
    }
  }
}

export function* getReownClient() {
  const reownClient = yield select((state) => state.reown.client);

  if (!reownClient) {
    return null;
  }

  return reownClient;
}

export function* checkForPendingRequests() {
  const reownClient = yield call(getReownClient);
  if (!reownClient) {
    // Do nothing, client might not yet have been initialized.
    log.debug('Tried to get reown client in checkForPendingRequests but it is undefined.');
    return;
  }
  const { walletKit } = reownClient;

  yield call([walletKit, walletKit.getPendingAuthRequests]);
  yield call([walletKit, walletKit.getPendingSessionRequests]);
}

export function* refreshActiveSessions(extend = false) {
  log.debug('Refreshing active sessions.');
  const reownClient = yield call(getReownClient);
  if (!reownClient) {
    // Do nothing, client might not yet have been initialized.
    log.debug('Tried to get reown client in refreshActiveSessions but it is undefined.');
    return;
  }
  const { walletKit } = reownClient;

  const activeSessions = yield call(() => walletKit.getActiveSessions());
  yield put(setReownSessions(activeSessions));

  if (extend) {
    for (const key of Object.keys(activeSessions)) {
      log.debug('Extending session ');
      log.debug(activeSessions[key].topic);

      try {
        yield call(() => walletKit.extendSession({
          topic: activeSessions[key].topic,
        }));
      } catch (extendError) {
        log.error('Error extending session, attempting to remove. Error:', extendError);

        // Extending session failed, remove it
        try {
          yield call(() => walletKit.disconnectSession({
            topic: activeSessions[key].topic,
            reason: {
              code: ERROR_CODES.USER_DISCONNECTED,
              message: 'Unable to extend session',
            },
          }));
        } catch (disconnectError) {
          log.error('Unable to remove session after extend failed.', disconnectError);
          yield put(onExceptionCaptured(disconnectError));
        }
      }
    }
  }
}

/**
 * @param {WalletKit} walletKit The Reown walletKit instance
 */
export function* setupListeners(walletKit) {
  const channel = eventChannel((emitter) => {
    const listenerMap = new Map();
    const addListener = (eventName) => {
      const listener = async (data) => {
        emitter({
          type: `REOWN_${eventName.toUpperCase()}`,
          data,
        });
      };

      walletKit.on(eventName, listener);
      listenerMap.set(eventName, listener);
    };

    addListener('session_request');
    addListener('session_proposal');
    addListener('session_delete');
    addListener('disconnect');

    return () => listenerMap.forEach((
      listener,
      eventName,
    ) => walletKit.removeListener(eventName, listener));
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
  const reownClient = yield call(getReownClient);
  if (!reownClient) {
    // Do nothing, client might not yet have been initialized.
    log.debug('Tried to get reown client in clearSessions but it is undefined.');
    return;
  }

  const { walletKit } = reownClient;

  const activeSessions = yield call(() => walletKit.getActiveSessions());

  for (const key of Object.keys(activeSessions)) {
    yield call(() => walletKit.disconnectSession({
      topic: activeSessions[key].topic,
      reason: {
        code: ERROR_CODES.USER_DISCONNECTED,
        message: '',
      },
    }));
  }

  yield call(refreshActiveSessions);
}

function* requestsListener() {
  const requestsChannel = yield actionChannel('REOWN_SESSION_REQUEST');

  let action;
  while (true) {
    try {
      action = yield take(requestsChannel);
      yield call(processRequest, action);
    } catch (error) {
      log.error('Error processing request.', error);
      yield put(onExceptionCaptured(error));
    }
  }
}

/**
 * This saga will be called (dispatched from the event listener) when a session
 * is requested from a dApp
 */
export function* processRequest(action) {
  const { payload } = action;
  const { params } = payload;

  const reownClient = yield call(getReownClient);
  if (!reownClient) {
    // Do nothing, client might not yet have been initialized.
    log.debug('Tried to get reown client in clearSessions but it is undefined.');
    return;
  }
  const { walletKit } = reownClient;
  const wallet = yield select((state) => state.wallet);

  const activeSessions = yield call(() => walletKit.getActiveSessions());
  const requestSession = activeSessions[payload.topic];

  if (!requestSession) {
    log.error('Could not identify the request session, ignoring request.');
    return;
  }

  const data = {
    icon: get(requestSession.peer, 'metadata.icons[0]', null),
    proposer: get(requestSession.peer, 'metadata.name', ''),
    url: get(requestSession.peer, 'metadata.url', ''),
    description: get(requestSession.peer, 'metadata.description', ''),
    chain: get(requestSession.namespaces, 'hathor.chains[0]', ''),
  };

  try {
    let dispatch;
    yield put((_dispatch) => {
      dispatch = _dispatch;
    });

    const response = yield call(
      handleRpcRequest,
      params.request,
      wallet,
      data,
      promptHandler(dispatch),
    );

    switch (response.type) {
      case RpcResponseTypes.SendNanoContractTxResponse:
        yield put(setNewNanoContractStatusSuccess());
        break;
      case RpcResponseTypes.CreateTokenResponse:
        yield put(setCreateTokenStatusSuccessful());
        break;
      default:
        break;
    }

    yield call(() => walletKit.respondSessionRequest({
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
      case SendNanoContractTxError: {
        yield put(setNewNanoContractStatusFailure());

        const retry = yield call(
          retryHandler,
          types.REOWN_CREATE_TOKEN_RETRY,
          types.REOWN_CREATE_TOKEN_RETRY_DISMISS,
        );

        if (retry) {
          shouldAnswer = false;
          // Retry the action, exactly as it came:
          yield* processRequest(action);
        }
      } break;
      case CreateTokenError: {
        yield put(setCreateTokenStatusFailed());

        // User might try again, wait for it.
        const retry = yield call(
          retryHandler,
          types.REOWN_CREATE_TOKEN_RETRY,
          types.REOWN_CREATE_TOKEN_RETRY_DISMISS,
        );

        if (retry) {
          shouldAnswer = false;
          // Retry the action, exactly as it came:
          yield* processRequest(action);
        }
      } break;
      default:
        break;
    }

    if (shouldAnswer) {
      try {
        yield call(() => walletKit.respondSessionRequest({
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
      } catch (error) {
        log.error('Error rejecting response on sessionRequest', error);
      }
    }
  }
}

/**
 * Handles various types of prompt requests by dispatching appropriate actions
 * and resolving with the corresponding responses.
 *
 * @param {function} dispatch - The dispatch function to send actions to the store.
 * @returns {function} - A function that receives Trigger requests from the rpc
 * library and dispatches actions
 *
 * The returned function performs the following:
 *
 * - Depending on the `request.type`, it will:
 *   - `TriggerTypes.SignMessageWithAddressConfirmationPrompt`:
 *     - Dispatches `showSignMessageWithAddressModal` with acceptance/rejection handlers.
 *     - Resolves with `TriggerResponseTypes.SignMessageWithAddressConfirmationResponse`.
 *   - `TriggerTypes.SendNanoContractTxConfirmationPrompt`:
 *     - Dispatches `showNanoContractSendTxModal` with acceptance/rejection handlers.
 *     - Resolves with `TriggerResponseTypes.SendNanoContractTxConfirmationResponse`.
 *   - `TriggerTypes.SendNanoContractTxLoadingTrigger`:
 *     - Dispatches `setNewNanoContractStatusLoading`.
 *     - Resolves immediately.
 *   - `TriggerTypes.LoadingFinishedTrigger`:
 *     - Dispatches `setNewNanoContractStatusReady`.
 *     - Resolves immediately.
 *   - `TriggerTypes.PinConfirmationPrompt`:
 *     - Awaits `showPinScreenForResult` to get the PIN code.
 *     - Resolves with `TriggerResponseTypes.PinRequestResponse`.
 *   - For any other `request.type`, this method will reject with an error.
 *
 * @param {Object} request - The request object containing type and data.
 * @param {Object} requestMetadata - Additional metadata for the request.
 *
 * @returns {Promise<Object>} - A Promise that resolves with the appropriate
 * response based on the request type.
 *
 * @example
 * const handler = promptHandler(dispatch);
 */
const promptHandler = (dispatch) => (request, requestMetadata) =>
  // eslint-disable-next-line
  new Promise(async (resolve, reject) => {
    switch (request.type) {
      case TriggerTypes.SignOracleDataConfirmationPrompt: {
        const signOracleDataResponseTemplate = (accepted) => () => resolve({
          type: TriggerResponseTypes.SignOracleDataConfirmationResponse,
          data: accepted,
        });

        dispatch(showSignOracleDataModal(
          signOracleDataResponseTemplate(true),
          signOracleDataResponseTemplate(false),
          request.data,
          requestMetadata,
        ));
      } break;
      case TriggerTypes.CreateTokenConfirmationPrompt: {
        const createTokenResponseTemplate = (accepted) => (data) => resolve({
          type: TriggerResponseTypes.CreateTokenConfirmationResponse,
          data: {
            accepted,
            token: data?.payload,
          }
        });
        dispatch(showCreateTokenModal(
          createTokenResponseTemplate(true),
          createTokenResponseTemplate(false),
          request.data,
          requestMetadata,
        ))
      } break;
      case TriggerTypes.SignMessageWithAddressConfirmationPrompt: {
        const signMessageResponseTemplate = (accepted) => () => resolve({
          type: TriggerResponseTypes.SignMessageWithAddressConfirmationResponse,
          data: accepted,
        });
        dispatch(showSignMessageWithAddressModal(
          signMessageResponseTemplate(true),
          signMessageResponseTemplate(false),
          request.data,
          requestMetadata,
        ));
      } break;
      case TriggerTypes.SendNanoContractTxConfirmationPrompt: {
        const sendNanoContractTxResponseTemplate = (accepted) => (data) => resolve({
          type: TriggerResponseTypes.SendNanoContractTxConfirmationResponse,
          data: {
            accepted,
            nc: data?.payload,
          }
        });

        dispatch(showNanoContractSendTxModal(
          sendNanoContractTxResponseTemplate(true),
          sendNanoContractTxResponseTemplate(false),
          request.data,
          requestMetadata,
        ));
      } break;
      case TriggerTypes.SendNanoContractTxLoadingTrigger:
        dispatch(setNewNanoContractStatusLoading());
        resolve();
        break;
      case TriggerTypes.CreateTokenLoadingTrigger:
        dispatch(setCreateTokenStatusLoading());
        resolve();
        break;
      case TriggerTypes.CreateTokenLoadingFinishedTrigger:
        dispatch(setCreateTokenStatusReady());
        resolve();
        break;
      case TriggerTypes.SendNanoContractTxLoadingFinishedTrigger:
        dispatch(setNewNanoContractStatusReady());
        resolve();
        break;
      case TriggerTypes.PinConfirmationPrompt: {
        const pinCode = await showPinScreenForResult(dispatch);

        resolve({
          type: TriggerResponseTypes.PinRequestResponse,
          data: {
            accepted: true,
            pinCode,
          }
        });
      } break;
      default: reject(new Error('Invalid request'));
    }
  });

/**
 * This saga will be called (dispatched from the event listener) when a sign
 * message RPC is published from a dApp
 *
 * @param {String} payload.data.requestId Unique identifier of the request
 * @param {String} payload.data.topic Unique identifier of the connected session
 * @param {String} payload.data.message Message the dApp requested a signature for
 * @param {String} payload.dapp.icon The icon sent by the dApp
 * @param {String} payload.dapp.proposer The proposer name sent by the dapp
 * @param {String} payload.dapp.url The url sent by the dApp
 * @param {String} payload.dapp.description The description sent by the dApp
 * @param {String} payload.accept A callback function to indicate that the
 * request has been accepted.
 * @param {String} payload.deny A callback function to indicate that the request
 * has been denied.
 */
export function* onSignMessageRequest({ payload }) {
  const { accept, deny: denyCb, data, dapp } = payload;

  const wallet = yield select((state) => state.wallet);

  if (!wallet.isReady()) {
    log.error('Got a session request but wallet is not ready, ignoring.');
    return;
  }

  yield put(setReownModal({
    show: true,
    type: ReownModalTypes.SIGN_MESSAGE,
    data: {
      data,
      dapp,
    },
  }));

  const { deny } = yield race({
    accept: take(types.REOWN_ACCEPT),
    deny: take(types.REOWN_REJECT),
  });

  if (deny) {
    denyCb();

    return;
  }

  accept();
}

export function* onSignOracleDataRequest({ payload }) {
  const { accept, deny: denyCb, data, dapp } = payload;

  const wallet = yield select((state) => state.wallet);

  if (!wallet.isReady()) {
    log.error('Got a session request but wallet is not ready, ignoring..');
    return;
  }

  yield put(setReownModal({
    show: true,
    type: ReownModalTypes.SIGN_ORACLE_DATA,
    data: {
      data,
      dapp,
    },
  }));

  const { deny } = yield race({
    accept: take(types.REOWN_ACCEPT),
    deny: take(types.REOWN_REJECT),
  });

  if (deny) {
    denyCb();

    return;
  }

  accept();
}

/**
 * This saga will be called (dispatched from the event listener) when a
 * sendNanoContractTx message RPC is published from a dApp
 *
 * @param {String} payload.data.requestId Unique identifier of the request
 * @param {String} payload.data.topic Unique identifier of the connected session
 * @param {String} payload.data.message Message the dApp requested a signature for
 * @param {String} payload.dapp.icon The icon sent by the dApp
 * @param {String} payload.dapp.proposer The proposer name sent by the dapp
 * @param {String} payload.dapp.url The url sent by the dApp
 * @param {String} payload.dapp.description The description sent by the dApp
 * @param {String} payload.accept A callback function to indicate that the
 * request has been accepted.
 * @param {String} payload.deny A callback function to indicate that the request
 * has been denied.
 */
export function* onSendNanoContractTxRequest({ payload }) {
  const { accept: acceptCb, deny: denyCb, nc, dapp } = payload;

  const wallet = yield select((state) => state.wallet);

  if (!wallet.isReady()) {
    log.error('Got a session request but wallet is not ready, ignoring.');
    return;
  }

  yield put(setReownModal({
    show: true,
    type: ReownModalTypes.SEND_NANO_CONTRACT_TX,
    data: {
      dapp,
      data: nc,
    },
  }));

  const { deny, accept } = yield race({
    accept: take(types.REOWN_ACCEPT),
    deny: take(types.REOWN_REJECT),
  });

  if (deny) {
    denyCb();

    return;
  }

  acceptCb(accept);
}

export function* onCreateTokenRequest({ payload }) {
  const { accept: acceptCb, deny: denyCb, data, dapp } = payload;

  const wallet = yield select((state) => state.wallet);

  if (!wallet.isReady()) {
    log.error('Got a session request but wallet is not ready, ignoring.');
    return;
  }

  yield put(setReownModal({
    show: true,
    type: ReownModalTypes.CREATE_TOKEN,
    data: {
      dapp,
      data,
    },
  }));

  const { deny, accept } = yield race({
    accept: take(types.REOWN_ACCEPT),
    deny: take(types.REOWN_REJECT),
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
  const reown = yield select((state) => state.reown);
  if (!reown || !reown.client) {
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
  const reownClient = yield call(getReownClient);

  if (!reownClient) {
    // Do nothing, client might not yet have been initialized.
    log.debug('Tried to get reown client in onSessionProposal but it is undefined.');
    return;
  }

  const { walletKit } = reownClient;
  const wallet = yield select((state) => state.wallet);
  const firstAddress = yield call(() => wallet.getAddressAtIndex(0));

  const data = {
    icon: get(params, 'proposer.metadata.icons[0]', null),
    proposer: get(params, 'proposer.metadata.name', ''),
    url: get(params, 'proposer.metadata.url', ''),
    description: get(params, 'proposer.metadata.description', ''),
    requiredNamespaces: get(params, 'requiredNamespaces', []),
  };

  const onAcceptAction = { type: 'REOWN_ACCEPT' };
  const onRejectAction = { type: 'REOWN_REJECT' };

  yield put(setReownModal({
    show: true,
    type: ReownModalTypes.CONNECT,
    data,
    onAcceptAction,
    onRejectAction,
  }));

  const { reject } = yield race({
    accept: take(onAcceptAction.type),
    reject: take(onRejectAction.type),
  });

  if (reject) {
    try {
      yield call(() => walletKit.rejectSession({
        id,
        reason: {
          code: ERROR_CODES.USER_REJECTED,
          message: 'User rejected the session',
        },
      }));
    } catch (e) {
      log.error('Error rejecting session on sessionProposal', e);
    }

    return;
  }

  const networkSettings = yield select(getNetworkSettings);
  try {
    yield call(() => walletKit.approveSession({
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
    log.error('Error on sessionProposal: ', error);
    try {
      // Attempt once more to reject the session, so it doesn't linger in the
      // message queue
      yield call(() => walletKit.rejectSession({
        id,
        reason: {
          code: ERROR_CODES.USER_REJECTED,
          message: 'User rejected the session',
        },
      }));
    } catch (e) {
      // Only if this fails, send the exception to Sentry
      yield put(onExceptionCaptured(error));
    }
  }
}

/**
 * This saga is fired when a URI is inputted either manually or by scanning
 * a QR Code
 */
export function* onUriInputted(action) {
  const reownClient = yield call(getReownClient);

  if (!reownClient) {
    // Do nothing, client might not yet have been initialized.
    log.debug('Tried to get reown client in onSessionProposal but it is undefined.');
    return;
  }

  const { core } = reownClient;

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
    const oldReownEnabled = yield call(isReownEnabled);
    yield take('FEATURE_TOGGLE_UPDATED');
    const newReownEnabled = yield call(isReownEnabled);

    if (oldReownEnabled && !newReownEnabled) {
      yield put({ type: 'REOWN_SHUTDOWN' });
    }
  }
}

/**
 * Sends a disconnect session RPC message to the connected cloud server
 */
export function* onCancelSession(action) {
  const { walletKit } = yield select((state) => state.reown.client);

  const activeSessions = yield call(() => walletKit.getActiveSessions());

  if (activeSessions[action.payload.id]) {
    yield call(() => walletKit.disconnectSession({
      topic: activeSessions[action.payload.id].topic,
      reason: {
        code: ERROR_CODES.USER_DISCONNECTED,
        message: 'User cancelled the session',
      },
    }));
  }

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
    fork(init),
    takeLatest(types.SHOW_NANO_CONTRACT_SEND_TX_MODAL, onSendNanoContractTxRequest),
    takeLatest(types.SHOW_SIGN_MESSAGE_REQUEST_MODAL, onSignMessageRequest),
    takeLatest(types.SHOW_SIGN_ORACLE_DATA_REQUEST_MODAL, onSignOracleDataRequest),
    takeLatest(types.SHOW_CREATE_TOKEN_REQUEST_MODAL, onCreateTokenRequest),
    takeEvery('REOWN_SESSION_PROPOSAL', onSessionProposal),
    takeEvery('REOWN_SESSION_DELETE', onSessionDelete),
    takeEvery('REOWN_CANCEL_SESSION', onCancelSession),
    takeEvery('REOWN_SHUTDOWN', clearSessions),
    takeEvery(types.RESET_WALLET, onWalletReset),
    takeLatest(types.REOWN_URI_INPUTTED, onUriInputted),
  ]);
}
