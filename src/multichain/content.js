/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { t } from 'ttag';

/**
 * The words Hathor Next screens use about money. They are the Hathor Next wallet's own
 * (hathor-next-wallet-mobile's src/content/*.ts), so one wallet reads the same way in both apps,
 * with two changes: the chain is called Hathor Next here, and its fee token is HTR. Keep them in
 * step with that repo.
 */

/**
 * A Hathor Next transaction's status, as a label. `recorded` is the settled state; `pending` is an
 * outgoing payment's brief submitted window. Neither `unconfirmed` nor `attention` is a failure,
 * and neither may be worded as one. (src/content/finality.ts)
 *
 * @param {string} status One of NEXT_TX_STATUS
 * @returns {string}
 */
export function nextStatusLabel(status) {
  switch (status) {
    case 'pending':
      return t`Sending`;
    case 'recorded':
      return t`Settled`;
    case 'failed':
      return t`Failed`;
    case 'unconfirmed':
      return t`Not settled yet`;
    case 'attention':
      return t`Needs attention`;
    default:
      return status;
  }
}

/** The finality sentence, under a settled payment. (src/content/finality.ts) */
export const finalitySentence = () => t`Settled means final. The payment is on the ledger for good — there is no waiting for confirmations and no chance of it being reversed.`;

/** The settled statement, for the payoff moment. (src/content/finality.ts) */
export const settledStatement = () => t`Settled and irreversible.`;

/** (src/content/sendOutcome.ts) */
export const sendingBody = () => t`Waiting for the network to record it.`;

/** (src/content/sendOutcome.ts) */
export const unconfirmedBody = () => t`Signed and handed to the network. Your statement is up to date and this payment isn't on it yet, so the network is most likely still working on it: if it had been turned down, this screen would say so and name the reason. That notice is a live message, though, and a wallet that was closed can miss one — so this is "not yet", never "fine". Nothing has been lost either way: if it is never accepted, no money leaves your wallet and no fee is paid. The coins for it stay set aside, and the wallet keeps checking.`;

/** (src/content/sendOutcome.ts) */
export const rejectedTitle = () => t`The network turned it down`;

/** (src/content/sendOutcome.ts) */
export const rejectedBody = () => t`The network looked at this payment and turned it down, so it will never settle. Nothing left your wallet, no fee was paid, and the coins that were set aside for it are already back. There is nothing to wait for.`;

/** What precedes the node's own words about a refusal. (src/content/finality.ts) */
export const verdictLead = () => t`The network said:`;

/** (src/content/copy.ts) */
export const privateSendStatement = () => t`Every Hathor Next payment is private: the amount, the token and who you paid never appear on the ledger. Only the exact network fee is public.`;

/** (src/content/copy.ts, receive.body) */
export const receiveReuseBody = () => t`Share this address as often as you like. Every payment to it lands on a different one-time key, so nobody can link them together — not even by watching the ledger.`;

/** While the first sync runs, the balance is a rising lower bound, never a total. */
export const syncingBody = () => t`Syncing your Hathor Next balance. It can still rise until the sync ends.`;

/** Sending is refused while the balance syncs, temporarily, and is never worded as a failure. */
export const syncingSendBody = () => t`You can send once your balance finishes syncing.`;
