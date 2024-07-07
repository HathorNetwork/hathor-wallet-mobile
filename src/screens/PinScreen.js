/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import { t } from 'ttag';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BackHandler, Keyboard, Text, View } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { walletUtils, cryptoUtils } from '@hathor/wallet-lib';
import SimpleButton from '../components/SimpleButton';
import PinInput from '../components/PinInput';
import Logo from '../components/Logo';
import { isBiometryEnabled, getSupportedBiometry } from '../utils';
import {
  unlockScreen as unlockScreenAction,
  startWalletRequested as startWalletRequestedAction,
  resetOnLockScreen as resetOnLockScreenAction,
  onExceptionCaptured,
} from '../actions';
import { PIN_SIZE } from '../constants';
import { COLORS } from '../styles/themes';
import { STORE } from '../store';
import baseStyle from '../styles/init';

export default function PinScreen({ isLockScreen }) {
  const wallet = useSelector((state) => state.wallet);

  const route = useRoute();
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const unlockScreen = () => dispatch(unlockScreenAction());
  const resetOnLockScreen = () => dispatch(resetOnLockScreenAction());
  const startWalletRequested = (payload) => dispatch(startWalletRequestedAction(payload));

  const [pin, setPin] = useState('');
  const [pinColor, setPinColor] = useState(COLORS.textColor);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(false);

  let focusEvent = null;
  let canCancel = false;
  let screenText = t`Enter your PIN Code `;
  let biometryText = t`Unlock Hathor Wallet`;

  if (!isLockScreen) {
    canCancel = route.params.canCancel ?? canCancel;
    screenText = route.params.screenText ?? screenText;
    biometryText = route.params.biometryText ?? biometryText;
  }

  useEffect(() => {
    // If the keyboard is being shown, hide it. This screen's keyboard is built differently
    Keyboard.dismiss();

    const supportedBiometry = getSupportedBiometry();
    const biometryEnabled = isBiometryEnabled();
    if (supportedBiometry && biometryEnabled) {
      askBiometricId();
    }

    if (!canCancel) {
      // If can't cancel this screen, we must remove the hardware back from android
      BackHandler.addEventListener('hardwareBackPress', handleBackButton);
    }

    focusEvent = navigation.addListener('focus', () => {
      // Ensure the keyboard is hidden when the screen is focused, even if it was already mounted
      Keyboard.dismiss();
      // Clear the pin
      setPin('');
      setPinColor(COLORS.textColor);
      setError(null);
    });

    return () => {
      if (!canCancel) {
        // Removing event listener
        BackHandler.removeEventListener(
          'hardwareBackPress',
          handleBackButton,
        );
      }

      // Removing focus event
      focusEvent();
    };
  }, []);

  useEffect(() => {
    let timer;
    if (removing && pin.length > 0) {
      timer = setTimeout(() => {
        setPin((prevPin) => prevPin.slice(0, -1));
      }, 25);
    }

    if (pin.length === 0 && removing) {
      setRemoving(false);
      setError(t`Incorrect PIN Code. Try again.`);
    }

    return () => clearTimeout(timer); // Cleanup timeout
  }, [pin, removing]);

  const startRemovingChars = () => {
    setRemoving(true);
    setPinColor(COLORS.errorBgColor);
  };

  const handleBackButton = () => true;

  const askBiometricId = async () => {
    try {
      /* getGenericPassword will return either `false` or UserCredentials:
       *
       * interface UserCredentials extends Result {
       *   username: string;
       *   password: string;
       * }
       */
      const credentials = await Keychain.getGenericPassword({
        authenticationPrompt: { title: biometryText },
      });

      if (credentials !== false) {
        dismiss(credentials.password);
      }
    } catch (e) {
      // No need to do anything here as the user can type his PIN
    }
  };

  const validatePin = async (inputPin) => {
    try {
      // Validate if we are able to decrypt the seed using this PIN
      // this will throw if the words are not able to be decoded with this
      // pin.

      // This will return either the old or the new access data.
      // We can ignore which one it is since we will only use the words which is present on both.
      const { accessData } = await STORE.getAvailableAccessData();

      if (!accessData) {
        // The wallet does not have an access data, we can't unlock it
        // This should not happen since we check if the wallet is initialized
        // before showing the unlock screen, but we will handle it anyway
        dispatch(onExceptionCaptured(
          new Error(
            "Attempted to unlock wallet but it wasn't initialized.",
          ),
          true, // Fatal since we can't start the wallet
        ));
        return;
      }

      let wordsEncryptedData = accessData.words;
      if (!accessData.words.data) {
        // This is from a previous version
        // We need aditional data to check pin
        wordsEncryptedData = {
          data: accessData.words,
          hash: accessData.hashPasswd,
          salt: accessData.saltPasswd,
          iterations: accessData.hashIterations,
          pbkdf2Hasher: accessData.pbkdf2Hasher,
        };
      }
      const pinCorrect = cryptoUtils.checkPassword(wordsEncryptedData, inputPin);

      if (!pinCorrect) {
        startRemovingChars();
        return;
      }

      const words = cryptoUtils.decryptData(wordsEncryptedData, inputPin);
      // Will throw InvalidWords if the seed is invalid
      walletUtils.wordsValid(words);
    } catch (e) {
      dispatch(onExceptionCaptured(
        new Error('User inserted a valid PIN but the app wasn\'t able to decrypt the words'),
        true, // Fatal since we can't start the wallet
      ));

      return;
    }

    // Inserted PIN was able to decrypt the words successfully
    dismiss(inputPin);
  };

  const onChangeText = (text) => {
    if (text.length > PIN_SIZE) {
      return;
    }

    if (text.length === PIN_SIZE) {
      setTimeout(() => validatePin(text), 300);
    }

    setPin(text);
    setPinColor(COLORS.textColor);
    setError(null);
  };

  const dismiss = async (inputPin) => {
    if (isLockScreen) {
      // in case it's the lock screen, we just have to execute the data migration
      // method an change redux state. No need to execute callback or go back on navigation
      await STORE.handleDataMigration(inputPin);
      if (!wallet) {
        // We have already made sure we have an available accessData
        // The handleDataMigration method ensures we have already migrated if necessary
        // This means the wallet is loaded and the access data is ready to be used.

        const words = await STORE.getWalletWords(inputPin);
        startWalletRequested({ words, pin: inputPin });
      }

      unlockScreen();
    } else {
      // dismiss the pin screen first because doing it after the callback can
      // end up dismissing the wrong screen
      navigation.goBack();

      // execute the callback passing the pin, if any cb was given
      const cb = route.params.cb ?? null;
      if (cb) {
        cb(pin);
      }
    }
  };

  const goToReset = () => resetOnLockScreen();

  const renderButton = () => {
    let title;
    let onPress;

    if (canCancel) {
      title = t`Cancel`;
      onPress = () => navigation.goBack();
    } else {
      title = t`Reset wallet`;
      onPress = () => goToReset();
    }

    return (
      <SimpleButton
        onPress={onPress}
        title={title}
        textStyle={{
          textTransform: 'uppercase',
          color: COLORS.textColorShadow,
          letterSpacing: 1,
          padding: 4,
        }}
        containerStyle={{ marginTop: 16, marginBottom: 8 }}
      />
    );
  };

  const renderPinDigits = () => (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          marginVertical: 16,
          alignItems: 'center',
          height: 21,
          width: 120,
        }}
      >
        <Logo style={{ height: 21, width: 120 }} />
      </View>
      <Text style={{ marginTop: 32, marginBottom: 16 }}>{screenText}</Text>
      <PinInput
        maxLength={PIN_SIZE}
        color={pinColor}
        value={pin}
        onChangeText={onChangeText}
        error={error}
      />
      {renderButton()}
    </View>
  );

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 16, // Padding ensures a homogeneous background color
        backgroundColor: baseStyle.container.backgroundColor,
      }}
    >
      {renderPinDigits()}
    </View>
  );
}
