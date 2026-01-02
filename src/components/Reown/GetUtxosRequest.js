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
import { constants } from '@hathor/wallet-lib';
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

  // data contains utxoDetails from wallet.getUtxos() plus filterParams from request
  const {
    utxos = [],
    total_amount_available: totalAmountAvailable = 0n,
    total_utxos_available: totalUtxosAvailable = 0,
    filterParams = {},
  } = data;

  // Normalize filter params - handle both camelCase and snake_case
  const params = {
    token: filterParams.token,
    maxUtxos: filterParams.maxUtxos ?? filterParams.max_utxos,
    filterAddress: filterParams.filterAddress ?? filterParams.filter_address,
    amountSmallerThan: filterParams.amountSmallerThan ?? filterParams.amount_smaller_than,
    amountBiggerThan: filterParams.amountBiggerThan ?? filterParams.amount_bigger_than,
    maximumAmount: filterParams.maximumAmount ?? filterParams.max_amount,
    onlyAvailableUtxos: filterParams.onlyAvailableUtxos ?? filterParams.only_available_utxos,
  };

  // Get token info from filterParams
  const tokenId = params.token;
  const tokenInfo = tokenId ? tokens[tokenId] : null;
  const isNFT = tokenId ? isTokenNFT(tokenId, tokenMetadata) : false;
  const isRegistered = tokenInfo != null;
  const getDisplaySymbol = () => {
    if (isRegistered) return tokenInfo.symbol;
    if (tokenId) return t`Unregistered token`;
    return constants.DEFAULT_NATIVE_TOKEN_CONFIG.symbol;
  };
  const displaySymbol = getDisplaySymbol();

  // Check if any filter parameters are set
  const hasFilterParams = params.token
    || params.maxUtxos
    || params.filterAddress
    || params.amountSmallerThan != null
    || params.amountBiggerThan != null
    || params.maximumAmount != null
    || params.onlyAvailableUtxos != null;

  // Calculate total amount from utxos array as fallback
  const totalAmount = totalAmountAvailable
    ? Number(totalAmountAvailable)
    : utxos.reduce((sum, utxo) => sum + (utxo.amount || 0), 0);
  const totalUtxos = totalUtxosAvailable
    ? Number(totalUtxosAvailable)
    : utxos.length;

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

      {/* Filter parameters */}
      {hasFilterParams && (
        <View style={[commonStyles.card, styles.filterCard]}>
          <Text style={styles.filterTitle}>{t`Request Parameters`}</Text>
          {params.token && (
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t`Token:`}</Text>
              <Text style={styles.filterValue}>{displaySymbol}</Text>
            </View>
          )}
          {params.maxUtxos && (
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t`Max UTXOs:`}</Text>
              <Text style={styles.filterValue}>{params.maxUtxos}</Text>
            </View>
          )}
          {params.filterAddress && (
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t`Filter Address:`}</Text>
              <Text style={styles.filterValueAddress}>{params.filterAddress}</Text>
            </View>
          )}
          {params.amountSmallerThan != null && (
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t`Amount smaller than:`}</Text>
              <Text style={styles.filterValue}>
                {renderValue(params.amountSmallerThan, isNFT)}
              </Text>
            </View>
          )}
          {params.amountBiggerThan != null && (
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t`Amount bigger than:`}</Text>
              <Text style={styles.filterValue}>
                {renderValue(params.amountBiggerThan, isNFT)}
              </Text>
            </View>
          )}
          {params.maximumAmount != null && (
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t`Maximum amount:`}</Text>
              <Text style={styles.filterValue}>
                {renderValue(params.maximumAmount, isNFT)}
              </Text>
            </View>
          )}
          {params.onlyAvailableUtxos != null && (
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t`Only available UTXOs:`}</Text>
              <Text style={styles.filterValue}>
                {params.onlyAvailableUtxos ? t`Yes` : t`No`}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* UTXOs summary */}
      <View style={[commonStyles.card, styles.utxosSummaryCard]}>
        <Text style={styles.utxosSummaryTitle}>{t`UTXOs to be shared`}</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t`Total quantity:`}</Text>
          <Text style={styles.summaryValue}>{totalUtxos}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t`Total amount:`}</Text>
          <Text style={styles.summaryValue}>
            {renderValue(totalAmount, isNFT)} {displaySymbol}
          </Text>
        </View>
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
  },
  utxosSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textColor,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textColorShadow,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
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
