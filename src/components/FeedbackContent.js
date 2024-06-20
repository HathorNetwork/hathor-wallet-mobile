/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { COLORS } from '../styles/themes';

/**
 * It presents a feedback content to user with title, message, icon and a call to action
 * if needed.
 *
 * @param {Objects} props
 * @param {string} props.title A bold, centered text
 * @param {string} props.message A regular text underneath title
 * @param {Object?} props.icon A react component or react element containing an icon,
 * if provided, it renders uppon the title
 * @param {Object?} props.action A react component or react element containing a call to action,
 * if provided, it renders underneath the content
 * @param {boolean} props.offcard Renders a feedback without card style
 * @param {boolean} props.offmargin Renders a feedback without margins
 *
 * @example
 * <FeedbackContent
 *   title={'Nano Contract Transactions Error'}
 *   message={'Something went wrong.'}
 *   icon={<Image source={errorIcon} style={{ height: 36, width: 36}} resizeMode='contain' />}
 *   action={<TryAgain ncId={ncId} />}
 * />
 */
export const FeedbackContent = ({
  title,
  message,
  icon,
  action,
  offcard,
  offmargin,
  offbackground
}) => (
  <View style={[
    styles.container,
    !offcard && styles.card,
    offmargin && styles.offMargin,
    offbackground && styles.offBackground
  ]}
  >
    <View style={styles.wrapper}>
      <View style={styles.content}>
        {icon
          && (<View style={styles.icon}>{icon}</View>)}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {action && (action)}
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 16,
    marginBottom: 45,
    marginHorizontal: 16,
    backgroundColor: COLORS.backgroundColor,
  },
  card: {
    borderRadius: 16,
    shadowOffset: { height: 2, width: 0 },
    shadowRadius: 4,
    shadowColor: COLORS.textColor,
    shadowOpacity: 0.08,
  },
  offMargin: {
    marginHorizontal: 0,
    marginVertical: 0,
  },
  offBackground: {
    backgroundColor: COLORS.lowContrastDetail,
  },
  wrapper: {
    overflow: 'scroll',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 45,
    /* Play the role of a minimum vertical padding for small screens */
    paddingVertical: 90,
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: 'bold',
    paddingBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 16,
    textAlign: 'center',
  },
  icon: {
    paddingBottom: 16,
  },
});
