/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  walletUtils,
  errors as hathorErrors,
  constants as hathorConstants,
} from '@hathor/wallet-lib';

import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { connect } from 'react-redux';
import { LOGIN_PROVIDER } from '@web3auth/auth';
import { t } from 'ttag';
import NewHathorButton from '../components/NewHathorButton';
import HathorHeader from '../components/HathorHeader';
import TextFmt from '../components/TextFmt';
import GoogleProviderIcon from '../components/Icons/GoogleProvider.icon';
import EmailProviderIcon from '../components/Icons/EmailProvider.icon';
import AppleProviderIcon from '../components/Icons/AppleProvider.icon';

import baseStyle from '../styles/init';
import { Link, str2jsx } from '../utils';

import { TERMS_OF_SERVICE_URL, PRIVACY_POLICY_URL, WEB3AUTH_FEATURE_TOGGLE } from '../constants';
import { web3authLogin, derivePublicKey, classifyWeb3AuthError, WEB3AUTH_ERROR_TYPES } from '../sagas/web3auth';
import Web3AuthErrorDialog from '../components/Web3AuthErrorDialog';
import { COLORS } from '../styles/themes';
import { SKIP_SEED_CONFIRMATION } from '../config';

class WelcomeScreen extends React.Component {
  state = { switchValue: false };

  style = ({ ...baseStyle,
    ...StyleSheet.create({
      switchView: {
        flexDirection: 'row',
      },
      switchText: {
        paddingLeft: 16,
        fontSize: 14,
        lineHeight: 18,
        flex: 1,
      },
    }) });

  toggleSwitch = (value) => {
    this.setState({ switchValue: value });
  }

  render() {
    return (
      <View style={{ flex: 1 }}>
        <HathorHeader withLogo />
        <View style={this.style.container}>
          <Text style={this.style.title}>{t`Welcome to Hathor Wallet!`}</Text>
          <View>
            <TextFmt style={this.style.text}>
              {t`This wallet is connected to the **mainnet**.`}
            </TextFmt>
            <Text style={this.style.text}>
              {t`A mobile wallet is not the safest place to store your tokens.
              So, we advise you to keep only a small amount of tokens here, such as pocket money.`}
            </Text>
            <Text style={this.style.text}>
              {str2jsx(
                t`For further information, check out our website |link:https://hathor.network/|.`,
                { link: (x, i) => <Link key={i} href='https://hathor.network/'>{x}</Link> }
              )}
            </Text>
          </View>
          <View style={this.style.switchView}>
            <Switch
              onValueChange={this.toggleSwitch}
              trackColor={{ true: COLORS.primary }}
              value={this.state.switchValue}
            />
            <Text style={this.style.switchText}>
              {str2jsx(
                t`I agree with the |link1:Terms of Service| and |link2:Privacy Policy| and understand the risks of using a mobile wallet`,
                {
                  link1: (x, i) => <Link key={i} href={TERMS_OF_SERVICE_URL}>{x}</Link>,
                  link2: (x, i) => <Link key={i} href={PRIVACY_POLICY_URL}>{x}</Link>
                }
              )}
            </Text>
          </View>
          <View style={this.style.buttonView}>
            <NewHathorButton
              disabled={!this.state.switchValue}
              onPress={() => this.props.navigation.navigate('InitialScreen')}
              title={t`Start`}
            />
          </View>
        </View>
      </View>
    );
  }
}

class InitialScreen extends React.Component {
  state = {
    web3authErrorType: null,
    web3authOriginalError: null,
  };

