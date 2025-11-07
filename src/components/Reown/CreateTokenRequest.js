/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  Image,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { numberUtils } from '@hathor/wallet-lib';
import { t } from 'ttag';
import {
  createTokenRetry,
  createTokenRetryDismiss,
  setCreateTokenStatusReady,
  reownAccept,
  reownReject
} from '../../actions';
import { COLORS } from '../../styles/themes';
import NewHathorButton from '../NewHathorButton';
import { DappContainer } from './NanoContract/DappContainer';
import { commonStyles } from './theme';
import { FeedbackContent } from '../FeedbackContent';
import { DEFAULT_TOKEN, REOWN_CREATE_TOKEN_STATUS } from '../../constants';
import FeedbackModal from '../FeedbackModal';
import Spinner from '../Spinner';
import errorIcon from '../../assets/images/icErrorBig.png';
import checkIcon from '../../assets/images/icCheckBig.png';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { DeclineModal } from './NanoContract/DeclineModal';

const condRenderData = (
  attribute,
  title,
  separator,
  formatter = (val) => val,
) => {
  if (attribute != null) {
    return (
      <>
        {separator && <View style={[commonStyles.cardSeparator, { alignSelf: 'stretch', width: '100%' }]} />}
        <View style={{ width: '100%', alignSelf: 'stretch' }}>
          <Text style={[
            commonStyles.text,
            commonStyles.field,
            commonStyles.bold,
            commonStyles.mb4,
          ]}
          >
            {title}
          </Text>
          <Text style={[styles.value, styles.bold, { flexShrink: 1, width: '100%' }]}>
            {formatter(attribute)}
          </Text>
        </View>
      </>
    );
  }

  return null;
};

/**
 * Renders translated values for boolean inputs
 * @param {boolean} bool
 */
function renderBooleanFormatter(bool) {
  return bool ? t`Yes` : t`No`;
}

export const CreateTokenRequestData = ({ data }) => (
  <View style={[commonStyles.card, commonStyles.cardSplit]}>
    <View style={[{
      flexDirection: 'column',
      alignSelf: 'stretch',
      gap: 8,
      flex: 1
    }]}
    >
      {condRenderData(data.name, t`Name`, false)}
      {condRenderData(data.symbol, t`Symbol`, true)}
      {condRenderData(data.amount, t`Amount`, true, numberUtils.prettyValue)}
      {condRenderData(data.address, t`Address to send newly minted ${data.symbol}`, true)}
      {condRenderData(data.changeAddress, t`Address to send change ${DEFAULT_TOKEN.symbol}`, true)}
      {condRenderData(data.createMint, t`Create mint authority?`, true, renderBooleanFormatter)}
      {condRenderData(data.createMelt, t`Create melt authority?`, true, renderBooleanFormatter)}
      {condRenderData(data.mintAuthorityAddress, t`Address to send the mint authority`, true)}
      {condRenderData(data.meltAuthorityAddress, t`Address to send the melt authority`, true)}
      {data.mintAuthorityAddress != null
        && condRenderData(
          data.allowExternalMintAuthorityAddress,
          t`Allow external mint authority addresses?`,
          true,
          renderBooleanFormatter,
        )}
      {data.meltAuthorityAddress != null
        && condRenderData(
          data.allowExternalMeltAuthorityAddress,
          t`Allow external melt authority addresses?`,
          true,
          renderBooleanFormatter,
        )}
      {condRenderData(data.contractPaysTokenDeposit, t`Contract pays token deposit?`, true, renderBooleanFormatter)}
      {condRenderData(data.data, t`Token data`, true, (tokenData) => tokenData.join('\n'))}
    </View>
  </View>
);

export const CreateTokenRequest = ({ createTokenRequest }) => {
  const { dapp, data } = createTokenRequest;
  const { status } = useSelector((state) => state.reown.createToken);
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [showDeclineModal, setShowDeclineModal] = useState(false);

  useEffect(() => () => {
    dispatch(setCreateTokenStatusReady());
  }, []);

  const onAcceptCreateTokenRequest = () => {
    const acceptedCreateToken = data;

    dispatch(reownAccept(acceptedCreateToken));
  };

  const onDeclineTransaction = () => {
    setShowDeclineModal(true);
  };

  const { navigateBack } = useBackButtonHandler(
    onDeclineTransaction,
    status === REOWN_CREATE_TOKEN_STATUS.SUCCESSFUL
  );

  const onDeclineConfirmation = () => {
    setShowDeclineModal(false);
    dispatch(reownReject());
    navigateBack();
  };

  const onDismissDeclineModal = () => {
    setShowDeclineModal(false);
  };

  const isTxReady = status === REOWN_CREATE_TOKEN_STATUS.READY;
  const isTxProcessing = status === REOWN_CREATE_TOKEN_STATUS.LOADING;
  const isTxSuccessful = status === REOWN_CREATE_TOKEN_STATUS.SUCCESSFUL;
  const isTxFailed = status === REOWN_CREATE_TOKEN_STATUS.FAILED;

  const onFeedbackModalDismiss = () => {
    dispatch(createTokenRetryDismiss());
    navigateBack();
  };

  const onNavigateToDashboard = () => {
    navigation.navigate('Dashboard');
  };

  const onTryAgain = () => {
    dispatch(setCreateTokenStatusReady());
    dispatch(createTokenRetry());
  };

  return (
    <>
      <ScrollView style={styles.wide}>
        <View style={styles.wrapper}>
          {isTxReady && (
            <View style={styles.content}>
              <DappContainer dapp={dapp} />
              <CreateTokenRequestData data={data} />
              {/* User actions */}
              <View style={styles.actionContainer}>
                <NewHathorButton
                  title={t`Accept Request`}
                  onPress={onAcceptCreateTokenRequest}
                />
                <NewHathorButton
                  title={t`Decline Request`}
                  onPress={onDeclineTransaction}
                  secondary
                  danger
                />
              </View>
            </View>
          )}
          {isTxProcessing && (
            <FeedbackContent
              title={t`Sending transaction`}
              message={t`Please wait.`}
              icon={<Spinner size={48} animating />}
              offmargin
              offcard
              offbackground
            />
          )}
        </View>
      </ScrollView>

      <DeclineModal
        show={showDeclineModal}
        onDecline={onDeclineConfirmation}
        onDismiss={onDismissDeclineModal}
      />

      {isTxSuccessful && (
        <FeedbackModal
          icon={(<Image source={checkIcon} resizeMode='contain' />)}
          text={t`Create Token Transaction successfully sent.`}
          onDismiss={onFeedbackModalDismiss}
          action={(<NewHathorButton discrete title={t`Ok, close`} onPress={onNavigateToDashboard} />)}
        />
      )}

      {isTxFailed && (
        <FeedbackModal
          icon={(<Image source={errorIcon} resizeMode='contain' />)}
          text={t`Error while sending create token transaction.`}
          onDismiss={onFeedbackModalDismiss}
          action={(<NewHathorButton discrete title={t`Try again`} onPress={onTryAgain} />)}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  wide: {
    width: '100%'
  },
  wrapper: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: COLORS.lowContrastDetail, // Defines an outer area on the main list content
  },
  content: {
    flex: 1,
    rowGap: 24,
    width: '100%',
    paddingVertical: 16,
  },
  actionContainer: {
    flexDirection: 'column',
    gap: 8,
    paddingBottom: 48,
    width: '100%',
  },
  value: [commonStyles.text, commonStyles.value, { width: '100%' }],
  bold: { fontWeight: 'bold' },
});
