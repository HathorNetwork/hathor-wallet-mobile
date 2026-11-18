/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { buffers, eventChannel } from 'redux-saga';
import {
  all,
  call,
  cancel,
  cancelled,
  delay,
  fork,
  put,
  race,
  select,
  spawn,
  take,
  takeEvery,
  takeLatest,
  takeLeading,
} from 'redux-saga/effects';
import { t } from 'ttag';
import {
  types,
  multichainConnectedNetworksSet,
  multichainConnectUpdate,
  multichainDevBackendSet,
  multichainNextHistoryUpdate,
  multichainNextReset,
  multichainNextSendUpdate,
  multichainNextUpdate,
  multichainTransfersSet,
  multichainTransferUpdate,
} from '../actions';
import { multichainKeyMap, NETWORK_PRIVATENET } from '../constants';
import { logger } from '../logger';
import { STORE } from '../store';
import { isExpectedPasskeyError, PasskeyCancelledError, withPasskeyWords } from '../passkey/passkeySigner';
import { TOKEN_DOWNLOAD_STATUS } from './tokens';
import { WALLET_STATUS } from './wallet';
import { createBridge } from '../multichain/bridge';
import { CHAIN } from '../multichain/chains';
import {
  getMultichainRolloutFlag,
  isSideChainAvailable,
  isSideChainConnected,
  selectMultichainNetwork,
  selectSideChainConfig,
  selectSideChainKey,
} from '../multichain/gating';
import { waitForFeatureToggleInitialization } from './helpers';
import {
  hasUsedNext,
  loadSavedNext,
  prepareNextKeys,
  prepareNextKeysWithPin,
  saveNext,
  pendingUnlockDerivation,
} from '../multichain/keys';
import { ensureNextClient, getNextClient, setNextClient } from '../multichain/nextClient';
import {
  NEXT_CLIENT_EVENT,
  NextClientError,
  NEXT_CLIENT_ERROR,
  userErrorText,
} from '../multichain/nextClientErrors';
import {
  CONNECT_STATUS,
  NEXT_STATUS,
  OPERATION_STATUS,
  SEND_IN_FLIGHT,
  TRANSFER_STATUS,
  isForgotten,
} from '../multichain/state';

const log = logger('multichain');

/**
 * The task that follows the connected client's events. Only one runs: stopNext cancels it.
 */
let feedTask = null;

/**
 * The load of Hathor Next that runs, if any: a way out cancels it, so a connect that answers
 * after it can't bring Hathor Next back.
 */
let connectTask = null;

/**
 * Starts over at every way out: a history read that answers after one is dropped.
 */
let generation = 0;

/**
 * The side chain config Hathor Next connected with, until it stops: the backend for local testing
 * can come into force or leave with its flag, while Hathor Next runs on the other backend.
 */
let connectedConfig = null;

/**
 * Brings the backend saved for local testing into the state, when the state doesn't have it yet.
 */
export function* syncDevBackend() {
  // The backend's flag decides whether it is in force, so it is read once Unleash answered (or its
  // defaults stand).
  yield call(waitForFeatureToggleInitialization);
  const stored = yield select((state) => state.multichain.devBackend);
  if (!stored) {
    const saved = STORE.getItem(multichainKeyMap.devBackend) ?? null;
    if (saved) {
      yield put(multichainDevBackendSet(saved, { persist: false }));
    }
  }
}

/**
 * The drafts already sent, for as long as the app runs. Sign-once must not rest on the payment's
 * state alone: the confirm screen clears it when it closes, and a confirm screen left mounted
 * would then send the same draft again.
 */
const sentDrafts = new Set();

/**
 * How long a payment handed to Hathor Next may go without an outcome before the screen says it
 * hasn't settled yet and lets the user leave. The wallet keeps following it.
 */
export const SEND_SETTLE_MS = 30000;

/** A payment's outcomes: anything else is still on its way. */
const SEND_SETTLED = [
  OPERATION_STATUS.RECORDED,
  OPERATION_STATUS.UNCONFIRMED,
  OPERATION_STATUS.FAILED,
  OPERATION_STATUS.EXPIRED,
  OPERATION_STATUS.ERROR,
];

/** No transfer, and none signed without an answer: the reset the transfer state's own keeps. */
const TRANSFER_CLEARED = {
  status: OPERATION_STATUS.IDLE,
  record: null,
  error: null,
  errorCode: null,
  uncertainId: null,
  requestId: null,
};

/** "Connect to side chain" is turning on, in these states. */
const TURNING_ON = [CONNECT_STATUS.UNLOCKING, CONNECT_STATUS.CONNECTING];

/** What the user is told when Hathor Next can't be loaded. */
export const connectFailedText = () => t`Couldn't connect to Hathor Next.`;

/** What the user is told when a transfer fails for a reason that has no words of its own. */
export const transferFailedText = () => t`The transfer failed.`;

// The failures of a load that say what to do: a network that changed under the app (update it),
// and a clock the wallet service refused (set it).
const LOAD_FAILURES_TOLD = [NEXT_CLIENT_ERROR.NETWORK_CHANGED, NEXT_CLIENT_ERROR.CLOCK];

/**
 * What the loading screen says when Hathor Next couldn't load.
 *
 * @param {Error} e
 * @returns {string}
 */
function loadFailedText(e) {
  if (isExpectedPasskeyError(e)) {
    return e.message;
  }
  if (e instanceof NextClientError && LOAD_FAILURES_TOLD.includes(e.code)) {
    return e.message;
  }
  return connectFailedText();
}

/**
 * Where the wallet is now: its network, and its side chain's backend. A transfer's record names
 * where it was signed.
 *
 * @returns {{ network: string, backendUrl: string|null }}
 */
function* currentPlace() {
  const network = yield select(selectMultichainNetwork);
  const backendUrl = (yield select(selectSideChainConfig))?.backendUrl ?? null;
  return { network, backendUrl };
}

/**
 * The transfer saved on the network and backend the wallet is on now, or null: one signed without
 * an answer, or one that ended forgotten and the user wasn't shown yet. It is saved with where it
 * was signed: asked about on another backend it could only be unknown, and no transfer could
 * start there.
 *
 * @returns {{ id: string, inputs: Object[]|null, forgotten: boolean }|null}
 */
