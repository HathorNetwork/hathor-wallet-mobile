/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** The most of a backend's reason the app keeps and shows. */
export const REASON_MAX_LENGTH = 200;

// Control characters, and the invisible ones that reorder or hide text.
// eslint-disable-next-line no-control-regex
const HIDDEN = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g;

/**
 * Why a backend says a payment, creation or transfer failed, as the app keeps and shows it: one
 * line of plain text, at most REASON_MAX_LENGTH characters. The backend's own words, but they are
 * stored with the sign-once ledger, which the app reads whole at every start, and shown in the
 * app's own modals after "The network said:".
 *
 * @param {unknown} reason
 * @returns {string|null} null when there is nothing to show
 */
export function reasonText(reason) {
  if (typeof reason !== 'string') {
    return null;
  }
  const plain = reason.slice(0, REASON_MAX_LENGTH * 4).replace(HIDDEN, ' ').replace(/\s+/g, ' ')
    .trim();
  if (!plain) {
    return null;
  }
  return plain.length > REASON_MAX_LENGTH ? `${plain.slice(0, REASON_MAX_LENGTH - 1)}…` : plain;
}
