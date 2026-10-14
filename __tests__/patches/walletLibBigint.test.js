/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';

/**
 * Hermes and JavaScriptCore call a JSON.parse reviver with (key, value) only, without the
 * `context` argument that carries each number's source text, and they have no JSON.rawJSON.
 * These tests load wallet-lib's bigint utils, as patched in patches/, under that behavior.
 */
describe('wallet-lib JSONBigInt on a React Native JS engine', () => {
  const nativeParse = JSON.parse;
  const rawJSONDescriptor = Object.getOwnPropertyDescriptor(JSON, 'rawJSON');
  let JSONBigInt;

  beforeAll(() => {
    JSON.parse = function parseWithoutContext(text, reviver) {
      if (typeof reviver !== 'function') {
        return nativeParse(text);
      }
      return nativeParse(text, function reviveWithoutContext(key, value) {
        return reviver.call(this, key, value);
      });
    };
    delete JSON.rawJSON;

    // core-js-pure picks between the native JSON.parse and its own source-aware parser when
    // it loads, so the module must load after the engine behavior is in place.
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      ({ JSONBigInt } = require('@hathor/wallet-lib/lib/utils/bigint'));
    });
  });

  afterAll(() => {
    JSON.parse = nativeParse;
    if (rawJSONDescriptor) {
      Object.defineProperty(JSON, 'rawJSON', rawJSONDescriptor);
    }
  });

  it('runs on an engine without reviver context or JSON.rawJSON', () => {
    const contexts = [];
    JSON.parse('[9007199254740993]', (key, value, context) => {
      contexts.push(context);
      return value;
    });
    expect(contexts).toEqual([undefined, undefined]);
    expect(JSON.rawJSON).toBeUndefined();
  });

  it('parses integers above 2^53 as exact bigints', () => {
    const parsed = JSONBigInt.parse(
      '{"big":12345678901234567890,"negative":-9007199254740993,"nested":[{"value":18446744073709551615}]}',
    );
    expect(parsed.big).toBe(12345678901234567890n);
    expect(parsed.negative).toBe(-9007199254740993n);
    expect(parsed.nested[0].value).toBe(18446744073709551615n);
  });

  it('keeps safe integers and non-integers as numbers', () => {
    const parsed = JSONBigInt.parse('{"maxSafe":9007199254740991,"small":42,"float":1.5,"exponent":1e2}');
    expect(parsed).toEqual({ maxSafe: 9007199254740991, small: 42, float: 1.5, exponent: 100 });
  });

  it('returns the value unchanged when the reviver gets no context', () => {
    const parsed = JSON.parse('{"small":42,"big":12345678901234567890}', JSONBigInt.bigIntReviver);
    expect(parsed.small).toBe(42);
    expect(typeof parsed.big).toBe('number');
  });

  it('stringifies bigints as raw JSON numbers that parse back exactly', () => {
    const value = {
      big: 12345678901234567890n,
      negative: -9007199254740993n,
      small: 42,
      label: 'bigint:1',
    };
    const text = JSONBigInt.stringify(value);
    expect(text).toBe('{"big":12345678901234567890,"negative":-9007199254740993,"small":42,"label":"bigint:1"}');
    expect(JSONBigInt.parse(text)).toEqual(value);
  });

  it('keeps the indentation when stringifying with a space argument', () => {
    expect(JSONBigInt.stringify({ big: 12345678901234567890n }, 2))
      .toBe('{\n  "big": 12345678901234567890\n}');
  });

  // stringify marks each bigint with a string that starts with a NUL character and 'bigint:',
  // then turns the marks into raw numbers. Strings from the data never become numbers.
  it('keeps strings that start like the bigint mark as strings', () => {
    const nul = String.fromCharCode(0);
    const value = {
      name: `${nul}bigint:5`,
      args: [`${nul}bigint:1000000`, 'memo'],
      big: 12345678901234567890n,
    };
    const text = JSONBigInt.stringify(value);
    expect(JSONBigInt.parse(text)).toEqual(value);
    expect(text).toContain('"big":12345678901234567890');
  });

  it('writes valid JSON for an object key that starts like the bigint mark', () => {
    const value = { [`${String.fromCharCode(0)}bigint:5`]: 'x' };
    expect(JSONBigInt.parse(JSONBigInt.stringify(value))).toEqual(value);
  });

  it('returns undefined for the values JSON.stringify does not serialize', () => {
    expect(JSONBigInt.stringify(undefined)).toBeUndefined();
    expect(JSONBigInt.stringify(() => 1)).toBeUndefined();
    expect(JSONBigInt.stringify(Symbol('value'))).toBeUndefined();
  });
});
