/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Wraps the built-in console to add scope to messages.
* @param {string} scope - prefix each message.
*
* @example
* const log = logger('my-scope');
* log.debug('a custom message');
* // output: [my-scope] a custom message
 */
export const logger = (scope) => ({
  log(msg) {
    console.log(`[${scope}] ${msg}`);
  },
  debug(msg) {
    console.debug(`[${scope}] ${msg}`);
  },
  error(msg, err) {
    console.error(`[${scope}] ${msg}`, err);
  },
  warn(msg) {
    console.warn(`[${scope}] ${msg}`);
  }
});
