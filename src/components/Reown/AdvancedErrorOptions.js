/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { t } from 'ttag';
import PropTypes from 'prop-types';
import NewHathorButton from '../NewHathorButton';
import ErrorDetailModal from './ErrorDetailModal';
import { COLORS } from '../../styles/themes';

/**
 * Reusable component for displaying advanced error options
 * Shows a collapsible section with "See error details" button
 *
 * @param {Object} props
 * @param {Object} props.errorDetails - Error details object from Redux
 */
export const AdvancedErrorOptions = ({ errorDetails = null }) => {
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showErrorDetail, setShowErrorDetail] = useState(false);

  // Don't render anything if there are no error details
  if (!errorDetails) {
    return null;
  }

  return (
    <>
      <View style={styles.advancedContainer}>
        <TouchableOpacity
          onPress={() => setShowAdvancedOptions(!showAdvancedOptions)}
          style={styles.advancedToggle}
        >
          <Text style={styles.advancedToggleText}>
            {showAdvancedOptions ? '▼ ' : '▶ '}
            {t`Advanced options`}
          </Text>
        </TouchableOpacity>
        {showAdvancedOptions && (
          <NewHathorButton
            secondary
            title={t`See error details`}
            onPress={() => setShowErrorDetail(true)}
            wrapperStyle={styles.seeErrorDetailsButton}
          />
        )}
      </View>
      <ErrorDetailModal
        visible={showErrorDetail}
        errorDetails={errorDetails}
        onDismiss={() => setShowErrorDetail(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  advancedContainer: {
    width: '100%',
    marginTop: 16,
  },
  advancedToggle: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  advancedToggleText: {
    fontSize: 14,
    color: COLORS.textColor,
    opacity: 0.7,
  },
  seeErrorDetailsButton: {
    marginTop: 8,
  },
});

AdvancedErrorOptions.propTypes = {
  errorDetails: PropTypes.shape({
    message: PropTypes.string.isRequired,
    stack: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    timestamp: PropTypes.number.isRequired,
  }),
};

export default AdvancedErrorOptions;
