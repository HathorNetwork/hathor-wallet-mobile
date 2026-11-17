/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createMobileShieldedCryptoProvider } from '@hathor/ct-crypto-mobile';

/**
 * The tag of HTR, whose token UID is 32 zero bytes. ct-crypto-node 0.5.0 derives the same bytes.
 */
export const HTR_SHIELDED_TAG_HEX = 'ed3d6b7540fb1b9d05e2852cfa6c83d95e8fe136f30092910bd06a48283611e1';

/**
 * How long the self-test waits for the native module. On Android the module answers on the
 * thread every native module shares, so a busy start can delay it.
 */
export const SHIELDED_PROVIDER_SELF_TEST_TIMEOUT_MS = 10000;

/**
 * The provider that passed its self-test. It holds no state of its own, so every wallet the app
 * starts shares it.
 */
let testedProvider = null;

/**
 * Creates the shielded crypto provider of @hathor/ct-crypto-mobile and checks that its native
 * module works: deriving the tag of HTR must give HTR_SHIELDED_TAG_HEX within the timeout.
 *
 * A provider that passed the self-test is kept, and later calls return it. A failure is not
 * kept, so the next call tries again.
 *
 * It never throws: a missing native module, an error from it, a wrong tag or a timeout is
 * returned as `{ error }`.
 *
 * @param {Object} [options]
 * @param {number} [options.timeoutMs] How long to wait for the self-test
 * @returns {Promise<{ provider: Object }|{ error: Error }>}
 */
export async function loadShieldedCryptoProvider(options = {}) {
  const { timeoutMs = SHIELDED_PROVIDER_SELF_TEST_TIMEOUT_MS } = options;
  if (testedProvider) {
    return { provider: testedProvider };
  }

  let timer = null;
  try {
    const provider = createMobileShieldedCryptoProvider();
    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`The shielded crypto provider did not answer its self-test in ${timeoutMs} ms.`));
      }, timeoutMs);
    });
    const tag = await Promise.race([provider.deriveTag(Buffer.alloc(32)), timeout]);
    const tagHex = Buffer.from(tag).toString('hex');
    if (tagHex !== HTR_SHIELDED_TAG_HEX) {
      throw new Error(`The shielded crypto provider failed its self-test: it derived the tag ${tagHex} for HTR.`);
    }
    testedProvider = provider;
    return { provider };
  } catch (error) {
    return { error };
  } finally {
    clearTimeout(timer);
  }
}
