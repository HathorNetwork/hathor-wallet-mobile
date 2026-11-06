/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { isUsableBackendConfig } from '../../src/components/Multichain/DevBackendSettings';

const pinsOf = (next) => ({
  next: {
    network_id: 1777,
    native_token: 'aa'.repeat(32),
    service_view_pub: 'bb'.repeat(32),
    wire_format: 'v2',
    genesis_ms: 1793398418273,
    epoch_ms: 500,
    ...next,
  },
});

describe('a backend for local testing', () => {
  test('runs on a network of either format the signer reads', () => {
    expect(isUsableBackendConfig(pinsOf({ wire_format: 'v2' }))).toBe(true);
    expect(isUsableBackendConfig(pinsOf({ wire_format: 'v3' }))).toBe(true);
  });

  test('is refused on any other format, or with a pin missing', () => {
    expect(isUsableBackendConfig(pinsOf({ wire_format: 'v1' }))).toBe(false);
    expect(isUsableBackendConfig(pinsOf({ wire_format: undefined }))).toBe(false);
    expect(isUsableBackendConfig(pinsOf({ native_token: 'aa' }))).toBe(false);
    expect(isUsableBackendConfig({})).toBe(false);
  });
});
