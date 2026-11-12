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
import {
  multichainNextCreateTokenRequested,
  multichainNextCreateTokenReset,
} from '../../actions';
import { renderNextValue } from '../../multichain/amount';
import {
  nextStatusLabel,
  rejectedTitle,
  syncingSendBody,
  unconfirmedBody,
  verdictLead,
} from '../../multichain/content';
import { selectSideChainConfig } from '../../multichain/gating';
import { OPERATION_STATUS, SEND_IN_FLIGHT } from '../../multichain/state';
import { authorizeTransaction } from '../../passkey/authorizeTransaction';
import NavigationService from '../../NavigationService';
import { useNavigation, useParams } from '../../hooks/navigation';
import { COLORS } from '../../styles/themes';
import { useHoldScreen } from '../../multichain/hooks';
import { selectNextSendFee } from './NextSendAmountInput';
import { publicTokenNote } from './NextCreateTokenScreen';
import checkIcon from '../../assets/images/icCheckBig.png';
import errorIcon from '../../assets/images/icErrorBig.png';

let draftCount = 0;

const newDraftId = () => {
  draftCount += 1;
  return `next-token-draft-${Date.now()}-${draftCount}`;
};

/**
 * The confirmation of a token creation on Hathor Next, and its outcome.
 *
 * SIGN-ONCE, as a payment: the creation spends this wallet's HTR for its fee, so a draft is
 * created at most once. Once authorized, Create never turns back on: whatever the outcome, the
 * flow closes, and another token starts from a new draft.
 *
 * Authorizing is the PIN, which decrypts the words the token's keys come from, or, for a passkey
 * wallet, the ceremony the saga runs. Until it succeeds nothing is derived or signed.
 */
export default function NextCreateTokenConfirmScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const params = useParams();
  const amount = BigInt(params.amount);
  const { name, symbol } = params;
  const config = useSelector(selectSideChainConfig);
  const creation = useSelector((state) => state.multichain.createToken);
  const online = useSelector((state) => state.multichain.next.online);
  const sweeping = useSelector((state) => state.multichain.next.sweeping);
  const fee = useSelector(selectNextSendFee);
  const hathorDecimalPlaces = useSelector((state) => state.serverInfo?.decimal_places ?? 2);
  const draftId = useRef(newDraftId()).current;
  const [authorized, setAuthorized] = useState(false);
  const earlierOnItsWay = creation.draftId !== draftId && SEND_IN_FLIGHT.includes(creation.status);
  const canCreate = !authorized && online && !sweeping && !earlierOnItsWay;
  const nativeSymbol = config?.nativeTokenSymbol ?? 'HTR';
  const render = (value, unit) => `${renderNextValue(value, hathorDecimalPlaces)} ${unit}`;
  const outcome = creation.draftId === draftId ? creation.status : OPERATION_STATUS.IDLE;
  useHoldScreen(navigation, SEND_IN_FLIGHT.includes(outcome));

  useEffect(() => () => {
    dispatch(multichainNextCreateTokenReset());
  }, []);

  // A passkey dismissed in the saga leaves the draft: Create is on again.
  useEffect(() => {
    if (authorized && creation.draftId === null && creation.status === OPERATION_STATUS.IDLE) {
      setAuthorized(false);
    }
  }, [creation.draftId, creation.status]);

  const submit = (pinCode) => {
    setAuthorized(true);
    dispatch(multichainNextCreateTokenRequested({ symbol, name, amount, draftId, pinCode }));
  };

  const onConfirm = () => {
    if (!canCreate) {
      return;
    }
    authorizeTransaction({
      navigation,
      pinParams: {
        cb: submit,
        canCancel: true,
        screenText: t`Enter your 6-digit pin to create the token`,
        biometryText: t`Create the token`,
      },
      // The saga runs the ceremony: the words it yields derive the token's keys.
      onPasskey: () => submit(),
    });
  };

  const exit = () => {
    dispatch(multichainNextCreateTokenReset());
    NavigationService.navigate('Main', { screen: 'Home' });
  };

  const icon = (source) => (
    <Image source={source} style={styles.feedbackIcon} resizeMode='contain' />
  );

  const renderOutcome = () => {
    switch (outcome) {
      case OPERATION_STATUS.SENDING:
      case 'pending':
        return <FeedbackModal icon={<Spinner />} text={t`Creating ${symbol} on Hathor Next…`} />;
      case OPERATION_STATUS.RECORDED:
        return (
          <FeedbackModal
            icon={icon(checkIcon)}
            text={[
              t`${symbol} was created on Hathor Next, and its whole supply is in your wallet.`,
              creation.tokenId ? t`Token id: ${creation.tokenId}` : null,
            ].filter(Boolean).join('\n\n')}
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
              `${rejectedTitle()}. ${t`The token wasn't created.`}`,
              creation.reason ? `${verdictLead()} ${creation.reason}` : null,
            ].filter(Boolean).join('\n\n')}
            onDismiss={exit}
            action={<NewHathorButton title={t`Done`} onPress={exit} />}
          />
        );
      case OPERATION_STATUS.ERROR:
        return (
          <FeedbackModal
            icon={icon(errorIcon)}
            text={creation.error ?? t`The token couldn't be created.`}
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
        title={t`CREATE TOKEN`}
        onBackPress={authorized ? null : () => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.label}>{t`Token name`}</Text>
        <Text style={styles.value}>{name}</Text>
        <Text style={styles.label}>{t`Token symbol`}</Text>
        <Text style={styles.value}>{symbol}</Text>
        <Text style={styles.label}>{t`Amount`}</Text>
        <Text style={styles.amount}>{render(amount, symbol)}</Text>
        <View style={styles.summary}>
          <Row label={t`Network fee`} value={render(fee, nativeSymbol)} />
        </View>
        {sweeping && <SyncingNotice text={syncingSendBody()} style={styles.syncing} />}
        {earlierOnItsWay && (
          <SyncingNotice
            text={t`An earlier token creation is still on its way. You can create another once it settles.`}
            style={styles.syncing}
          />
        )}
        <View style={styles.note}>
          <Text style={styles.noteTitle}>{t`Public`}</Text>
          <Text style={styles.noteText}>{publicTokenNote()}</Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <NewHathorButton title={t`Create token`} disabled={!canCreate} onPress={onConfirm} />
      </View>
      {renderOutcome()}
      <OfflineBar style={{ position: 'relative' }} />
    </View>
  );
}

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
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
  value: {
    marginTop: 4,
    fontSize: 16,
    color: COLORS.textColor,
  },
  amount: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: 'bold',
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
  syncing: {
    marginTop: 16,
  },
  note: {
    marginTop: 24,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textColor,
  },
  noteText: {
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
