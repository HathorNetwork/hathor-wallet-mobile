/**
 * @jest-environment node
 *
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from '@jest/globals';
import { isLocalNode } from '../../QA/e2e/lib/localNode';

describe('isLocalNode', () => {
  it.each([
    'http://localhost:18083/v1a/',
    'http://127.0.0.1:18083/v1a/',
  ])('accepts %s', (url) => {
    expect(isLocalNode(url)).toBe(true);
  });

  it.each([
    'https://node1.testnet.hathor.network/v1a/',
    'https://node1.mainnet.hathor.network/v1a/',
    'http://localhost.evil.com/v1a/',
    'http://localhost@evil.com/v1a/',
    'http://evil.com/localhost/',
    'localhost:18083',
    '',
    undefined,
  ])('refuses %s', (url) => {
    expect(isLocalNode(url)).toBe(false);
  });
});
