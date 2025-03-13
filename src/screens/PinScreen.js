/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { connect } from 'react-redux';
import { t } from 'ttag';

import { BackHandler, Keyboard, Text, View, Image } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { walletUtils, cryptoUtils } from '@hathor/wallet-lib';
import SimpleButton from '../components/SimpleButton';
import PinInput from '../components/PinInput';
import Logo from '../components/Logo';
import { isBiometryEnabled, getSupportedBiometry, biometricsMigration } from '../utils';
import {
  lockScreen,
  unlockScreen,
  setLoadHistoryStatus,
  setTempPin,
  onStartWalletLock,
  startWalletRequested,
  resetOnLockScreen,
  onExceptionCaptured,
} from '../actions';
import { PIN_SIZE } from '../constants';
import { COLORS } from '../styles/themes';
import { SAFE_BIOMETRY_FEATURE_FLAG_KEY, STORE } from '../store';
import baseStyle from '../styles/init';
import Spinner from '../components/Spinner';
import FeedbackModal from '../components/FeedbackModal';
import errorIcon from '../assets/images/icErrorBig.png';
import { logger } from '../logger';
import Performance from '../utils/performance';

const log = logger('PIN_SCREEN');

/**
 * loadHistoryActive {bool} whether we still need to load history
 */
const mapStateToProps = (state) => ({
  loadHistoryActive: state.loadHistoryStatus.active,
  wallet: state.wallet,
});

const mapDispatchToProps = (dispatch) => ({
  unlockScreen: () => dispatch(unlockScreen()),
  lockScreen: () => dispatch(lockScreen()),
  resetOnLockScreen: () => dispatch(resetOnLockScreen()),
  setLoadHistoryStatus: (active, error) => dispatch(setLoadHistoryStatus(active, error)),
  setTempPin: (pin) => dispatch(setTempPin(pin)),
  onStartWalletLock: () => dispatch(onStartWalletLock()),
  startWalletRequested: (payload) => dispatch(startWalletRequested(payload)),
  onExceptionCaptured: (error, isFatal) => dispatch(onExceptionCaptured(error, isFatal)),
});

class PinScreen extends React.Component {
  static defaultProps = { isLockScreen: false };

  constructor(props) {
    super(props);
    /**
     * pin {string} Pin entered by the user
     * error {string} Error message (null if there's no error)
     */
    this.state = {
      pin: '',
      pinColor: COLORS.textColor,
      error: null,
      biometryFailed: false,
    };

    this.canCancel = false;
    this.screenText = t`Enter your PIN Code `;
    this.biometryText = t`Unlock Hathor Wallet`;
    if (!this.props.isLockScreen) {
      this.canCancel = props.route.params.canCancel ?? this.canCancel;
      this.screenText = props.route.params.screenText ?? this.screenText;
      this.biometryText = props.route.params.biometryText ?? this.biometryText;
      this.biometryLoadingText = props.route.params.biometryLoadingText ?? '';
    }
    this.useSafeBiometryFeature = STORE.getItem(SAFE_BIOMETRY_FEATURE_FLAG_KEY);
    this.biometryEnabled = isBiometryEnabled();

    this.focusEvent = null;
  }

  componentDidMount() {
    // If the keyboard is being shown, hide it. This screen's keyboard is built differently
    Keyboard.dismiss();

    const supportedBiometry = getSupportedBiometry();
    const biometryEnabled = isBiometryEnabled();
    if (supportedBiometry && biometryEnabled) {
      this.askBiometricId();
    }

    if (!this.canCancel) {
      // If can't cancel this screen, we must remove the hardware back from android
      BackHandler.addEventListener('hardwareBackPress', this.handleBackButton);
    }

    this.focusEvent = this.props.navigation.addListener('focus', () => {
      // Ensure the keyboard is hidden when the screen is focused, even if it was already mounted
      Keyboard.dismiss();
      // Clear the pin
      this.setState({ pin: '', pinColor: COLORS.textColor, error: null });
    });
  }

  componentWillUnmount() {
    if (!this.canCancel) {
      // Removing event listener
      BackHandler.removeEventListener(
        'hardwareBackPress',
        this.handleBackButton,
      );
    }

    // Removing focus event
    this.focusEvent();
  }

