/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { t } from 'ttag';
import _ from 'lodash';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import NewHathorButton from '../components/NewHathorButton';
import HathorHeader from '../components/HathorHeader';
import FeedbackModal from '../components/FeedbackModal';
import checkIcon from '../assets/images/icCheckBig.png';
import errorIcon from '../assets/images/icErrorBig.png';

import baseStyle from '../styles/init';

import { PRIMARY_COLOR } from '../constants';
import { Strong } from '../utils';


class BackupWords extends React.Component {
  /**
   * step {number} Which validation step user is
   * indexes {Array} Array of indexes that will be used to execute the validation
   * wordsOptions {Array} For each step we have some options for the user to choose the correct word
   * modal {FeedbackModal} modal to display. If null, do not display
   */
  state = {
    step: 0,
    indexes: [],
    wordOptions: [],
    modal: null,
  };

  style = Object.assign({}, baseStyle, StyleSheet.create({
    footerView: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    past: {
      backgroundColor: '#000',
    },
    current: {
      backgroundColor: PRIMARY_COLOR,
    },
    future: {
      backgroundColor: '#000',
      opacity: 0.3,
    },
    lastView: {
      marginRight: 0,
    },
    button: {
      marginBottom: 16,
    },
  }));

  // Array of words shown on the previous screen
  words = null;

  /**
   * Expects 'words' as navigation parameter with all generated words as a string separated by space
   */
  constructor(props) {
    super(props);
    const paramWords = this.props.navigation.getParam('words');
    this.words = paramWords ? paramWords.split(' ') : [];
  }

  componentDidMount() {
    // Get 5 random indexes of word to check backup
    const indexesArr = Array(24).fill().map((v, i) => i + 1);
    const indexesToBackup = _.shuffle(indexesArr).slice(0, 5);
    this.setState({ indexes: indexesToBackup }, () => {
      this.updateWordsShownOnScreen();
    });
  }

  /**
   * Update state with options to be shown to the user depending on the step
   * If the step is the word in position 4, we must show the words in position 2, 3, 4, 5, 6
   * If we get one of the corner cases
   * (positions 1, 2, 23, or 24 we expand to the side we still have words) e.g., if we want to
   * validate word in position 2, we must have 5 options.
   * Positions 1, 2, 3, 4, 5 (the position 0 is substituted by position 5)
   */
  updateWordsShownOnScreen = () => {
    const index = this.state.indexes[this.state.step] - 1;
    let optionsStartIndex = index - 2;
    let optionsEndIndex = index + 2;

    // If index is 0 or 1, startIndex would be negative
    // So we set start to 0 and end to 4
    if (optionsStartIndex < 0) {
      optionsStartIndex = 0;
      optionsEndIndex = optionsStartIndex + 4;
    }

    // If index is 22 or 23, endIndex would be greater than the max
    // So we set to the max and decrease the startIndex
    const maxIndex = this.words.length - 1;
    if (optionsEndIndex > maxIndex) {
      optionsEndIndex = maxIndex;
      optionsStartIndex = maxIndex - 4;
    }

    const options = this.words.slice(optionsStartIndex, optionsEndIndex + 1);
    this.setState({ wordOptions: _.shuffle(options) });
  }

  /**
   * Method called after user selects a word
   * If is the wrong word we show an error and go back to the words screen
   * If is correct we move one step until the last one.
   * In case of the last step we show success and redirect to the ChoosePin screen
   *
   * @param {String} word Word of the button clicked
   */
  wordSelected = (word) => {
    const index = this.state.indexes[this.state.step];
    if (this.words[index - 1] === word) {
      if (this.state.step < 4) {
        // Correct word was chosen, move one step
        this.setState((prevState) => ({ step: prevState.step + 1 }), () => {
          this.updateWordsShownOnScreen();
        });
      } else {
        // Success
        this.setState({
          modal:
            // eslint-disable-next-line react/jsx-indent
            <FeedbackModal
              icon={<Image source={checkIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />}
              text={
                <Text>{t`Words saved correctly`}</Text>
              }
              onDismiss={() => {
                this.setState({ modal: null }, () => {
                  this.props.navigation.navigate('ChoosePinScreen', { words: this.props.navigation.getParam('words') });
                });
              }}
            />,
        });
      }
    } else {
      // Error, incorrect word was chosen
      this.setState({
        modal:
          // eslint-disable-next-line react/jsx-indent
          <FeedbackModal
            icon={<Image source={errorIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />}
            text={(
              <Text>
                <Strong>Wrong word.</Strong>
                Please double check the words you saved and start the process again.
              </Text>
)}
            onDismiss={() => {
              this.setState({ modal: null }, () => {
                this.props.navigation.goBack();
              });
            }}
          />,
      });
    }
  }

  render() {
    const renderOptions = () => this.state.wordOptions.map((word) => (
      <NewHathorButton
        key={word}
        style={this.style.button}
        secondary
        title={word}
        onPress={() => this.wordSelected(word)}
      />
    ));

    const renderFooter = () => {
      const viewArr = [];
      for (let i = 0; i < this.state.indexes.length; i += 1) {
        const styles = [this.style.footerView];
        if (i === this.state.step) {
          styles.push(this.style.current);
        } else if (i < this.state.step) {
          styles.push(this.style.past);
        } else {
          styles.push(this.style.future);
        }

        if (i === this.state.indexes.length - 1) {
          styles.push(this.style.lastView);
        }

        viewArr.push(<View key={i} style={styles} />);
      }

      return (
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' }}>
          {viewArr}
        </View>
      );
    };

    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          onBackPress={() => this.props.navigation.goBack()}
        />
        <ScrollView>
          {this.state.modal}
          <View style={[this.style.container, { flexDirection: 'column', justifyContent: 'space-between' }]}>
            <View>
              <Text style={this.style.title}>{t`To make sure you saved,`}</Text>
              <Text style={this.style.text}>
                {t`Please select the word that corresponds to the number below:`}
              </Text>
              <Text style={[this.style.title, { textAlign: 'center', fontSize: 24 }]}>
                {this.state.indexes[this.state.step]}
              </Text>
            </View>
            <View style={{ flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
              {renderOptions()}
            </View>
            {renderFooter()}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
}

export default BackupWords;
