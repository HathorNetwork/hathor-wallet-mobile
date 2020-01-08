/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import hathorLib from '@hathor/wallet-lib';
import Mnemonic from 'bitcore-mnemonic';

import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  SafeAreaView,
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
import { Link } from '../utils';

import { HATHOR_COLOR } from '../constants';

class WelcomeScreen extends React.Component {
  state = { switchValue: false };

  style = Object.assign({}, baseStyle, StyleSheet.create({
    switchView: {
      flexDirection: 'row',
    },
    switchText: {
      paddingLeft: 16,
      fontSize: 14,
      lineHeight: 18,
      flex: 1,
    },
  }));

  toggleSwitch = (value) => {
    this.setState({ switchValue: value });
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1 }}>
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
              {t`For further information, check our website `}
              <Link href='https://hathor.network'>https://hathor.network/</Link>
              .
            </Text>
          </View>
          <View style={this.style.switchView}>
            <Switch
              onValueChange={this.toggleSwitch}
              trackColor={{ true: HATHOR_COLOR }}
              value={this.state.switchValue}
            />
            <Text style={this.style.switchText}>
              {t`I understand the risks of using a mobile wallet`}
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
      </SafeAreaView>
    );
  }
}

class InitialScreen extends React.Component {
  style = Object.assign({}, baseStyle);

  render() {
    return (
      <SafeAreaView style={{ flex: 1 }}>
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
      </SafeAreaView>
    );
  }
}

class NewWordsScreen extends React.Component {
  state = {
    words: hathorLib.wallet.generateWalletWords(hathorLib.constants.HD_WALLET_ENTROPY),
  };

  style = Object.assign({}, baseStyle, StyleSheet.create({
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
      color: '#000',
      fontSize: 18,
    },
  }));

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
      <SafeAreaView style={{ flex: 1 }}>
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
      </SafeAreaView>
    );
  }
}

class LoadWordsScreen extends React.Component {
  state = {
    words: '',
    errorMessage: '',
    isValid: false,
  };

  wordlist = Mnemonic.Words.ENGLISH;

  numberOfWords = 24;

  style = Object.assign({}, baseStyle, StyleSheet.create({
    inputView: {
      marginTop: 16,
      marginBottom: 16,
    },
    label: {
      fontSize: 12,
      color: 'rgba(0, 0, 0, 0.5)',
      marginTop: 8,
      marginBottom: 8,
    },
    input: {
      fontSize: 16,
      lineHeight: 24,
      borderColor: '#EEEEEE',
      borderBottomWidth: 1,
    },
  }));

  onChangeText = (text) => {
    const words = text.trim().split(' ');
    const nonEmptyWords = words.filter((value) => value.length !== 0);
    const errorList = [];

    for (let i = 0; i < nonEmptyWords.length; i += 1) {
      const w = nonEmptyWords[i];
      if (this.wordlist.indexOf(w.toLowerCase()) < 0) {
        errorList.push(w);
      }
    }

    let errorMessage = '';
    let isValid = false;
    if (errorList.length > 0) {
      errorMessage = `Invalid words: ${errorList.join(' ')}`;
    } else if (nonEmptyWords.length === this.numberOfWords) {
      isValid = true;
    } else if (nonEmptyWords.length > this.numberOfWords) {
      errorMessage = 'Too many words.';
    }

    this.setState({
      words: nonEmptyWords,
      errorMessage,
      isValid,
    });
  }

  loadClicked = () => {
    Keyboard.dismiss();
    const words = this.state.words.join(' ');
    this.setState({ errorMessage: '' });
    const result = hathorLib.wallet.wordsValid(words);
    if (result.valid) {
      this.props.navigation.navigate('ChoosePinScreen', { words });
    } else {
      this.setState({ errorMessage: result.message });
    }
  }

  render() {
    return (
      <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
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
                  keyboardAppearance='dark'
                  returnKeyType='done'
                  enablesReturnKeyAutomatically
                  autoFocus
                  onSubmitEditing={this.loadClicked}
                  blurOnSubmit
                />
                <Text style={this.style.label}>
                  {this.state.words.length}
/
                  {this.numberOfWords}
                </Text>
              </View>
              <Text style={{ color: 'red' }}>{this.state.errorMessage}</Text>
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
        </SafeAreaView>
      </KeyboardAvoidingView>
    );
  }
}

export {
  WelcomeScreen, InitialScreen, LoadWordsScreen, NewWordsScreen,
};
