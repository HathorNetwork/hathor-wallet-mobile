/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { privateSendStatement, receiveReuseBody } from '../../src/multichain/content';

// What the app says a payment keeps private is what the protocol gives: no more. The sender picks
// the privacy level, and only the highest hides the recipient; public coins spent show their token
// and amount; a transfer between chains writes the address in the open; the wallet service that
// builds payments holds the view key.
describe('what Hathor Next tells the user it keeps private', () => {
  test('on Send, names the public coins and the wallet service', () => {
    const said = privateSendStatement();
    expect(said).toMatch(/unless the coins it spends were public/);
    expect(said).toMatch(/fee is public/);
    expect(said).toMatch(/wallet service .* sees all of it/);
    expect(said).not.toMatch(/never appear/);
  });

  test('on Receive, names the lower privacy levels, transfers and the wallet service', () => {
    const said = receiveReuseBody();
    expect(said).toMatch(/Payments with less privacy, and transfers from Hathor Network, can be/);
    expect(said).toMatch(/wallet service sees every payment you receive/);
    expect(said).not.toMatch(/nobody can link|not even by watching/);
  });
});
