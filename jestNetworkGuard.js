/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * No test reaches a network. The app talks to real wallets' services, and a test that ran the real
 * wallet-lib or the real Hathor Next client without its own stand-ins would send them what it
 * holds. A request out of a test is refused here with an error naming it. A test that needs
 * answers brings its own: an injected fetchImpl or WebSocketImpl, a mocked module, or its own
 * global.fetch.
 */
const http = require('http');
const https = require('https');
const net = require('net');

const refuse = (what) => {
  throw new Error(`A test tried to reach the network: ${what}. Inject a stand-in instead.`);
};

for (const [name, mod] of [['http', http], ['https', https]]) {
  for (const method of ['request', 'get']) {
    mod[method] = (target) => refuse(`${name}.${method} ${target?.href ?? target?.hostname ?? target}`);
  }
}

const { connect } = net.Socket.prototype;
net.Socket.prototype.connect = function guardedConnect(...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  // A pipe or a unix socket is jest's own plumbing, not the network.
  if (options && typeof options === 'object' && options.path) {
    return connect.apply(this, args);
  }
  return refuse(`a socket to ${JSON.stringify(options)}`);
};

global.fetch = (target) => refuse(`fetch ${target}`);
global.WebSocket = function WebSocket(target) {
  refuse(`a WebSocket to ${target}`);
};
