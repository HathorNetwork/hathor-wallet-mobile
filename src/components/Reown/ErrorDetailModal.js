/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Clipboard,
} from 'react-native';
import { t } from 'ttag';
import PropTypes from 'prop-types';
import HathorModal from '../HathorModal';
import NewHathorButton from '../NewHathorButton';
import { COLORS } from '../../styles/themes';

/**
 * Modal that displays detailed error information with copy functionality
 *
 * @param {Object} props
 * @param {boolean} props.visible - Whether the modal is visible
 * @param {Object} props.errorDetails - Error details object
 * @param {string} props.errorDetails.message - Error message
 * @param {string} props.errorDetails.stack - Error stack trace
 * @param {string} props.errorDetails.type - Error type/class name
 * @param {number} props.errorDetails.timestamp - Error timestamp
 * @param {Function} props.onDismiss - Callback when modal is dismissed
 */
const ErrorDetailModal = ({ visible, errorDetails, onDismiss }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const timeoutRef = React.useRef(null);

  // Cleanup timeout on unmount
  useEffect(() => () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  if (!visible || !errorDetails) {
    return null;
  }

  const handleCopy = () => {
    const errorText = `Error Type: ${errorDetails.type}
Message: ${errorDetails.message}
Timestamp: ${new Date(errorDetails.timestamp).toISOString()}

Stack Trace:
${errorDetails.stack}`;

    Clipboard.setString(errorText);
    setCopySuccess(true);

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Store timeout ref for cleanup
    timeoutRef.current = setTimeout(() => {
      setCopySuccess(false);
      timeoutRef.current = null;
    }, 2000);
  };

  return (
    <HathorModal
      onDismiss={onDismiss}
      viewStyle={styles.modalView}
    >
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t`Error Details`}</Text>

        <View style={styles.errorSection}>
          <Text style={styles.label}>{t`Error Type:`}</Text>
          <Text style={styles.value}>{errorDetails.type}</Text>
        </View>

        <View style={styles.errorSection}>
          <Text style={styles.label}>{t`Message:`}</Text>
          <Text style={styles.value}>{errorDetails.message}</Text>
        </View>

        <View style={styles.errorSection}>
          <Text style={styles.label}>{t`Timestamp:`}</Text>
          <Text style={styles.value}>
            {new Date(errorDetails.timestamp).toLocaleString()}
          </Text>
        </View>

        <View style={styles.stackSection}>
          <Text style={styles.label}>{t`Stack Trace:`}</Text>
          <ScrollView style={styles.stackScroll} nestedScrollEnabled>
            <Text style={styles.stackText} selectable>
              {errorDetails.stack}
            </Text>
          </ScrollView>
        </View>

        <View style={styles.buttonContainer}>
          <NewHathorButton
            title={copySuccess ? t`Copied!` : t`Copy to Clipboard`}
            onPress={handleCopy}
            wrapperStyle={styles.copyButton}
            disabled={copySuccess}
          />
          <NewHathorButton
            title={t`Close`}
            onPress={onDismiss}
            secondary
          />
        </View>
      </ScrollView>
    </HathorModal>
  );
};

const styles = StyleSheet.create({
  modalView: {
    maxHeight: '80%',
  },
  scrollContainer: {
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    color: COLORS.textColor,
  },
  errorSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    color: COLORS.textColor,
  },
  value: {
    fontSize: 14,
    color: COLORS.textColorShadow,
  },
  stackSection: {
    marginBottom: 16,
  },
  stackScroll: {
    backgroundColor: COLORS.lowContrastDetail,
    borderRadius: 4,
    padding: 12,
    maxHeight: 200,
  },
  stackText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: COLORS.textColor,
  },
  buttonContainer: {
    width: '100%',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 16,
  },
  copyButton: {
    marginBottom: 8,
  },
});

ErrorDetailModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  errorDetails: PropTypes.shape({
    message: PropTypes.string.isRequired,
    stack: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    timestamp: PropTypes.number.isRequired,
  }),
  onDismiss: PropTypes.func.isRequired,
};

ErrorDetailModal.defaultProps = {
  errorDetails: null,
};

export default ErrorDetailModal;
