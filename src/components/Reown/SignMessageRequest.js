/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  StyleSheet,
  View,
  ScrollView,
  TouchableWithoutFeedback,
  Text,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { t } from 'ttag';
import {
  reownAccept,
  reownReject
} from '../../actions';
import { COLORS } from '../../styles/themes';
import NewHathorButton from '../NewHathorButton';
import { DappContainer } from './NanoContract/DappContainer';
import { commonStyles } from './theme';
import { NanoContractIcon } from '../Icons/NanoContract.icon';

export const SignMessageRequestData = ({ data }) => (
  <View style={[commonStyles.card, commonStyles.cardSplit]}>
    <View style={commonStyles.cardSplitIcon}>
      <NanoContractIcon type='fill' color={COLORS.white} />
    </View>
    <View style={commonStyles.cardSplitContent}>
      <View>
        <Text style={styles.property}>{t`Message to sign`}</Text>
        <Text style={styles.value}>{data.message}</Text>
      </View>
      <View style={commonStyles.cardSeparator} />
      <View>
        <Text style={styles.property}>{t`Address`}</Text>
        <Text style={styles.value}>{data.address.address}</Text>
      </View>
      <View style={commonStyles.cardSeparator} />
      <View>
        <Text style={styles.property}>{t`Address Path`}</Text>
        <Text style={[styles.value, styles.bold]}>{data.address.addressPath}</Text>
      </View>
    </View>
  </View>
);

export const SignMessageRequest = ({ signMessageRequest }) => {
  const { dapp, data } = signMessageRequest;
  const { message, address } = data;
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const onAcceptSignMessageRequest = () => {
    const acceptedReq = { address, message };

    // Signal the user has accepted the current request and pass the accepted data.
    dispatch(reownAccept(acceptedReq));
    navigation.goBack();
  };

  const onDeclineTransaction = () => {
    dispatch(reownReject());
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.wide}>
      <TouchableWithoutFeedback>
        <View style={styles.wrapper}>
          <View style={styles.content}>
            <DappContainer dapp={dapp} />
            <SignMessageRequestData data={data} />
            {/* User actions */}
            <View style={styles.actionContainer}>
              <NewHathorButton
                title={t`Accept Request`}
                onPress={onAcceptSignMessageRequest}
              />
              <NewHathorButton
                title={t`Decline Request`}
                onPress={onDeclineTransaction}
                secondary
                danger
              />
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </ScrollView>
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
  balanceReceived: {
    color: 'hsla(180, 85%, 34%, 1)',
    fontWeight: 'bold',
  },
  actionContainer: {
    flexDirection: 'column',
    gap: 8,
    paddingBottom: 48,
  },
  declineModalBody: {
    paddingBottom: 24,
  },
  value: [commonStyles.text, commonStyles.value],
});
