/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Image,
  SafeAreaView,
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

import { HATHOR_COLOR } from '../constants';
import { Strong } from '../utils';

import _ from 'lodash';


class BackupWords extends React.Component {
  /**
   * modal {FeedbackModal} modal to display. If null, do not display
   * }
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
      backgroundColor: HATHOR_COLOR,
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

  words = null;

  constructor(props) {
    super(props);
    const paramWords = this.props.navigation.getParam('words');
    this.words = paramWords ? paramWords.split(' ') : [];
  }

  componentDidMount() {
    // Get 5 random indexes of word to check backup
    const indexesArr = Array(24).fill().map((v,i)=>i+1);
    const indexesToBackup = _.shuffle(indexesArr).slice(0, 5);
    this.setState({ indexes: indexesToBackup }, () => {
      this.updateWordOptions();
    });
  }

  updateWordOptions = () => {
    const index = this.state.indexes[this.state.step] - 1;
    let optionsStartIndex = index - 2;
    let optionsEndIndex = index + 2;

    // If index is 0 or 1, startIndex would be negative
    // So we set to 0 and increment the endIndex
    if (optionsStartIndex < 0) {
      optionsEndIndex = optionsEndIndex + (-optionsStartIndex);
      optionsStartIndex = 0;
    }

    // If index is 22 or 23, endIndex would be greater than the max
    // So we set to the max and decrease the startIndex
    const maxIndex = this.words.length - 1;
    if (optionsEndIndex > maxIndex) {
      optionsStartIndex = optionsStartIndex - (optionsEndIndex - maxIndex);
      optionsEndIndex = maxIndex;
    }

    const options = this.words.slice(optionsStartIndex, optionsEndIndex + 1)
    this.setState({ wordOptions: _.shuffle(options) });
  }

  wordSelected = (word) => {
    const index = this.state.indexes[this.state.step];
    if (this.words[index - 1] === word) {
      if (this.state.step < 4) {
        // Move one step
        this.setState({ step: this.state.step + 1 }, () => {
          this.updateWordOptions();
        });
      } else {
        // Success
        this.setState({
          modal:
            // eslint-disable-next-line react/jsx-indent
            <FeedbackModal
              icon={<Image source={checkIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />}
              text={
                <Text>Words saved correctly</Text>
              }
              onDismiss={() => {
                this.setState({ modal: null }, () => {
                  this.props.navigation.navigate('ChoosePinScreen', { words: this.props.navigation.getParam('words') })
                })
              }}
            />,
        });
      }
    } else {
      // Error
      this.setState({
        modal:
          // eslint-disable-next-line react/jsx-indent
          <FeedbackModal
            icon={<Image source={errorIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />}
            text={
              <Text><Strong>Wrong word.</Strong> Please double check the words you saved and start the process again.</Text>
            }
            onDismiss={() => {
              this.setState({ modal: null }, () => {
                this.props.navigation.goBack()
              });
            }}
          />,
      });
    }
  }

  render() {
    const renderOptions = () => {
      return this.state.wordOptions.map((word, index) => (
        <NewHathorButton key={index} style={this.style.button} secondary title={word} onPress={() => this.wordSelected(word)} />
      ));
    }

    const renderFooter = () => {
      const viewArr = [];
      for (let i=0; i<this.state.indexes.length; i++) {
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

        viewArr.push(<View key={i} style={styles} />)
      }

      return (
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' }}>
          {viewArr}
        </View>
      )
    }

    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          onBackPress={() => this.props.navigation.goBack()}
        />
        {this.state.modal}
        <View style={[this.style.container, {flexDirection: 'column', justifyContent: 'space-between'}]}>
          <View>
            <Text style={this.style.title}>To make sure you saved,</Text>
            <Text style={this.style.text}>Please select the word that corresponds to the number below:</Text>
            <Text style={[this.style.title, { textAlign: 'center', fontSize: 24 }]}>{this.state.indexes[this.state.step]}</Text>
          </View>
          <View style={{ flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
            {renderOptions()}
          </View>
          {renderFooter()}
        </View>
      </SafeAreaView>
    );
  }
}

export default BackupWords;