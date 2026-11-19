/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * src/multichain/bridge.js for tests, running the fake bridge:
 *
 *   jest.mock('<path>/src/multichain/bridge', () => require('<path>/fakes/bridgeModule'));
 */
const { createFakeBridge } = require('./fakeBridge');

module.exports = {
  // The same object for `import * as`, so a test's jest.spyOn reaches the app's code.
  __esModule: true,
  createBridge: (config, options) => createFakeBridge(config, options),
};
