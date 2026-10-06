import { jest, describe, test, expect, beforeEach } from '@jest/globals';

jest.mock('../../src/store', () => ({
  STORE: {
    setItem: jest.fn(),
    getStorage: jest.fn(),
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
import { persistNetworkSettings } from '../../src/sagas/networkSettings';
import { networkChanged, reloadWalletRequested } from '../../src/actions';
/* eslint-enable import/first */

const log = logger();
const SETTINGS = { network: 'testnet', nodeUrl: 'http://localhost:8080/' };

const isPut = (effect, action) => effect?.type === 'PUT'
  && JSON.stringify(effect.payload.action) === JSON.stringify(action);

// Steps persistNetworkSettings up to the effect right after `networkChanged()` is dispatched,
// i.e. where the running wallet gets stopped.
const runToWalletStop = (wallet) => {
  const gen = persistNetworkSettings({ payload: SETTINGS });
  let step = gen.next(); // put(networkSettingsUpdateWaiting())
  for (let i = 0; i < 20 && !isPut(step.value, networkChanged()); i += 1) {
    let answer;
    if (step.value?.type === 'ALL') answer = [{ saved: true }, { saved: true }]; // snapshots done
    if (step.value?.type === 'SELECT') answer = wallet;
    step = gen.next(answer);
  }
  expect(isPut(step.value, networkChanged())).toBe(true);
  return { gen, stopStep: gen.next() };
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

    // Only once the stop has finished: clean storage, then reload.
    const cleanStep = gen.next().value;
    expect(cleanStep.payload.fn).toBe(storage.cleanStorage);
    expect(isPut(gen.next().value, reloadWalletRequested())).toBe(true);
  });

  test('a failed wallet.stop is logged and does not block the network switch', () => {
    const { gen } = runToWalletStop(wallet);

    const stopError = new Error('stop failed');
    const cleanStep = gen.throw(stopError).value;

    // Every logger in this file shares one mock, so check for the stop's own error.
    expect(log.error).toHaveBeenCalledWith(expect.any(String), stopError);
    expect(cleanStep.payload.fn).toBe(storage.cleanStorage);
    expect(isPut(gen.next().value, reloadWalletRequested())).toBe(true);
  });

  test('without a wallet (e.g. after a network loading error) it just cleans and reloads', () => {
    const { stopStep, gen } = runToWalletStop(null);

    expect(stopStep.value.payload.fn).toBe(storage.cleanStorage);
    expect(isPut(gen.next().value, reloadWalletRequested())).toBe(true);
  });
});
