/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { t } from 'ttag';

/**
 * How the simulated Hathor Next behaves. Picked in Settings, under "Hathor Next (simulated)".
 */
export const MOCK_SCENARIO = {
  FUNDED: 'funded',
  EMPTY: 'empty',
  SLOW_SYNC: 'slow-sync',
  CONNECT_FAILS: 'connect-fails',
  GOES_OFFLINE: 'goes-offline',
  SEND_REJECTED: 'send-rejected',
  SEND_UNCONFIRMED: 'send-unconfirmed',
};

export const DEFAULT_MOCK_SCENARIO = MOCK_SCENARIO.FUNDED;

/**
 * The scenarios in the order the picker lists them, with what each one does.
 *
 * @returns {{ id: string, title: string, description: string }[]}
 */
export function mockScenarioOptions() {
  return [
    {
      id: MOCK_SCENARIO.FUNDED,
      title: t`Funded`,
      description: t`25 HTR and two tokens that share a symbol.`,
    },
    {
      id: MOCK_SCENARIO.EMPTY,
      title: t`Empty`,
      description: t`No tokens yet.`,
    },
    {
      id: MOCK_SCENARIO.SLOW_SYNC,
      title: t`Slow sync`,
      description: t`The first sync takes 20 seconds, and sending waits for it.`,
    },
    {
      id: MOCK_SCENARIO.CONNECT_FAILS,
      title: t`Connect fails`,
      description: t`Connecting to Hathor Next fails.`,
    },
    {
      id: MOCK_SCENARIO.GOES_OFFLINE,
      title: t`Goes offline`,
      description: t`The connection drops 30 seconds after connecting, for 20 seconds.`,
    },
    {
      id: MOCK_SCENARIO.SEND_REJECTED,
      title: t`Send rejected`,
      description: t`The network turns every payment down, with a reason.`,
    },
    {
      id: MOCK_SCENARIO.SEND_UNCONFIRMED,
      title: t`Send unconfirmed`,
      description: t`The network never answers a payment.`,
    },
  ];
}

/**
 * Whether a scenario starts with the funded ledger.
 *
 * @param {string} scenario One of MOCK_SCENARIO
 * @returns {boolean}
 */
export function isFundedScenario(scenario) {
  return scenario !== MOCK_SCENARIO.EMPTY;
}
