/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Platform, StyleSheet } from 'react-native';
import { ANDROID_BG_COLOR, IOS_BG_COLOR, PRIMARY_COLOR } from '../constants';

/**
 * TODO: Obtain color from the OS scheme
 * @see: https://reactnavigation.org/docs/5.x/themes/#using-the-operating-system-preferences
 * @type {string}
 */
const defaultBackgroundColor = (Platform.OS === 'ios') ? IOS_BG_COLOR : ANDROID_BG_COLOR;

const baseStyle = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: defaultBackgroundColor,
  },
  buttonView: {
    flex: 1,
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 16,
    backgroundColor: defaultBackgroundColor,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  link: {
    color: PRIMARY_COLOR,
    fontWeight: 'bold',
  },
});

export default baseStyle;
