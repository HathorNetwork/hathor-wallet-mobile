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
 *
 * One way through: the opt-in suites that run against a local stack (e2eLocal, e2eTransfer) name
 * its services in NEXT_E2E_* variables, and reach those, on this machine only. A variable that
 * names another host opens nothing.
 */
const http = require('http');
const https = require('https');
const net = require('net');

const refuse = (what) => {
  throw new Error(`A test tried to reach the network: ${what}. Inject a stand-in instead.`);
};

// http, https and net are Node's own modules: every test file a jest worker runs shares them,
// while each file runs this guard in its own context, with its own process.env. So each file's
// guard replaces the one before and calls the true originals, kept once on each module. A guard
// left by an earlier file, reading that file's process.env, never stands in the way.
const ORIGINALS = Symbol.for('hathor-wallet-mobile/jestNetworkGuard/originals');
function originalsOf(owner, names) {
  if (!owner[ORIGINALS]) {
    Object.defineProperty(owner, ORIGINALS, {
      value: Object.fromEntries(names.map((name) => [name, owner[name]])),
    });
  }
  return owner[ORIGINALS];
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const DEFAULT_PORT = {
  'http:': 80, 'https:': 443, 'ws:': 80, 'wss:': 443,
};

/** The ports of the local stack the NEXT_E2E_* variables name, read as each request goes. */
function localStackPorts() {
  const ports = new Set();
  for (const [name, value] of Object.entries(process.env)) {
    if (name.startsWith('NEXT_E2E_') && typeof value === 'string') {
      try {
        const url = new URL(value);
        if (LOOPBACK.has(url.hostname) && url.protocol in DEFAULT_PORT) {
          ports.add(Number(url.port || DEFAULT_PORT[url.protocol]));
        }
      } catch (e) {
        // Not a URL: a switch, such as NEXT_E2E_SENDS.
      }
    }
  }
  return ports;
}

const toLocalStack = (host, port) => LOOPBACK.has(host) && localStackPorts().has(Number(port));

/** @returns {boolean} Whether a URL, as text or an object with href, is the local stack's */
function urlToLocalStack(target) {
  try {
    const url = new URL(typeof target === 'string' ? target : target?.href ?? target?.url);
    return toLocalStack(url.hostname, url.port || DEFAULT_PORT[url.protocol]);
  } catch (e) {
    return false;
  }
}

for (const [name, mod] of [['http', http], ['https', https]]) {
  const originals = originalsOf(mod, ['request', 'get']);
  for (const method of ['request', 'get']) {
    const original = originals[method];
    mod[method] = (target, ...rest) => {
      const local = typeof target === 'object' && !(target instanceof URL) && !target?.href
        ? toLocalStack(target?.hostname ?? target?.host, target?.port ?? (name === 'https' ? 443 : 80))
        : urlToLocalStack(target);
      if (local) {
        return original.call(mod, target, ...rest);
      }
      return refuse(`${name}.${method} ${target?.href ?? target?.hostname ?? target}`);
    };
  }
}

const { connect } = originalsOf(net.Socket.prototype, ['connect']);
net.Socket.prototype.connect = function guardedConnect(...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  // A pipe or a unix socket is jest's own plumbing, not the network.
  if (options && typeof options === 'object' && options.path) {
    return connect.apply(this, args);
  }
  const [port, host] = typeof options === 'object' && options !== null
    ? [options.port, options.host ?? 'localhost']
    : [args[0], typeof args[1] === 'string' ? args[1] : 'localhost'];
  if (toLocalStack(host, port)) {
    return connect.apply(this, args);
  }
  return refuse(`a socket to ${JSON.stringify(options)}`);
};

const realFetch = global.fetch;
global.fetch = (target, ...rest) => {
  if (realFetch && urlToLocalStack(target)) {
    return realFetch(target, ...rest);
  }
  return refuse(`fetch ${target}`);
};

const RealWebSocket = global.WebSocket;
global.WebSocket = function WebSocket(target, ...rest) {
  if (RealWebSocket && urlToLocalStack(target)) {
    return new RealWebSocket(target, ...rest);
  }
  return refuse(`a WebSocket to ${target}`);
};
