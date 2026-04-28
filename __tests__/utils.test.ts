/**
 * Unit tests for src/utils.js — pure utility functions.
 *
 * These tests focus on financial math (getIntegerAmount, getAmountParsed)
 * and string helpers (getShortHash, getShortContent, getTokenLabel).
 */
import { getIntegerAmount, getAmountParsed, getShortHash, getShortContent, getTokenLabel } from '../src/utils';

// ─── getIntegerAmount ──────────────────────────────────────────────────────
describe('getIntegerAmount', () => {
  it('converts whole number with default 2 decimal places', () => {
    expect(getIntegerAmount('10', 2)).toBe(1000n);
  });

  it('converts with explicit decimal (period)', () => {
    expect(getIntegerAmount('10.00', 2)).toBe(1000n);
  });

  it('converts with comma as decimal separator', () => {
    expect(getIntegerAmount('10,01', 2)).toBe(1001n);
  });

  it('handles large amounts', () => {
    expect(getIntegerAmount('1000', 2)).toBe(100000n);
    expect(getIntegerAmount('1000.00', 2)).toBe(100000n);
  });

  it('pads short decimal part with zeros', () => {
    // "10.5" with 2 decimal places → "1050"
    expect(getIntegerAmount('10.5', 2)).toBe(1050n);
  });

  it('truncates long decimal part', () => {
    // "10.999" with 2 decimal places → integer part "10" + "99" = 1099
    expect(getIntegerAmount('10.999', 2)).toBe(1099n);
  });

  it('handles zero', () => {
    expect(getIntegerAmount('0', 2)).toBe(0n);
    expect(getIntegerAmount('0.00', 2)).toBe(0n);
  });

  it('handles leading/trailing whitespace', () => {
    expect(getIntegerAmount('  10.00  ', 2)).toBe(1000n);
  });

  it('defaults to 2 decimal places when decimalPlaces is null', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getIntegerAmount('10', null)).toBe(1000n);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('defaults to 2 decimal places when decimalPlaces is undefined', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getIntegerAmount('10', undefined)).toBe(1000n);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('handles 0 decimal places', () => {
    // "10" with 0 decimal places → 10
    expect(getIntegerAmount('10', 0)).toBe(10n);
  });

  it('handles higher precision (8 decimal places, like Bitcoin)', () => {
    expect(getIntegerAmount('1.00000001', 8)).toBe(100000001n);
  });

  it('converts "1" with 8 decimal places', () => {
    expect(getIntegerAmount('1', 8)).toBe(100000000n);
  });
});

// ─── getAmountParsed ───────────────────────────────────────────────────────
describe('getAmountParsed', () => {
  it('returns text unchanged if no separator', () => {
    expect(getAmountParsed('100', 2)).toBe('100');
  });

  it('keeps period separator with valid decimal length', () => {
    expect(getAmountParsed('10.05', 2)).toBe('10.05');
  });

  it('keeps comma separator with valid decimal length', () => {
    expect(getAmountParsed('10,05', 2)).toBe('10,05');
  });

  it('truncates decimal part exceeding decimalPlaces', () => {
    expect(getAmountParsed('10.999', 2)).toBe('10.99');
  });

  it('handles multiple separators by only taking first two parts', () => {
    // "10.20.30" → parts ["10", "20", "30"] → sliced to ["10", "20"]
    expect(getAmountParsed('10.20.30', 2)).toBe('10.20');
  });

  it('allows short decimal part without padding', () => {
    expect(getAmountParsed('10.5', 2)).toBe('10.5');
  });
});

// ─── getShortHash ──────────────────────────────────────────────────────────
describe('getShortHash', () => {
  const hash64 = '00c30fc8a1b9a326a766ab0351faf3635297d316fd039a0eda01734d9de40185';

  it('shortens a 64-char hash with default length', () => {
    expect(getShortHash(hash64)).toBe('00c3...0185');
  });

  it('accepts custom length', () => {
    expect(getShortHash(hash64, 6)).toBe('00c30f...e40185');
  });
});

// ─── getShortContent ───────────────────────────────────────────────────────
describe('getShortContent', () => {
  it('shortens content based on its own length (not fixed 64)', () => {
    expect(getShortContent('abcdefghij', 3)).toBe('abc...hij');
  });

  it('uses default length of 4', () => {
    expect(getShortContent('abcdefghijklmnop')).toBe('abcd...mnop');
  });
});

// ─── getTokenLabel ─────────────────────────────────────────────────────────
describe('getTokenLabel', () => {
  it('formats token as "name (symbol)"', () => {
    expect(getTokenLabel({ name: 'Hathor', symbol: 'HTR' })).toBe('Hathor (HTR)');
  });
});
