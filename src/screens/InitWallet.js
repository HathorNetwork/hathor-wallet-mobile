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
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { t } from 'ttag';
import NewHathorButton from '../components/NewHathorButton';
import HathorHeader from '../components/HathorHeader';
import TextFmt from '../components/TextFmt';

import baseStyle from '../styles/init';
import { Link, str2jsx } from '../utils';

import { TERMS_OF_SERVICE_URL, PRIVACY_POLICY_URL } from '../constants';
import { COLORS } from '../styles/themes';

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
  style = ({ ...baseStyle });

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
      </View>
    );
  }
}

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
              onPress={() => this.props.navigation.navigate('BackupWords', { words: this.state.words })}
              title={t`Next`}
            />
          </View>
        </View>
      </View>
    );
  }
}

class LoadWordsScreen extends React.Component {
  state = {
    words: '',
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
    const words = text.trim(/\s+/);
    let errorMessage = '';
    let isValid = false;
    if (words) {
      try {
        walletUtils.wordsValid(words);
        isValid = true;
      } catch (e) {
        if (e instanceof hathorErrors.InvalidWords) {
          errorMessage = e.message;
          if (e.invalidWords && e.invalidWords.length > 0) {
            errorMessage = `${errorMessage} List of invalid words: ${e.invalidWords.join(', ')}.`;
          }
        } else {
          throw e;
        }
      }
    }

    const wordsArr = words.split(/\s+/);
    const nonEmptyWords = wordsArr.filter((value) => value.length !== 0);
    const nonEmptyWordsLowerCase = nonEmptyWords.map((value) => value.toLowerCase());
    this.setState({
      words: nonEmptyWordsLowerCase,
      errorMessage,
      isValid,
    });
  }

  loadClicked = () => {
    Keyboard.dismiss();
    const words = this.state.words.join(' ');
    this.setState({ errorMessage: '' });
    const result = walletUtils.wordsValid(words);
    if (result.valid) {
      this.props.navigation.navigate('ChoosePinScreen', { words });
    } else {
      this.setState({ errorMessage: result.message });
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
  WelcomeScreen, InitialScreen, LoadWordsScreen, NewWordsScreen,
};
