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
import { WalletIcon } from '../Icons/Wallet.icon';

export const GetAddressRequestData = ({ data }) => (
  <>
    {/* Main request information */}
    <View style={[commonStyles.card, styles.requestCard]}>
      <View style={styles.requestHeader}>
        <View style={styles.requestIconWrapper}>
          <WalletIcon type='fill' color={COLORS.white} size={24} />
        </View>
        <View style={styles.requestTextWrapper}>
          <Text style={styles.requestTitle}>{t`Address Request`}</Text>
          <Text style={styles.requestDescription}>
            {t`This app is requesting access to your wallet address at index ${data.index}`}
          </Text>
        </View>
      </View>
    </View>

    {/* Address details */}
    <View style={[commonStyles.card, commonStyles.cardSplit]}>
      <View style={commonStyles.cardSplitIcon}>
        <WalletIcon type='fill' color={COLORS.white} />
      </View>
      <View style={commonStyles.cardSplitContent}>
        <View>
          <Text style={styles.property}>{t`Address Index`}</Text>
          <Text style={styles.value}>{data.index}</Text>
        </View>
        <View style={commonStyles.cardSeparator} />
        <View>
          <Text style={styles.property}>{t`Address`}</Text>
          <Text style={styles.addressValue}>{data.address}</Text>
        </View>
      </View>
    </View>

    {/* Privacy notice */}
    <View style={styles.privacyNotice}>
      <Text style={styles.privacyText}>
        {t`The app will receive your address for identification. It cannot access your funds or make transactions without your approval.`}
      </Text>
    </View>
  </>
);

export const GetAddressRequest = ({ getAddressRequest }) => {
  const { dapp, data } = getAddressRequest;
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const onAcceptRequest = () => {
    dispatch(reownAccept());
    navigation.goBack();
  };

  const onDeclineRequest = () => {
    dispatch(reownReject());
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.wide}>
      <TouchableWithoutFeedback>
        <View style={styles.wrapper}>
          <View style={styles.content}>
            <DappContainer dapp={dapp} />
            <GetAddressRequestData data={data} />
            {/* User actions */}
            <View style={styles.actionContainer}>
              <NewHathorButton
                title={t`Share Address`}
                onPress={onAcceptRequest}
              />
              <NewHathorButton
                title={t`Decline`}
                onPress={onDeclineRequest}
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
    backgroundColor: COLORS.lowContrastDetail,
  },
  content: {
    flex: 1,
    rowGap: 16,
    width: '100%',
    paddingVertical: 16,
  },
  actionContainer: {
    flexDirection: 'column',
    gap: 8,
    paddingBottom: 48,
    marginTop: 8,
  },
  property: [commonStyles.text, commonStyles.property],
  value: [commonStyles.text, commonStyles.value],
  addressValue: {
    fontSize: 14,
    color: COLORS.textColor,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  requestCard: {
    padding: 16,
    backgroundColor: COLORS.primaryOpacity10,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  requestTextWrapper: {
    flex: 1,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textColor,
    marginBottom: 4,
  },
  requestDescription: {
    fontSize: 14,
    color: COLORS.textColorShadow,
    lineHeight: 20,
  },
  privacyNotice: {
    backgroundColor: COLORS.cardBackground,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderColor,
  },
  privacyText: {
    fontSize: 13,
    color: COLORS.textColorShadow,
    lineHeight: 18,
    textAlign: 'center',
  },
});