function* savedTransferHere() {
  const saved = STORE.getItem(multichainKeyMap.uncertainTransfer);
  const { network, backendUrl } = yield call(currentPlace);
  return saved?.id && saved.network === network && saved.backendUrl === backendUrl
    ? { id: saved.id, inputs: saved.inputs ?? null, forgotten: saved.forgotten === true }
    : null;
}

/**
 * The transfer signed without an answer on the network and backend the wallet is on now, or null.
 *
 * @returns {{ id: string, inputs: Object[]|null }|null} Its id, and the outputs its burn spends
 */
function* uncertainTransferHere() {
  const saved = yield call(savedTransferHere);
  return saved && !saved.forgotten ? { id: saved.id, inputs: saved.inputs } : null;
}

/**
 * Whether the transfer saved here is still this one, signed without an answer. The backend can
 * change while it is asked about (the backend for local testing): the client then asks the new
 * one, which never knew it, and its answer would settle a record that isn't its own.
 *
 * @param {string} id
 */
function* stillUncertainHere(id) {
  return (yield call(uncertainTransferHere))?.id === id;
}

/** The outcome of a transfer Hathor Next no longer knows, until the user dismisses it. */
const transferForgotten = () => ({
  status: OPERATION_STATUS.ERROR,
  record: null,
  error: new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_FORGOTTEN).message,
  errorCode: NEXT_CLIENT_ERROR.TRANSFER_FORGOTTEN,
  uncertainId: null,
});

/**
 * Saves a transfer signed without an answer, with where it was signed and the outputs its burn
 * spends: with those, the wallet's own node can settle it if the backend no longer knows it.
 *
 * @param {string} transferId
 * @param {{ txId: string, index: number }[]|null} inputs
 * @param {{ network: string, backendUrl: string|null }} place Where it was signed
 */
function rememberUncertainTransfer(transferId, inputs, { network, backendUrl }) {
  STORE.setItem(multichainKeyMap.uncertainTransfer, {
    id: transferId, network, backendUrl, inputs,
  });
}

/**
 * A confirm screen's own transfer in these states is its own: on its way, or its outcome. Not one
 * still not confirmed: closing its screen keeps it, still named as that screen's, and nothing
 * would clear it on another backend, where it would hold every transfer.
 */
const OWN_OUTCOME = [OPERATION_STATUS.SENDING, OPERATION_STATUS.DONE, OPERATION_STATUS.ERROR];

/**
 * Shows the transfer signed without an answer where the wallet is now, saved by an earlier run of
 * the app or on this network before: a confirm screen keeps Confirm off until it settles. One
 * that ended forgotten shows until the user dismisses it. One left in the state from another
 * network or backend goes.
 */
export function* showUncertainTransfer() {
  const saved = yield call(savedTransferHere);
  const { transfer } = yield select((state) => state.multichain);
  // A confirm screen's own transfer on its way, or its outcome shown, stays as it is: one made
  // on another backend would read as this one. Closing that screen clears a done or refused
  // outcome, and the next transfer here hears of the saved one first (onTransferRequested). A
  // forgotten one stays, still named as that screen's, until the user dismisses it: through a
  // switch too, so it shows on the new backend until then, and from its record again back where
  // it was signed.
  if (transfer.requestId && OWN_OUTCOME.includes(transfer.status)) {
    return;
  }
  if (saved?.forgotten) {
    if (!isForgotten(transfer)) {
      // No confirm screen asked for it in this run of the app.
      yield put(multichainTransferUpdate({ ...transferForgotten(), requestId: null }));
    }
  } else if (saved && transfer.uncertainId !== saved.id) {
    yield put(multichainTransferUpdate({
      status: OPERATION_STATUS.UNCONFIRMED,
      record: null,
      error: new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_UNCERTAIN).message,
      uncertainId: saved.id,
      // No confirm screen asked for it in this run of the app.
      requestId: null,
    }));
  } else if (!saved && (transfer.uncertainId || isForgotten(transfer))) {
    yield put(multichainTransferUpdate(TRANSFER_CLEARED));
  }
}

/**
 * The user dismissed a forgotten transfer's outcome: its record goes, and the state shows it no
 * more (the reducer).
 */
export function* onTransferForgottenSeen() {
  const saved = yield call(savedTransferHere);
  if (saved?.forgotten) {
    STORE.removeItem(multichainKeyMap.uncertainTransfer);
  }
}

/**
 * The bridge of the network the wallet runs on.
 */
export function* currentBridge() {
  const config = yield select(selectSideChainConfig);
  const network = yield select(selectMultichainNetwork);
  const decimalPlaces = yield select((state) => state.serverInfo?.decimal_places ?? 2);
  const wallet = yield select((state) => state.wallet);
  return createBridge(config, {
    network,
    decimalPlaces,
    wallet,
    hathorNetwork: wallet?.getNetworkObject?.() ?? null,
    client: getNextClient(),
  });
}

/**
 * Derives the Hathor Next keys with the PIN, which decrypts the words.
 *
 * @param {string} pinCode
 */
export function* deriveKeysWithPin(pinCode) {
  const address = yield call(
    prepareNextKeysWithPin,
    pinCode,
    (pin) => STORE.getWalletWords(pin),
  );
  yield put(multichainNextUpdate({ keysReady: true, ...(address ? { address } : {}) }));
  return address;
}

/**
 * Derives the Hathor Next keys in one passkey ceremony.
 *
 * @throws PasskeyCancelledError when the user dismisses it
 */
export function* deriveKeysWithPasskey() {
  const address = yield call(withPasskeyWords, async (words) => prepareNextKeys(words));
  yield put(multichainNextUpdate({ keysReady: true, ...(address ? { address } : {}) }));
  return address;
}

/**
 * Makes sure the Hathor Next keys are in memory: they already are when the wallet used Hathor
 * Next before (they are derived at unlock). Otherwise, when the user asked for it, the PIN derives
 * them, or a passkey ceremony for a passkey wallet.
 *
 * @param {Object} options
 * @param {string} [options.pinCode]
 * @param {boolean} options.interactive Whether a passkey ceremony may run
 * @returns {boolean} false when the keys are missing and nothing could derive them
 */
