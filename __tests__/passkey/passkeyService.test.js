import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// react-native-passkey is required lazily by the service; mock the native module.
const mockPasskey = {
  create: jest.fn(),
  createPlatformKey: jest.fn(),
  get: jest.fn(),
  isSupported: jest.fn(() => true),
};
jest.mock('react-native-passkey', () => ({ Passkey: mockPasskey }));

/* eslint-disable import/first */
import { Platform } from 'react-native';
import {
  assertUserVerified,
  createWalletWordsFromPasskey,
  decodeUserIdLabel,
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

  test('rejects an assertion without user verification before deriving anything', async () => {
    mockPasskey.get.mockResolvedValue(assertion({
      response: { authenticatorData: authData(FLAG_UP), userHandle: userHandleFor('Savings') },
    }));

    await expect(signInWalletWordsFromPasskey()).rejects.toThrow(/did not verify your identity/);
  });

  test('wraps a plain-object native rejection in PasskeyNativeError, keeping code and message', async () => {
    mockPasskey.get.mockRejectedValue({ error: 'NoCredentials', message: 'No passkey found.' });

    const err = await signInWalletWordsFromPasskey().catch((e) => e);

    expect(err).toBeInstanceOf(PasskeyNativeError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('NoCredentials');
    expect(err.message).toBe('No passkey found.');
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
    mockPasskey.create.mockResolvedValue(created);
    mockPasskey.createPlatformKey.mockResolvedValue(created);

    await expect(createWalletWordsFromPasskey('Savings')).rejects.toThrow(/can't create a passkey wallet/);
    expect(mockPasskey.createPlatformKey).toHaveBeenCalledTimes(1);
    expect(mockPasskey.get).not.toHaveBeenCalled();
  });

  test('forces a platform passkey on iOS (a security key carries no PRF)', async () => {
    const created = { id: 'cred-new', clientExtensionResults: { prf: { enabled: true } } };
    mockPasskey.createPlatformKey.mockResolvedValue(created);
    mockPasskey.get.mockResolvedValue(assertion({ id: 'cred-new' }));

    await createWalletWordsFromPasskey('Savings');

    expect(Platform.OS).toBe('ios');
    expect(mockPasskey.createPlatformKey).toHaveBeenCalledTimes(1);
    expect(mockPasskey.create).not.toHaveBeenCalled();
  });

  test('uses the regular create call on Android', async () => {
    const created = { id: 'cred-new', clientExtensionResults: { prf: { enabled: true } } };
    mockPasskey.create.mockResolvedValue(created);
    mockPasskey.get.mockResolvedValue(assertion({ id: 'cred-new' }));
    const originalOS = Platform.OS;
    Platform.OS = 'android';
    try {
      await createWalletWordsFromPasskey('Savings');
    } finally {
      Platform.OS = originalOS;
    }

    expect(mockPasskey.create).toHaveBeenCalledTimes(1);
    expect(mockPasskey.createPlatformKey).not.toHaveBeenCalled();
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
