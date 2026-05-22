/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { t } from 'ttag';

import { ModalBase } from './ModalBase';
import { WEB3AUTH_ERROR_TYPES } from '../sagas/web3auth';
import { logger } from '../logger';

const log = logger('web3auth-error-dialog');

// Maps each error type to title + body copy and which actions to render.
// Returning copy at render time keeps the strings inside the ttag scanner.
const getDialogContent = (errorType) => {
  switch (errorType) {
    case WEB3AUTH_ERROR_TYPES.NETWORK:
      return {
        title: t`Connection issue`,
        body: t`We couldn't reach Web3Auth. Check your internet connection and try again.`,
        primary: t`Try again`,
        secondary: t`Cancel`,
        sentryCategory: 'network',
      };
    case WEB3AUTH_ERROR_TYPES.VERIFIER_CONFIG:
      return {
        title: t`Configuration error`,
        body: t`There was an issue with our authentication setup. Please try again in a few minutes. If the problem persists, contact support.`,
        primary: t`Try again`,
        secondary: t`Cancel`,
        sentryCategory: 'config',
      };
    case WEB3AUTH_ERROR_TYPES.MFA_REQUIRED:
      return {
        title: t`Recovery factor required`,
        body: t`To protect your wallet, you must configure at least one recovery factor. Would you like to set it up now?`,
        primary: t`Configure now`,
        secondary: t`Cancel`,
        sentryCategory: 'mfa',
      };
    case WEB3AUTH_ERROR_TYPES.KEY_DERIVATION:
    case WEB3AUTH_ERROR_TYPES.UNKNOWN:
    default:
      return {
        title: t`Something went wrong`,
        body: t`We couldn't complete the sign-in. Please try again. If the issue persists, contact support.`,
        primary: t`Try again`,
        secondary: t`Cancel`,
        sentryCategory: 'unknown',
      };
  }
};

const Web3AuthErrorDialog = ({ errorType, onRetry, onCancel, originalError }) => {
  useEffect(() => {
    if (!errorType) return;
    const { sentryCategory } = getDialogContent(errorType);
    log.error('web3auth_error_dialog_shown', {
      errorType,
      category: sentryCategory,
      originalError: originalError ? String(originalError.message || originalError) : null,
    });
  }, [errorType, originalError]);

  if (!errorType) return null;

  const content = getDialogContent(errorType);

  return (
    <ModalBase show onDismiss={onCancel}>
      <ModalBase.Title>{content.title}</ModalBase.Title>
      <ModalBase.Body style={styles.body}>
        <Text style={styles.text}>{content.body}</Text>
      </ModalBase.Body>
      <ModalBase.Button title={content.primary} onPress={onRetry} />
      <ModalBase.DiscreteButton title={content.secondary} onPress={onCancel} />
    </ModalBase>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingBottom: 20,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default Web3AuthErrorDialog;
