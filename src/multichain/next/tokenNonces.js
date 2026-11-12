/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nextNonce } from './kit/authority';

/**
 * The token-creation nonces this device has handed out, saved per Hathor Next wallet.
 *
 * A token reaches the registry only once its creation is recorded, so a scan alone would hand a
 * creation started meanwhile the nonce the one before it took, and the two tokens would carry the
 * same mint and melt keys on chain, linked forever. So a nonce is reserved, on disk, before the
 * request that uses it goes out, and leaves the set only on proof:
 *
 * - nothing carrying it was signed (the backend never answered with a creation, or this wallet
 *   refused the one it answered with): it is released, and the next creation takes it again;
 * - the registry lists a token at it: it is taken on chain, which the scan already says.
 *
 * Every other outcome keeps it: a skipped nonce costs a hole the scan steps over, a reused one
 * costs two tokens their privacy. And the highest nonce this wallet ever signed a creation at is
 * kept apart, as a floor, so a creation the network refused, or one the registry never lists,
 * never brings a signed nonce round again.
 *
 * Saved outside the `wallet:` keys, as the sign-once ledger is: a wallet reset that brings the
 * same words back keeps it.
 *
 * @param {{ getItem: Function, setItemAsync: Function }} storage A durable write is awaited
 * @param {string} key
 */
export function createNonceStore(storage, key) {
  const load = () => {
    const saved = storage.getItem(key) ?? { reserved: [], signedFloor: null };
    const valid = (n) => Number.isSafeInteger(n) && n >= 0;
    // A set that doesn't read is not an empty one: dropping a member would lower the floor, which
    // is the collision itself. Creations stop until someone looks.
    if (!Array.isArray(saved.reserved) || !saved.reserved.every(valid)
      || (saved.signedFloor !== null && !valid(saved.signedFloor))) {
      throw new Error('The saved token-creation nonces can\'t be read.');
    }
    return saved;
  };
  const save = (value) => storage.setItemAsync(key, value);

  return {
    /** @returns {{ reserved: number[], signedFloor: number|null }} */
    read: load,

    /**
     * Takes the next free nonce and saves it as reserved before returning it.
     *
     * @param {{ highest: number, held: { nonce: number }[] }} scan What the registry shows taken
     * @returns {Promise<number>}
     * @throws {NonceBeyondReachError} When a scan from the words alone couldn't find it again
     */
    async reserve(scan) {
      const saved = load();
      // A nonce the registry lists is taken on chain: the scan says so from now on.
      const listed = new Set(scan.held.map((h) => h.nonce));
      const reserved = saved.reserved.filter((n) => !listed.has(n));
      const nonce = nextNonce({
        highest: scan.highest,
        reserved,
        signedFloor: saved.signedFloor,
      });
      await save({ ...saved, reserved: [...reserved, nonce] });
      return nonce;
    },

    /**
     * Gives a nonce back: nothing carrying it was signed.
     *
     * @param {number} nonce
     */
    async release(nonce) {
      const saved = load();
      await save({ ...saved, reserved: saved.reserved.filter((n) => n !== nonce) });
    },

    /**
     * A creation at this nonce is signed: no later creation goes at or below it.
     *
     * @param {number} nonce
     */
    async markSigned(nonce) {
      const saved = load();
      const floor = saved.signedFloor === null ? nonce : Math.max(saved.signedFloor, nonce);
      await save({ ...saved, signedFloor: floor });
    },
  };
}
