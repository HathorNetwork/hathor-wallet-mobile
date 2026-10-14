/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';
import { NativeModules } from 'react-native';

// The real @hathor/ct-crypto-mobile runs here: its factory finds the native module on
// NativeModules, so each test sets a fake HathorCtCrypto there. The package turns bytes into
// base64 strings on the way to the native module and back.

const HTR_TAG_HEX = 'ed3d6b7540fb1b9d05e2852cfa6c83d95e8fe136f30092910bd06a48283611e1';
const HTR_UID_BASE64 = Buffer.alloc(32).toString('base64');
const OTHER_TAG_HEX = '11'.repeat(32);

const base64OfHex = (hex) => Buffer.from(hex, 'hex').toString('base64');

// The module keeps the provider that passed its self-test, so each test loads a fresh copy.
function loadModule() {
  let mod;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    mod = require('../../src/shielded/cryptoProvider');
  });
  return mod;
}

function fakeNativeModule(deriveTag) {
  NativeModules.HathorCtCrypto = { deriveTag: jest.fn(deriveTag) };
  return NativeModules.HathorCtCrypto;
}

afterEach(() => {
  delete NativeModules.HathorCtCrypto;
  jest.useRealTimers();
});

describe('loadShieldedCryptoProvider', () => {
  test('returns a provider that derives HTR\'s tag through the native module', async () => {
    const native = fakeNativeModule(async () => base64OfHex(HTR_TAG_HEX));
    const { loadShieldedCryptoProvider, HTR_SHIELDED_TAG_HEX } = loadModule();

    const result = await loadShieldedCryptoProvider();

    expect(HTR_SHIELDED_TAG_HEX).toBe(HTR_TAG_HEX);
    expect(result.error).toBeUndefined();
    expect(native.deriveTag).toHaveBeenCalledTimes(1);
    expect(native.deriveTag).toHaveBeenCalledWith(HTR_UID_BASE64);
    const tag = await result.provider.deriveTag(Buffer.alloc(32));
    expect(tag.toString('hex')).toBe(HTR_TAG_HEX);
  });

  test('returns the error when the native module is not linked', async () => {
    const { loadShieldedCryptoProvider } = loadModule();

    const result = await loadShieldedCryptoProvider();

    expect(result.provider).toBeUndefined();
    expect(result.error.message).toMatch(/HathorCtCrypto native module not found/);
  });

  test('returns an error when the native module derives another tag', async () => {
    fakeNativeModule(async () => base64OfHex(OTHER_TAG_HEX));
    const { loadShieldedCryptoProvider } = loadModule();

    const result = await loadShieldedCryptoProvider();

    expect(result.provider).toBeUndefined();
    expect(result.error.message).toMatch(/failed its self-test/);
  });

  test('returns the native rejection', async () => {
    const rejection = Object.assign(new Error('native failure'), { code: 'Internal' });
    fakeNativeModule(async () => { throw rejection; });
    const { loadShieldedCryptoProvider } = loadModule();

    const result = await loadShieldedCryptoProvider();

    expect(result.provider).toBeUndefined();
    expect(result.error).toBe(rejection);
  });

  test('returns an error when the native module does not answer in time', async () => {
    jest.useFakeTimers();
    fakeNativeModule(() => new Promise(() => {}));
    const { loadShieldedCryptoProvider } = loadModule();

    let result = null;
    loadShieldedCryptoProvider({ timeoutMs: 5000 }).then((value) => { result = value; });
    await jest.advanceTimersByTimeAsync(4999);
    expect(result).toBeNull();
    await jest.advanceTimersByTimeAsync(1);

    expect(result.provider).toBeUndefined();
    expect(result.error.message).toMatch(/did not answer its self-test in 5000 ms/);
  });

  test('waits 10 seconds by default and clears its timer on success', async () => {
    jest.useFakeTimers();
    let answer;
    fakeNativeModule(() => new Promise((resolve) => { answer = resolve; }));
    const { loadShieldedCryptoProvider } = loadModule();

    let result = null;
    loadShieldedCryptoProvider().then((value) => { result = value; });
    await jest.advanceTimersByTimeAsync(9999);
    expect(result).toBeNull();
    answer(base64OfHex(HTR_TAG_HEX));
    await jest.advanceTimersByTimeAsync(0);

    expect(result.provider).toBeDefined();
    expect(jest.getTimerCount()).toBe(0);
  });

  test('keeps the provider that passed, without testing it again', async () => {
    const native = fakeNativeModule(async () => base64OfHex(HTR_TAG_HEX));
    const { loadShieldedCryptoProvider } = loadModule();

    const first = await loadShieldedCryptoProvider();
    const second = await loadShieldedCryptoProvider();

    expect(second.provider).toBe(first.provider);
    expect(native.deriveTag).toHaveBeenCalledTimes(1);
  });

  test('tries again after a failure', async () => {
    const { loadShieldedCryptoProvider } = loadModule();
    const failed = await loadShieldedCryptoProvider();
    expect(failed.error).toBeDefined();

    const native = fakeNativeModule(async () => base64OfHex(HTR_TAG_HEX));
    const retried = await loadShieldedCryptoProvider();

    expect(retried.error).toBeUndefined();
    expect(retried.provider).toBeDefined();
    expect(native.deriveTag).toHaveBeenCalledTimes(1);
  });
});