export function* ensureKeys({ pinCode, interactive }) {
  // A passkey unlock doesn't wait for its derivation: a load that comes first waits for it here.
  const pending = pendingUnlockDerivation();
  if (pending) {
    yield call(() => pending);
  }
  if (ensureNextClient().hasKeys()) {
    return true;
  }
  if (STORE.isPasskeyWallet()) {
    if (!interactive) {
      return false;
    }
    yield call(deriveKeysWithPasskey);
    return true;
  }
  if (!pinCode) {
    return false;
  }
  yield call(deriveKeysWithPin, pinCode);
  return true;
}

/**
 * The passkey unlock derived the keys: say so, and run a load that failed without them again.
 */
export function* onNextKeysDerived() {
  yield call(syncDevBackend);
  const client = ensureNextClient();
  if (!client.hasKeys()) {
    return;
  }
  const address = client.getAddress?.() ?? null;
  yield put(multichainNextUpdate({ keysReady: true, ...(address ? { address } : {}) }));
  const failed = yield select((state) => state.multichain.next.status === NEXT_STATUS.FAILED);
  if (failed && (yield select(isSideChainConnected))) {
    yield call(runConnect, loadNext, { interactive: false });
  }
}

/**
 * The lock screen took the PIN: derive the Hathor Next keys if the multichain flag is on and the
 * wallet used Hathor Next before or has the side chain on here, so loading it needs no prompt. A
 * failure is only logged. A load that failed for want of the keys (the loading screen's Try again
 * locks the app to get the PIN) runs again.
 */
export function* onNextKeysUnlockRequested({ payload }) {
  // It waits for Unleash, so the flag below is Unleash's answer (or its default, off). The flag
  // as Unleash gives it, on any network: the keys stay in memory, so switching to a network with a
  // side chain needs no PIN.
  yield call(syncDevBackend);
  const multichainOn = yield select(getMultichainRolloutFlag);
  if (!multichainOn || ensureNextClient().hasKeys()) {
    return;
  }
  // Switching the backend for local testing forgets the saved address, not the side chain
  // setting: without the setting, its Try again would lock the app over and over.
  if (!hasUsedNext() && !(yield select(isSideChainConnected))) {
    return;
  }
  try {
    yield call(deriveKeysWithPin, payload.pinCode);
  } catch (e) {
    log.error('Could not derive the Hathor Next keys at unlock.', e);
    return;
  }
  const failed = yield select((state) => state.multichain.next.status === NEXT_STATUS.FAILED);
  if (failed && (yield select(isSideChainConnected))) {
    yield call(runConnect, loadNext, { interactive: false });
  }
}

/**
 * Reads the tokens, balances and transfers into the state.
 *
 * @param {Object} client
 */
export function* refreshNextData(client) {
  const tokens = yield call([client, client.getTokens]);
  const { sweeping, balances } = yield call([client, client.getBalances]);
  yield put(multichainNextUpdate({
    sweeping,
    tokens: Object.fromEntries(tokens.map((token) => [token.id, token])),
    balances: Object.fromEntries(Object.entries(balances).map(([tokenId, data]) => [
      tokenId,
      { status: TOKEN_DOWNLOAD_STATUS.READY, data },
    ])),
  }));
  // The transfers are their own read: one that fails leaves the last list, and Hathor Next loads.
  try {
    yield call(refreshTransfers);
  } catch (e) {
    log.error('Could not read the transfers between chains.', e);
  }
}

// How often a transfer on its way is read again: no Hathor Next event marks its progress.
const TRANSFER_POLL_MS = 15000;

/**
 * Reads the transfers again while one is on its way, so its progress ("Confirming k of N") moves,
 * and asks again about a transfer signed without an answer until it settles: its first tries may
 * all fall while the backend can't be reached. Runs as long as the client is followed.
 */
export function* pollPendingTransfers() {
  while (true) {
    yield delay(TRANSFER_POLL_MS);
    const uncertain = yield call(uncertainTransferHere);
    if (uncertain) {
      try {
        const bridge = yield call(currentBridge);
        yield call(resolveUncertainTransfer, bridge, uncertain, 1);
      } catch (e) {
        log.error('Could not ask about a transfer signed without an answer.', e);
      }
    }
    const pending = yield select((state) => state.multichain.transfers
      .some((transfer) => transfer.status === TRANSFER_STATUS.PENDING));
    if (pending) {
      try {
        yield call(refreshTransfers);
      } catch (e) {
        log.error('Could not read the transfers between chains.', e);
      }
    }
  }
}

/**
 * Reads the transfers between chains into the state.
 */
export function* refreshTransfers() {
  const bridge = yield call(currentBridge);
  const transfers = yield call([bridge, bridge.getTransfers]);
  yield put(multichainTransfersSet(transfers));
}

/**
 * Reads the first page of every history the screens loaded, after the rows changed.
 *
 * @param {Object} client
 */
function* refreshLoadedHistories(client) {
  const history = yield select((state) => state.multichain.next.history);
  for (const tokenId of Object.keys(history)) {
    const { rows, cursor } = yield call([client, client.getHistory], tokenId, { cursor: 0 });
    yield put(multichainNextHistoryUpdate({
      tokenId,
      status: TOKEN_DOWNLOAD_STATUS.READY,
      data: rows,
      cursor,
    }));
  }
}

/**
 * The client's events, as a channel. It keeps every event until the follower takes it: one that
 * came while the follower was busy with another would be lost unbuffered, and a payment whose
 * "recorded" was lost waits on its screen for good.
 *
 * @param {Object} client
 */
