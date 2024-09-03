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
import { Text } from 'react-native';
import { ModalBase } from '../ModalBase';
import { WarnDisclaimer } from './WarnDisclaimer';
import { walletConnectReject } from '../../actions';
import { commonStyles } from './theme';

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
      <ModalBase.Body style={commonStyles.body}>
        <WarnDisclaimer onReadMore={onReadMore} />
        <Text style={commonStyles.text}>
          {t`You have received a new Create Token Request. Please`}
          <Text style={commonStyles.bold}>
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
