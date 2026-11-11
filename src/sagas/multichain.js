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
  multichainMockUpdate,
  multichainNextHistoryUpdate,
  multichainNextReset,
  multichainNextSendUpdate,
  multichainNextUpdate,
  multichainTransfersSet,
  multichainTransferUpdate,
} from '../actions';
import { multichainKeyMap } from '../constants';
import { logger } from '../logger';
import { STORE } from '../store';
import { isExpectedPasskeyError, PasskeyCancelledError, withPasskeyWords } from '../passkey/passkeySigner';
import { TOKEN_DOWNLOAD_STATUS } from './tokens';
import { WALLET_STATUS } from './wallet';
import { createBridge } from '../multichain/bridge';
import { CHAIN, isSimulatedClient } from '../multichain/chains';
import {
  getMultichainFeatureToggle,
  isSideChainAvailable,
  isSideChainConnected,
  selectDevBackend,
  selectMultichainNetwork,
  selectSideChainConfig,
} from '../multichain/gating';
import { waitForFeatureToggleInitialization } from './helpers';
import {
  hasUsedNext,
  loadSavedNext,
  prepareNextKeys,
  saveNext,
  pendingUnlockDerivation,
} from '../multichain/keys';
import {
  NEXT_CLIENT_KIND,
  ensureNextClient,
  getNextClient,
  setNextClient,
  setNextClientKind,
} from '../multichain/nextClient';
import { NEXT_CLIENT_EVENT, NextClientError, NEXT_CLIENT_ERROR } from '../multichain/nextClientErrors';
import { loadLedger, resetLedger } from '../multichain/mock/mockLedger';
import {
  CONNECT_STATUS,
  NEXT_STATUS,
  OPERATION_STATUS,
  SEND_IN_FLIGHT,
  TRANSFER_STATUS,
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
 * Brings the backend saved for local testing into the state, when the state doesn't have it yet,
 * and runs the kind of client it needs: the backend client with one in force (its flag on), the
 * simulated client otherwise.
 *
 * @returns {boolean} Whether the client changed kind
 */
export function* syncDevBackend() {
  // The backend's flag decides the client's kind, so it is read once Unleash answered (or its
  // defaults stand): keys derived on one kind are lost when it changes.
  yield call(waitForFeatureToggleInitialization);
  const stored = yield select((state) => state.multichain.devBackend);
  if (!stored) {
    const saved = STORE.getItem(multichainKeyMap.devBackend) ?? null;
    if (saved) {
      yield put(multichainDevBackendSet(saved, { persist: false }));
    }
  }
  const devBackend = yield select(selectDevBackend);
  return setNextClientKind(devBackend ? NEXT_CLIENT_KIND.BACKEND : NEXT_CLIENT_KIND.MOCK);
}

/** What the user is told when Hathor Next can't be loaded. */
export const connectFailedText = () => t`Couldn't connect to Hathor Next.`;

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
  const words = yield call([STORE, STORE.getWalletWords], pinCode);
  const address = yield call(prepareNextKeys, words);
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
  // It waits for Unleash, so the flag below is Unleash's answer (or its default, off).
  yield call(syncDevBackend);
  const multichainOn = yield select(getMultichainFeatureToggle);
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
    const { status, uncertainId } = yield select((state) => state.multichain.transfer);
    if (uncertainId && status === OPERATION_STATUS.UNCONFIRMED) {
      try {
        const bridge = yield call(currentBridge);
        yield call(resolveUncertainTransfer, bridge, uncertainId, 1);
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
 */
export function* followNextClient(client) {
  const channel = yield call(nextClientChannel, client);
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
  yield put(multichainNextUpdate({ status: NEXT_STATUS.CONNECTING, error: null }));
  // Registered from the beginning of the chain: a later birthday loses funds for good.
  yield call([client, client.connect], { network, config, birthday: 'genesis' });
  // The network may have changed while it connected: this Hathor Next is no longer the wallet's.
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
  feedTask = yield spawn(followNextClient, client);
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
    const error = isExpectedPasskeyError(e) ? e.message : connectFailedText();
    yield put(multichainNextUpdate({ status: NEXT_STATUS.FAILED, error }));
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
  const network = yield select(selectMultichainNetwork);
  if (!network) {
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
    const connectedNetworks = { ...current, [network]: true };
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
 * Runs a load of Hathor Next as the one a way out cancels.
 *
 * @param {Function} load loadNext or turnOnSideChain
 * @param {...*} args
 */
function* runConnect(load, ...args) {
  if (connectTask?.isRunning()) {
    yield cancel(connectTask);
  }
  connectTask = yield fork(load, ...args);
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
 * The wallet started: load the side chain setting and what the wallet saved about Hathor Next,
 * and load Hathor Next where the side chain is connected.
 */
export function* onWalletStarted() {
  yield call(syncDevBackend);
  yield put(multichainConnectedNetworksSet(
    STORE.getItem(multichainKeyMap.connectedNetworks) ?? {},
  ));
  const client = getNextClient();
  yield put(multichainNextUpdate({
    address: client?.getAddress() ?? loadSavedNext().address,
    keysReady: Boolean(client?.hasKeys()),
  }));
  const network = yield select(selectMultichainNetwork);
  if (isSimulatedClient() && network) {
    yield put(multichainMockUpdate({ scenario: loadLedger(network).scenario }));
  }
  if (yield select(isSideChainConnected)) {
    yield call(runConnect, loadNext, { interactive: false });
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
    yield call(runConnect, turnOnSideChain, payload.pinCode);
    return;
  }
  const network = yield select(selectMultichainNetwork);
  if (!network) {
    return;
  }
  const current = yield select((state) => state.multichain.connectedNetworks);
  const connectedNetworks = { ...current };
  delete connectedNetworks[network];
  STORE.setItem(multichainKeyMap.connectedNetworks, connectedNetworks);
  yield put(multichainConnectedNetworksSet(connectedNetworks));
  yield call(exitNext);
}

/**
 * The flags changed: without the side chain, leave Hathor Next; with it back on a network whose
 * side chain is connected, load it.
 */
export function* onFeatureToggleUpdated() {
  // The backend for local testing has a flag of its own: when it turns on or off, the client
  // changes kind, and Hathor Next loads again on the other one.
  if (yield call(syncDevBackend)) {
    yield call(exitNext, { dropKeys: true });
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
  if (send.draftId === draftId) {
    log.error('A Hathor Next draft was asked to be sent twice; the second request was ignored.');
    return;
  }
  if (SEND_IN_FLIGHT.includes(send.status)) {
    log.error('A Hathor Next draft was asked to be sent while another payment is on its way; it was ignored.');
    return;
  }
  yield put(multichainNextSendUpdate({
    status: OPERATION_STATUS.SENDING,
    draftId,
    sendId: null,
    txId: null,
    reason: null,
    error: null,
  }));
  try {
    const client = getNextClient();
    const { sendId } = yield call([client, client.send], { tokenId, to, amount });
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
    yield put(multichainNextSendUpdate({ status: OPERATION_STATUS.ERROR, error: e.message }));
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
 * @param {Object} bridge
 * @param {string} transferId
 * @param {number} tries
 * @returns {boolean} Whether it settled
 */
export function* resolveUncertainTransfer(bridge, transferId, tries) {
  if (resolving) {
    return false;
  }
  resolving = true;
  try {
    for (let i = 0; i < tries; i += 1) {
      try {
        const record = yield call([bridge, bridge.resolveTransfer], transferId);
        if (record) {
          yield put(multichainTransferUpdate({
            status: OPERATION_STATUS.DONE,
            record,
            error: null,
            uncertainId: null,
          }));
          yield call(refreshTransfers);
        } else {
          yield put(multichainTransferUpdate({
            status: OPERATION_STATUS.ERROR,
            error: new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_NOT_SENT).message,
            uncertainId: null,
          }));
        }
        return true;
      } catch (e) {
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
  } = payload;
  const pendingId = yield select((state) => state.multichain.transfer.uncertainId);
  let bridge = null;
  if (pendingId) {
    bridge = yield call(currentBridge);
    const settled = yield call(resolveUncertainTransfer, bridge, pendingId, 1);
    const status = yield select((state) => state.multichain.transfer.status);
    // Settled as sent: that transfer is the outcome, and a new one waits for the user.
    if (!settled || status === OPERATION_STATUS.DONE) {
      if (!settled) {
        yield put(multichainTransferUpdate({ status: OPERATION_STATUS.UNCONFIRMED }));
      }
      return;
    }
  }
  yield put(multichainTransferUpdate({
    status: OPERATION_STATUS.SENDING,
    record: null,
    error: null,
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
    yield put(multichainTransferUpdate({ status: OPERATION_STATUS.DONE, record }));
    yield call(refreshTransfers);
  } catch (e) {
    if (e instanceof PasskeyCancelledError) {
      // The user dismissed the passkey: nothing was signed, and the transfer can be confirmed
      // again.
      yield put(multichainTransferUpdate({ status: OPERATION_STATUS.IDLE }));
      return;
    }
    if (e?.code === NEXT_CLIENT_ERROR.TRANSFER_UNCERTAIN && e.transferId) {
      // Signed, with no answer: never shown as a failure, never retried blindly.
      yield put(multichainTransferUpdate({
        status: OPERATION_STATUS.UNCONFIRMED,
        error: e.message,
        uncertainId: e.transferId,
      }));
      yield call(resolveUncertainTransfer, bridge, e.transferId, RESOLVE_TRIES);
      return;
    }
    log.error('The transfer between chains failed.', e);
    yield put(multichainTransferUpdate({ status: OPERATION_STATUS.ERROR, error: e.message }));
  }
}

/**
 * The simulated Hathor Next: a new scenario, or a reset, starts its ledger over. What a scenario
 * does on connect takes effect the next time Hathor Next loads.
 */
export function* onMockLedgerChanged(action) {
  const network = yield select(selectMultichainNetwork);
  if (!isSimulatedClient() || !network) {
    return;
  }
  const scenario = action.type === types.MULTICHAIN_MOCK_SCENARIO_SET
    ? action.payload
    : yield select((state) => state.multichain.mock.scenario);
  resetLedger(network, scenario);
  yield put(multichainMockUpdate({ scenario }));
  const client = getNextClient();
  if (client && client.getNetwork() === network) {
    yield call(refreshNextData, client);
    yield call(refreshLoadedHistories, client);
  }
}

/**
 * A backend for local testing was set or cleared: save it, leave the Hathor Next that ran (its
 * client and keys belong to the other kind) and load it again where the side chain is connected,
 * with keys derived again: from the PIN Settings asked for the switch, or by a passkey wallet's
 * ceremony, run now since the user asked for it.
 */
export function* onDevBackendSet({ payload, meta }) {
  if (!meta?.persist) {
    // Read back from storage at the start: nothing ran on the other kind yet.
    return;
  }
  if (payload) {
    STORE.setItem(multichainKeyMap.devBackend, payload);
  } else {
    STORE.removeItem(multichainKeyMap.devBackend);
  }
  yield call(exitNext, { dropKeys: true });
  setNextClientKind(payload ? NEXT_CLIENT_KIND.BACKEND : NEXT_CLIENT_KIND.MOCK);
  saveNext({ address: null });
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
  // The watchers start at once, so nothing dispatched before Unleash answers is missed. The
  // client's kind is settled as soon as it answers, and every handler that picks a client waits
  // for that (syncDevBackend).
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
    takeLatest(
      [types.MULTICHAIN_MOCK_SCENARIO_SET, types.MULTICHAIN_MOCK_RESET],
      onMockLedgerChanged,
    ),
    takeLatest(types.FEATURE_TOGGLE_UPDATED, onFeatureToggleUpdated),
    takeLatest(types.NETWORK_CHANGED, onNetworkChanged),
    takeLatest(types.RESET_WALLET, onResetWallet),
    takeLatest(types.MULTICHAIN_DEV_BACKEND_SET, onDevBackendSet),
    takeEvery(types.SET_LOCK_SCREEN, onLockChanged),
  ]);
}
