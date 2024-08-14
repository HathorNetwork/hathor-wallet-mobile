/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { t } from 'ttag';
import { StyleSheet, Text } from 'react-native';
import { COLORS } from '../../styles/themes';
import { ModalBase } from '../ModalBase';
import { WarnDisclaimer } from './WarnDisclaimer';
import { walletConnectReject } from '../../actions';

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
  selectionContainer: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.freeze100,
  },
});

export default ({
  onDismiss,
  data,
}) => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const isRetrying = useSelector((state) => state.walletConnect.createToken.retrying);

  // XXX: Make it navigates to readMoreUrl
  const onReadMore = () => {};

  const onReject = () => {
    onDismiss();
    dispatch(walletConnectReject());
  };

  const navigateToCreateTokenRequestScreen = () => {
    onDismiss();
    navigation.navigate('CreateTokenRequest', { createTokenRequest: data });
  };

  useEffect(() => {
    if (isRetrying) {
      navigateToCreateTokenRequestScreen();
    }
  }, [isRetrying]);

  return (
    <ModalBase show onDismiss={onReject}>
      <ModalBase.Title>{t`New Create Token Request`}</ModalBase.Title>
      <ModalBase.Body style={styles.body}>
        <WarnDisclaimer onReadMore={onReadMore} />
        <Text style={styles.text}>
          {t`You have received a new Create Token Request. Please`}
          <Text style={styles.bold}>
            {' '}{t`carefully review the details`}{' '}
          </Text>
          {t`before deciding to accept or decline.`}
        </Text>
      </ModalBase.Body>
      <ModalBase.Button
        title={t`Review Create Token Request details`}
        onPress={navigateToCreateTokenRequestScreen}
      />
      <ModalBase.DiscreteButton
        title={t`Cancel`}
        onPress={onReject}
      />
    </ModalBase>
  );
};
