/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { REASON_MAX_LENGTH, reasonText } from '../../../src/multichain/next/reasonText';
import { recordOf } from '../../../src/multichain/next/backendBridge';

// A backend's reason is stored with the sign-once ledger and shown in the app's own modals.
describe('a backend\'s reason, as the app keeps and shows it', () => {
  const char = (...codes) => String.fromCharCode(...codes);

  test('is the backend\'s words when they are one short line', () => {
    expect(reasonText('fee too low')).toBe('fee too low');
  });

  test('is nothing when there is no text', () => {
    for (const reason of [undefined, null, 7, {}, ['fee'], '', '   ', char(0, 10, 0x200b)]) {
      expect(reasonText(reason)).toBeNull();
    }
  });

  test('is one line, without control characters or text that reorders or hides itself', () => {
    const reason = `fee${char(0)}too${char(10, 13, 9)}low${char(0x1b)}[31m${char(0x202e)}gnirts`
      + `${char(0x200b, 0x2066, 0xfeff, 0x85, 0x2028)}end`;
    expect(reasonText(reason)).toBe('fee too low [31m gnirts end');
  });

  test('is cut to a sentence, however long the backend\'s', () => {
    const shown = reasonText(`${'a'.repeat(REASON_MAX_LENGTH)}b`);
    expect(shown).toHaveLength(REASON_MAX_LENGTH);
    expect(shown.endsWith('…')).toBe(true);
    expect(reasonText('a'.repeat(REASON_MAX_LENGTH))).toBe('a'.repeat(REASON_MAX_LENGTH));
    expect(reasonText('x'.repeat(3000000))).toHaveLength(REASON_MAX_LENGTH);
  });
});

// A transfer's failure is shown in its sheet: the bridge keeps the backend's reason the same way.
describe('a failed transfer\'s reason', () => {
  test('is kept as one short line of plain text', () => {
    const record = recordOf({
      id: 'transfer-1',
      amount: '500',
      status: 'failed',
      reason: `burn refused${String.fromCharCode(10, 0x202e)}${'y'.repeat(3000000)}`,
      confirmations: 0,
      needed: 21,
      created_at: 1,
    }, { transfer: { confirmations: 21, mean_block_ms: 5000 } }, null);
    expect(record.reason).toMatch(/^burn refused y+…$/);
    expect(record.reason).toHaveLength(REASON_MAX_LENGTH);
  });
});
