/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { eventChannel } from 'redux-saga';
import {
  all,
  call,
  cancel,
  cancelled,
  delay,
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
import { CHAIN } from '../multichain/chains';
import {
  isSideChainAvailable,
  isSideChainConnected,
  selectMultichainNetwork,
  selectSideChainConfig,
  selectSideChainKey,
} from '../multichain/gating';
import { loadSavedNext, prepareNextKeys, saveNext } from '../multichain/keys';
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
  OPERATION_STATUS.ERROR,
];

/** "Connect to side chain" is turning on, in these states. */
const TURNING_ON = [CONNECT_STATUS.UNLOCKING, CONNECT_STATUS.CONNECTING];

/** What the user is told when Hathor Next can't be loaded. */
export const connectFailedText = () => t`Couldn't connect to Hathor Next.`;

/** What the user is told when a transfer fails for a reason that has no words of its own. */
export const transferFailedText = () => t`The transfer failed.`;

/**
 * The bridge of the network the wallet runs on.
 */
export function* currentBridge() {
  const config = yield select(selectSideChainConfig);
  const network = yield select(selectMultichainNetwork);
  const decimalPlaces = yield select((state) => state.serverInfo?.decimal_places ?? 2);
  return createBridge(config, { network, decimalPlaces });
}

/**
 * Derives the Hathor Next keys with the PIN, which decrypts the words.
 *
 * @param {string} pinCode
 */
export function* deriveKeysWithPin(pinCode) {
  const words = yield call([STORE, STORE.getWalletWords], pinCode);
  const address = prepareNextKeys(words);
  yield put(multichainNextUpdate({ keysReady: true, address }));
  return address;
}

/**
 * Derives the Hathor Next keys in one passkey ceremony.
 *
 * @throws PasskeyCancelledError when the user dismisses it
 */
export function* deriveKeysWithPasskey() {
  const address = yield call(withPasskeyWords, async (words) => prepareNextKeys(words));
  yield put(multichainNextUpdate({ keysReady: true, address }));
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
 * The lock screen took the PIN: derive the Hathor Next keys if the wallet used Hathor Next
 * before, so loading it needs no prompt. A failure is only logged. A load that failed for want of
 * the keys (the loading screen's Try again locks the app to get the PIN) runs again.
 */
export function* onNextKeysUnlockRequested({ payload }) {
  if (!loadSavedNext().address || ensureNextClient().hasKeys()) {
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
  yield call(refreshTransfers);
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
 * The client's events, as a channel.
 *
 * @param {Object} client
 */
export function nextClientChannel(client) {
  return eventChannel((emitter) => {
    const unsubscribes = Object.values(NEXT_CLIENT_EVENT).map((event) => (
      client.on(event, (payload) => emitter({ event, payload: payload ?? {} }))
    ));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  });
}

/**
 * Follows the connected client's events until stopNext cancels it.
 *
 * @param {Object} client
 */
export function* followNextClient(client) {
  const channel = yield call(nextClientChannel, client);
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
  saveNext({ registered: { ...saved.registered, [network]: true } });
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
  // Every reload of the wallet starts it again (a reconnect, coming back from the background): a
  // Hathor Next already loaded on this network stays as it is, with the payments it follows.
  const client = getNextClient();
  const network = yield select(selectMultichainNetwork);
  const status = yield select((state) => state.multichain.next.status);
  if (status === NEXT_STATUS.READY && client?.hasKeys() && client.getNetwork() === network) {
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
 * The wallet started: load the side chain setting and what the wallet saved about Hathor Next,
 * and load Hathor Next where the side chain is connected.
 */
export function* onWalletStarted() {
  yield put(multichainConnectedNetworksSet(
    STORE.getItem(multichainKeyMap.connectedNetworks) ?? {},
  ));
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
  if (yield select(isSideChainConnected)) {
    yield call(runConnect, loadNext, { pinCode: payload.pinCode, interactive: true });
  }
}

/**
 * The user turned "Connect to side chain" on or off for the network the wallet runs on.
 */
export function* onConnectSettingChanged({ payload }) {
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
  if (walletReady && connected && status === NEXT_STATUS.STOPPED) {
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
 */
export function* onNextSendRequested({ payload }) {
  const { tokenId, to, amount, draftId } = payload;
  const send = yield select((state) => state.multichain.send);
  if (send.draftId === draftId || sentDrafts.has(draftId)) {
    log.error('A Hathor Next draft was asked to be sent twice; the second request was ignored.');
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

/**
 * Transfers a token from one chain to the other. A second request while one runs is ignored
 * (takeLeading), so a double tap can't transfer twice.
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
  // Only where the side chain is connected: a request from anywhere else burns nothing. The
  // confirm screen says so.
  if (!(yield select(isSideChainConnected))) {
    log.error('A transfer between chains was asked for where the side chain is not connected.');
    yield put(multichainTransferUpdate({
      status: OPERATION_STATUS.ERROR,
      record: null,
      error: connectFailedText(),
    }));
    return;
  }
  yield put(multichainTransferUpdate({
    status: OPERATION_STATUS.SENDING,
    record: null,
    error: null,
  }));
  try {
    const bridge = yield call(currentBridge);
    const ownAddress = to === CHAIN.HATHOR_NEXT
      ? yield select((state) => state.multichain.next.address)
      : null;
    const record = yield call(
      [bridge, bridge.transfer],
      { from, to, tokenId, amount, toAddress, ownAddress, pinCode },
    );
    yield put(multichainTransferUpdate({ status: OPERATION_STATUS.DONE, record }));
  } catch (e) {
    if (e instanceof PasskeyCancelledError) {
      // The user dismissed the passkey: nothing was signed, and the transfer can be confirmed
      // again.
      yield put(multichainTransferUpdate({ status: OPERATION_STATUS.IDLE }));
      return;
    }
    log.error('The transfer between chains failed.', e);
    yield put(multichainTransferUpdate({
      status: OPERATION_STATUS.ERROR,
      error: userErrorText(e, transferFailedText),
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

export function* saga() {
  // A new run of the saga is a new app: no draft has been sent in it.
  sentDrafts.clear();
  yield all([
    takeEvery(types.START_WALLET_SUCCESS, onWalletStarted),
    takeLatest(types.MULTICHAIN_CONNECT_SETTING_CHANGED, onConnectSettingChanged),
    takeLatest(types.MULTICHAIN_LOAD_REQUESTED, onLoadRequested),
    takeLatest(types.MULTICHAIN_NEXT_KEYS_UNLOCK_REQUESTED, onNextKeysUnlockRequested),
    takeEvery(types.MULTICHAIN_NEXT_HISTORY_REQUESTED, onNextHistoryRequested),
    takeEvery(types.MULTICHAIN_NEXT_SEND_REQUESTED, onNextSendRequested),
    takeLeading(types.MULTICHAIN_TRANSFER_REQUESTED, onTransferRequested),
    // Every change of the flags sets them: a retry of Unleash that answers, with nothing after
    // it, and a poll that finds a change, with "flags updated" right after. That second action
    // is left alone: it would run this again while the first run still goes, and cut it short.
    takeLatest(types.SET_FEATURE_TOGGLES, onFeatureToggleUpdated),
    takeLatest(types.NETWORK_CHANGED, onNetworkChanged),
    takeLatest(types.RESET_WALLET, onResetWallet),
  ]);
}
