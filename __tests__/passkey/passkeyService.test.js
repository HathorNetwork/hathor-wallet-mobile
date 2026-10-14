import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// react-native-passkey is required lazily by the service; mock the native module.
const mockPasskey = {
  create: jest.fn(),
  createPlatformKey: jest.fn(),
  get: jest.fn(),
  getImmediate: jest.fn(),
  isSupported: jest.fn(() => true),
};
jest.mock('react-native-passkey', () => ({ Passkey: mockPasskey }));

/* eslint-disable import/first */
import { Platform } from 'react-native';
import {
  assertUserVerified,
  createWalletWordsFromPasskey,
  decodeUserIdLabel,
  EXPECTED_NATIVE_CODES,
  isPasskeySupported,
  PasskeyNativeError,
  signInWalletWordsFromPasskey,
} from '../../src/passkey/passkeyService';
/* eslint-enable import/first */

// The app's global Buffer is the buffer@4.9.2 polyfill (shim.js), NOT Node's native Buffer that
// Jest provides. `require('buffer/')` (trailing slash) skips Node's core module and loads the npm
// polyfill, so these tests exercise the same Buffer the device uses.
// eslint-disable-next-line import/no-extraneous-dependencies, global-require
const PolyfillBuffer = require('buffer/').Buffer;

// authenticatorData: rpIdHash (32) | flags (1) | signCount (4)
const FLAG_UP = 0x01;
const FLAG_UV = 0x04;
const authData = (flags) => {
  const bytes = new Uint8Array(37);
  bytes[32] = flags;
  return bytes;
};

const userHandleFor = (label) => new Uint8Array([
  ...Buffer.from(label, 'utf8'),
  0,
  ...new Array(8).fill(7),
]);

const PRF_32 = new Uint8Array(32).fill(1);