  handleBackButton = () => true;

  askBiometricId = async () => {
    try {
      /* getGenericPassword will return either `false` or UserCredentials:
       *
       * interface UserCredentials extends Result {
       *   username: string;
       *   password: string;
       * }
       */
      const credentials = await Keychain.getGenericPassword({
        authenticationPrompt: { title: this.biometryText },
      });

      if (credentials !== false) {
        this.dismiss(credentials.password);
      }
    } catch (e) {
      this.setState({ biometryFailed: true });
    }
  };

  dismiss = async (pin) => {
    if (this.props.isLockScreen) {
      // in case it's the lock screen, we just have to execute the data migration
      // method an change redux state. No need to execute callback or go back on navigation
      try {
        Performance.start('PIN_DATA_MIGRATION');
        await STORE.handleDataMigration(pin);
        const actualPin = await biometricsMigration(pin);
        Performance.end('PIN_DATA_MIGRATION');

        if (!this.props.wallet) {
          // We have already made sure we have an available accessData
          // The handleDataMigration method ensures we have already migrated if necessary
          // This means the wallet is loaded and the access data is ready to be used.
          Performance.start('PIN_GET_WALLET_WORDS');
          const words = await STORE.getWalletWords(actualPin);
          Performance.end('PIN_GET_WALLET_WORDS');

          Performance.start('PIN_START_WALLET_REQUEST');
          log.log('🔍 PROFILING: Dispatching startWalletRequested action');
          this.props.startWalletRequested({ words, pin: actualPin });
          Performance.end('PIN_START_WALLET_REQUEST');
        }
        this.props.unlockScreen();
      } catch (e) {
        log.error(e);
        this.props.onExceptionCaptured(
          e,
          true, // Fatal since we can't start the wallet
        );
      }
    } else {
      // dismiss the pin screen first because doing it after the callback can
      // end up dismissing the wrong screen
      this.props.navigation.goBack();
      // execute the callback passing the pin, if any cb was given
      const cb = this.props.route.params.cb ?? null;
      if (cb) {
        cb(pin);
      }
    }
  };

  onChangeText = (text) => {
    if (text.length > PIN_SIZE) {
      return;
    }

    if (text.length === PIN_SIZE) {
      setTimeout(() => this.validatePin(text), 300);
    }
    this.setState({ pin: text, pinColor: COLORS.textColor, error: null });
  };

  validatePin = async (pin) => {
    try {
      Performance.start('PIN_VALIDATION_TO_WALLET_START');
      log.log('🔍 PROFILING: Starting PIN validation');

      // Validate if we are able to decrypt the seed using this PIN
      // this will throw if the words are not able to be decoded with this
      // pin.

      // This will return either the old or the new access data.
      // We can ignore which one it is since we will only use the words which is present on both.
      Performance.start('PIN_GET_ACCESS_DATA');
      const { accessData } = await STORE.getAvailableAccessData();
      Performance.end('PIN_GET_ACCESS_DATA');

      if (!accessData) {
        // The wallet does not have an access data, we can't unlock it
        // This should not happen since we check if the wallet is initialized
        // before showing the unlock screen, but we will handle it anyway
        this.props.onExceptionCaptured(
          new Error(
            "Attempted to unlock wallet but it wasn't initialized.",
          ),
          true, // Fatal since we can't start the wallet
        );
        return;
      }

      Performance.start('PIN_CHECK_PASSWORD');
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
      const pinCorrect = cryptoUtils.checkPassword(wordsEncryptedData, pin);
      Performance.end('PIN_CHECK_PASSWORD');

      if (!pinCorrect) {
        this.removeOneChar();
        return;
      }

      Performance.start('PIN_DECRYPT_WORDS');
      const words = cryptoUtils.decryptData(wordsEncryptedData, pin);
      // Will throw InvalidWords if the seed is invalid
      walletUtils.wordsValid(words);
      Performance.end('PIN_DECRYPT_WORDS');

      Performance.end('PIN_VALIDATION_TO_WALLET_START');
      log.log('🔍 PROFILING: PIN validated successfully, starting wallet');
    } catch (e) {
      this.props.onExceptionCaptured(
        new Error(
          "User inserted a valid PIN but the app wasn't able to decrypt the words",
        ),
        true, // Fatal since we can't start the wallet
      );

      return;
    }

    // Inserted PIN was able to decrypt the words successfully
    this.dismiss(pin);
  };

