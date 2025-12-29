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

export const GetUtxosRequestData = ({ data }) => {
  const tokenMetadata = useSelector((state) => state.tokenMetadata);
  const tokens = useSelector((state) => state.tokens);

  // data contains: token, filter (optional), utxos (the actual UTXOs to share)
  const { token, utxos = [], filter } = data;

  const isNFT = token ? isTokenNFT(token.id, tokenMetadata) : false;
  const isRegistered = token && tokens[token.id] != null;
  const displaySymbol = isRegistered ? token.symbol : t`Unregistered token`;
  const displayName = isRegistered ? token.name : '';

  return (
    <>
      {/* Main request information */}
      <View style={[commonStyles.card, styles.requestCard]}>
        <View style={styles.requestHeader}>
          <View style={styles.requestIconWrapper}>
            <WalletIcon type='fill' color={COLORS.white} size={24} />
          </View>
          <View style={styles.requestTextWrapper}>
            <Text style={styles.requestTitle}>{t`UTXOs Request`}</Text>
            <Text style={styles.requestDescription}>
              {t`This app is requesting access to your wallet's UTXOs (Unspent Transaction Outputs)`}
            </Text>
          </View>
        </View>
      </View>

      {/* Token information */}
      {token && (
        <View style={[commonStyles.card, commonStyles.cardSplit]}>
          <View style={commonStyles.cardSplitIcon}>
            <WalletIcon type='fill' color={COLORS.white} />
          </View>
          <View style={commonStyles.cardSplitContent}>
            <View>
              <Text style={styles.property}>{t`Token`}</Text>
              <View style={styles.tokenHeader}>
                <Text style={styles.tokenSymbol}>{displaySymbol}</Text>
                <Text style={styles.tokenName}>{displayName}</Text>
              </View>
              <Text style={styles.tokenUid}>{token.id}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Filter information */}
      {filter && (
        <View style={[commonStyles.card, styles.filterCard]}>
          <Text style={styles.filterTitle}>{t`Filter Parameters`}</Text>
          {filter.max_utxos && (
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t`Max UTXOs:`}</Text>
              <Text style={styles.filterValue}>{filter.max_utxos}</Text>
            </View>
          )}
          {filter.filter_address && (
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t`Filter Address:`}</Text>
              <Text style={styles.filterValueAddress}>{filter.filter_address}</Text>
            </View>
          )}
          {filter.amount_smaller_than != null && (
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t`Amount smaller than:`}</Text>
              <Text style={styles.filterValue}>
                {renderValue(filter.amount_smaller_than, isNFT)}
              </Text>
            </View>
          )}
          {filter.amount_bigger_than != null && (
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t`Amount bigger than:`}</Text>
              <Text style={styles.filterValue}>
                {renderValue(filter.amount_bigger_than, isNFT)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* UTXOs summary */}
      <View style={[commonStyles.card, styles.utxosSummaryCard]}>
        <Text style={styles.utxosSummaryTitle}>{t`UTXOs to be shared`}</Text>
        <Text style={styles.utxosSummaryCount}>
          {t`${utxos.length} UTXO(s) found`}
        </Text>
      </View>

      {/* Privacy notice */}
      <View style={styles.privacyNotice}>
        <Text style={styles.privacyText}>
          {t`The app will receive information about your unspent transaction outputs. It cannot spend your funds without your approval.`}
        </Text>
      </View>
    </>
  );
};

export const GetUtxosRequest = ({ getUtxosRequest }) => {
  const { dapp, data } = getUtxosRequest;
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
            <GetUtxosRequestData data={data} />
            {/* User actions */}
            <View style={styles.actionContainer}>
              <NewHathorButton
                title={t`Share UTXOs Information`}
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
  tokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
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
  tokenUid: {
    fontSize: 12,
    color: COLORS.textColorShadow,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  filterCard: {
    padding: 16,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textColor,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 14,
    color: COLORS.textColorShadow,
  },
  filterValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textColor,
  },
  filterValueAddress: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textColor,
    fontFamily: 'monospace',
    flex: 1,
    marginLeft: 8,
    textAlign: 'right',
  },
  utxosSummaryCard: {
    padding: 16,
    alignItems: 'center',
  },
  utxosSummaryTitle: {
    fontSize: 14,
    color: COLORS.textColorShadow,
    marginBottom: 4,
  },
  utxosSummaryCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textColor,
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
