/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { constants as hathorLibConstants } from '@hathor/wallet-lib';
import { TxHistory } from '../../src/models';

const HTR = hathorLibConstants.NATIVE_TOKEN_UID;

// History entries of shielded outputs, as getTxHistory passes them through. The ones the wallet
// decoded carry their value, token and blinding factors.
const amountShielded = (fields = {}) => ({
  mode: 1,
  commitment: 'c1',
  range_proof: 'r1',
  script: 's1',
  decoded: { type: 'P2PKH', address: 'WSPEND1' },
  ...fields,
});
const fullyShielded = (fields = {}) => ({
  mode: 2,
  commitment: 'c2',
  range_proof: 'r2',
  asset_commitment: 'a2',
  surjection_proof: 'p2',
  script: 's2',
  decoded: { type: 'P2PKH', address: 'WSPEND2' },
  ...fields,
});

const fromHistory = (fields) => TxHistory.from({
  txId: 'tx1',
  timestamp: 1700000000,
  balance: -10n,
  voided: false,
  version: 1,
  ...fields,
}, HTR);

describe('TxHistory.privacyFee', () => {
  test.each([
    ['an amount-shielded output', [amountShielded()], 1n],
    ['a fully shielded output', [fullyShielded()], 2n],
    ['both, and a second amount-shielded one', [amountShielded(), fullyShielded(), amountShielded()], 4n],
  ])('counts %s', (_label, shieldedOutputs, fee) => {
    expect(fromHistory({ shielded_outputs: shieldedOutputs }).privacyFee).toBe(fee);
  });

  test('is 0 for a tx with no shielded output', () => {
    expect(fromHistory({}).privacyFee).toBe(0n);
    expect(fromHistory({ shielded_outputs: [] }).privacyFee).toBe(0n);
    expect(new TxHistory({ txId: 'tx1' }).privacyFee).toBe(0n);
  });

  test('reads mode, and ignores a shieldedMode field', () => {
    expect(fromHistory({ shielded_outputs: [amountShielded({ shieldedMode: 2 })] }).privacyFee)
      .toBe(1n);
  });

  test('tells the modes apart by the asset commitment when mode is missing', () => {
    const withoutMode = (output) => {
      const entry = { ...output };
      delete entry.mode;
      return entry;
    };
    const outputs = [withoutMode(fullyShielded()), withoutMode(amountShielded())];
    expect(fromHistory({ shielded_outputs: outputs }).privacyFee).toBe(3n);
  });

  test('ignores headers, and has no network fee', () => {
    const tx = fromHistory({
      shielded_outputs: [amountShielded()],
      headers: [{ id: 17, entries: [{ tokenIndex: 0, amount: 5n }] }],
    });
    expect(tx.privacyFee).toBe(1n);
    expect(tx).not.toHaveProperty('networkFee');
  });

  test('keeps none of the shielded outputs, whose blinding factors stay out of redux', () => {
    const blindingFactor = 'a5'.repeat(32);
    const tx = fromHistory({
      shielded_outputs: [amountShielded({ value: 5n, token: HTR, blindingFactor })],
    });
    expect(JSON.stringify(tx, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)))
      .not.toContain(blindingFactor);
    expect(tx).not.toHaveProperty('shielded_outputs');
  });
});
