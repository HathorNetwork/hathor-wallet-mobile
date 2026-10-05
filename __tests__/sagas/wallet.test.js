import { jest, describe, test, expect, afterEach } from '@jest/globals';
import { startWallet } from '../../src/sagas/wallet';
import { startWalletRequested } from '../../src/actions';
import { STORE } from '../../src/store';

describe('startWallet saga', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Regression guard for the passkey-core fix: the passkey start paths (onboarding +
  // unlock) dispatch startWalletRequested() with NO argument and read everything from the
  // persisted walletMeta. Before `action.payload ?? {}` was added, destructuring
  // `action.payload` (undefined) threw synchronously before startup — a crash that slipped
  // through an approved review unnoticed.
  test('does not crash when a passkey wallet is started with no payload', () => {
    jest.spyOn(STORE, 'getWalletMeta').mockReturnValue({
      walletType: 'passkey',
      xpub: 'xpub-passkey-wallet',
      passkeyLabel: 'My passkey',
    });
    // getStorage is the first thing used after the metadata branch; stub the pieces the
    // saga touches up to its first yield (cleaning memory metadata and transaction history).
    jest.spyOn(STORE, 'getStorage').mockReturnValue({
      store: { cleanMetadata: jest.fn() },
      cleanStorage: jest.fn(),
    });

    const action = startWalletRequested(); // no payload
    expect(action.payload).toBeUndefined();

    const gen = startWallet(action);

    // Running the generator to its first yield executes the payload destructure and the
    // passkey-metadata branch; with the fix it must not throw, and the saga keeps going.
    let step;
    expect(() => {
      step = gen.next();
    }).not.toThrow();
    expect(step.done).toBe(false);
  });
});
