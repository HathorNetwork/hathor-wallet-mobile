/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';
import FeedbackModal from '../../components/FeedbackModal';
import Spinner from '../../components/Spinner';
import OfflineBar from '../../components/OfflineBar';
import { ChainTag } from '../../components/Multichain/ChainTag';
import { SimulatedTagIfMock } from '../../components/Multichain/SimulatedTag';
import { multichainTransferRequested, multichainTransferReset } from '../../actions';
import { authorizeTransaction } from '../../passkey/authorizeTransaction';
import { CHAIN, transferReceiveSymbol } from '../../multichain/chains';
import { renderNextValue } from '../../multichain/amount';
import { isSideChainSimulated, selectSideChainConfig } from '../../multichain/gating';
import { OPERATION_STATUS } from '../../multichain/state';
import NavigationService from '../../NavigationService';
import { renderValue } from '../../utils';
import { COLORS } from '../../styles/themes';
import { arrivalText } from '../../multichain/transfer';
import { SummaryRow, useTransferContext } from './ChainTransferScreen';
import { sameNextAddress } from '../../multichain/address';
import { useHoldScreen } from '../../multichain/hooks';
import checkIcon from '../../assets/images/icCheckBig.png';
import errorIcon from '../../assets/images/icErrorBig.png';

/**
 * What a transfer's success says. There is no tracking yet, so it says when to expect the HTR.
 *
 * @param {number} etaSeconds
 * @returns {string}
 */
export const transferSentText = (etaSeconds) => {
  const eta = arrivalText(etaSeconds);
  return t`Your HTR will arrive on Hathor Next in ${eta}.`;
};

/**
 * The confirmation of a transfer between chains: what leaves, what arrives, the fees, when, and
 * that it can't come back yet. Confirming asks for the PIN (or the passkey) and spends the source
 * chain's balance.
 */
