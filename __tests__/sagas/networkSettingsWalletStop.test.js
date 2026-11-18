import { jest, describe, test, expect, beforeEach } from '@jest/globals';

jest.mock('../../src/store', () => ({
  STORE: {
    setItem: jest.fn(),
    getStorage: jest.fn(),
    getWalletMeta: jest.fn(),
  },
}));

// One shared logger object, so the test can assert on what the saga logs.
jest.mock('../../src/logger', () => {
  const log = {
    error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn(),
  };
  return { logger: () => log };
});

/* eslint-disable import/first */
import { STORE } from '../../src/store';
import { logger } from '../../src/logger';
import {
  persistNetworkSettings,
  registerPasskeyWalletOnNetworkChange,
} from '../../src/sagas/networkSettings';
import { monitorFeatureFlags } from '../../src/sagas/featureToggle';
import { registerOnNetworkChange } from '../../src/passkey/walletServiceRegistration';
import { isWalletServiceEnabled } from '../../src/sagas/wallet';
import {
  networkChanged,
  networkSettingsUpdateWaiting,
  reloadWalletRequested,
} from '../../src/actions';
/* eslint-enable import/first */

const log = logger();
const SETTINGS = { network: 'testnet', nodeUrl: 'http://localhost:8080/' };

const isPut = (effect, action) => effect?.type === 'PUT'
  && JSON.stringify(effect.payload.action) === JSON.stringify(action);

// Steps persistNetworkSettings up to the effect right after `networkChanged()` is dispatched,
// i.e. where the running wallet gets stopped.
const runToWalletStop = (wallet) => {
  const gen = persistNetworkSettings({ payload: SETTINGS });
  let step = gen.next(); // put(saveTokensForNetwork())
  for (let i = 0; i < 20 && !isPut(step.value, networkChanged()); i += 1) {
    let answer;
    if (step.value?.type === 'ALL') answer = [{ saved: true }, { saved: true }]; // snapshots done
    if (step.value?.type === 'SELECT') answer = wallet;
    step = gen.next(answer);
  }
  expect(isPut(step.value, networkChanged())).toBe(true);
  return { gen, stopStep: gen.next() };
};

// After the storage is cleaned: the passkey registration for the new network, then the WAITING
// status (the screens keep their LOADING spinner until here), then the reload that starts the
// wallet there.
const expectRegistrationThenReload = (gen) => {
  const registerStep = gen.next().value;
  expect(registerStep.type).toBe('CALL');
  expect(registerStep.payload.fn).toBe(registerPasskeyWalletOnNetworkChange);
  expect(registerStep.payload.args).toEqual([SETTINGS]);
  expect(isPut(gen.next().value, networkSettingsUpdateWaiting())).toBe(true);
  expect(isPut(gen.next().value, reloadWalletRequested())).toBe(true);
};

describe('persistNetworkSettings wallet stop', () => {
  let wallet;
  let storage;

  beforeEach(() => {
    jest.clearAllMocks();
    wallet = { stop: jest.fn() };
    storage = { cleanStorage: jest.fn() };
    STORE.getStorage.mockReturnValue(storage);
  });

  test('waits for wallet.stop before cleaning storage and reloading', () => {
    const { gen, stopStep } = runToWalletStop(wallet);

    // The stop is yielded as an effect (so the saga waits for its promise), not called and dropped.
    expect(stopStep.value.type).toBe('CALL');
    expect(stopStep.value.payload.fn).toBe(wallet.stop);
    expect(stopStep.value.payload.context).toBe(wallet);
    expect(stopStep.value.payload.args).toEqual([
      { cleanStorage: true, cleanAddresses: true, cleanTokens: true },
    ]);
    expect(wallet.stop).not.toHaveBeenCalled();

    // Only once the stop has finished: clean storage, register a passkey wallet, then reload.
    const cleanStep = gen.next().value;
    expect(cleanStep.payload.fn).toBe(storage.cleanStorage);
    expectRegistrationThenReload(gen);
  });

  test('a failed wallet.stop is logged and does not block the network switch', () => {
    const { gen } = runToWalletStop(wallet);

    const stopError = new Error('stop failed');
    const cleanStep = gen.throw(stopError).value;

    // Every logger in this file shares one mock, so check for the stop's own error.
    expect(log.error).toHaveBeenCalledWith(expect.any(String), stopError);
    expect(cleanStep.payload.fn).toBe(storage.cleanStorage);
    expectRegistrationThenReload(gen);
  });

  test('without a wallet (e.g. after a network loading error) it just cleans and reloads', () => {
    const { stopStep, gen } = runToWalletStop(null);

    expect(stopStep.value.payload.fn).toBe(storage.cleanStorage);
    expectRegistrationThenReload(gen);
  });

  test('a failed passkey registration is logged and does not block the network switch', () => {
    const { gen } = runToWalletStop(wallet);
    gen.next(); // the wallet stop ends: clean storage

    const registerStep = gen.next().value;
    expect(registerStep.payload.fn).toBe(registerPasskeyWalletOnNetworkChange);

    // The storage is already wiped: the status must still leave LOADING, and the wallet reload.
    const registrationError = new Error('feature toggles unavailable');
    expect(isPut(gen.throw(registrationError).value, networkSettingsUpdateWaiting())).toBe(true);
    expect(log.error).toHaveBeenCalledWith(expect.any(String), registrationError);
    expect(isPut(gen.next().value, reloadWalletRequested())).toBe(true);
    expect(gen.next().done).toBe(true);
  });
});

describe('registerPasskeyWalletOnNetworkChange', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('a seed wallet registers at its start, so it skips this', () => {
    STORE.getWalletMeta.mockReturnValue({ walletType: 'seed' });
    const gen = registerPasskeyWalletOnNetworkChange(SETTINGS);

    expect(gen.next().done).toBe(true);
  });

  test('a passkey wallet reads the toggles of the new network, then registers there', () => {
    STORE.getWalletMeta.mockReturnValue({ walletType: 'passkey', xpub: 'xpub' });
    const toggles = { 'wallet-service-mobile.rollout': true };
    const gen = registerPasskeyWalletOnNetworkChange(SETTINGS);

    const refreshStep = gen.next().value;
    expect(refreshStep.payload.fn).toBe(monitorFeatureFlags);
    expect(refreshStep.payload.args).toEqual([0, false]);
    expect(gen.next().value.payload.fn).toBe(isWalletServiceEnabled);
    expect(gen.next(true).value.type).toBe('SELECT');
    const registerStep = gen.next(toggles).value;
    expect(registerStep.payload.fn).toBe(registerOnNetworkChange);
    expect(registerStep.payload.args).toEqual([toggles, SETTINGS]);
    expect(gen.next(true).done).toBe(true);
  });

  // A failed wallet-service start is ignored for a while: the start would use the fullnode facade
  // anyway, so no passkey prompt.
  test('a passkey wallet does not register while the wallet-service is off for it', () => {
    STORE.getWalletMeta.mockReturnValue({ walletType: 'passkey', xpub: 'xpub' });
    const gen = registerPasskeyWalletOnNetworkChange(SETTINGS);

    gen.next(); // monitorFeatureFlags
    expect(gen.next().value.payload.fn).toBe(isWalletServiceEnabled);
    expect(gen.next(false).done).toBe(true);
  });
});
