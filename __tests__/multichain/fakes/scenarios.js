/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * How the fake Hathor Next behaves in a test: its ledger starts funded or empty, and its client
 * fails, stalls or refuses as the scenario says.
 */
export const FAKE_SCENARIO = {
  FUNDED: 'funded',
  EMPTY: 'empty',
  SLOW_SYNC: 'slow-sync',
  CONNECT_FAILS: 'connect-fails',
  GOES_OFFLINE: 'goes-offline',
  SEND_REJECTED: 'send-rejected',
  SEND_UNCONFIRMED: 'send-unconfirmed',
};

export const DEFAULT_FAKE_SCENARIO = FAKE_SCENARIO.FUNDED;

/**
 * Whether a scenario starts with the funded ledger.
 *
 * @param {string} scenario One of FAKE_SCENARIO
 * @returns {boolean}
 */
export function isFundedScenario(scenario) {
  return scenario !== FAKE_SCENARIO.EMPTY;
}
