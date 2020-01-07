/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Text } from 'react-native';
import { Strong } from '../utils';

const TextFmt = (props) => {
  const { children, ...otherProps } = props;
  const parts = children.split('**');
  const ret = [];
  if (parts.length % 2 === 0) {
    throw new Error(`invalid string: ${children}`);
  }
  for (let i = 0; i < parts.length; i += 1) {
    if (i % 2 === 0) {
      ret.push(parts[i]);
    } else {
      ret.push(<Strong key={i}>{parts[i]}</Strong>);
    }
  }
  return <Text {...otherProps}>{ret}</Text>;
};

export default TextFmt;
