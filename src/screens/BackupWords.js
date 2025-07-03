/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect } from 'react';
import { t } from 'ttag';
import _ from 'lodash';
import {
  Image,
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

import { Strong } from '../utils';
import { COLORS } from '../styles/themes';

const BackupWords = ({ navigation, route }) => {
  // State management
  const [step, setStep] = useState(0);
  const [indexes, setIndexes] = useState([]);
  const [wordOptions, setWordOptions] = useState([]);
  const [successModal, setSuccessModal] = useState(false);
  const [failureModal, setFailureModal] = useState(false);

  // Parse words from navigation parameters
  const paramWords = route.params.words.split(' ') ?? [];
  const words = paramWords.map((word, id) => ({ word, id }));

  // Styles
  const styles = {
    ...baseStyle,
    ...StyleSheet.create({
      footerView: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
      },
      past: {
        backgroundColor: COLORS.textColor,
      },
      current: {
        backgroundColor: COLORS.primary,
      },
      future: {
        backgroundColor: COLORS.textColor,
        opacity: 0.3,
      },
      lastView: {
        marginRight: 0,
      },
      button: {
        marginBottom: 16,
      },
    }),
  };

  /**
   * Update state with options to be shown to the user depending on the step
   * If the step is the word in position 4, we must show the words in position 2, 3, 4, 5, 6
   * If we get one of the corner cases
   * (positions 1, 2, 23, or 24 we expand to the side we still have words) e.g., if we want to
   * validate word in position 2, we must have 5 options.
   * Positions 1, 2, 3, 4, 5 (the position 0 is substituted by position 5)
   */
  const updateWordsShownOnScreen = (currentStep) => {
    const index = indexes[currentStep] - 1;
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
    const maxIndex = words.length - 1;
    if (optionsEndIndex > maxIndex) {
      optionsEndIndex = maxIndex;
      optionsStartIndex = maxIndex - 4;
    }

    const options = words.slice(optionsStartIndex, optionsEndIndex + 1);
    setWordOptions(_.shuffle(options));
  };

  /**
   * Method called after user selects a word
   * If is the wrong word we show an error and go back to the words screen
   * If is correct we move one step until the last one.
   * In case of the last step we show success and redirect to the ChoosePin screen
   *
   * @param {String} word Word of the button clicked
   */
  const wordSelected = (word) => {
    const index = indexes[step];
    if (words[index - 1].word === word) {
      if (step < 4) {
        // Correct word was chosen, move one step
        const nextStep = step + 1;
        setStep(nextStep);
        updateWordsShownOnScreen(nextStep);
      } else {
        setSuccessModal(true);
      }
    } else {
      // Error, incorrect word was chosen
      setFailureModal(true);
    }
  };

  // Initialize component on mount
  useEffect(() => {
    // Get 5 random indexes of word to check backup
    const indexesArr = Array(24).fill().map((v, i) => i + 1);
    const indexesToBackup = _.shuffle(indexesArr).slice(0, 5);
    setIndexes(indexesToBackup);
  }, []);

  // Update word options when indexes change
  useEffect(() => {
    if (indexes.length > 0) {
      updateWordsShownOnScreen(step);
    }
  }, [indexes, step]);

  const renderOptions = () => wordOptions.map(({ id, word }) => (
    <NewHathorButton
      key={id}
      style={styles.button}
      secondary
      title={word}
      onPress={() => wordSelected(word)}
    />
  ));

  const renderFooter = () => {
    const viewArr = [];
    for (let i = 0; i < indexes.length; i += 1) {
      const footerStyles = [styles.footerView];
      if (i === step) {
        footerStyles.push(styles.current);
      } else if (i < step) {
        footerStyles.push(styles.past);
      } else {
        footerStyles.push(styles.future);
      }

      if (i === indexes.length - 1) {
        footerStyles.push(styles.lastView);
      }

      viewArr.push(<View key={i} style={footerStyles} />);
    }

    return (
      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' }}>
        {viewArr}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <HathorHeader
        onBackPress={() => navigation.goBack()}
      />
      <View style={[styles.container, { flexDirection: 'column', justifyContent: 'space-between' }]}>
        <View>
          <Text style={styles.title}>{t`To make sure you saved,`}</Text>
          <Text style={styles.text}>
            {t`Please select the word that corresponds to the number below:`}
          </Text>
          <Text style={[styles.title, { textAlign: 'center', fontSize: 24 }]}>
            {indexes[step]}
          </Text>
        </View>
        <View style={{ flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
          {renderOptions()}
        </View>
        {renderFooter()}
      </View>
      {successModal && (
        <FeedbackModal
          icon={<Image source={checkIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />}
          text={<Text>{t`Words saved correctly`}</Text>}
          onDismiss={() => {
            setSuccessModal(false);
          }}
        />
      )}
      {failureModal && (
        <FeedbackModal
          icon={<Image source={errorIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />}
          text={(
            <Text>
              <Strong>{t`Wrong word.`} </Strong>
              {t`Please double check the words you saved and start the process again.`}
            </Text>
          )}
          onDismiss={() => {
            setFailureModal(false);
            navigation.goBack();
          }}
        />
      )}
    </View>
  );
};

export default BackupWords;