export function nextClientChannel(client) {
  return eventChannel((emitter) => {
    const unsubscribes = Object.values(NEXT_CLIENT_EVENT).map((event) => (
      client.on(event, (payload) => emitter({ event, payload: payload ?? {} }))
    ));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, buffers.expanding(16));
}

/**
 * Follows the connected client's events until stopNext cancels it.
 *
 * @param {Object} client
 * @param {Object} [events] The client's channel, when it was opened before: it holds the events
 *   that came since
 */
export function* followNextClient(client, events = null) {
  const channel = events ?? (yield call(nextClientChannel, client));
  yield fork(pollPendingTransfers);
  try {
    while (true) {
      const { event, payload } = yield take(channel);
      try {
        switch (event) {
          case NEXT_CLIENT_EVENT.BALANCE:
          case NEXT_CLIENT_EVENT.SWEEP:
            yield call(refreshNextData, client);
            break;
          case NEXT_CLIENT_EVENT.HISTORY:
            yield call(refreshLoadedHistories, client);
            break;
          case NEXT_CLIENT_EVENT.CONNECTION:
            yield put(multichainNextUpdate({ online: payload.online }));
            break;
          case NEXT_CLIENT_EVENT.SEND: {
            const send = yield select((state) => state.multichain.send);
            if (send.sendId === payload.sendId) {
              yield put(multichainNextSendUpdate({
                status: payload.status,
                reason: payload.reason ?? null,
                txId: payload.txId ?? null,
              }));
            }
            break;
          }
          default:
            break;
        }
      } catch (e) {
        log.error(`Failed to handle the Hathor Next ${event} event.`, e);
      }
    }
  } finally {
    channel.close();
  }
}

/**
 * Connects to the network's Hathor Next, unless the client already is, loads it and follows it.
 */
export function* connectNext() {
  const client = ensureNextClient();
  const network = yield select(selectMultichainNetwork);
  const status = yield select((state) => state.multichain.next.status);
  if (status === NEXT_STATUS.READY && client.getNetwork() === network) {
    return;
  }
  const config = yield select(selectSideChainConfig);
  // The backend it connects to, from the start: the backend switching while it connects (the one
  // for local testing turned off as it still answers) then leaves, and connects again on the
  // backend the state names, rather than finish on the one turned off.
  connectedConfig = config;
  yield put(multichainNextUpdate({ status: NEXT_STATUS.CONNECTING, error: null }));
  // The client's events from before the connect on: the connect itself says what it learns (a
  // payment the statement now records), and the follower takes those once it runs.
  const channel = yield call(nextClientChannel, client);
  let followed = false;
  try {
    // Registered from the beginning of the chain: a later birthday loses funds for good.
    yield call([client, client.connect], { network, config, birthday: 'genesis' });
    // The network may have changed while it connected: this Hathor Next is no longer the
    // wallet's.
    if ((yield select(selectMultichainNetwork)) !== network) {
      client.disconnect();
      throw new NextClientError(NEXT_CLIENT_ERROR.NOT_CONNECTED);
    }
    const saved = loadSavedNext();
    const address = client.getAddress();
    saveNext({
      registered: { ...saved.registered, [network]: true },
      ...(address ? { address } : {}),
    });
    yield call(refreshNextData, client);
    if (feedTask) {
      yield cancel(feedTask);
    }
    // Detached: the load that connected must end, and a later load must not cancel the feed.
    feedTask = yield spawn(followNextClient, client, channel);
    followed = true;
  } finally {
    if (!followed) {
      channel.close();
    }
  }
  const address = client.getAddress();
  yield put(multichainNextUpdate({
    status: NEXT_STATUS.READY,
    online: client.isOnline(),
    sendFee: client.getSendFee(),
    ...(address ? { address } : {}),
  }));
}

/**
 * Stops following Hathor Next and closes its session. A history read still on its way is
 * dropped. The keys stay in memory, unless the wallet is reset.
 *
 * @param {{ dropKeys?: boolean }} [options]
 */
function* stopNext({ dropKeys = false } = {}) {
  generation += 1;
  connectedConfig = null;
  if (feedTask) {
    yield cancel(feedTask);
    feedTask = null;
  }
  getNextClient()?.disconnect();
  if (dropKeys) {
    setNextClient(null);
  }
}

/**
 * Loads Hathor Next for a wallet whose side chain is connected: at the wallet's start, and on the
 * loading screen's Try again. A failure leaves `next.status` failed, which the loading screen
 * shows with Try again.
 *
 * @param {Object} options
 * @param {string} [options.pinCode]
 * @param {boolean} options.interactive Whether the user asked for it, so a passkey may run
 */
export function* loadNext({ pinCode, interactive }) {
  // Every reload of the wallet starts it again (a reconnect, coming back from the background): a
  // Hathor Next already loaded on this network stays as it is, with the payments it follows. The
  // keys aren't needed for that: a lock drops them and keeps the session, and the unlock brings
  // them back.
  const client = getNextClient();
  const network = yield select(selectMultichainNetwork);
  const config = yield select(selectSideChainConfig);
  const status = yield select((state) => state.multichain.next.status);
  if (status === NEXT_STATUS.READY && client?.getNetwork() === network
    && connectedConfig === config) {
    return;
  }
  try {
    yield put(multichainNextUpdate({ status: NEXT_STATUS.CONNECTING, error: null }));
    const hasKeys = yield call(ensureKeys, { pinCode, interactive });
    if (!hasKeys) {
      throw new NextClientError(NEXT_CLIENT_ERROR.NO_KEYS);
    }
    yield call(connectNext);
  } catch (e) {
    log.error('Hathor Next could not be loaded.', e);
    yield call(stopNext);
    yield put(multichainNextUpdate({ status: NEXT_STATUS.FAILED, error: loadFailedText(e) }));
  }
}

/**
 * The user turned "Connect to side chain" on: derive the keys (the PIN, or a passkey ceremony),
 * connect and load. The setting turns on only when it all worked; a dismissed passkey leaves it
 * off quietly.
 *
 * @param {string} [pinCode]
 */
export function* turnOnSideChain(pinCode) {
  const key = yield select(selectSideChainKey);
  if (!key || !(yield select(isSideChainAvailable))) {
    return;
  }
  try {
    const unlocking = STORE.isPasskeyWallet() && !ensureNextClient().hasKeys();
    yield put(multichainConnectUpdate({
      status: unlocking ? CONNECT_STATUS.UNLOCKING : CONNECT_STATUS.CONNECTING,
    }));
    const hasKeys = yield call(ensureKeys, { pinCode, interactive: true });
    if (!hasKeys) {
      // Settings collects the PIN before it turns the setting on, when the keys need it.
      log.error('The side chain was turned on without the PIN its keys need.');
      yield put(multichainConnectUpdate({ status: CONNECT_STATUS.IDLE }));
      return;
    }
    yield put(multichainConnectUpdate({ status: CONNECT_STATUS.CONNECTING }));
    yield call(connectNext);
    const current = yield select((state) => state.multichain.connectedNetworks);
    const connectedNetworks = { ...current, [key]: true };
    STORE.setItem(multichainKeyMap.connectedNetworks, connectedNetworks);
    yield put(multichainConnectedNetworksSet(connectedNetworks));
    yield put(multichainConnectUpdate({ status: CONNECT_STATUS.IDLE }));
  } catch (e) {
    yield call(stopNext);
    yield put(multichainNextReset());
    if (e instanceof PasskeyCancelledError) {
      yield put(multichainConnectUpdate({ status: CONNECT_STATUS.IDLE }));
      return;
    }
    log.error('The side chain could not be turned on.', e);
    const error = isExpectedPasskeyError(e) ? e.message : connectFailedText();
    yield put(multichainConnectUpdate({ status: CONNECT_STATUS.FAILED, error }));
  } finally {
    if (yield cancelled()) {
      yield put(multichainConnectUpdate({ status: CONNECT_STATUS.IDLE }));
    }
  }
}

/**
 * Runs a load of Hathor Next as the one a way out cancels. It is detached from the handler that
 * started it: those handlers are takeLatest, and the next action of their type would cancel the
 * load half way, leaving "Loading Hathor Next…" with nothing running. Only a way out (exitNext)
 * or the next load cancels it.
 *
 * @param {Function} load loadNext or turnOnSideChain
 * @param {...*} args
 */
function* runConnect(load, ...args) {
  if (connectTask?.isRunning()) {
    yield cancel(connectTask);
  }
  connectTask = yield spawn(load, ...args);
}

/**
 * Leaves Hathor Next: cancels a load still running, stops following it, closes its session and
 * clears its data.
 *
 * @param {{ dropKeys?: boolean }} [options]
 */
export function* exitNext(options = {}) {
  if (connectTask?.isRunning()) {
    yield cancel(connectTask);
  }
  connectTask = null;
  yield call(stopNext, options);
  yield put(multichainNextReset());
  if (options.dropKeys) {
    yield put(multichainNextUpdate({ keysReady: false, address: null }));
  }
}

/**
 * "Connect to side chain" as saved. On a privatenet it was once saved under the network's name
 * alone, which every privatenet shares: it moves to the key of the network and its node
 * (selectSideChainKey), for the privatenet the wallet is on, so a tester's setting stays on.
 *
 * @returns {Object} network key → true
 */
function* loadConnectedNetworks() {
  const saved = STORE.getItem(multichainKeyMap.connectedNetworks) ?? {};
  const network = yield select(selectMultichainNetwork);
  const key = yield select(selectSideChainKey);
  const own = (name) => Object.prototype.hasOwnProperty.call(saved, name);
  if (network !== NETWORK_PRIVATENET || key === network || !own(network)) {
    return saved;
  }
  const moved = { ...saved };
  if (moved[network] === true && !own(key)) {
    moved[key] = true;
  }
  delete moved[network];
  STORE.setItem(multichainKeyMap.connectedNetworks, moved);
  return moved;
}

/**
 * The wallet started: load the side chain setting and what the wallet saved about Hathor Next,
 * and load Hathor Next where the side chain is connected.
 */
export function* onWalletStarted() {
  yield call(syncDevBackend);
  yield put(multichainConnectedNetworksSet(yield call(loadConnectedNetworks)));
  yield call(showUncertainTransfer);
  const client = getNextClient();
  yield put(multichainNextUpdate({
    address: client?.getAddress() ?? loadSavedNext().address,
    keysReady: Boolean(client?.hasKeys()),
  }));
  if (yield select(isSideChainConnected)) {
    yield call(runConnect, loadNext, { interactive: false });
    return;
  }
  // "Connect to side chain" is turning on: the setting is saved once it loaded, so the side chain
  // isn't connected yet. A reload now (a reconnect) leaves it to finish, where the side chain is
  // still there.
  const turningOn = yield select((state) => TURNING_ON.includes(state.multichain.connect.status));
  if (turningOn && connectTask?.isRunning() && (yield select(isSideChainAvailable))) {
    return;
  }
  // The flags this start read may have turned the side chain off: a Hathor Next still running
  // from before, or still turning on, stops here, since no "flags updated" action comes for them.
  const status = yield select((state) => state.multichain.next.status);
  if (status !== NEXT_STATUS.STOPPED || connectTask?.isRunning()) {
    yield call(exitNext);
  }
}

/**
 * The loading screen's Try again.
 */
export function* onLoadRequested({ payload }) {
  yield call(syncDevBackend);
  if (yield select(isSideChainConnected)) {
    yield call(runConnect, loadNext, { pinCode: payload.pinCode, interactive: true });
  }
}

/**
 * The user turned "Connect to side chain" on or off for the network the wallet runs on.
 */
export function* onConnectSettingChanged({ payload }) {
  yield call(syncDevBackend);
  if (payload.connected) {
    // Only where the flag is on and the network has a side chain; mainnet never has one.
    if (!(yield select(isSideChainAvailable))) {
      log.error('The side chain was asked to turn on where there is none.');
      return;
    }
    yield call(runConnect, turnOnSideChain, payload.pinCode);
    return;
  }
  const key = yield select(selectSideChainKey);
  if (!key) {
    return;
  }
  const current = yield select((state) => state.multichain.connectedNetworks);
  const connectedNetworks = { ...current };
  delete connectedNetworks[key];
  STORE.setItem(multichainKeyMap.connectedNetworks, connectedNetworks);
  yield put(multichainConnectedNetworksSet(connectedNetworks));
  yield call(exitNext);
}

/**
 * Unleash's flags were set: without the side chain, leave Hathor Next; with it back on a network
 * whose side chain is connected, load it. A wallet start sets them before the wallet is ready,
 * and loads Hathor Next itself once it is (onWalletStarted).
 */
export function* onFeatureToggleUpdated() {
  // The backend for local testing has a flag of its own: when it turns on or off, Hathor Next
  // runs on another backend, and loads again there. The keys stay: they are the same on every
  // backend, while the address carries each one's view key. A transfer signed without an answer
  // is that backend's: the one of the backend the wallet is on now shows, and no other.
  yield call(syncDevBackend);
  yield call(showUncertainTransfer);
  const config = yield select(selectSideChainConfig);
  if (connectedConfig && connectedConfig.backendUrl !== config?.backendUrl) {
    yield call(exitNext);
    saveNext({ address: null });
  }
  const available = yield select(isSideChainAvailable);
  const status = yield select((state) => state.multichain.next.status);
  if (!available) {
    if (status !== NEXT_STATUS.STOPPED) {
      yield call(exitNext);
    }
    return;
  }
  const walletReady = yield select((state) => state.walletStartState === WALLET_STATUS.READY);
  const connected = yield select(isSideChainConnected);
  const stopped = yield select((state) => state.multichain.next.status === NEXT_STATUS.STOPPED);
  if (walletReady && connected && stopped) {
    yield call(runConnect, loadNext, { interactive: false });
  }
}

/**
 * The network changed: leave Hathor Next of the network the wallet left. The new network's start
 * loads its own, if its side chain is connected.
 */
export function* onNetworkChanged() {
  yield call(exitNext);
}

/**
 * The wallet was reset: leave Hathor Next and forget its keys. Its saved data has the 'wallet:'
 * prefix, so the reset sweeps it.
 */
export function* onResetWallet() {
  yield call(exitNext, { dropKeys: true });
  yield put(multichainConnectedNetworksSet({}));
  yield put(multichainTransferUpdate(TRANSFER_CLEARED));
  // The sign-once ledgers saved before under keys outside the wallet's, of any wallet or network:
  // the reset sweeps only the `wallet:` keys.
  Object.keys(STORE.hathorMemoryStorage ?? {})
    .filter((key) => key.startsWith('multichain:nextSigned:'))
    .forEach((key) => STORE.removeItem(key));
}

/**
 * A screen asks for a token's Hathor Next history: its first page, or the next one. An answer
 * that arrives after a way out is dropped.
 */
export function* onNextHistoryRequested({ payload }) {
  const { tokenId, more } = payload;
  const client = getNextClient();
  const status = yield select((state) => state.multichain.next.status);
  if (!client || status !== NEXT_STATUS.READY) {
    return;
  }
  const mine = generation;
  const previous = yield select((state) => state.multichain.next.history[tokenId]);
  if (more && (!previous || previous.cursor === null)) {
    return;
  }
  if (!more) {
    yield put(multichainNextHistoryUpdate({ tokenId, status: TOKEN_DOWNLOAD_STATUS.LOADING }));
  }
  try {
    const { rows, cursor } = yield call(
      [client, client.getHistory],
      tokenId,
      { cursor: more ? previous.cursor : 0 },
    );
    if (mine !== generation) {
      return;
    }
    yield put(multichainNextHistoryUpdate({
      tokenId,
      status: TOKEN_DOWNLOAD_STATUS.READY,
      data: more ? [...previous.data, ...rows] : rows,
      cursor,
    }));
  } catch (e) {
    if (mine !== generation) {
      return;
    }
    log.error('Could not load a Hathor Next history.', e);
    yield put(multichainNextHistoryUpdate({ tokenId, status: TOKEN_DOWNLOAD_STATUS.FAILED }));
  }
}

/**
 * Signs and submits a Hathor Next payment. Sign-once: a draft is sent at most once, so a second
 * request for the same draft does nothing, whatever the first one's outcome. The outcome arrives
 * from the client's events.
 *
 * One payment is followed at a time: while one is on its way, another draft sends nothing, so the
 * outcome of the first is never lost to the second.
 */
export function* onNextSendRequested({ payload }) {
  const { tokenId, to, amount, draftId } = payload;
  const send = yield select((state) => state.multichain.send);
  if (send.draftId === draftId || sentDrafts.has(draftId)) {
    log.error('A Hathor Next draft was asked to be sent twice; the second request was ignored.');
    return;
  }
  if (SEND_IN_FLIGHT.includes(send.status)) {
    log.error('A Hathor Next draft was asked to be sent while another payment is on its way; it was ignored.');
    return;
  }
  // Only where the side chain is connected: a request from anywhere else signs nothing. The
  // confirm screen says so, instead of waiting for an outcome that never comes.
  if (!(yield select(isSideChainConnected))) {
    log.error('A Hathor Next payment was asked for where the side chain is not connected.');
    yield put(multichainNextSendUpdate({
      status: OPERATION_STATUS.ERROR,
      draftId,
      sendId: null,
      txId: null,
      reason: null,
      error: connectFailedText(),
    }));
    return;
  }
  sentDrafts.add(draftId);
  yield put(multichainNextSendUpdate({
    status: OPERATION_STATUS.SENDING,
    draftId,
    sendId: null,
    txId: null,
    reason: null,
    error: null,
  }));
  let sendId;
  try {
    const client = getNextClient();
    ({ sendId } = yield call([client, client.send], { tokenId, to, amount }));
    yield put(multichainNextSendUpdate({ sendId }));
    // The payment may have settled while send() ran: its event came before the saga knew the id,
    // so the state it reached is read once now.
    const now = client.getSend(sendId);
    if (now && now.status !== 'pending') {
      yield put(multichainNextSendUpdate({
        status: now.status,
        reason: now.reason ?? null,
        txId: now.txId ?? null,
      }));
    }
  } catch (e) {
    log.error('The Hathor Next payment was refused before it was signed.', e);
    yield put(multichainNextSendUpdate({
      status: OPERATION_STATUS.ERROR,
      error: userErrorText(e),
    }));
    return;
  }
  yield call(awaitSendOutcome, sendId);
}

/**
 * Waits for a payment's outcome, for SEND_SETTLE_MS at most. With none by then (the network is
 * slow, or Hathor Next reconnected and lost track of it), the payment is shown as not settled
 * yet: the screen's spinner gives way and the user can leave. A later outcome still lands, and
 * the payment itself is safe either way: what was signed is sent again until it settles.
 *
 * @param {string} sendId
 */
function* awaitSendOutcome(sendId) {
  const settled = (state) => SEND_SETTLED.includes(state.multichain.send.status);
  if (yield select(settled)) {
    return;
  }
  const { timeout } = yield race({
    outcome: take((action) => action.type === types.MULTICHAIN_NEXT_SEND_UPDATE
      && SEND_SETTLED.includes(action.payload?.status)),
    timeout: delay(SEND_SETTLE_MS),
  });
  if (!timeout) {
    return;
  }
  const send = yield select((state) => state.multichain.send);
  if (send.sendId === sendId && !SEND_SETTLED.includes(send.status)) {
    yield put(multichainNextSendUpdate({ status: OPERATION_STATUS.UNCONFIRMED }));
  }
}

// How often, and how many times, a transfer signed without an answer is asked about at first.
// After that, the transfers poll asks again (pollPendingTransfers).
const RESOLVE_INTERVAL_MS = 3000;
const RESOLVE_TRIES = 10;

// Whether a transfer signed without an answer is being asked about: by one asker at a time.
let resolving = false;

/**
 * Settles a transfer signed without an answer: done when its burn reached the network, a plain
 * error when it never did (nothing left the wallet), still unconfirmed when the backend can't be
 * read, or when another asker is on it. Until it settles no other transfer starts, so nothing
 * burns twice.
 *
 * The outcome keeps the requestId of the screen that sent it: on any other confirm screen it shows
 * as an earlier transfer's.
 *
 * @param {Object} bridge
 * @param {{ id: string, inputs: Object[]|null }} uncertain Its id, and the outputs its burn spends
 * @param {number} tries
 * @returns {boolean} Whether it settled
 */
export function* resolveUncertainTransfer(bridge, uncertain, tries) {
  if (resolving) {
    return false;
  }
  resolving = true;
  try {
    for (let i = 0; i < tries; i += 1) {
      // Asked about, and settled, only while its record is saved where the wallet is: after a
      // switch of backend, the client asks the new one, which never knew it. The background
      // check asks again once the wallet is back where it was signed.
      if (!(yield call(stillUncertainHere, uncertain.id))) {
        return false;
      }
      try {
        const record = yield call(
          [bridge, bridge.resolveTransfer],
          uncertain.id,
          { inputs: uncertain.inputs ?? undefined },
        );
        if (!(yield call(stillUncertainHere, uncertain.id))) {
          return false;
        }
        STORE.removeItem(multichainKeyMap.uncertainTransfer);
        // Reached the network and was refused there (its inputs spent, for one): nothing moved.
        if (!record || record.status === TRANSFER_STATUS.FAILED) {
          if (record) {
            log.error(`A transfer's burn was refused: ${record.reason}`);
          }
          yield put(multichainTransferUpdate({
            status: OPERATION_STATUS.ERROR,
            error: new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_NOT_SENT).message,
            errorCode: NEXT_CLIENT_ERROR.TRANSFER_NOT_SENT,
            uncertainId: null,
          }));
          return true;
        }
        yield put(multichainTransferUpdate({
          status: OPERATION_STATUS.DONE,
          record,
          error: null,
          uncertainId: null,
        }));
        // Its own step: a read that fails leaves the transfer settled as done.
        try {
          yield call(refreshTransfers);
        } catch (e) {
          log.error('Could not read the transfers between chains after a transfer.', e);
        }
        return true;
      } catch (e) {
        // The backend no longer knows it, and the wallet's node can't tell that nothing moved:
        // there is nothing left to ask. Still uncertain, it would stop every transfer here for
        // good. Its HTR may have left the wallet: it is saved as forgotten, and shows on the
        // transfer screens, across restarts, until the user dismisses it.
        if (e?.code === NEXT_CLIENT_ERROR.TRANSFER_FORGOTTEN) {
          if (!(yield call(stillUncertainHere, uncertain.id))) {
            return false;
          }
          log.error('A transfer signed without an answer is no longer known to the backend.');
          const saved = STORE.getItem(multichainKeyMap.uncertainTransfer);
          STORE.setItem(multichainKeyMap.uncertainTransfer, {
            ...saved, id: uncertain.id, inputs: null, forgotten: true,
          });
          yield put(multichainTransferUpdate(transferForgotten()));
          return true;
        }
        log.error('Could not read a transfer signed without an answer.', e);
      }
      if (i < tries - 1) {
        yield delay(RESOLVE_INTERVAL_MS);
      }
    }
    return false;
  } finally {
    resolving = false;
  }
}