  style = ({ ...baseStyle,
    ...StyleSheet.create({
      socialRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 16,
        gap: 8,
      },
      providerCard: {
        flex: 1,
        height: 56,
        borderWidth: 1,
        borderColor: '#ece5f8',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.white,
      },
      orRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 0,
        marginBottom: 16,
      },
      orLine: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.borderColorMid,
      },
      orText: {
        marginHorizontal: 12,
        fontSize: 14,
        color: COLORS.midContrastDetail,
        fontWeight: '600',
        textTransform: 'uppercase',
      },
    }) });

  handleSocialLogin = async (loginProvider) => {
    try {
      let extraLoginOptions = {};
      if (loginProvider === LOGIN_PROVIDER.EMAIL_PASSWORDLESS) {
        // For email passwordless, Web3Auth requires login_hint (the email)
        const testEmail = 'test_account_5041@example.com'; // Web3Auth test account (OTP: 973012)
        extraLoginOptions = { login_hint: testEmail };
      }
      const { privateKey, email } = await web3authLogin(
        loginProvider,
        this.props.hathorNetwork,
        extraLoginOptions,
      );
      const publicKey = derivePublicKey(privateKey);

      this.props.navigation.navigate('Web3AuthRecoveryScreen', {
        privateKey,
        publicKey,
        web3authEmail: email,
        walletType: 'web3auth',
      });
    } catch (err) {
      const errorType = classifyWeb3AuthError(err);
      if (errorType === WEB3AUTH_ERROR_TYPES.USER_CANCELLED) {
        // Silent — user intentionally backed out of the OAuth flow.
        return;
      }
      this.setState({ web3authErrorType: errorType, web3authOriginalError: err });
    }
  };

  dismissWeb3AuthError = () => {
    this.setState({ web3authErrorType: null, web3authOriginalError: null });
  };

  retryWeb3AuthLogin = () => {
    this.dismissWeb3AuthError();
    // Only Google is currently wired up; Email and Apple cards are inert.
    // Retrying defaults to Google because that is the only provider that
    // could have produced the failure we are recovering from.
    this.handleSocialLogin(LOGIN_PROVIDER.GOOGLE);
  };

  render() {
    return (
      <View style={{ flex: 1 }}>
        <HathorHeader withLogo />
        <View style={this.style.container}>
          <Text style={this.style.title}>{t`To start,`}</Text>
          <TextFmt style={this.style.text}>
            {t`You need to **initialize your wallet**.`}
          </TextFmt>
          <TextFmt style={this.style.text}>
            {t`You can either **start a new wallet** or **import a wallet** that already exists.`}
          </TextFmt>
          <Text style={this.style.text}>
            {t`To import a wallet, you will need to provide your seed words.`}
          </Text>
          <View style={this.style.buttonView}>
            {this.props.web3authEnabled && (
              <>
                <View style={this.style.socialRow}>
                  <TouchableOpacity
                    style={this.style.providerCard}
                    onPress={() => this.handleSocialLogin(LOGIN_PROVIDER.GOOGLE)}
                  >
                    <GoogleProviderIcon size={24} />
                  </TouchableOpacity>
                  {/* TODO: WAITING OAUTH CLIENT TO BE DEFINED */}
                  <View style={this.style.providerCard}>
                    <EmailProviderIcon size={24} />
                  </View>
                  {/* TODO: WAITING OAUTH CLIENT TO BE DEFINED */}
                  <View style={this.style.providerCard}>
                    <AppleProviderIcon size={24} />
                  </View>
                </View>
                <View style={this.style.orRow}>
                  <View style={this.style.orLine} />
                  <Text style={this.style.orText}>{t`OR`}</Text>
                  <View style={this.style.orLine} />
                </View>
              </>
            )}
            <NewHathorButton
              onPress={() => this.props.navigation.navigate('LoadWordsScreen')}
              title={t`Import Wallet`}
              style={{ marginBottom: 16 }}
              secondary
            />
            <NewHathorButton
              onPress={() => this.props.navigation.navigate('NewWordsScreen')}
              title={t`New Wallet`}
            />
          </View>
        </View>
        <Web3AuthErrorDialog
          errorType={this.state.web3authErrorType}
          onRetry={this.retryWeb3AuthLogin}
          onCancel={this.dismissWeb3AuthError}
          originalError={this.state.web3authOriginalError}
        />
      </View>
    );
  }
}

const mapInitialStateToProps = (state) => ({
  web3authEnabled: !!state.featureToggles[WEB3AUTH_FEATURE_TOGGLE],
  hathorNetwork: state.networkSettings.network,
});

const ConnectedInitialScreen = connect(mapInitialStateToProps)(InitialScreen);

class NewWordsScreen extends React.Component {
  state = {
    words: walletUtils.generateWalletWords(hathorConstants.HD_WALLET_ENTROPY),
  };

  style = ({ ...baseStyle,
    ...StyleSheet.create({
      row: {
        flexDirection: 'row',
        flex: 0.5,
      },
      item: {
        flex: 1,
      },
      itemNumber: {
        fontSize: 14,
      },
      itemText: {
        color: COLORS.textColor,
        fontSize: 18,
      },
    }) });

  render() {
    const wordsArr = this.state.words ? this.state.words.split(' ') : [];
    const wordsPerRow = 2;

    const navigateToNextStep = () => {
      const nextStep = SKIP_SEED_CONFIRMATION ? 'ChoosePinScreen' : 'BackupWords';

      this.props.navigation.navigate(nextStep, {
        words: this.state.words,
      })
    };

    const renderWords = () => {
      const data = [];

      for (let i = 0; i < wordsArr.length / wordsPerRow; i += 1) {
        data.push(renderWordsRow(i));
      }
      return data;
    };

    const renderWordsRow = (index) => {
      const startIndex = index * wordsPerRow;
      const wordsToRender = wordsArr.slice(startIndex, startIndex + wordsPerRow);

      const rows = wordsToRender.map((word, idx) => {
        const realIndex = startIndex + idx + 1;
        return (
          <View key={`word-${realIndex}`} style={this.style.item}>
            <Text>
              <Text style={this.style.itemNumber}>
                {realIndex}.
              </Text>
              <Text style={this.style.itemText}> {word}</Text>
            </Text>
          </View>
        );
      });

      return (
        <View key={`row-${index}`} style={this.style.row}>
          {rows}
        </View>
      );
    };

    return (
      <View style={{ flex: 1 }}>
        <HathorHeader
          withLogo
          onBackPress={() => this.props.navigation.goBack()}
        />
        <View style={this.style.container}>
          <View>
            <Text style={this.style.title}>{t`Your wallet has been created!`}</Text>
            <TextFmt style={this.style.text}>
              {t`You must **do a backup** and save the words below **in the same order they appear**.`}
            </TextFmt>
          </View>
          {renderWords()}
          <View style={this.style.buttonView}>
            <NewHathorButton
              onPress={navigateToNextStep}
              title={t`Next`}
            />
          </View>
        </View>
      </View>
    );
  }
}

