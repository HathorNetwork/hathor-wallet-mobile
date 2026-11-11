/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';
import FeedbackModal from '../../components/FeedbackModal';
import Spinner from '../../components/Spinner';
import OfflineBar from '../../components/OfflineBar';
import { SyncingNotice } from '../../components/Multichain/SyncingNotice';
import { multichainNextSendRequested, multichainNextSendReset } from '../../actions';
import { renderNextValue } from '../../multichain/amount';
import {
  finalitySentence,
  nextStatusLabel,
  privateSendStatement,
  rejectedBody,
  rejectedTitle,
  sendingBody,
  settledStatement,
  syncingSendBody,
  unconfirmedBody,
  verdictLead,
} from '../../multichain/content';
import { selectSideChainConfig } from '../../multichain/gating';
import { OPERATION_STATUS, SEND_IN_FLIGHT } from '../../multichain/state';
import { authorizeTransaction } from '../../passkey/authorizeTransaction';
import {
  isExpectedPasskeyError,
  PasskeyCancelledError,
  withPasskeyWords,
} from '../../passkey/passkeySigner';
import NavigationService from '../../NavigationService';
import { useNavigation, useParams } from '../../hooks/navigation';
import { logger } from '../../logger';
import { COLORS } from '../../styles/themes';
import { selectNextSendFee } from './NextSendAmountInput';
import checkIcon from '../../assets/images/icCheckBig.png';
import errorIcon from '../../assets/images/icErrorBig.png';
import { useHoldScreen } from '../../multichain/hooks';

const log = logger('next-send');

let draftCount = 0;

/**
 * A new draft's identity. A draft is sent at most once.
 *
 * @returns {string}
 */
const newDraftId = () => {
  draftCount += 1;
  return `next-draft-${Date.now()}-${draftCount}`;
};

/**
 * The confirmation of a Hathor Next payment, and its outcome.
 *
 * SIGN-ONCE: signing a second spend of the same input loses the funds for good, so a draft is sent
 * at most once. Once the PIN (or the passkey) authorizes it, Send never turns back on: whatever
 * the outcome, the flow closes, and a new payment starts from a new draft. There is no retry, no
 * cancel and no speed-up. Hathor Network's SendConfirmScreen turns Send back on after an error;
 * this screen must not.
 *
 * Authorizing comes first: the PIN, or a passkey ceremony. Hathor Network's passkey sends run their
 * ceremony when the lib signs, but Hathor Next signs with keys already in memory, so this screen
 * runs it. Until it succeeds nothing is signed, so a dismissed passkey leaves Send on.
 */
