/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The private part of a token's available balance: the sum of the token's shielded UTXOs that
 * aren't timelocked. Height locks only apply to block rewards, which are never shielded.
 *
 * It counts the UTXOs a pending send reserved, as the available balance does, so the private
 * and the public parts add up to it: it doesn't ask for only_available_utxos, which would leave
 * them out. The storage leaves authority UTXOs out by default. Private outputs the wallet hasn't
 * decoded have no UTXO yet, so they count for nothing.
 *
 * @param {HathorWallet} wallet A fullnode-facade wallet
 * @param {string} tokenUid
 * @returns {Promise<bigint>}
 */
export async function getPrivateAvailableBalance(wallet, tokenUid) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  let total = 0n;
  for await (const utxo of wallet.storage.selectUtxos({
    token: tokenUid,
    shielded: true,
    filter_method: (candidate) => !(candidate.timelock && nowSeconds < candidate.timelock),
  })) {
    total += utxo.value;
  }
  return total;
}

/**
 * Splits a token's available balance into its private and public parts, which always add up to
 * it: the private part is at most the available balance, as a read during a walk over the
 * history can see more, and the public part is the rest.
 *
 * @param {bigint} available The available balance
 * @param {bigint} privateAvailable The private part, from getPrivateAvailableBalance
 * @returns {{ privateAvailable: bigint, publicAvailable: bigint }}
 */
export function splitAvailableBalance(available, privateAvailable) {
  const privatePart = privateAvailable > available ? available : privateAvailable;
  return { privateAvailable: privatePart, publicAvailable: available - privatePart };
}

/**
 * Decides when a screen fetches a token's balance again for its private part: once per token
 * while the split is available, and not again until the split turns off and on. A balance
 * fetched while the split was off has no private part (undefined); one whose private part failed
 * has null, which no fetch is asked for, so a failure can't make it ask again and again.
 */
export function createPrivateBalanceRequests() {
  const requested = new Set();
  return {
    /**
     * @param {Object} params
     * @param {boolean} params.splitAvailable Whether the balance split is available
     * @param {string} params.tokenUid
     * @param {bigint|null|undefined} params.privateAvailable The private part the balance has
     * @returns {boolean} Whether to fetch the token's balance again
     */
    shouldRequest({ splitAvailable, tokenUid, privateAvailable }) {
      if (!splitAvailable) {
        requested.clear();
        return false;
      }
      if (privateAvailable !== undefined || requested.has(tokenUid)) {
        return false;
      }
      requested.add(tokenUid);
      return true;
    },
  };
}
