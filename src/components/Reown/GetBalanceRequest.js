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
import { useDispatch, useSelector } from 'react-redux';
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
import { renderValue, isTokenNFT } from '../../utils';

export const GetBalanceRequestData = ({ data }) => {
  const tokenMetadata = useSelector((state) => state.tokenMetadata);
  const tokens = useSelector((state) => state.tokens);

  return (
    <>
      {/* Main request information */}
      <View style={[commonStyles.card, styles.requestCard]}>
        <View style={styles.requestHeader}>
          <View style={styles.requestIconWrapper}>
            <WalletIcon type='fill' color={COLORS.white} size={24} />
          </View>
          <View style={styles.requestTextWrapper}>
            <Text style={styles.requestTitle}>{t`Balance Request`}</Text>
            <Text style={styles.requestDescription}>
              {t`This app is requesting access to your token balances`}
            </Text>
          </View>
        </View>
      </View>

      {/* Token list */}
      <View style={[commonStyles.card, commonStyles.cardSplit]}>
        <View style={commonStyles.cardSplitIcon}>
          <WalletIcon type='fill' color={COLORS.white} />
        </View>
        <View style={commonStyles.cardSplitContent}>
          <View>
            <Text style={styles.property}>{t`Tokens to be shared`}</Text>
          </View>
          {data.map((item, index) => {
            const isNFT = isTokenNFT(item.token.id, tokenMetadata);
            const isRegistered = tokens[item.token.id] != null;
            const displaySymbol = isRegistered ? item.token.symbol : t`Unregistered token`;
            const displayName = isRegistered ? item.token.name : '';

            return (
              <View key={item.token.id}>
                {index > 0 && <View style={commonStyles.cardSeparator} />}
                <View style={styles.balanceItem}>
                  <View style={styles.balanceHeader}>
                    <Text style={styles.tokenSymbol}>{displaySymbol}</Text>
                    <Text style={styles.tokenName}>{displayName}</Text>
                  </View>
                  <View style={styles.balanceDetails}>
                    <View style={styles.balanceRow}>
                      <Text style={styles.balanceLabel}>{t`Available:`}</Text>
                      <Text style={styles.balanceAmount}>
                        {renderValue(item.balance.unlocked, isNFT)}
                      </Text>
                    </View>
                    {item.balance.locked > 0 && (
                      <View style={styles.balanceRow}>
                        <Text style={styles.balanceLabel}>{t`Locked:`}</Text>
                        <Text style={[styles.balanceAmount, styles.lockedAmount]}>
                          {renderValue(item.balance.locked, isNFT)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.tokenUid}>{item.token.id}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Privacy notice */}
      <View style={styles.privacyNotice}>
        <Text style={styles.privacyText}>
          {t`The app will only receive your balance information. It cannot access your funds or make transactions.`}
        </Text>
      </View>
    </>
  );
};

export const GetBalanceRequest = ({ getBalanceRequest }) => {
  const { dapp, data } = getBalanceRequest;
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const onAcceptGetBalanceRequest = () => {
    // Signal the user has accepted the current request
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
            <GetBalanceRequestData data={data} />
            {/* User actions */}
            <View style={styles.actionContainer}>
              <NewHathorButton
                title={t`Share Balance Information`}
                onPress={onAcceptGetBalanceRequest}
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
  balanceItem: {
    marginVertical: 12,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
    color: COLORS.textColor,
  },
  tokenName: {
    fontSize: 14,
    color: COLORS.textColorShadow,
    flex: 1,
  },
  balanceDetails: {
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 14,
    color: COLORS.textColorShadow,
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textColor,
  },
  lockedAmount: {
    color: COLORS.textColorShadow,
  },
  tokenUid: {
    fontSize: 12,
    color: COLORS.textColorShadow,
    fontFamily: 'monospace',
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
