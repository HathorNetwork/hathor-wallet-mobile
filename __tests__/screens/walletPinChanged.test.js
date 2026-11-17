/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

jest.mock('../../src/utils', () => ({
  ...jest.requireActual('../../src/utils'),
  changePin: jest.fn(),
  generateRandomPassword: jest.fn(),
  biometricsMigration: jest.fn(),
}));

/* eslint-disable import/first */
import { changePin, generateRandomPassword, biometricsMigration } from '../../src/utils';
import { STORE } from '../../src/store';
import { ChangePin } from '../../src/screens/ChangePin';
import { Security } from '../../src/screens/Security';
import { PinScreen } from '../../src/screens/PinScreen';
import { SHIELDED_UNLOCK_SOURCE } from '../../src/constants';
/* eslint-enable import/first */

// Each screen below re-encrypts the access data of the running wallet. A reload starts the wallet
// again with the PIN it hands over through walletPinChanged.

const PIN = '111111';
const NEW_PIN = '222222';
const PASSWORD = 'random-password';
const WALLET = { isReady: () => true };

// The screens are class components: the tests call their handlers without rendering them.
function instantiate(Screen, props) {
  const screen = new Screen(props);
  screen.setState = (update) => {
    screen.state = {
      ...screen.state,
      ...(typeof update === 'function' ? update(screen.state) : update),
    };
  };
  return screen;
}

// Lets the promise chains the handlers start settle.
const flushPromises = () => new Promise((resolve) => { setImmediate(resolve); });

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('ChangePin', () => {
  test('hands the new PIN over after it re-encrypts the access data', async () => {
    changePin.mockResolvedValue(true);
    const walletPinChanged = jest.fn();
    const screen = instantiate(ChangePin, { wallet: WALLET, walletPinChanged });
    screen.setState({ pin1: PIN, pin2: NEW_PIN, pin3: NEW_PIN });

    screen.executeChangePin();
    await flushPromises();

    expect(changePin).toHaveBeenCalledWith(WALLET, PIN, NEW_PIN);
    expect(walletPinChanged).toHaveBeenCalledWith(NEW_PIN);
  });

  test('hands nothing over when the access data is not re-encrypted', async () => {
    changePin.mockResolvedValue(false);
    const walletPinChanged = jest.fn();
    const screen = instantiate(ChangePin, { wallet: WALLET, walletPinChanged });
    screen.setState({ pin1: PIN, pin2: NEW_PIN, pin3: NEW_PIN });
    screen.removeOneChar = jest.fn();

    screen.executeChangePin();
    await flushPromises();

    expect(walletPinChanged).not.toHaveBeenCalled();
  });
});

describe('Security', () => {
  test('hands the safe-biometry password over when it turns safe biometry on', async () => {
    changePin.mockResolvedValue(true);
    generateRandomPassword.mockReturnValue(PASSWORD);
    jest.spyOn(STORE, 'enableSafeBiometry').mockImplementation(() => {});
    const walletPinChanged = jest.fn();
    const screen = instantiate(Security, { wallet: WALLET, walletPinChanged });

    screen.executeSafeBiometryEnable(PIN);
    await flushPromises();

    expect(changePin).toHaveBeenCalledWith(WALLET, PIN, PASSWORD);
    expect(walletPinChanged).toHaveBeenCalledWith(PASSWORD);
  });

  test('hands the PIN over when it turns safe biometry off', async () => {
    changePin.mockResolvedValue(true);
    jest.spyOn(STORE, 'disableSafeBiometry').mockReturnValue(PIN);
    const walletPinChanged = jest.fn();
    const screen = instantiate(Security, { wallet: WALLET, walletPinChanged });

    screen.executeSafeBiometryDisable(PASSWORD);
    await flushPromises();

    expect(changePin).toHaveBeenCalledWith(WALLET, PASSWORD, PIN);
    expect(walletPinChanged).toHaveBeenCalledWith(PIN);
  });

  test('hands nothing over when the access data is not re-encrypted', async () => {
    changePin.mockResolvedValue(false);
    generateRandomPassword.mockReturnValue(PASSWORD);
    jest.spyOn(STORE, 'enableSafeBiometry').mockImplementation(() => {});
    const walletPinChanged = jest.fn();
    const onExceptionCaptured = jest.fn();
    const screen = instantiate(Security, { wallet: WALLET, walletPinChanged, onExceptionCaptured });

    screen.executeSafeBiometryEnable(PIN);
    await flushPromises();

    expect(onExceptionCaptured).toHaveBeenCalled();
    expect(walletPinChanged).not.toHaveBeenCalled();
  });
});

