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
  Image
} from 'react-native';
import { t } from 'ttag';
import { FeedbackContent } from '../../components/FeedbackContent';
import NewHathorButton from '../../components/NewHathorButton';
import OfflineBar from '../../components/OfflineBar';
import { COLORS } from '../../styles/themes';
import checkIcon from '../../assets/images/icCheckBig.png';

export const SCREEN_NAME = 'SuccessFeedback';

export function SuccessFeedbackScreen({ navigation, route }) {
  const { title, message } = route.params;

  const onBackHome = () => {
    navigation.navigate('Dashboard');
  };

  return (
    <Wrapper>
      <FeedbackContent
        title={title}
        message={message}
        icon={(<Image source={checkIcon} style={styles.feedbackModalIcon} resizeMode='contain' />)}
        action={(
          <NewHathorButton
            title={t`Back`}
            onPress={onBackHome}
            discrete
          />
        )}
        offmargin
        offcard
      />
      <OfflineBar />
    </Wrapper>
  );
}

const Wrapper = ({ children }) => (
  <View style={styles.wrapper}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.lowContrastDetail, // Defines an outer area on the main list content
  },
  feedbackModalIcon: {
    height: 48,
    width: 48,
    marginBottom: 16,
  },
});