export default function ChainTransferConfirmScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const amount = BigInt(route.params.amount);
  const {
    from = CHAIN.HATHOR,
    to = CHAIN.HATHOR_NEXT,
    tokenId = '00',
    toAddress,
  } = route.params;
  const { bridge, decimalPlaces, available } = useTransferContext();
  const ownAddress = useSelector((state) => state.multichain.next.address);
  const simulated = useSelector(isSideChainSimulated);
  const sideChainConfig = useSelector(selectSideChainConfig);
  const transfer = useSelector((state) => state.multichain.transfer);
  useHoldScreen(navigation, transfer.status === OPERATION_STATUS.SENDING);

  // A transfer's outcome belongs to this screen: a new one starts clean.
  useEffect(() => {
    dispatch(multichainTransferReset());
    return () => {
      dispatch(multichainTransferReset());
    };
  }, []);

  if (!bridge) {
    return null;
  }

  const quote = bridge.quote({ from, to, amount, available });
  const receiveSymbol = transferReceiveSymbol(sideChainConfig);
  const htr = (value) => `${renderValue(value, false, decimalPlaces)} HTR`;
  const isOwnAddress = sameNextAddress(toAddress, ownAddress);

  const send = (pinCode) => dispatch(multichainTransferRequested({
    from, to, tokenId, amount, toAddress, pinCode,
  }));

  const onConfirm = () => {
    authorizeTransaction({
      navigation,
      pinParams: {
        cb: send,
        canCancel: true,
        screenText: t`Enter your 6-digit pin to authorize the transfer`,
        biometryText: t`Authorize the transfer`,
      },
      onPasskey: () => send(),
    });
  };

  const done = () => {
    dispatch(multichainTransferReset());
    NavigationService.navigate('Main', { screen: 'Home' });
  };

  const renderFeedback = () => {
    switch (transfer.status) {
      case OPERATION_STATUS.SENDING:
        return <FeedbackModal icon={<Spinner />} text={t`Transferring to Hathor Next…`} />;
      case OPERATION_STATUS.DONE:
        return (
          <FeedbackModal
            icon={<Image source={checkIcon} style={styles.feedbackIcon} resizeMode='contain' />}
            text={transferSentText(quote.etaSeconds)}
            onDismiss={done}
            action={<NewHathorButton title={t`Done`} onPress={done} />}
          />
        );
      case OPERATION_STATUS.UNCONFIRMED:
        // Signed, with no answer yet: the app keeps asking, and no other transfer starts.
        return (
          <FeedbackModal
            icon={<Spinner />}
            text={transfer.error ?? t`We couldn't confirm the transfer yet.`}
            onDismiss={done}
            action={<NewHathorButton secondary title={t`Close`} onPress={done} />}
          />
        );
      case OPERATION_STATUS.ERROR:
        return (
          <FeedbackModal
            icon={<Image source={errorIcon} style={styles.feedbackIcon} resizeMode='contain' />}
            text={transfer.error ?? t`The transfer failed.`}
            onDismiss={() => dispatch(multichainTransferReset())}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.wrapper}>
      <HathorHeader
        withBorder
        title={t`CONFIRM TRANSFER`}
        onBackPress={transfer.status === OPERATION_STATUS.SENDING
          ? null
          : () => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <SimulatedTagIfMock />
        <View style={styles.route}>
          <View style={styles.routeSide}>
            <ChainTag chain={from} />
            <Text style={styles.routeLabel}>{t`You send`}</Text>
            <Text style={styles.routeAmount}>{htr(amount)}</Text>
          </View>
          <Text style={styles.routeArrow}>→</Text>
          <View style={[styles.routeSide, styles.routeSideEnd]}>
            <ChainTag chain={to} />
            <Text style={styles.routeLabel}>{t`You receive`}</Text>
            <Text style={styles.routeAmount}>
              {`${renderNextValue(quote.receiveAmount, decimalPlaces)} ${receiveSymbol}`}
            </Text>
          </View>
        </View>

        <Text style={styles.label}>{isOwnAddress ? t`To your address` : t`To`}</Text>
        <Text style={styles.address} selectable>{toAddress}</Text>

        <View style={styles.summary}>
          <SummaryRow label={t`Bridge fee`} value={htr(quote.bridgeFee)} />
          <SummaryRow label={t`Network fee`} value={htr(quote.networkFee)} />
          <SummaryRow label={t`Arrives in`} value={arrivalText(quote.etaSeconds)} />
        </View>
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            {t`One-way: you can't move these tokens back to Hathor Network yet.`}
          </Text>
        </View>
        {simulated && (
          <Text style={styles.simulatedNote}>
            {t`Simulated: nothing is broadcast on Hathor Network, and your Hathor Network balance doesn't change.`}
          </Text>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <NewHathorButton
          title={t`Confirm and send`}
          disabled={transfer.status !== OPERATION_STATUS.IDLE}
          onPress={onConfirm}
        />
      </View>
      {renderFeedback()}
      <OfflineBar style={{ position: 'relative' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.backgroundColor,
  },
  body: {
    padding: 16,
    paddingBottom: 32,
  },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: COLORS.lowContrastDetail,
  },
  routeSide: {
    flex: 1,
  },
  routeSideEnd: {
    alignItems: 'flex-end',
  },
  routeArrow: {
    marginHorizontal: 8,
    fontSize: 22,
    color: COLORS.textColorShadow,
  },
  routeLabel: {
    marginTop: 12,
    fontSize: 12,
    color: COLORS.textColorShadow,
  },
  routeAmount: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textColor,
  },
  label: {
    marginTop: 24,
    fontSize: 14,
    color: COLORS.textColorShadow,
  },
  address: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textColor,
  },
  summary: {
    marginTop: 24,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.lowContrastDetail,
  },
  warning: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.feedbackError200,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.feedbackError600,
  },
  simulatedNote: {
    marginTop: 16,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textColorShadow,
  },
  footer: {
    padding: 16,
  },
  feedbackIcon: {
    height: 105,
    width: 105,
  },
});
