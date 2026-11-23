/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { COLORS } from '../../styles/themes';

/**
 * The icon of a privacy warning on Hathor Next: something would become public. It is a warning,
 * not an error: nothing went wrong, and the user decides.
 */
export const PrivacyWarningIcon = () => (
  <FontAwesomeIcon icon={faTriangleExclamation} size={72} color={COLORS.feedbackWarning300} />
);
