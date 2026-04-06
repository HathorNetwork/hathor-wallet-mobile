/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  ActivityIndicator, Image, StyleSheet, Text, View,
} from 'react-native';
import { t } from 'ttag';
import NewHathorButton from './NewHathorButton';
import HathorModal from './HathorModal';
import { COLORS } from '../styles/themes';
import checkIcon from '../assets/images/icCheckBig.png';
import errorIcon from '../assets/images/icErrorBig.png';

/**
 * @param {Object} props
 * @param {string} props.status - Current import status
 * @param {Function} props.onDismiss - Called when "SEE ALL TOKENS" is pressed (success)
 * @param {Function} props.onRetry - Called when "TRY AGAIN" is pressed (error)
 */

export const ImportTokensModalState = {
  IDLE: 'idle',
  IMPORTING: 'importing',
  SUCCESS: 'success',
  ERROR: 'error',
};

const ImportTokensModal = ({ status, onDismiss, onRetry }) => {
  const renderContent = () => {
    if (status === ImportTokensModalState.IMPORTING) {
      return (
        <>
          <ActivityIndicator size='large' color={COLORS.textColor} />
          <Text style={styles.messageText}>{t`Adding tokens...`}</Text>
        </>
      );
    }

    if (status === ImportTokensModalState.SUCCESS) {
      return (
        <>
          <Image
            source={checkIcon}
            style={styles.icon}
            resizeMode='contain'
          />
          <Text style={styles.messageText}>{t`New tokens added!`}</Text>
          <View style={styles.actionContainer}>
            <NewHathorButton
              discrete
              title={t`See all tokens`}
              onPress={onDismiss}
            />
          </View>
        </>
      );
    }

    // Error state
    return (
      <>
        <Image
          source={errorIcon}
          style={styles.icon}
          resizeMode='contain'
        />
        <Text style={styles.messageText}>{t`Add tokens failed`}</Text>
        <View style={styles.actionContainer}>
          <NewHathorButton
            discrete
            title={t`Try again`}
            onPress={onRetry}
          />
        </View>
      </>
    );
  };

  const handleDismiss = () => {
    if (status === ImportTokensModalState.SUCCESS && onDismiss) {
      onDismiss();
    } else if (status === ImportTokensModalState.ERROR && onRetry) {
      onRetry();
    }
  };

  return (
    <HathorModal onDismiss={handleDismiss}>
      {renderContent()}
    </HathorModal>
  );
};

const styles = StyleSheet.create({
  icon: {
    height: 105,
    width: 105,
  },
  messageText: {
    fontSize: 18,
    lineHeight: 21,
    paddingTop: 36,
    textAlign: 'center',
    color: COLORS.textColor,
  },
  actionContainer: {
    width: '100%',
    paddingTop: 8,
  },
});

export default ImportTokensModal;
