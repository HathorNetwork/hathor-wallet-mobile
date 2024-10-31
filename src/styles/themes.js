/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DefaultTheme } from '@react-navigation/native';
import { _PRIMARY_COLOR as PRIMARY_COLOR } from '../config';
import { HslColor } from '../HslColor';

/**
 * Light theme color scheme
 */
export const COLORS = {
  white: '#fff',
  black: '#000',
  /**
   * @type {string} The main background color
   */
  backgroundColor: '#fff',
  /**
   * @type {string} Low contrast with background, like separator lines
   */
  lowContrastDetail: '#f7f7f7',
  /**
   * @type {string} Medium contrast with background, like placeholders
   */
  midContrastDetail: '#9e9e9e',
  darkContrastDetail: '#808080',
  /**
   * @type {string} Defines borders
   */
  borderColor: '#eee',
  borderColorMid: '#dcdcdc',
  borderColorDark: '#cecece',
  /**
   * @type {string}
   * Maximum contrast with the background color, for better reading
   */
  textColor: '#000',
  /**
   * @type {string} Washed down version of the text
   */
  textColorShadow: 'rgba(0, 0, 0, 0.5)',
  textColorShadowOpacity005: 'rgba(0, 0, 0, 0.05)',
  textColorShadowLighter: 'rgba(0, 0, 0, 0.1)',
  /**
   * @type {string} More washed down version of the text
   */
  textColorShadowLight: 'rgba(0, 0, 0, 0.3)',
  textColorShadowOpacity06: 'rgba(0, 0, 0, 0.6)',
  textColorShadowOpacity07: 'rgba(0, 0, 0, 0.7)',
  textColorShadowDark: 'rgba(0, 0, 0, 0.8)',
  textColorShadowOpacity09: 'rgba(0, 0, 0, 0.9)',
  /**
   * @type {string} Specific for tab bar selectors
   */
  tabBarBackground: '#333',
  /**
   * @type {string} Represents a positive feedback for the user
   */
  positiveBalanceColor: '#0DA0A0',
  /**
   * @type {string} For containers with error feedbacks
   */
  errorBgColor: '#DE3535',
  /**
   * @type {string} For texts with error messages
   */
  errorTextColor: '#F00',
  /**
   * @type {string} Washed down version of error texts
   * */
  errorTextShadow: `rgba(255, 0, 0, 0.7)`,
  /**
   * @type {string} Primary color, as set on the application config file
   * */
  primary: PRIMARY_COLOR,
  /**
   * @type {string} Primary color washed down to 10% opacity
   */
  primaryOpacity10: `${PRIMARY_COLOR}1A`,
  /**
   * @type {string} Primary color washed down to 30% opacity
   */
  primaryOpacity30: `${PRIMARY_COLOR}4D`,
  feedbackSuccess100: 'hsla(161, 30%, 85%, 1)',
  feedbackSuccess400: 'hsla(159, 75%, 17%, 1)',
  feedbackWarning100: 'hsla(21, 100%, 90%, 1)',
  feedbackWarning300: 'hsla(21, 54%, 49%, 1)',
  feedbackError200: 'hsla(7, 69%, 95%, 1)',
  feedbackError600: 'hsla(7, 100%, 30%, 1)',
  freeze100: 'hsla(0, 0%, 90%, 1)',
  freeze300: 'hsla(0, 0%, 45%, 1)',
  cardWarning100: 'hsla(46, 100%, 95%, 1)',
  cardWarning200: 'hsla(46, 100%, 58%, 1)',
  /**
   * @type {string} Black with 38% of light and full opaque
   */
  textLabel: 'hsla(0, 0%, 38%, 1)',
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

const alertBaseColor = new HslColor('hsl(47, 100%, 66%)');
export const AlertUI = {
  baseHslColor: alertBaseColor,
  lightColor: alertBaseColor.addLightness(20).toString(),
  darkColor: alertBaseColor.addLightness(-44).toString(),
};
