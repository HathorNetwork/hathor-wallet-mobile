/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { encodeAddress } from '../next/kit/address';
import { hashToScalar } from '../next/kit/hash';
import { deriveAccount, mnemonicToSeed, publicKeyOf } from '../next/kit/keys';
import { asciiBytes, bytesToHex } from '../next/kit/scalar';

// The simulated wallet service's view key. Its secret is a fixed label's hash, public as befits a
// simulation: it only makes the simulated addresses real Hathor Next addresses, curve points and
// checksum included, so every screen reads them as it reads a real one.
const MOCK_SERVICE_VIEW_PUB = bytesToHex(
  publicKeyOf(hashToScalar('hathor-wallet/mock-service-view/v1', [])),
);

/**
 * The simulated address of a public spend key.
 *
 * @param {Uint8Array} pubB
 * @returns {string}
 */
export function mockNextAddressOf(pubB) {
  return encodeAddress(MOCK_SERVICE_VIEW_PUB, bytesToHex(pubB));
}

/**
 * The simulated address of a wallet: the wallet's real Hathor Next spend key (m/44'/280'/3') under
 * the simulated service's view key. It is the same on every start and every device holding the
 * words, and it shows nothing the real address doesn't.
 *
 * @param {string} words
 * @returns {Promise<string>}
 */
export async function deriveMockNextAddress(words) {
  const seed = await mnemonicToSeed(words);
  try {
    return mockNextAddressOf(publicKeyOf(deriveAccount(seed).b));
  } finally {
    seed.fill(0);
  }
}

/**
 * A simulated address of someone else, named by a label.
 *
 * @param {string} label ASCII
 * @returns {string}
 */
export function mockPeerAddress(label) {
  return mockNextAddressOf(
    publicKeyOf(hashToScalar('hathor-wallet/mock-peer/v1', [asciiBytes(label)])),
  );
}
