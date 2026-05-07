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
import { TOKEN_IMPORT_MODAL_STATE } from '../constants';
import checkIcon from '../assets/images/icCheckBig.png';
import errorIcon from '../assets/images/icErrorBig.png';

/**
 * @param {Object} props
 * @param {string} props.status - Current import status
 * @param {Function} props.onDismiss - Called when "SEE ALL TOKENS" is pressed (success)
 * @param {Function} props.onRetry - Called when "TRY AGAIN" is pressed (error)
 */
const ImportTokensModal = ({ status, onDismiss, onRetry }) => {
  const renderContent = () => {
    // IDLE shares the spinner branch to avoid a one-frame flash of the error
    // UI between mount and the first IMPORTING dispatch.
    if (status === TOKEN_IMPORT_MODAL_STATE.IMPORTING
        || status === TOKEN_IMPORT_MODAL_STATE.IDLE) {
      return (
        <>
          <ActivityIndicator size='large' color={COLORS.textColor} />
          <Text style={styles.messageText}>{t`Adding tokens...`}</Text>
        </>
      );
    }

    if (status === TOKEN_IMPORT_MODAL_STATE.SUCCESS) {
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

  // Outside-tap should always dismiss; "Try again" is reachable only via the
  // explicit button so we never trigger a destructive retry by accident.
  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
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