/**
 * Transfers a token from one chain to the other. A second request while one runs is ignored
 * (takeLeading), so a double tap can't transfer twice. A transfer signed without an answer is
 * settled first (resolveUncertainTransfer), here and before the next one starts.
 */
export function* onTransferRequested({ payload }) {
  const {
    from = CHAIN.HATHOR,
    to = CHAIN.HATHOR_NEXT,
    tokenId = '00',
    amount,
    toAddress,
    pinCode,
    requestId = null,
  } = payload;
  // Only where the side chain is connected: a request from anywhere else burns nothing. The
  // confirm screen says so.
  if (!(yield select(isSideChainConnected))) {
    log.error('A transfer between chains was asked for where the side chain is not connected.');
    yield put(multichainTransferUpdate({
      status: OPERATION_STATUS.ERROR,
      requestId,
      record: null,
      error: connectFailedText(),
      errorCode: null,
    }));
    return;
  }
  // One that ended forgotten holds every transfer here until the user dismisses it: its HTR may
  // have left the wallet. The screens keep Confirm off while it shows; this holds a request that
  // came before it showed (biometrics, with the PIN screen open).
  if ((yield call(savedTransferHere))?.forgotten) {
    yield call(showUncertainTransfer);
    return;
  }
  // Where the transfer is signed: its record names it, whatever the backend is by its answer.
  const place = yield call(currentPlace);
  const pending = yield call(uncertainTransferHere);
  let bridge = null;
  if (pending) {
    bridge = yield call(currentBridge);
    const settled = yield call(resolveUncertainTransfer, bridge, pending, 1);
    const transfer = yield select((state) => state.multichain.transfer);
    // Settled as sent, or forgotten (its HTR may have left the wallet): that transfer is the
    // outcome, shown as the earlier one's (its requestId isn't this request's), and a new one
    // waits for the user. Only one that never went through lets this one go on.
    if (!settled || transfer.status === OPERATION_STATUS.DONE || isForgotten(transfer)) {
      // Unsettled, and still saved here: not confirmed. Gone from here (another backend now),
      // it shows again only back there.
      if (!settled && (yield call(stillUncertainHere, pending.id))) {
        yield put(multichainTransferUpdate({
          status: OPERATION_STATUS.UNCONFIRMED,
          error: new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_UNCERTAIN).message,
          uncertainId: pending.id,
        }));
      }
      return;
    }
  }
  yield put(multichainTransferUpdate({
    status: OPERATION_STATUS.SENDING,
    requestId,
    record: null,
    error: null,
    errorCode: null,
  }));
  try {
    bridge = bridge ?? (yield call(currentBridge));
    const ownAddress = to === CHAIN.HATHOR_NEXT
      ? yield select((state) => state.multichain.next.address)
      : null;
    const record = yield call(
      [bridge, bridge.transfer],
      { from, to, tokenId, amount, toAddress, ownAddress, pinCode },
    );
    // Reached the network and was refused there (its inputs spent, for one): nothing moved.
    if (record.status === TRANSFER_STATUS.FAILED) {
      log.error(`A transfer's burn was refused: ${record.reason}`);
      yield put(multichainTransferUpdate({
        status: OPERATION_STATUS.ERROR,
        error: new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_NOT_SENT).message,
        errorCode: NEXT_CLIENT_ERROR.TRANSFER_NOT_SENT,
      }));
      return;
    }
    yield put(multichainTransferUpdate({ status: OPERATION_STATUS.DONE, record }));
  } catch (e) {
    if (e instanceof PasskeyCancelledError) {
      // The user dismissed the passkey: nothing was signed, and the transfer can be confirmed
      // again.
      yield put(multichainTransferUpdate({ status: OPERATION_STATUS.IDLE }));
      return;
    }
    if (e?.code === NEXT_CLIENT_ERROR.TRANSFER_UNCERTAIN && e.transferId) {
      // Signed, with no answer: never shown as a failure, never retried blindly.
      rememberUncertainTransfer(e.transferId, e.inputs ?? null, place);
      yield put(multichainTransferUpdate({
        status: OPERATION_STATUS.UNCONFIRMED,
        error: e.message,
        uncertainId: e.transferId,
      }));
      yield call(
        resolveUncertainTransfer,
        bridge,
        { id: e.transferId, inputs: e.inputs ?? null },
        RESOLVE_TRIES,
      );
      return;
    }
    log.error('The transfer between chains failed.', e);
    yield put(multichainTransferUpdate({
      status: OPERATION_STATUS.ERROR,
      error: userErrorText(e, transferFailedText),
      errorCode: e?.code ?? null,
    }));
    return;
  }
  // The transfer went through: reading the list again is its own step, and a read that fails
  // leaves the transfer done. Shown as failed, it would let the user transfer a second time.
  try {
    yield call(refreshTransfers);
  } catch (e) {
    log.error('Could not read the transfers between chains after a transfer.', e);
  }
}

