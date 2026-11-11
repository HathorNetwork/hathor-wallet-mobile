/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * src/multichain/nextClient.js for tests, running the fake client:
 *
 *   jest.mock('<path>/src/multichain/nextClient', () => require('<path>/fakes/nextClientModule'));
 */
const { createFakeNextClient } = require('./fakeNextClient');

let currentClient = null;

module.exports = {
  createNextClient: () => createFakeNextClient(),
  getNextClient: () => currentClient,
  ensureNextClient: () => {
    if (!currentClient) {
      currentClient = createFakeNextClient();
    }
    return currentClient;
  },
  setNextClient: (client) => {
    currentClient = client;
  },
};