/**
 * Handles the validation of the raw seed words input
 * @param {string} rawWords String containing all the words written by the user
 * @returns {{words: string[], errorMessage: string, isValid: boolean}}
 */
function handleValidWords(rawWords) {
  let trimmedWordsStr = rawWords.trim(/\s+/);
  let errorMessage = '';
  let isValid = false;

  try {
    const { valid, words } = walletUtils.wordsValid(trimmedWordsStr);
    trimmedWordsStr = words;
    isValid = valid;
  } catch (e) {
    // Handling unknown errors
    if (!(e instanceof hathorErrors.InvalidWords)) {
      throw e;
    }

    // Handling Invalid Words errors
    isValid = false;
    errorMessage = e.message;
    const listOfInvalidWords = e.invalidWords.filter((word) => word.length !== 0);
    if (listOfInvalidWords.length > 0) {
      errorMessage = `${errorMessage} List of invalid words: ${e.invalidWords.join(', ')}.`;
    }
  }
  const wordsArr = trimmedWordsStr.split(/\s+/);
  const nonEmptyWords = wordsArr.filter((word) => word.length !== 0);
  const lowercaseWords = nonEmptyWords.map((word) => word.toLowerCase());

  return {
    words: lowercaseWords,
    errorMessage,
    isValid,
  }
}

class LoadWordsScreen extends React.Component {
  /**
   * State for the import wallet words screen
   * @type {{rawWords: '', words: string[], errorMessage: string, isValid: boolean}}
   */
  state = {
    rawWords: '',
    words: [],
    errorMessage: '',
    isValid: false,
  };

  numberOfWords = 24;

  style = ({ ...baseStyle,
    ...StyleSheet.create({
      inputView: {
        marginTop: 16,
        marginBottom: 16,
      },
      label: {
        fontSize: 12,
        color: COLORS.textColorShadow,
        marginTop: 8,
        marginBottom: 8,
      },
      input: {
        fontSize: 16,
        lineHeight: 24,
        borderColor: COLORS.borderColor,
        borderBottomWidth: 1,
      },
    }) });

  onChangeText = (text) => {
    const { words, isValid, errorMessage } = handleValidWords(text);
    this.setState({
      rawWords: text,
      words,
      errorMessage,
      isValid,
    });
  }

  loadClicked = () => {
    Keyboard.dismiss();
    const { rawWords } = this.state;
    const { isValid, errorMessage, words } = handleValidWords(rawWords);

    if (isValid) {
      this.props.navigation.navigate('ChoosePinScreen', { words: words.join(' ') });
    } else {
      this.setState({ errorMessage });
    }
  }

  render() {
    return (
      <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <HathorHeader
            withLogo
            onBackPress={() => this.props.navigation.goBack()}
          />
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={this.style.container}>
              <Text style={this.style.title}>{t`To import a wallet,`}</Text>
              <TextFmt style={this.style.text}>
                {t`You need to **write down the ${this.numberOfWords} seed words** of your wallet, separated by space.`}
              </TextFmt>
              <View style={this.style.inputView}>
                <Text style={this.style.label}>{t`Words`}</Text>
                <TextInput
                  style={this.style.input}
                  textAlignVertical='top'
                  onChangeText={this.onChangeText}
                  placeholder={t`Enter your seed words separated by space`}
                  multiline
                  maxHeight='80%'
                  keyboardAppearance='dark'
                  returnKeyType='done'
                  enablesReturnKeyAutomatically
                  autoFocus
                  onSubmitEditing={this.loadClicked}
                  blurOnSubmit
                  inputMode='text'
                  secureTextEntry
                  autoCorrect={false}
                  autoComplete='off'
                  // ios only
                  spellCheck={false}
                  // android only
                  importantForAutofill='no'
                />
                <Text style={this.style.label}>
                  {this.state.words.length}
                  /
                  {this.numberOfWords}
                </Text>
                <Text style={{ color: COLORS.errorTextColor }}>{this.state.errorMessage}</Text>
              </View>
              <View style={this.style.buttonView}>
                <NewHathorButton
                  onPress={this.loadClicked}
                  disabled={!this.state.isValid}
                  title={t`Next`}
                  style={{ marginTop: 8 }}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </KeyboardAvoidingView>
    );
  }
}

export {
  WelcomeScreen, ConnectedInitialScreen as InitialScreen, LoadWordsScreen, NewWordsScreen,
};