/**
 * A backend for local testing was set or cleared: save it, leave the Hathor Next that ran on the
 * other backend and load it again where the side chain is connected. The keys stay, as they are
 * the same on every backend; were they missing, the PIN Settings asked for the switch derives
 * them, or a passkey wallet's ceremony, run now since the user asked for it.
 */
export function* onDevBackendSet({ payload, meta }) {
  if (!meta?.persist) {
    // Read back from storage at the start: nothing ran on another backend yet.
    return;
  }
  if (payload) {
    STORE.setItem(multichainKeyMap.devBackend, payload);
  } else {
    STORE.removeItem(multichainKeyMap.devBackend);
  }
  yield call(exitNext);
  // The address carries the backend's view key: the new backend's comes with its connect.
  saveNext({ address: null });
  yield call(showUncertainTransfer);
  if (yield select(isSideChainConnected)) {
    yield call(runConnect, loadNext, { pinCode: meta.pinCode, interactive: true });
  }
}

/**
 * The app locked: the Hathor Next keys leave memory until the next unlock derives them again.
 */
export function* onLockChanged({ payload: locked }) {
  if (locked !== true) {
    return;
  }
  if (getNextClient()?.forgetKeys()) {
    yield put(multichainNextUpdate({ keysReady: false }));
  }
}

