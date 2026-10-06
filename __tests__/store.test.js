import { jest, describe, test, expect, afterEach } from '@jest/globals';
import { walletUtils } from '@hathor/wallet-lib';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AsyncStorageStore, { WALLET_META_KEY } from '../src/store';

// A promise the test settles by hand, to check what a caller does while a native write is pending.
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

// Lets pending promise callbacks run.
const flush = () => new Promise((resolve) => { setImmediate(resolve); });

describe('AsyncStorageStore.initStorage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Regression guard for the passkey-core fix: a seed-wallet start must clear any passkey metadata
  // left by a prior passkey onboarding. If it doesn't, startWallet reads the stale
  // walletType:'passkey' and boots this seed wallet read-only from the OLD xpub — silently ignoring
  // the seed the user just entered and rendering the passkey lock screen.
  test('clears stale passkey metadata before writing the seed access data', async () => {
    const store = new AsyncStorageStore();

    // Simulate passkey metadata left behind by a prior passkey onboarding.
    store.hathorMemoryStorage[WALLET_META_KEY] = {
      walletType: 'passkey',
      xpub: 'xpub-from-old-passkey-wallet',
      passkeyLabel: 'Old passkey',
    };
    expect(store.getWalletMeta()).not.toBeNull();
    expect(store.isPasskeyWallet()).toBe(true);

    // Avoid real crypto / wallet-lib storage: stub access-data generation and persistence.
    const saveAccessData = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(store, 'getStorage').mockReturnValue({ saveAccessData });
    jest
      .spyOn(walletUtils, 'generateAccessDataFromSeed')
      .mockReturnValue({ fake: 'accessData' });
    // initStorage must use the DURABLE variant so the clear is awaited before saveAccessData.
    const removeItemSpy = jest.spyOn(store, 'removeItemAsync');

    await store.initStorage('seed words here', '1234');

    // The stale passkey metadata is gone (removeItemAsync drops the cache and the persisted key).
    expect(removeItemSpy).toHaveBeenCalledWith(WALLET_META_KEY);
    expect(store.getWalletMeta()).toBeNull();
    expect(store.isPasskeyWallet()).toBe(false);

    // ...and it is cleared BEFORE the access data is written, so a seed wallet can never
    // momentarily inherit passkey metadata.
    expect(removeItemSpy.mock.invocationCallOrder[0]).toBeLessThan(
      saveAccessData.mock.invocationCallOrder[0],
    );
  });
});

describe('AsyncStorageStore fire-and-forget writes', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Saga callers `yield STORE.setItem(...)` without waiting for the native write, so a failed
  // write must be logged, not left as an unhandled rejection.
  test.each([
    ['setItem', 'setItemAsync', (store) => store.setItem('some-key', { a: 1 })],
    ['removeItem', 'removeItemAsync', (store) => store.removeItem('some-key')],
  ])('%s logs a failed native write instead of rejecting', async (_name, asyncMethod, call) => {
    const store = new AsyncStorageStore();
    const failure = new Error('disk full');
    jest.spyOn(store, asyncMethod).mockRejectedValue(failure);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(call(store)).toBeUndefined();
    // Let the rejection reach the handler.
    await new Promise((resolve) => { setImmediate(resolve); });

    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('some-key'), failure);
  });
});

// These writes must be durable before the caller moves on, so each one waits for the native
// write: the tests hold AsyncStorage's promise open and check that nothing else happens until it
// settles, and that a failed write rejects instead of being swallowed.
describe('AsyncStorageStore durable writes', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const stubAccessData = (store) => {
    const saveAccessData = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(store, 'getStorage').mockReturnValue({ saveAccessData });
    jest.spyOn(walletUtils, 'generateAccessDataFromSeed').mockReturnValue({ fake: 'accessData' });
    jest.spyOn(walletUtils, 'generateAccessDataFromXpub').mockReturnValue({ fake: 'accessData' });
    return saveAccessData;
  };

  test('initStorage writes the access data only after the stale metadata is cleared', async () => {
    const store = new AsyncStorageStore();
    const saveAccessData = stubAccessData(store);
    const removal = deferred();
    jest.spyOn(AsyncStorage, 'removeItem').mockReturnValueOnce(removal.promise);

    const init = store.initStorage('seed words here', '1234');
    await flush();
    expect(saveAccessData).not.toHaveBeenCalled();

    removal.resolve();
    await init;
    expect(saveAccessData).toHaveBeenCalledTimes(1);
  });

  test('initStorage rejects when clearing the stale metadata fails', async () => {
    const store = new AsyncStorageStore();
    const saveAccessData = stubAccessData(store);
    const failure = new Error('disk full');
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(failure);

    await expect(store.initStorage('seed words here', '1234')).rejects.toBe(failure);
    expect(saveAccessData).not.toHaveBeenCalled();
  });

  test('initPasskeyStorage writes the access data only after the wallet metadata', async () => {
    const store = new AsyncStorageStore();
    const saveAccessData = stubAccessData(store);
    const metaWrite = deferred();
    jest.spyOn(AsyncStorage, 'setItem').mockReturnValueOnce(metaWrite.promise);

    const init = store.initPasskeyStorage('xpub-of-the-passkey-wallet', { passkeyLabel: 'Savings' });
    await flush();
    expect(saveAccessData).not.toHaveBeenCalled();

    metaWrite.resolve();
    await init;
    expect(saveAccessData).toHaveBeenCalledTimes(1);
    expect(store.getWalletMeta()).toMatchObject({ walletType: 'passkey', xpub: 'xpub-of-the-passkey-wallet' });
  });

  test('initPasskeyStorage rejects when the wallet metadata write fails', async () => {
    const store = new AsyncStorageStore();
    const saveAccessData = stubAccessData(store);
    const failure = new Error('disk full');
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(failure);

    await expect(store.initPasskeyStorage('xpub-of-the-passkey-wallet', {})).rejects.toBe(failure);
    expect(saveAccessData).not.toHaveBeenCalled();
  });

  test('updateWalletMeta resolves only once the metadata is written', async () => {
    const store = new AsyncStorageStore();
    store.hathorMemoryStorage[WALLET_META_KEY] = { walletType: 'passkey', xpub: 'xpub' };
    const write = deferred();
    jest.spyOn(AsyncStorage, 'setItem').mockReturnValueOnce(write.promise);

    let done = false;
    const update = store.updateWalletMeta({ credentialId: 'cred-1' }).then(() => { done = true; });
    await flush();
    expect(done).toBe(false);

    write.resolve();
    await update;
    expect(done).toBe(true);
    expect(store.getWalletMeta()).toMatchObject({ credentialId: 'cred-1' });
  });

  test('updateWalletMeta rejects when the metadata write fails', async () => {
    const store = new AsyncStorageStore();
    store.hathorMemoryStorage[WALLET_META_KEY] = { walletType: 'passkey', xpub: 'xpub' };
    const failure = new Error('disk full');
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(failure);

    await expect(store.updateWalletMeta({ credentialId: 'cred-1' })).rejects.toBe(failure);
  });
});