  goToReset = () => {
    this.props.resetOnLockScreen();
  };

  /*
   * This function is used when coming back to lock screen from reset screen
   */
  backFromReset = () => {
    // set to same status as before
    this.props.setLoadHistoryStatus(this.props.loadHistoryActive, false);
    // show lock screen again
    this.props.lockScreen();
    // navigate to dashboard (will be hidden under lock screen)
    this.props.navigation.navigate('Dashboard');
  };

  removeOneChar = () => {
    const pin = this.state.pin.slice(0, -1);
    if (pin.length === 0) {
      this.setState({ pin: '', error: t`Incorrect PIN Code. Try again.` });
    } else {
      this.setState({ pin, pinColor: COLORS.errorBgColor });
      setTimeout(() => this.removeOneChar(), 25);
    }
  };

  render() {
    const renderBiometryRetryButton = () => (
      <SimpleButton
        onPress={() => this.askBiometricId()}
        title={t`Try again`}
        textStyle={{
          textAlign: 'center',
          textTransform: 'uppercase',
          color: COLORS.textColorShadow,
          letterSpacing: 1,
          padding: 4,
        }}
        containerStyle={{
          marginTop: 16,
          marginBottom: 16,
        }}
      />
    );

    const renderButton = () => {
      if ((!this.state.biometryFailed) && this.useSafeBiometryFeature && this.biometryEnabled) {
        // Biometry has not failed, so we should not show a cancellation button.
        return null;
      }
      const biometryFailed = this.state.biometryFailed
        && this.useSafeBiometryFeature
        && this.biometryEnabled;
      let title;
      let onPress;
      if (this.canCancel) {
        title = t`Cancel`;
        onPress = () => this.props.navigation.goBack();
      } else {
        title = t`Reset wallet`;
        onPress = () => this.goToReset();
      }

      return (
        <View
          style={{
            alignContent: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          {biometryFailed ? renderBiometryRetryButton() : null}
          <SimpleButton
            onPress={onPress}
            title={title}
            textStyle={{
              textAlign: 'center',
              textTransform: 'uppercase',
              color: COLORS.textColorShadow,
              letterSpacing: 1,
              padding: 4,
            }}
            containerStyle={{ marginTop: 16, marginBottom: 32 }}
          />
        </View>
      );
    };

    const renderBiometryErrorMessage = () => {
      if (this.props.isLockScreen) {
        return (<Text>{ t`Biometry failed or canceled.` }</Text>);
      }
      return (
        <FeedbackModal
          text={t`Biometry failed or canceled.`}
          onDismiss={() => this.props.navigation.goBack()}
          icon=<Image source={errorIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />
        />
      );
    };

    const safeBiometryMessage = () => (
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        { this.state.biometryFailed
          ? renderBiometryErrorMessage()
          : (
            <>
              <Text style={{ marginBottom: 16 }}>{ this.biometryLoadingText }</Text>
              <Spinner size={48} animating />
            </>
          )}
      </View>
    );

    const renderBody = () => {
      if (this.useSafeBiometryFeature && this.biometryEnabled) {
        // Safe biometry mode is enabled, we should not render the pin input.
        return safeBiometryMessage();
      }

      return (
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ marginTop: 32, marginBottom: 16 }}>{this.screenText}</Text>
          <PinInput
            maxLength={PIN_SIZE}
            color={this.state.pinColor}
            value={this.state.pin}
            onChangeText={this.onChangeText}
            error={this.state.error}
          />
        </View>
      );
    };

    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          paddingHorizontal: 16, // Padding ensures a homogeneous background color
          backgroundColor: baseStyle.container.backgroundColor,
          justifyContent: 'space-between',
        }}
      >
        <View
          style={{
            flex: 0.1,
            marginVertical: 16,
            alignItems: 'center',
            height: 21,
            width: 120,
          }}
        >
          <Logo style={{ height: 21, width: 120 }} />
        </View>
        <View
          style={{
            flex: 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {renderBody()}
        </View>
        <View
          style={{
            flex: 0.2,
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
          }}
        >
          {renderButton()}
        </View>
      </View>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(PinScreen);
