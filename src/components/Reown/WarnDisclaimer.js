/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { t } from 'ttag';
import { StyleSheet, View, Text, Linking } from 'react-native';
import { COLORS } from '../../styles/themes';
import { CircleInfoIcon } from '../Icons/CircleInfo.icon';
import SimpleButton from '../SimpleButton';
import { NANO_CONTRACT_INFO_URL } from '../../constants';

export const WarnDisclaimer = () => {
  const onReadMore = () => {
    Linking.openURL(NANO_CONTRACT_INFO_URL)
  };

  return (
    <View style={styles.warnContainer}>
      <View style={styles.infoIcon}>
        <CircleInfoIcon color={COLORS.cardWarning200} />
      </View>
      <View style={styles.warnContent}>
        <Text style={styles.warnMessage}>
          {t`Caution: There are risks associated with signing dapp transaction requests.`}
        </Text>
        <View style={styles.learnMoreWrapper}>
          <SimpleButton
            containerStyle={styles.learnMoreContainer}
            textStyle={styles.learnMoreText}
            title={t`Read More.`}
            onPress={onReadMore}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  warnContainer: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderRadius: 8,
    paddingTop: 12,
    /* It should have been 12 but it is adjusted to compensate the negative
     * margin on learnMoreWrapper and the difference between the font size
     * and the line height, which amounts to 8 points of compensation.
     */
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: COLORS.cardWarning100,
  },
  warnContent: {
    paddingLeft: 8,
  },
  warnMessage: {
    fontSize: 12,
    lineHeight: 16,
  },
  learnMoreWrapper: {
    display: 'inline-block',
    /* We are using negative margin here to correct the text position
     * and create an optic effect of alignment. */
    marginBottom: -4,
    paddingLeft: 2,
    marginRight: 'auto',
  },
  learnMoreContainer: {
    justifyContent: 'flex-start',
    borderBottomWidth: 1,
  },
  learnMoreText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 'bold',
    color: 'hsla(0, 0%, 25%, 1)',
  },
});
