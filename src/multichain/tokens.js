/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TOKEN_DOWNLOAD_STATUS } from '../sagas/tokens';
import { CHAIN } from './chains';
import { hathorToNextAmount, nextAmountForDisplay } from './amount';
import { TRANSFER_STATUS } from './state';

/**
 * The first characters of a token id, the form a person compares two ids by.
 *
 * @param {string} id
 * @returns {string}
 */
export const shortTokenId = (id) => id.trim().toLowerCase().slice(0, 6);

/**
 * Hathor Next's tokens as the token list shows them: the native token first, then by most recent
 * activity (there is no price feed to rank by value). Token symbols aren't unique on Hathor Next,
 * so a token whose symbol another token shares carries its short id in its name; screens still
 * find every token by its id.
 *
 * @param {{ [id: string]: { id, name, symbol, lastActivityAt } }} tokens
 * @param {string} nativeTokenId
 * @returns {{ uid: string, name: string, symbol: string, lastActivityAt: number|null }[]}
 */
export function nextTokenList(tokens, nativeTokenId) {
  const all = Object.values(tokens);
  const symbolCount = {};
  for (const token of all) {
    symbolCount[token.symbol] = (symbolCount[token.symbol] ?? 0) + 1;
  }
  return all
    .map((token) => ({
      uid: token.id,
      name: symbolCount[token.symbol] > 1
        ? `${token.name} · ${shortTokenId(token.id)}`
        : token.name,
      symbol: token.symbol,
      lastActivityAt: token.lastActivityAt ?? null,
    }))
    .sort((a, b) => {
      if (a.uid === nativeTokenId) return -1;
      if (b.uid === nativeTokenId) return 1;
      return (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0);
    });
}

/**
 * What a transfer still on its way adds to a token, in Hathor Next's units: what will arrive in
 * this wallet, and the part of it that already left the other chain's balance. Only that part
 * counts in a combined total: a simulated transfer moves nothing on Hathor Network, so counting
 * it there would count it twice.
 *
 * @param {Object[]} transfers TransferRecord (src/multichain/bridge.js)
 * @param {{ hathor: string|null, next: string|null }} ids The token's id on each chain
 * @param {bigint} scale mintScaleOf(config): a transfer's scale between the chains
 * @returns {{ arriving: bigint, inFlight: bigint }}
 */
export function arrivingAmounts(transfers, ids, scale) {
  let arriving = 0n;
  let inFlight = 0n;
  for (const transfer of transfers) {
    const ownToken = transfer.to === CHAIN.HATHOR_NEXT
      ? transfer.nextTokenId === ids.next
      : transfer.hathorTokenId === ids.hathor;
    if (transfer.status !== TRANSFER_STATUS.PENDING || !transfer.toOwn || !ownToken) {
      continue;
    }
    const received = BigInt(transfer.receiveAmount);
    const amount = transfer.to === CHAIN.HATHOR_NEXT
      ? received
      : hathorToNextAmount(received, scale);
    arriving += amount;
    if (transfer.debitedOnSource) {
      inFlight += amount;
    }
  }
  return { arriving, inFlight };
}

/**
 * The Dashboard's list with the side chain connected: Hathor Network's tokens and Hathor Next's
 * in one list. A token the bridge maps on both chains is one row, with its balance on both: rows
 * merge only by that map, never by name or symbol, which aren't unique on Hathor Next.
 *
 * Order: Hathor Network's list as it is, a mapped token in its place, then Hathor Next's own
 * tokens in Hathor Next's order (nextTokenList).
 *
 * @param {Object} params
 * @param {{ [uid: string]: { uid, name, symbol } }} params.hathorTokens state.tokens
 * @param {{ [uid: string]: { status: string, data: { available: bigint } } }} params.hathorBalances
 *   state.tokensBalance
 * @param {number} params.hathorDecimalPlaces
 * @param {{ [id: string]: Object }} params.nextTokens state.multichain.next.tokens
 * @param {{ [id: string]: { data: { available: bigint } } }} params.nextBalances
 * @param {{ hathor: string, next: string }[]} params.tokenMap
 * @param {string} params.nativeTokenId Hathor Next's native token
 * @param {Object[]} params.transfers TransferRecord (src/multichain/bridge.js)
 * @param {bigint} [params.mintScale] mintScaleOf(config)
 * @returns {{
 *   uid: string,
 *   hathorUid: string|null,
 *   nextId: string|null,
 *   name: string,
 *   symbol: string,
 *   chains: string[],
 *   status: string,
 *   available: bigint,
 *   decimalPlaces: number|undefined,
 *   arriving: { amount: bigint, decimalPlaces: number }|null,
 * }[]} `uid` is the row's key; decimalPlaces is undefined for Hathor Network's own rows, which
 *   keep the network's
 */
export function combinedTokenList({
  hathorTokens,
  hathorBalances,
  hathorDecimalPlaces,
  nextTokens,
  nextBalances,
  tokenMap,
  nativeTokenId,
  transfers,
  mintScale = 1n,
}) {
  const nextIdOf = Object.fromEntries(tokenMap.map((pair) => [pair.hathor, pair.next]));
  const mappedNext = new Set(tokenMap.map((pair) => pair.next));
  const nextAvailable = (id) => nextBalances[id]?.data?.available ?? 0n;

  const rows = Object.values(hathorTokens).map((token) => {
    const balance = hathorBalances[token.uid];
    const nextId = nextIdOf[token.uid];
    if (!nextId) {
      return {
        uid: token.uid,
        hathorUid: token.uid,
        nextId: null,
        name: token.name,
        symbol: token.symbol,
        chains: [CHAIN.HATHOR],
        status: balance?.status ?? TOKEN_DOWNLOAD_STATUS.LOADING,
        available: balance?.data?.available ?? 0n,
        decimalPlaces: undefined,
        arriving: null,
      };
    }
    const { arriving, inFlight } = arrivingAmounts(
      transfers,
      { hathor: token.uid, next: nextId },
      mintScale,
    );
    const total = hathorToNextAmount(balance?.data?.available ?? 0n, mintScale)
      + nextAvailable(nextId)
      + inFlight;
    const shown = nextAmountForDisplay(total, hathorDecimalPlaces);
    return {
      uid: token.uid,
      hathorUid: token.uid,
      nextId,
      name: token.name,
      symbol: token.symbol,
      chains: [CHAIN.HATHOR, CHAIN.HATHOR_NEXT],
      status: balance?.status ?? TOKEN_DOWNLOAD_STATUS.LOADING,
      available: shown.amount,
      decimalPlaces: shown.decimalPlaces,
      arriving: arriving > 0n ? nextAmountForDisplay(arriving, hathorDecimalPlaces) : null,
    };
  });

  const nextOnly = nextTokenList(
    Object.fromEntries(Object.entries(nextTokens).filter(([id]) => !mappedNext.has(id))),
    nativeTokenId,
  ).map((token) => {
    const shown = nextAmountForDisplay(nextAvailable(token.uid), hathorDecimalPlaces);
    return {
      // Hathor Next ids can't collide with Hathor Network's in the list's keys.
      uid: `next:${token.uid}`,
      hathorUid: null,
      nextId: token.uid,
      name: token.name,
      symbol: token.symbol,
      chains: [CHAIN.HATHOR_NEXT],
      status: TOKEN_DOWNLOAD_STATUS.READY,
      available: shown.amount,
      decimalPlaces: shown.decimalPlaces,
      arriving: null,
    };
  });

  return [...rows, ...nextOnly];
}