describe('PinScreen as the lock screen of a running wallet', () => {
  const lockScreenProps = () => ({
    isLockScreen: true,
    wallet: WALLET,
    unlockScreen: jest.fn(),
    startWalletRequested: jest.fn(),
    onExceptionCaptured: jest.fn(),
    walletPinChanged: jest.fn(),
    shieldedViewUnlockRequested: jest.fn(),
  });

  test('hands the password over when the biometry migration re-encrypts the access data', async () => {
    jest.spyOn(STORE, 'handleDataMigration').mockResolvedValue(undefined);
    biometricsMigration.mockResolvedValue(PASSWORD);
    const props = lockScreenProps();
    const screen = instantiate(PinScreen, props);

    await screen.dismiss(PIN);

    expect(biometricsMigration).toHaveBeenCalledWith(PIN);
    expect(props.walletPinChanged).toHaveBeenCalledWith(PASSWORD);
    expect(props.startWalletRequested).not.toHaveBeenCalled();
    expect(props.unlockScreen).toHaveBeenCalled();
  });

  test('hands nothing over when the unlock re-encrypts nothing', async () => {
    jest.spyOn(STORE, 'handleDataMigration').mockResolvedValue(undefined);
    biometricsMigration.mockResolvedValue(PIN);
    const props = lockScreenProps();
    const screen = instantiate(PinScreen, props);

    await screen.dismiss(PIN);

    expect(props.walletPinChanged).not.toHaveBeenCalled();
    expect(props.unlockScreen).toHaveBeenCalled();
  });

  // A wallet that started with a stale PIN holds its shielded outputs locked until a PIN entry.
  test('asks to unlock the shielded view with the password the biometry migration set', async () => {
    jest.spyOn(STORE, 'handleDataMigration').mockResolvedValue(undefined);
    biometricsMigration.mockResolvedValue(PASSWORD);
    const props = lockScreenProps();
    const screen = instantiate(PinScreen, props);

    await screen.dismiss(PIN);

    expect(props.shieldedViewUnlockRequested).toHaveBeenCalledWith({
      pinCode: PASSWORD,
      source: SHIELDED_UNLOCK_SOURCE.LOCK_SCREEN,
    });
  });

  test('asks to unlock the shielded view with the PIN when nothing was re-encrypted', async () => {
    jest.spyOn(STORE, 'handleDataMigration').mockResolvedValue(undefined);
    biometricsMigration.mockResolvedValue(PIN);
    const props = lockScreenProps();
    const screen = instantiate(PinScreen, props);

    await screen.dismiss(PIN);

    expect(props.shieldedViewUnlockRequested).toHaveBeenCalledWith({
      pinCode: PIN,
      source: SHIELDED_UNLOCK_SOURCE.LOCK_SCREEN,
    });
  });
});

describe('PinScreen as the lock screen of a cold start', () => {
  test('starts the wallet with the PIN, and asks for no unlock', async () => {
    jest.spyOn(STORE, 'handleDataMigration').mockResolvedValue(undefined);
    jest.spyOn(STORE, 'getWalletWords').mockResolvedValue('seed words');
    biometricsMigration.mockResolvedValue(PIN);
    const props = {
      isLockScreen: true,
      wallet: null,
      unlockScreen: jest.fn(),
      startWalletRequested: jest.fn(),
      onExceptionCaptured: jest.fn(),
      walletPinChanged: jest.fn(),
      shieldedViewUnlockRequested: jest.fn(),
    };
    const screen = instantiate(PinScreen, props);

    await screen.dismiss(PIN);

    expect(props.startWalletRequested).toHaveBeenCalledWith({ words: 'seed words', pin: PIN });
    expect(props.shieldedViewUnlockRequested).not.toHaveBeenCalled();
    expect(props.walletPinChanged).not.toHaveBeenCalled();
  });
});
