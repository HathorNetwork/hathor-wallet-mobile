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
  Text
} from 'react-native';
import { t } from 'ttag';
import { FeedbackContent } from '../../components/FeedbackContent';
import NewHathorButton from '../../components/NewHathorButton';
import OfflineBar from '../../components/OfflineBar';
import { COLORS } from '../../styles/themes';
import checkIcon from '../../assets/images/icCheckBig.png';
import { useDispatch, useSelector } from 'react-redux';
import {
  newToken,
  fetchTokensMetadata,
  tokenMetadataUpdated
} from '../../actions';

export function RegisterTokenAfterSuccessScreen({ navigation, route }) {
  const { tokens } = route.params;
  const wallet = useSelector((state) => state.wallet);
  const dispatch = useDispatch();

  let message = t`Transaction successfully sent.`;

  if (tokens.length > 1) {
    message = `${message} There were ${tokens.length} unregistered tokens in this transaction. Do you want to register them?`;
  } else {
    message = `${message} There was 1 unregistered token in this transaction. Do you want to register it?`;
  }

  const onRegister = async () => {
    for (const token of tokens) {
      await wallet.storage.registerToken(token);
      dispatch(newToken(token));
    }

    const uids = tokens.map(token => token.uid);
    const networkName = wallet.getNetworkObject().name;
    // This will make the fetch metadata call to run async while we
    // already navigate to Dashboard without awaiting it
    (async () => {
      const metadatas = await fetchTokensMetadata([uids], networkName);
      dispatch(tokenMetadataUpdated(metadatas));
    })();
    navigation.navigate('Dashboard');
  };

  const onBackHome = () => {
    navigation.navigate('Dashboard');
  };

  const renderTokens = () => {
    return tokens.map(token => {
      return <Text key={token.uid}>{token.uid}</Text>
    });
  };

  const renderTokensAndButtons = () => {
    return (
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
    );
  }

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
