/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Alert,
  StyleSheet,
  Text,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';

import { hideErrorModal } from '../actions';
import { COLORS } from '../styles/themes';
import BackdropModal from './BackdropModal';

const styles = StyleSheet.create({
  innerModal: {
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 8,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 56,
    paddingTop: 48,
    height: 290,
  },
  text: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 24,
  }
});

const showErrorReportedMessage = () => (
  <Text style={styles.text}>
    {t`Thanks for reporting the error to the team. We will investigate it to prevent from happening again.`}
  </Text>
);

export const ErrorModal = () => {
  const dispatch = useDispatch();
  const errorHandler = useSelector((state) => state.errorHandler);

  const {
    showModal,
    isFatal,
    errorReported,
  } = errorHandler;

  const hide = () => {
    dispatch(hideErrorModal());
  };

  if (!showModal) {
    return null;
  }

  return (
    <BackdropModal
      visible={showModal}
      animationType='slide'
      position='bottom'
      enableSwipeToDismiss={!isFatal}
      enableBackdropPress={!isFatal}
      onDismiss={isFatal ? undefined : hide}
      contentStyle={styles.innerModal}
    >
      <Text style={styles.title}>
        {t`Unexpected error`}
      </Text>
      {errorReported && showErrorReportedMessage()}
      <Text style={styles.text}>
        {t`Please restart your app to continue using the wallet.`}
      </Text>
    </BackdropModal>
  );
};

export const GlobalErrorHandler = () => {
  const dispatch = useDispatch();
  const {
    showModal,
    showAlert,
    isFatal,
    error,
  } = useSelector((state) => state.errorHandler);

  if (showModal) {
    return <ErrorModal />;
  }

  const getMessage = () => {
    if (isFatal) {
      return t`Unfortunately an unhandled error happened and you will need to restart your app.\n\nWe kindly ask you to report this error to the Hathor team clicking on the button below.\n\nNo sensitive data will be shared.`;
    }

    return t`Unfortunately an unhandled error happened.\n\nWe kindly ask you to report this error to the Hathor team clicking on the button below.\n\nNo sensitive data will be shared.`;
  };

  if (showAlert) {
    // Debugging helper for when React Native is running in development mode
    if (__DEV__) {
      console.debug('[GlobalErrorModal] Error modal data:', error);
    }
    return (
      <>
        {Alert.alert(
          t`Unexpected error occurred`,
          getMessage(),
          [{
            text: t`Report error`,
            onPress: () => {
              dispatch({ type: 'ALERT_REPORT_ERROR' });
            },
          }, {
            text: t`Close`,
            onPress: () => {
              dispatch({ type: 'ALERT_DONT_REPORT_ERROR' });
            }
          }],
          { cancelable: false },
        )}
      </>
    );
  }

  return null;
};