export function* saga() {
  // A new run of the saga is a new app: no draft has been sent in it.
  sentDrafts.clear();
  // The watchers start at once, so nothing dispatched before Unleash answers is missed. The
  // backend for local testing is settled as soon as it answers, and every handler that reaches
  // Hathor Next waits for that (syncDevBackend).
  yield fork(syncDevBackend);
  yield all([
    takeEvery(types.START_WALLET_SUCCESS, onWalletStarted),
    takeLatest(types.MULTICHAIN_CONNECT_SETTING_CHANGED, onConnectSettingChanged),
    takeLatest(types.MULTICHAIN_LOAD_REQUESTED, onLoadRequested),
    takeLatest(types.MULTICHAIN_NEXT_KEYS_UNLOCK_REQUESTED, onNextKeysUnlockRequested),
    takeLatest(types.MULTICHAIN_NEXT_KEYS_DERIVED, onNextKeysDerived),
    takeEvery(types.MULTICHAIN_NEXT_HISTORY_REQUESTED, onNextHistoryRequested),
    takeEvery(types.MULTICHAIN_NEXT_SEND_REQUESTED, onNextSendRequested),
    takeLeading(types.MULTICHAIN_TRANSFER_REQUESTED, onTransferRequested),
    takeEvery(types.MULTICHAIN_TRANSFER_FORGOTTEN_SEEN, onTransferForgottenSeen),
    // Every change of the flags sets them: a retry of Unleash that answers, with nothing after
    // it, and a poll that finds a change, with "flags updated" right after. That second action
    // is left alone: it would run this again while the first run still goes, and cut it short.
    takeLatest(types.SET_FEATURE_TOGGLES, onFeatureToggleUpdated),
    takeLatest(types.NETWORK_CHANGED, onNetworkChanged),
    takeLatest(types.RESET_WALLET, onResetWallet),
    takeLatest(types.MULTICHAIN_DEV_BACKEND_SET, onDevBackendSet),
    takeEvery(types.SET_LOCK_SCREEN, onLockChanged),
  ]);
}
