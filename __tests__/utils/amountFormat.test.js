import { describe, it, expect } from '@jest/globals';
import {
  compressAmountString, renderValue, getDisplayAmountFormat, normalizeAmountFormat,
  capDecimalsByMagnitude, renderHomeValue,
} from '../../src/utils';
import { AMOUNT_FORMAT, AMOUNT_FORMAT_DEFAULT, AMOUNT_FORMAT_FEATURE_TOGGLE } from '../../src/constants';

const stateWith = (flagOn, amountFormat) => ({
  featureToggles: { [AMOUNT_FORMAT_FEATURE_TOGGLE]: flagOn },
  amountFormat,
});

describe('compressAmountString', () => {
  // Compresses only the leading fractional zero run into subscript notation and
  // keeps every later digit verbatim (including inner and trailing zeros), so the
  // compressed form shows the same significant digits as the Expanded form.
  it.each([
    ['0.0000005195', '0.0₆5195'],
    ['0.000000012345', '0.0₇12345'],
    ['0.00012', '0.0₃12'], // exactly 3 leading zeros (threshold)
    ['-0.0000005195', '-0.0₆5195'], // keeps the negative sign
    ['-0.00012', '-0.0₃12'],
    ['0.0000005000', '0.0₆5000'], // trailing zeros are kept, not trimmed
    ['0.00000000000050', '0.0₁₂50'], // deep run + trailing zero kept verbatim
    ['0.000000000012', '0.0₁₀12'], // multi-digit subscript (10 zeros)
    ['0.000000045600000123', '0.0₇45600000123'], // inner zeros kept verbatim
  ])('compresses %s -> %s', (input, expected) => {
    expect(compressAmountString(input)).toBe(expected);
  });

  it.each([
    ['0.05'], // 1 leading zero, below threshold
    ['0.0012'], // 2 leading zeros, below threshold
    ['0.005195'], // 2 leading zeros, below threshold
    ['1.0000005195'], // non-zero integer part
    ['10.0000005'], // non-zero integer part
    ['1,234.00005'], // non-zero (grouped) integer part
    ['0.000000'], // effectively zero, nothing significant after the run
    ['1,234'], // no fractional part
    ['1234'], // no fractional part
  ])('leaves %s unchanged', (input) => {
    expect(compressAmountString(input)).toBe(input);
  });
});

describe('capDecimalsByMagnitude', () => {
  // < 1 -> 8, 1-999 -> 4, 1000-9999 -> 3, >= 10000 -> 2; truncated, not padded.
  it.each([
    ['0.12345678', '0.12345678'], // < 1, keeps up to 8
    ['0.123456789', '0.12345678'], // < 1, truncated to 8
    ['0.5', '0.5'], // < 1, no padding
    ['1.12345678', '1.1234'], // 1-999 -> 4
    ['999.98765', '999.9876'], // 999 -> 4
    ['1000.12345', '1000.123'], // 1000-9999 -> 3
    ['9999.9999', '9999.999'], // 9999 -> 3
    ['10000.98765', '10000.98'], // >= 10000 -> 2
    ['100000.12345678', '100000.12'],
    ['9223372036854775808.12345678', '9223372036854775808.12'],
    ['-0.123456789', '-0.12345678'], // sign preserved
    ['1,234.56789', '1,234.567'], // grouping preserved, magnitude 1234 -> 3
    ['1234', '1234'], // no fractional part unchanged
  ])('%s -> %s', (input, expected) => {
    expect(capDecimalsByMagnitude(input)).toBe(expected);
  });
});

describe('renderValue with amount format', () => {
  it('defaults to expanded (unchanged behavior)', () => {
    expect(renderValue(1234n, false)).toBe(renderValue(1234n, false, AMOUNT_FORMAT.EXPANDED));
  });

  it('routes COMPRESSED output through compressAmountString', () => {
    const amount = 500000n;
    expect(renderValue(amount, false, AMOUNT_FORMAT.COMPRESSED))
      .toBe(compressAmountString(renderValue(amount, false, AMOUNT_FORMAT.EXPANDED)));
  });

  it('is a no-op for NFT amounts (no fractional part)', () => {
    expect(renderValue(12345n, true, AMOUNT_FORMAT.COMPRESSED)).toBe('12,345');
  });
});

describe('renderHomeValue (magnitude rule + network decimals)', () => {
  it('renders small amounts with up to 8 decimals from the network decimal places', () => {
    // 12 base units at 8 decimals => 0.00000012 (< 1 => 8 dp)
    expect(renderHomeValue(12n, false, AMOUNT_FORMAT.EXPANDED, 8)).toBe('0.00000012');
  });

  it('caps large amounts to 2 decimals by magnitude', () => {
    // 10000012345678 at 8 decimals => 100,000.12345678 (>= 10000 => 2 dp)
    expect(renderHomeValue(10000012345678n, false, AMOUNT_FORMAT.EXPANDED, 8)).toBe('100,000.12');
  });

  it('applies Compressed notation after the magnitude cap', () => {
    expect(renderHomeValue(12n, false, AMOUNT_FORMAT.COMPRESSED, 8)).toBe('0.0₆12');
  });

  it('falls back to the lib default decimals when unset', () => {
    // 1234 base units at default 2 decimals => 12.34
    expect(renderHomeValue(1234n, false)).toBe('12.34');
  });
});

describe('getDisplayAmountFormat (flag gating)', () => {
  it('returns the stored preference while the flag is on', () => {
    expect(getDisplayAmountFormat(stateWith(true, AMOUNT_FORMAT.COMPRESSED)))
      .toBe(AMOUNT_FORMAT.COMPRESSED);
    expect(getDisplayAmountFormat(stateWith(true, AMOUNT_FORMAT.EXPANDED)))
      .toBe(AMOUNT_FORMAT.EXPANDED);
  });

  it('forces Expanded when the flag is off, ignoring the stored preference', () => {
    expect(getDisplayAmountFormat(stateWith(false, AMOUNT_FORMAT.COMPRESSED)))
      .toBe(AMOUNT_FORMAT.EXPANDED);
  });

  it('falls back to the default when nothing is stored', () => {
    expect(getDisplayAmountFormat(stateWith(true, undefined))).toBe(AMOUNT_FORMAT.EXPANDED);
  });
});

describe('normalizeAmountFormat', () => {
  it('passes through known enum values', () => {
    expect(normalizeAmountFormat(AMOUNT_FORMAT.EXPANDED)).toBe(AMOUNT_FORMAT.EXPANDED);
    expect(normalizeAmountFormat(AMOUNT_FORMAT.COMPRESSED)).toBe(AMOUNT_FORMAT.COMPRESSED);
  });

  it('falls back to the default for unknown, null or undefined values', () => {
    expect(normalizeAmountFormat('bogus')).toBe(AMOUNT_FORMAT_DEFAULT);
    expect(normalizeAmountFormat(null)).toBe(AMOUNT_FORMAT_DEFAULT);
    expect(normalizeAmountFormat(undefined)).toBe(AMOUNT_FORMAT_DEFAULT);
  });
});
