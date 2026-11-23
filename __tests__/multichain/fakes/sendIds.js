/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Send ids as the backend makes them: 16 bytes in lowercase hex. The signer refuses any other,
 * so the tests that sign name their sends with these; the number they stand for ends each one.
 */
const sendIdOf = (prefix, n) => `${prefix}${String(n).padStart(32 - prefix.length, '0')}`;

export const SEND_0 = sendIdOf('5e1d', 0);
export const SEND_1 = sendIdOf('5e1d', 1);
export const SEND_2 = sendIdOf('5e1d', 2);
export const SEND_9 = sendIdOf('5e1d', 9);
export const CREATE_1 = sendIdOf('c4ea7e', 1);
