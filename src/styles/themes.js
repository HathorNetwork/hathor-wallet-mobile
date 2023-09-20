/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DefaultTheme } from '@react-navigation/native';

import { _PRIMARY_COLOR as PRIMARY_COLOR } from '../config';

/**
 * Light theme color scheme
 * @type {{
 * midContrastDetail: string,
 * errorBgColor: string,
 * backgroundColor: string,
 * borderColor: string,
 * lowContrastDetail: string,
 * textColorShadow: string,
 * positiveBalanceColor: string,
 * textColor: string,
 * errorTextColor: string,
 * tabBarBackground: string,
 * primaryOpacity30: string,
 * textColorShadowLight: string,
 * primaryOpacity10: string,
 * errorTextShadow: string,
 * primary: string}}
 * @property {string} backgroundColor The main background color
 * @property {string} lowContrastDetail Low contrast with background: separator lines, containers...
 * @property {string} midContrastDetail Medium contrast with background: placeholders, ...
 * @property {string} borderColor Defines borders
 * @property {string} textColor Maximum contrast with the background color, for reading
 * @property {string} textColorShadow Washed down version of the text
 * @property {string} textColorShadowLight More washed down version of the text
 * @property {string} tabBarBackground Specific for tab bar selectors
 * @property {string} positiveBalanceColor Represents a positive feedback for the user
 * @property {string} errorBgColor For containers with error feedbacks
 * @property {string} errorTextColor For texts with error messages
 * @property {string} errorTextShadow Washed down version of error texts
 * @property {string} primary Primary color, as set on the application config file
 * @property {string} primaryOpacity10 Primary color washed down to 10% opacity
 * @property {string} primaryOpacity30 Primary color washed down to 30% opacity
 */
export const COLORS = {
  backgroundColor: '#fff',
  lowContrastDetail: '#f7f7f7',
  midContrastDetail: '#9e9e9e',
  borderColor: '#eee',
  textColor: '#000',
  textColorShadow: 'rgba(0, 0, 0, 0.5)',
  textColorShadowLighter: 'rgba(0, 0, 0, 0.1)',
  textColorShadowLight: 'rgba(0, 0, 0, 0.3)',
  textColorShadowDark: 'rgba(0, 0, 0, 0.8)',
  tabBarBackground: '#333',
  positiveBalanceColor: '#0DA0A0',
  errorBgColor: '#DE3535',
  errorTextColor: '#F00',
  errorTextShadow: `rgba(255, 0, 0, 0.7)`,
  primary: PRIMARY_COLOR,
  primaryOpacity10: `${PRIMARY_COLOR}1A`,
  primaryOpacity30: `${PRIMARY_COLOR}4D`,
};

/**
 * @type {{ headerHeight: number }}
 * @property {number} headerHeight Defines the height of the screen title, for calculation purposes
 */
export const STYLE = {
  headerHeight: 56,
};

/**
 * Defines the default colors for the application.
 * Can be updated and will reflect the changes in real time on the application.
 * @see https://reactnavigation.org/docs/themes/
 * @type {{
 * dark: boolean,
 * colors: {
 *  border: string,
 *  notification: string,
 *  background: string,
 *  text: string,
 *  card: string,
 *  primary: string}
 * }}
 */
export const HathorTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.backgroundColor,
    text: COLORS.textColor,
    border: COLORS.borderColor,
  },
};
