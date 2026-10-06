import { jest, describe, test, expect, afterEach } from '@jest/globals';
import { walletUtils } from '@hathor/wallet-lib';
import AsyncStorageStore, { WALLET_META_KEY } from '../src/store';

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