const assertion = (overrides = {}) => ({
  id: 'cred-1',
  response: {
    authenticatorData: authData(FLAG_UP | FLAG_UV), // eslint-disable-line no-bitwise
    userHandle: userHandleFor('Savings'),
  },
  clientExtensionResults: { prf: { results: { first: PRF_32 } } },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// Runs `fn` with Platform.OS set to `os`, restoring it afterwards.
async function withPlatformOS(os, fn) {
  const originalOS = Platform.OS;
  Platform.OS = os;
  try {
    return await fn();
  } finally {
    Platform.OS = originalOS;
  }
}

describe('decodeUserIdLabel under the device Buffer polyfill', () => {
  const nativeBuffer = global.Buffer;

  beforeEach(() => {
    global.Buffer = PolyfillBuffer;
  });

  afterEach(() => {
    global.Buffer = nativeBuffer;
  });

  // Regression: with the polyfill, Buffer#subarray returns a plain Uint8Array whose toString
  // ignores 'utf8' and joins the byte values ("Savings" -> "83,97,118,105,110,103,115").
  test.each([
    ['Savings'],
    ['Poupança'],
    ['钱包'],
    ['🔐 wallet'],
  ])('decodes %s back to the original label', (label) => {
    expect(decodeUserIdLabel(userHandleFor(label))).toBe(label);
  });

  test('returns null for a userHandle with no text label', () => {
    // Old-format credentials carry random bytes in user.id; the decoded text is rejected.
    expect(decodeUserIdLabel(new Uint8Array([0xff, 0xfe, 0x01, 0x02]))).toBeNull();
  });
});

describe('assertUserVerified', () => {
  test('accepts authenticatorData with the UV flag set', () => {
    // eslint-disable-next-line no-bitwise
    expect(() => assertUserVerified(authData(FLAG_UP | FLAG_UV))).not.toThrow();
  });

  test('rejects authenticatorData without the UV flag', () => {
    expect(() => assertUserVerified(authData(FLAG_UP))).toThrow(/did not verify your identity/);
  });

  test('rejects missing or truncated authenticatorData', () => {
    expect(() => assertUserVerified(undefined)).toThrow(/authenticator data/);
    expect(() => assertUserVerified(new Uint8Array(10))).toThrow(/authenticator data/);
  });
});

describe('signInWalletWordsFromPasskey', () => {
  test('derives the words and recovers the label on a verified assertion', async () => {
    mockPasskey.get.mockResolvedValue(assertion());

    const result = await signInWalletWordsFromPasskey({ credentialId: 'cred-1' });

    expect(result.words.split(' ')).toHaveLength(24);
    expect(result.label).toBe('Savings');
    expect(result.credentialId).toBe('cred-1');
  });

  // The silent retry only applies right after creation: the passkey being signed in with already
  // exists, so Android gets a single regular assertion.
  test('asks with a single regular assertion on Android', async () => {
    mockPasskey.get.mockResolvedValue(assertion());

    await withPlatformOS('android', () => signInWalletWordsFromPasskey({ credentialId: 'cred-1' }));

    expect(mockPasskey.get).toHaveBeenCalledTimes(1);
    expect(mockPasskey.getImmediate).not.toHaveBeenCalled();
  });

  test('rejects an assertion without user verification before deriving anything', async () => {
    mockPasskey.get.mockResolvedValue(assertion({
      response: { authenticatorData: authData(FLAG_UP), userHandle: userHandleFor('Savings') },
    }));

    await expect(signInWalletWordsFromPasskey()).rejects.toThrow(/did not verify your identity/);
  });

  test('wraps a plain-object native rejection in PasskeyNativeError, keeping code and message', async () => {
    mockPasskey.get.mockRejectedValue({ error: 'RequestFailed', message: 'The request failed.' });

    const err = await signInWalletWordsFromPasskey().catch((e) => e);

    expect(err).toBeInstanceOf(PasskeyNativeError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('RequestFailed');
    expect(err.message).toBe('The request failed.');
    expect(err.nativeMessage).toBe('The request failed.');
  });

  // Expected codes reach the user (swap sheet, lock banner), so they get a translated message
  // instead of the library's English text, which is kept in nativeMessage.
  test.each([
    ['NoCredentials', /isn't available on this device/],
    ['TimedOut', /timed out/],
    ['Interrupted', /was interrupted/],
  ])('gives the expected %s code a translated message', async (code, message) => {
    const native = { error: code, message: 'Library message.' };
    mockPasskey.get.mockRejectedValue(native);

    const err = await signInWalletWordsFromPasskey().catch((e) => e);

    expect(err).toBeInstanceOf(PasskeyNativeError);
    expect(err.code).toBe(code);
    expect(err.message).toMatch(message);
    expect(err.nativeMessage).toBe('Library message.');
  });

  test('does not treat inherited object keys as expected codes', () => {
    const err = new PasskeyNativeError({ error: 'toString', message: 'Library message.' });

    expect(err.message).toBe('Library message.');
    expect(EXPECTED_NATIVE_CODES).not.toContain('toString');
  });

  test('re-throws a user cancel untouched so callers can detect it', async () => {
    const cancel = { error: 'UserCancelled', message: 'cancelled' };
    mockPasskey.get.mockRejectedValue(cancel);

    await expect(signInWalletWordsFromPasskey()).rejects.toBe(cancel);
  });
});

describe('createWalletWordsFromPasskey', () => {
  test('aborts before the second prompt when the new credential has PRF disabled', async () => {
    const created = { id: 'cred-new', clientExtensionResults: { prf: { enabled: false } } };
    mockPasskey.createPlatformKey.mockResolvedValue(created);

    await withPlatformOS('ios', async () => {
      await expect(createWalletWordsFromPasskey('Savings')).rejects.toThrow(/can't create a passkey wallet/);
    });
    expect(mockPasskey.createPlatformKey).toHaveBeenCalledTimes(1);
    expect(mockPasskey.get).not.toHaveBeenCalled();
  });

  // react-native-passkey passes the provider's registration response through as-is, so a provider
  // may leave `prf.enabled` out. Only an explicit `false` stops creation early.
  test.each([
    ['an empty prf result', { id: 'cred-new', clientExtensionResults: { prf: {} } }],
    ['no extension results', { id: 'cred-new' }],
  ])('goes on to the assertion when the creation response has %s', async (_case, created) => {
    mockPasskey.createPlatformKey.mockResolvedValue(created);
    mockPasskey.get.mockResolvedValue(assertion({ id: 'cred-new' }));

    const result = await withPlatformOS('ios', () => createWalletWordsFromPasskey('Savings'));

    expect(mockPasskey.get).toHaveBeenCalledTimes(1);
    expect(result.words.split(' ')).toHaveLength(24);
  });

  test('still fails with the PRF message when the field is missing and no PRF comes back', async () => {
    mockPasskey.createPlatformKey.mockResolvedValue({ id: 'cred-new' });
    mockPasskey.get.mockResolvedValue(assertion({ id: 'cred-new', clientExtensionResults: {} }));

    await withPlatformOS('ios', async () => {
      await expect(createWalletWordsFromPasskey('Savings')).rejects.toThrow(/can't create a passkey wallet/);
    });
  });

  test('forces a platform passkey on iOS (a security key carries no PRF)', async () => {
    const created = { id: 'cred-new', clientExtensionResults: { prf: { enabled: true } } };
    mockPasskey.createPlatformKey.mockResolvedValue(created);
    mockPasskey.get.mockResolvedValue(assertion({ id: 'cred-new' }));

    await withPlatformOS('ios', () => createWalletWordsFromPasskey('Savings'));

    expect(mockPasskey.createPlatformKey).toHaveBeenCalledTimes(1);
    expect(mockPasskey.create).not.toHaveBeenCalled();
  });

  // The silent retry is Android-only: iOS lists a new passkey at once, and getImmediate there
  // would only add a different code path.
  test('asks for the PRF with a single regular assertion on iOS', async () => {
    const created = { id: 'cred-new', clientExtensionResults: { prf: { enabled: true } } };
    mockPasskey.createPlatformKey.mockResolvedValue(created);
    mockPasskey.get.mockResolvedValue(assertion({ id: 'cred-new' }));

    await withPlatformOS('ios', () => createWalletWordsFromPasskey('Savings'));

    expect(mockPasskey.get).toHaveBeenCalledTimes(1);
    expect(mockPasskey.getImmediate).not.toHaveBeenCalled();
  });

  test('creates the credential, then derives the wallet from a verified assertion', async () => {
    const created = { id: 'cred-new', clientExtensionResults: { prf: { enabled: true } } };
    mockPasskey.create.mockResolvedValue(created);
    mockPasskey.createPlatformKey.mockResolvedValue(created);
    mockPasskey.get.mockResolvedValue(assertion({ id: 'cred-new' }));

    const result = await createWalletWordsFromPasskey('Savings');

    expect(result.words.split(' ')).toHaveLength(24);
    expect(result.credentialId).toBe('cred-new');
    // The assertion is pinned to the credential just created.
    expect(mockPasskey.get.mock.calls[0][0].allowCredentials).toEqual([{ type: 'public-key', id: 'cred-new' }]);
  });
});

// Google Password Manager can't list a passkey for a moment after creating it, so on Android the
// PRF assertion that follows creation retries silently instead of opening Android's chooser.
describe('createWalletWordsFromPasskey on Android, right after creating the passkey', () => {
  const created = { id: 'cred-new', clientExtensionResults: { prf: { enabled: true } } };
  const notReady = { error: 'NoCredentials', message: 'No credentials available.' };

  beforeEach(() => {
    jest.useFakeTimers();
    mockPasskey.create.mockResolvedValue(created);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Runs the Android creation flow to completion, firing the retry delays as they come due.
  async function createOnAndroid() {
    return withPlatformOS('android', async () => {
      const pending = createWalletWordsFromPasskey('Savings');
      // Attach a handler now so a rejection isn't reported as unhandled while timers run.
      pending.catch(() => {});
      await jest.runAllTimersAsync();
      return pending;
    });
  }

  test('uses the regular create call on Android', async () => {
    mockPasskey.getImmediate.mockResolvedValue(assertion({ id: 'cred-new' }));

    await createOnAndroid();

    expect(mockPasskey.create).toHaveBeenCalledTimes(1);
    expect(mockPasskey.createPlatformKey).not.toHaveBeenCalled();
  });

  // runAllTimersAsync fires timers whatever their length, so the waits get their own test: with no
  // wait, every attempt runs before the passkey is listed and the user ends up in the chooser.
  test('waits 250, 500, 1000, 2000 and 4000 ms before each silent attempt', async () => {
    mockPasskey.getImmediate.mockRejectedValue(notReady);
    mockPasskey.get.mockResolvedValue(assertion({ id: 'cred-new' }));

    await withPlatformOS('android', async () => {
      const pending = createWalletWordsFromPasskey('Savings');
      pending.catch(() => {});
      const delays = [250, 500, 1000, 2000, 4000];
      for (const [attempt, delayMs] of delays.entries()) {
        // eslint-disable-next-line no-await-in-loop
        await jest.advanceTimersByTimeAsync(delayMs - 1);
        expect(mockPasskey.getImmediate).toHaveBeenCalledTimes(attempt);
        // eslint-disable-next-line no-await-in-loop
        await jest.advanceTimersByTimeAsync(1);
        expect(mockPasskey.getImmediate).toHaveBeenCalledTimes(attempt + 1);
      }
      await pending;
    });

    expect(mockPasskey.get).toHaveBeenCalledTimes(1);
  });

  // A PRF read without user verification returns a different secret, so the new wallet could never
  // be derived again by sign-in, which requires it.
  test('rejects an assertion without user verification', async () => {
    mockPasskey.getImmediate.mockResolvedValue(assertion({
      id: 'cred-new',
      response: { authenticatorData: authData(FLAG_UP), userHandle: userHandleFor('Savings') },
    }));

    await expect(createOnAndroid()).rejects.toThrow(/did not verify your identity/);
  });

  test('retries until the new passkey is available, without opening the chooser', async () => {
    mockPasskey.getImmediate
      .mockRejectedValueOnce(notReady)
      .mockResolvedValueOnce(assertion({ id: 'cred-new' }));

    const result = await createOnAndroid();

    expect(result.words.split(' ')).toHaveLength(24);
    expect(result.credentialId).toBe('cred-new');
    expect(mockPasskey.getImmediate).toHaveBeenCalledTimes(2);
    expect(mockPasskey.get).not.toHaveBeenCalled();
    // Every attempt is pinned to the credential just created.
    mockPasskey.getImmediate.mock.calls.forEach(([request]) => {
      expect(request.allowCredentials).toEqual([{ type: 'public-key', id: 'cred-new' }]);
    });
  });

  test('falls back to the regular assertion when the passkey never becomes available', async () => {
    mockPasskey.getImmediate.mockRejectedValue(notReady);
    mockPasskey.get.mockResolvedValue(assertion({ id: 'cred-new' }));

    const result = await createOnAndroid();

    expect(result.words.split(' ')).toHaveLength(24);
    // Five silent attempts, one per retry delay, then the regular prompt, which can still offer a
    // security key or another device.
    expect(mockPasskey.getImmediate).toHaveBeenCalledTimes(5);
    expect(mockPasskey.get).toHaveBeenCalledTimes(1);
    expect(mockPasskey.get.mock.calls[0][0].allowCredentials).toEqual([{ type: 'public-key', id: 'cred-new' }]);
    // Each attempt is a new request with its own challenge.
    const challenges = [...mockPasskey.getImmediate.mock.calls, ...mockPasskey.get.mock.calls]
      .map(([request]) => request.challenge);
    expect(new Set(challenges).size).toBe(6);
  });

  // Once the passkey is found, Android shows the biometric prompt. Any answer other than "not
  // listed yet" is final: retrying would prompt the user again after they cancelled.
  test('passes a user cancel straight through without retrying', async () => {
    const cancel = { error: 'UserCancelled', message: 'The user cancelled the request.' };
    mockPasskey.getImmediate.mockRejectedValue(cancel);

    await expect(createOnAndroid()).rejects.toBe(cancel);
    expect(mockPasskey.getImmediate).toHaveBeenCalledTimes(1);
    expect(mockPasskey.get).not.toHaveBeenCalled();
  });

  test('passes any other native failure straight through without retrying', async () => {
    mockPasskey.getImmediate.mockRejectedValue({ error: 'TimedOut', message: 'The request timed out.' });

    await expect(createOnAndroid()).rejects.toMatchObject({ name: 'PasskeyNativeError', code: 'TimedOut' });
    expect(mockPasskey.getImmediate).toHaveBeenCalledTimes(1);
    expect(mockPasskey.get).not.toHaveBeenCalled();
  });
});

describe('isPasskeySupported', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Under Jest, Platform.Version is NaN unless stubbed, and `NaN < 18` is false, so an unstubbed
  // test would pass the version gates silently.
  const withVersion = (version) => jest.spyOn(Platform, 'Version', 'get').mockReturnValue(version);

  test.each([
    ['ios', 17, false],
    ['ios', '17.5', false],
    ['android', 27, false],
  ])('%s %s is unsupported without asking the passkey module', async (os, version) => {
    withVersion(version);

    await expect(withPlatformOS(os, () => isPasskeySupported())).resolves.toBe(false);
    expect(mockPasskey.isSupported).not.toHaveBeenCalled();
  });

  test.each([
    ['ios', '18.0'],
    ['ios', 26],
    ['android', 28],
  ])('%s %s asks the passkey module', async (os, version) => {
    withVersion(version);
    mockPasskey.isSupported.mockReturnValue(true);

    await expect(withPlatformOS(os, () => isPasskeySupported())).resolves.toBe(true);
    expect(mockPasskey.isSupported).toHaveBeenCalledTimes(1);
  });

  test('is unsupported when the passkey module throws', async () => {
    withVersion('18.0');
    mockPasskey.isSupported.mockImplementation(() => { throw new Error('not linked'); });

    await expect(withPlatformOS('ios', () => isPasskeySupported())).resolves.toBe(false);
  });
});
