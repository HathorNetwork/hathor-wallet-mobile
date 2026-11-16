/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { tokenText } from '../../../src/multichain/next/tokenText';

describe("a token's name or symbol, made safe to show", () => {
  test('loses its control and direction characters, and its blanks at either end', () => {
    expect(tokenText(' H‮TR\u0007 ', 16)).toBe('HTR');
    expect(tokenText('​', 16)).toBeNull();
    expect(tokenText(42, 16)).toBeNull();
  });

  test('is cut to its cap at a whole character, never inside one', () => {
    // Each of these takes four bytes.
    expect(tokenText('🙂🙂🙂', 9)).toBe('🙂🙂');
    expect(tokenText('ab🙂', 5)).toBe('ab');
    expect(tokenText('abc', 3)).toBe('abc');
  });

  test('takes one pass, however long the text a backend sends', () => {
    const hostile = '🙂'.repeat(200000);
    const started = Date.now();
    expect(tokenText(hostile, 64)).toBe('🙂'.repeat(16));
    // Cut a character at a time, re-encoding the rest each time, this took minutes.
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
