/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * src/multichain/chains.js for tests, with FAKE_SIDE_CHAIN on FAKE_NETWORK, unless a backend for
 * local testing takes its place:
 *
 *   jest.mock('<path>/src/multichain/chains', () => require('<path>/fakes/chainsModule'));
 */
const { jest } = require('@jest/globals');

const actual = jest.requireActual('../../../src/multichain/chains');
const { FAKE_NETWORK, FAKE_SIDE_CHAIN } = require('./sideChain');

module.exports = {
  // The same object for `import * as`, so a test's jest.spyOn reaches the app's code.
  __esModule: true,
  ...actual,
  getSideChainConfig: (networkName, devBackend = null, ...rest) => (
    networkName === FAKE_NETWORK && !devBackend
      ? FAKE_SIDE_CHAIN
      : actual.getSideChainConfig(networkName, devBackend, ...rest)
  ),
};
