/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Linking,
} from 'react-native';
import { t } from 'ttag';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { COLORS } from '../../../styles/themes';
import { CircleInfoIcon } from '../../Icons/CircleInfo.icon';
import { ModalBase } from '../../ModalBase';
import SimpleButton from '../../SimpleButton';
import { walletConnectReject } from '../../../actions';
import { NANO_CONTRACT_INFO_URL } from '../../../constants';

export const NewNanoContractTransactionModal = ({
  onDismiss,
  data: { payload },
}) => {
  const isRetrying = useSelector(({ walletConnect }) => (
    walletConnect.newNanoContractTransaction.retrying
  ));
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const readMoreUrl = NANO_CONTRACT_INFO_URL;

  const onModalDismiss = useCallback(() => {
    dispatch(walletConnectReject());
    onDismiss();
  }, []);

  const navigatesToNewNanoContractScreen = () => {
    onDismiss();
    navigation.navigate('NewNanoContractTransactionScreen', { ncTxRequest: payload });
  };

  useEffect(() => {
    if (isRetrying) {
      navigatesToNewNanoContractScreen();
    }
  }, [isRetrying, navigation]);

  const onReadMore = () => {
    Linking.openURL(readMoreUrl)
  };

  return (
    <ModalBase show onDismiss={onModalDismiss}>
      <ModalBase.Title>{t`New Nano Contract Transaction`}</ModalBase.Title>
      <ModalBase.Body style={styles.body}>
        <WarnDisclaimer onReadMore={onReadMore} />
        <Text style={styles.text}>
          {t`You have received a new Nano Contract Transaction. Please`}
          <Text style={styles.bold}>
            {' '}{t`carefully review the details`}{' '}
          </Text>
          {t`before deciding to accept or decline.`}
        </Text>
      </ModalBase.Body>
      <ModalBase.Button
        title={t`Review transaction details`}
        onPress={navigatesToNewNanoContractScreen}
      />
      <ModalBase.DiscreteButton
        title={t`Cancel`}
        onPress={onModalDismiss}
      />
    </ModalBase>
  );
};

const WarnDisclaimer = ({ onReadMore }) => (
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

const styles = StyleSheet.create({
  body: {
    paddingBottom: 24,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
  },
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
