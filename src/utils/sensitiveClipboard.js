/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AppState, Clipboard } from 'react-native';
import { SENSITIVE_CLIPBOARD_CLEAR_MS } from '../constants';

/**
 * The clear the last sensitive copy armed: its timer, when it is due, and the subscription that
 * clears the clipboard when the app comes back to the foreground after it is due. A newer copy
 * replaces the timer and the due time. It never holds the copied text.
 */
const pendingClear = {
  timer: null,
  dueAt: null,
  subscription: null,
};

/**
 * Clears the clipboard and drops the pending clear. It writes an empty string over whatever the
 * clipboard holds, without reading it first: a read shows the paste prompt on iOS 16 and later,
 * and a toast on Android 12 and later. So it also clears what the user copied since.
 */
function clearSensitiveCopy() {
  if (pendingClear.timer !== null) {
    clearTimeout(pendingClear.timer);
  }
  if (pendingClear.subscription !== null) {
    pendingClear.subscription.remove();
  }
  pendingClear.timer = null;
  pendingClear.dueAt = null;
  pendingClear.subscription = null;
  Clipboard.setString('');
}

/**
 * iOS suspends the timers of an app in the background, so the timer may not have run when the
 * app comes back: the clear runs then, if it is due.
 *
 * @param {string} nextState The app's new AppState
 */
function onAppStateChange(nextState) {
  if (nextState === 'active' && pendingClear.dueAt !== null && Date.now() >= pendingClear.dueAt) {
    clearSensitiveCopy();
  }
}

/**
 * Copies sensitive text, such as a privacy key or the unblinding values of a tx, to the clipboard,
 * and clears the clipboard once the time is up: when the timer runs, or when the app comes back
 * to the foreground after it. A newer sensitive copy restarts the time.
 *
 * The clear is best effort: it doesn't run while the app is killed, and the system keeps what
 * other apps, such as a keyboard with a clipboard history, took from the clipboard meanwhile.
 *
 * @param {string} text
 * @param {Object} [options]
 * @param {number} [options.clearAfterMs] How long the text stays in the clipboard
 */
export function copySensitive(text, { clearAfterMs = SENSITIVE_CLIPBOARD_CLEAR_MS } = {}) {
  Clipboard.setString(text);
  if (pendingClear.timer !== null) {
    clearTimeout(pendingClear.timer);
  }
  pendingClear.dueAt = Date.now() + clearAfterMs;
  pendingClear.timer = setTimeout(clearSensitiveCopy, clearAfterMs);
  if (pendingClear.subscription === null) {
    pendingClear.subscription = AppState.addEventListener('change', onAppStateChange);
  }
}
