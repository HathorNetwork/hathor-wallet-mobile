/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import http from 'http';
import https from 'https';
import net from 'net';

// Every test runs behind jestNetworkGuard.js: what a test sends out is refused before it leaves.
describe('a test that tries to reach the network', () => {
  const refused = 'A test tried to reach the network';

  test('is refused, whichever way it goes', () => {
    expect(() => global.fetch('https://example.invalid/')).toThrow(refused);
    expect(() => https.get('https://example.invalid/')).toThrow(refused);
    expect(() => http.request({ hostname: 'example.invalid' })).toThrow(refused);
    expect(() => new global.WebSocket('wss://example.invalid/')).toThrow(refused);
    expect(() => net.connect(443, 'example.invalid')).toThrow(refused);
  });
});