export default function NextSendConfirmScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const params = useParams();
  const amount = BigInt(params.amount);
  const { address } = params;
  const config = useSelector(selectSideChainConfig);
  const send = useSelector((state) => state.multichain.send);
  const online = useSelector((state) => state.multichain.next.online);
  const sweeping = useSelector((state) => state.multichain.next.sweeping);
  const draftId = useRef(newDraftId()).current;
  // Set the moment the send is authorized, before anything is signed, and never unset.
  const [authorized, setAuthorized] = useState(false);
  // While the passkey sheet is open.
  const [authorizing, setAuthorizing] = useState(false);
  const [passkeyError, setPasskeyError] = useState(null);
  // Another draft's payment still on its way: this one waits for its outcome.
  const earlierOnItsWay = send.draftId !== draftId && SEND_IN_FLIGHT.includes(send.status);
  // Sending also pauses while Hathor Next is offline or syncing: the draft would be refused.
  const canSend = !authorized && !authorizing && online && !sweeping && !earlierOnItsWay;

  useEffect(() => () => {
    dispatch(multichainNextSendReset());
  }, []);

  const symbol = config?.nativeTokenSymbol ?? 'HTR';
  const fee = useSelector(selectNextSendFee);
  const hathorDecimalPlaces = useSelector((state) => state.serverInfo?.decimal_places ?? 2);
  const render = (value) => `${renderNextValue(value, hathorDecimalPlaces)} ${symbol}`;
  const outcome = send.draftId === draftId ? send.status : OPERATION_STATUS.IDLE;
  // No way back while the payment is on its way: the outcome shows here.
  useHoldScreen(navigation, SEND_IN_FLIGHT.includes(outcome));

  const submit = (pinCode) => {
    setAuthorized(true);
    dispatch(multichainNextSendRequested({
      tokenId: config.nativeTokenId,
      to: address,
      amount,
      draftId,
      pinCode,
    }));
  };

  const authorizeWithPasskey = async () => {
    setAuthorizing(true);
    try {
      await withPasskeyWords(async () => {});
    } catch (e) {
      setAuthorizing(false);
      if (e instanceof PasskeyCancelledError) {
        return;
      }
      if (!isExpectedPasskeyError(e)) {
        log.error('The passkey could not authorize a Hathor Next payment.', e);
      }
      setPasskeyError(e.message || t`The passkey couldn't authorize the payment.`);
      return;
    }
    setAuthorizing(false);
    submit();
  };

  const onConfirm = () => {
    if (!canSend) {
      return;
    }
    authorizeTransaction({
      navigation,
      pinParams: {
        cb: submit,
        canCancel: true,
        screenText: t`Enter your 6-digit pin to authorize the payment`,
        biometryText: t`Authorize the payment`,
      },
      onPasskey: authorizeWithPasskey,
    });
  };

  const exit = () => {
    dispatch(multichainNextSendReset());
    NavigationService.navigate('Main', { screen: 'Home' });
    // The next payment starts on an empty address input, as on Hathor Network: reset the Send
    // stack once the navigation has completed, so the user doesn't see it happen.
    setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: 'SendAddressInput' }] });
    }, 500);
  };

  // Leaving Hathor Next (the setting turned off, the network changed) drops the payment's state:
  // this screen has nothing left to show, so it closes.
  const sawDraft = useRef(false);
  useEffect(() => {
    if (send.draftId === draftId) {
      sawDraft.current = true;
    } else if (authorized && sawDraft.current) {
      exit();
    }
  }, [send.draftId]);

  const icon = (source) => (
    <Image source={source} style={styles.feedbackIcon} resizeMode='contain' />
  );

  const renderOutcome = () => {
    if (passkeyError) {
      return (
        <FeedbackModal
          icon={icon(errorIcon)}
          text={passkeyError}
          onDismiss={() => setPasskeyError(null)}
        />
      );
    }
    switch (outcome) {
      case OPERATION_STATUS.SENDING:
      case 'pending':
        return <FeedbackModal icon={<Spinner />} text={sendingBody()} />;
      case OPERATION_STATUS.RECORDED:
        return (
          <FeedbackModal
            icon={icon(checkIcon)}
            text={`${settledStatement()} ${finalitySentence()}`}
            onDismiss={exit}
            action={<NewHathorButton title={t`Done`} onPress={exit} />}
          />
        );
      case OPERATION_STATUS.UNCONFIRMED:
        return (
          <FeedbackModal
            icon={<Spinner />}
            text={`${nextStatusLabel('unconfirmed')}. ${unconfirmedBody()}`}
            onDismiss={exit}
            action={<NewHathorButton title={t`Done`} onPress={exit} />}
          />
        );
      case OPERATION_STATUS.FAILED:
        return (
          <FeedbackModal
            icon={icon(errorIcon)}
            text={[
              `${rejectedTitle()}. ${rejectedBody()}`,
              send.reason ? `${verdictLead()} ${send.reason}` : null,
            ].filter(Boolean).join('\n\n')}
            onDismiss={exit}
            action={<NewHathorButton title={t`Done`} onPress={exit} />}
          />
        );
      case OPERATION_STATUS.ERROR:
        return (
          <FeedbackModal
            icon={icon(errorIcon)}
            text={send.error ?? t`The payment couldn't be sent.`}
            onDismiss={exit}
            action={<NewHathorButton title={t`Done`} onPress={exit} />}
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
        title={t`SEND ${symbol}`}
        onBackPress={authorized ? null : () => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.label}>{t`Amount`}</Text>
        <Text style={styles.amount}>{render(amount)}</Text>
        <Text style={styles.label}>{t`Address`}</Text>
        <Text style={styles.address} selectable>{address}</Text>
        <View style={styles.summary}>
          <Row label={t`Network fee`} value={render(fee)} />
          <Row label={t`Total`} value={render(amount + fee)} strong />
        </View>
        {sweeping && <SyncingNotice text={syncingSendBody()} style={styles.syncing} />}
        {earlierOnItsWay && (
          <SyncingNotice
            text={t`An earlier payment is still on its way. You can send once it settles.`}
            style={styles.syncing}
          />
        )}
        <View style={styles.privacy}>
          <Text style={styles.privacyTitle}>{t`Private`}</Text>
          <Text style={styles.privacyText}>{privateSendStatement()}</Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <NewHathorButton
          title={t`Send`}
          disabled={!canSend}
          onPress={onConfirm}
        />
      </View>
      {renderOutcome()}
      <OfflineBar style={{ position: 'relative' }} />
    </View>
  );
}

const Row = ({ label, value, strong = false }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, strong && styles.strong]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.backgroundColor,
  },
  body: {
    padding: 16,
    paddingBottom: 32,
  },
  label: {
    marginTop: 16,
    fontSize: 14,
    color: COLORS.textColorShadow,
  },
  amount: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textColor,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLabel: {
    fontSize: 14,
    color: COLORS.textColorShadow,
  },
  rowValue: {
    fontSize: 14,
    color: COLORS.textColor,
  },
  strong: {
    fontWeight: 'bold',
  },
  syncing: {
    marginTop: 16,
  },
  privacy: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderColor,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textColor,
  },
  privacyText: {
    marginTop: 4,
    fontSize: 13,
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
