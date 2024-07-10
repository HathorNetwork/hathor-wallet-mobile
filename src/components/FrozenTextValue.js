/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { TextValue } from './TextValue';

/**
 * @param {Object} props
 * @param {boolean} props.title It sets font weight to bold and a larger font size
 * @param {boolean} props.bold It sets font weight to bold
 * @param {boolean} props.oneline It sets numberOfLines to 1
 * @param {boolean} props.shrink It sets flexShrink to 1
 * @param {boolean} props.pb4 It sets padding bottom to 4
 */
export const FrozenTextValue = ({ title, bold, oneline, shrink, pb4, children }) => (
  <TextValue
    color='hsla(0, 0%, 38%, 1)'
    title={title}
    bold={bold}
    oneline={oneline}
    shrink={shrink}
    pb4={pb4}
  >
    {children}
  </TextValue>
);
