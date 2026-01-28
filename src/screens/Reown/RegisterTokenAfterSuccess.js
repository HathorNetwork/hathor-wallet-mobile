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
  Image,
  Text,
  ScrollView
} from 'react-native';
import { t } from 'ttag';
import { useDispatch, useSelector } from 'react-redux';
import { FeedbackContent } from '../../components/FeedbackContent';
import NewHathorButton from '../../components/NewHathorButton';
import OfflineBar from '../../components/OfflineBar';
import { COLORS } from '../../styles/themes';
import checkIcon from '../../assets/images/icCheckBig.png';
import { registerToken, updateTokensMetadata } from '../../utils/tokens';
import { getTokenLabel, getShortHash } from '../../utils';

export function RegisterTokenAfterSuccessScreen({ navigation, route }) {
  const { tokens } = route.params;
  const wallet = useSelector((state) => state.wallet);
  const dispatch = useDispatch();

  let message = t`Transaction successfully sent.`;

  if (tokens.length > 1) {
    message = `${message} ${t`There are ${tokens.length} unregistered tokens in this transaction. Do you want to register them?`}`;
  } else {
    message = `${message} ${t`There is 1 unregistered token in this transaction. Do you want to register it?`}`;
  }

  const onRegister = async () => {
    // Run token registration in parallel
    await Promise.all(
      tokens.map((token) => registerToken(wallet, dispatch, token))
    );

    const uids = tokens.map((token) => token.uid);
    // Not awaited intentionally - fetch metadata in background while navigating
    updateTokensMetadata(wallet, dispatch, uids);
    navigation.navigate('Dashboard');
  };

  const onBackHome = () => {
    navigation.navigate('Dashboard');
  };

  const renderTokens = () => tokens.map((token) => {
    const tokenLabel = getTokenLabel(token);
    const shortUid = getShortHash(token.uid);
    return (
      <View key={token.uid} style={styles.tokenItem}>
        <Text style={styles.tokenLabel}>{tokenLabel}</Text>
        <Text style={styles.tokenUid}>UID: {shortUid}</Text>
      </View>
    );
  });

  const renderTokensAndButtons = () => (
    <Wrapper>
      {renderTokens()}
      <NewHathorButton
        title={t`Register`}
        onPress={onRegister}
      />
      <NewHathorButton
        title={t`Back`}
        onPress={onBackHome}
        discrete
      />
    </Wrapper>
  )

  return (
    <Wrapper>
      <FeedbackContent
        title={t`Success`}
        message={message}
        icon={(<Image source={checkIcon} style={styles.feedbackModalIcon} resizeMode='contain' />)}
        action={renderTokensAndButtons()}
        offmargin
        offcard
      />
      <OfflineBar />
    </Wrapper>
  );
}

const Wrapper = ({ children }) => (
  <ScrollView style={styles.wrapper} contentContainerStyle={styles.scrollContent}>
    {children}
  </ScrollView>
);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.backgroundColor,
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  feedbackModalIcon: {
    height: 48,
    width: 48,
    marginBottom: 16,
  },
  tokenItem: {
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    minWidth: 280,
    borderWidth: 1,
    borderColor: COLORS.borderColorLight,
  },
  tokenLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textColor,
    marginBottom: 4,
  },
  tokenUid: {
    fontSize: 14,
    color: COLORS.textColorShadow,
    fontFamily: 'monospace',
  },
});
