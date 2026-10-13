import { jest, describe, test, expect, afterEach } from '@jest/globals';
import { runSaga, stdChannel } from 'redux-saga';
import { call, take } from 'redux-saga/effects';
import {
  saga,
  startWallet,
  trackRestartPin,
  waitForWalletRestart,
} from '../../src/sagas/wallet';
import {
  reloadWalletRequested,
  resetWallet,
  startWalletRequested,
  walletPinChanged,
} from '../../src/actions';
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

describe('waitForWalletRestart', () => {
  const startAction = startWalletRequested({ words: 'seed words', pin: '111111' });

  // Runs trackRestartPin, as the wallet saga does, and dispatches `start` to it. Then runs the saga
  // for the wallet `start` started, and dispatches `actions` in order.
  async function run(actions, start = startAction) {
    const channel = stdChannel();
    const dispatched = [];
    const io = { channel, dispatch: (action) => dispatched.push(action) };
    const pinTracker = runSaga(io, trackRestartPin);
    channel.put(start);
    const task = runSaga(io, waitForWalletRestart, start);
    actions.forEach((action) => channel.put(action));
    await task.toPromise();
    pinTracker.cancel();
    return dispatched;
  }

  test('starts the wallet again with the same action on a reload', async () => {
    expect(await run([reloadWalletRequested()])).toEqual([startAction]);
  });

  // ChangePin and the safe-biometry switch re-encrypt the access data of the running wallet, and
  // start() decrypts it with the PIN it is given.
  test('starts the wallet again with the PIN of the last PIN change on a reload', async () => {
    const dispatched = await run([
      walletPinChanged('222222'),
      walletPinChanged('random-password'),
      reloadWalletRequested(),
    ]);
    expect(dispatched).toEqual([
      startWalletRequested({ words: 'seed words', pin: 'random-password' }),
    ]);
  });

  test('starts a passkey wallet again with its start action, which has no PIN', async () => {
    const passkeyStartAction = startWalletRequested();
    expect(await run([reloadWalletRequested()], passkeyStartAction)).toEqual([passkeyStartAction]);
  });

  test('ends without starting the wallet on a new start request or a wallet reset', async () => {
    expect(await run([
      walletPinChanged('222222'),
      startWalletRequested({ words: 'other words', pin: '333333' }),
    ])).toEqual([]);
    expect(await run([resetWallet()])).toEqual([]);
  });
});

describe('wallet saga', () => {
  // startWallet loads the wallet, then runs waitForWalletRestart. In its place, the saga runs this
  // start, which loads until the test dispatches WALLET_LOADED.
  const WALLET_LOADED = 'TEST_WALLET_LOADED';
  function* loadWallet(action) {
    yield take(WALLET_LOADED);
    yield call(waitForWalletRestart, action);
  }
  const replaceStartWallet = (next) => (effect) => (
    effect?.type === 'CALL' && effect.payload.fn === startWallet
      ? next(call(loadWallet, ...effect.payload.args))
      : next(effect)
  );

  // A PIN change can land before the wallet has loaded: the biometry migration of a lock screen
  // shown during the load, or a PIN change committed just before a reload began.
  test('reloads the wallet with the PIN of a PIN change that landed while it loaded', () => {
    const channel = stdChannel();
    const dispatched = [];
    const task = runSaga({
      channel,
      dispatch: (action) => dispatched.push(action),
      effectMiddlewares: [replaceStartWallet],
    }, saga);
    [
      startWalletRequested({ words: 'seed words', pin: '111111' }),
      walletPinChanged('222222'),
      { type: WALLET_LOADED },
      reloadWalletRequested(),
    ].forEach((action) => channel.put(action));
    task.cancel();

    expect(dispatched).toEqual([
      startWalletRequested({ words: 'seed words', pin: '222222' }),
    ]);
  });
});
