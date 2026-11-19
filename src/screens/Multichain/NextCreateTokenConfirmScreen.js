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
  multichainNextCreateTokenReviewed,
} from '../../actions';
import { renderNextValue } from '../../multichain/amount';
import {
  nextStatusLabel,
  rejectedTitle,
  syncingSendBody,
  unconfirmedBody,
  verdictLead,
} from '../../multichain/content';
import { selectSideChainConfig, selectSideChainConnection } from '../../multichain/gating';
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

/**
 * What the screen says of a creation it saw sent, then lost track of when the app left Hathor
 * Next.
 */
export const creationLostText = () => t`The token creation was sent, but this screen lost track of it when the app left Hathor Next. Check your tokens on Hathor Next before you create this one again.`;

/**
 * What the screen says of a creation it lost track of before it knew whether it was signed:
 * another draft took the creation after the app left Hathor Next, and this one's answer never
 * comes here.
 */
export const creationUnknownText = () => t`This screen lost track of the token creation before it knew whether it was signed. Check your tokens on Hathor Next before you create this one again.`;

/**
 * What the user is asked before a creation that pays some of their HTR back in the open is signed.
 *
 * @param {string} symbol The token's
 * @param {string} shown The HTR that goes public, as shown
 */
export const publicChangeText = (symbol, shown) => t`Creating ${symbol} makes ${shown} public. The fee is paid from your HTR, and what comes back to you as change is paid openly to your Hathor Next address, where anyone who knows that address can see it.`;

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
  const connection = useSelector(selectSideChainConnection);
  const current = useSelector((state) => state.multichain.createToken);
  const online = useSelector((state) => state.multichain.next.online);
  const sweeping = useSelector((state) => state.multichain.next.sweeping);
  const fee = useSelector(selectNextSendFee);
  const hathorDecimalPlaces = useSelector((state) => state.serverInfo?.decimal_places ?? 2);
  const draftId = useRef(newDraftId()).current;
  const [authorized, setAuthorized] = useState(false);
  const own = current.draftId === draftId;
  // This draft's state as last seen here. The app leaving Hathor Next (its flag turned off, or its
  // backend changed) clears the creation: an outcome already shown stays shown. One signed (it has
  // its id) and not settled is one the screen lost track of: no update reaches it any more. One
  // not signed yet still has the saga's answer coming, named with this draft: the screen waits
  // for it, as nothing says yet whether it was created, unless another draft took the creation
  // meanwhile, whose state the answer never overwrites: lost track of too. It is never sent again.
  const [last, setLast] = useState(null);
  const leaving = useRef(false);
  const kept = !own && !leaving.current ? last : null;
  const otherOwns = current.draftId !== null && !own;
  const unsignedInFlight = Boolean(kept) && !kept.sendId && SEND_IN_FLIGHT.includes(kept.status);
  const lost = (Boolean(kept?.sendId) && (SEND_IN_FLIGHT.includes(kept.status)
    || kept.status === OPERATION_STATUS.UNCONFIRMED)) || (unsignedInFlight && otherOwns);
  const answerComing = unsignedInFlight && !otherOwns;
  const keptOutcome = kept && kept.status !== OPERATION_STATUS.IDLE
    && !SEND_IN_FLIGHT.includes(kept.status) ? kept : null;
  // What the screen shows of its draft.
  const creation = own ? current : keptOutcome;
  const earlierOnItsWay = !own && SEND_IN_FLIGHT.includes(current.status);
  const canCreate = !authorized && online && !sweeping && !earlierOnItsWay;
  const nativeSymbol = config?.nativeTokenSymbol ?? 'HTR';
  const render = (value, unit) => `${renderNextValue(value, hathorDecimalPlaces)} ${unit}`;
  const outcome = answerComing ? OPERATION_STATUS.SENDING
    : creation?.status ?? OPERATION_STATUS.IDLE;
  useHoldScreen(navigation, SEND_IN_FLIGHT.includes(outcome));

  useEffect(() => () => {
    dispatch(multichainNextCreateTokenReset());
  }, []);

  // A passkey dismissed in the saga leaves this draft idle: Create is on again.
  useEffect(() => {
    if (!own) {
      return;
    }
    setLast(current);
    if (authorized && current.status === OPERATION_STATUS.IDLE) {
      setAuthorized(false);
    }
  }, [own, current]);

  const onConfirm = () => {
    if (!canCreate) {
      return;
    }
    // The Hathor Next it is authorized on, as Create was tapped: the saga creates it there only,
    // though the backend may change while the PIN is asked.
    const authorizedOn = connection;
    const submit = (pinCode) => {
      setAuthorized(true);
      dispatch(multichainNextCreateTokenRequested({
        symbol, name, amount, draftId, pinCode, connection: authorizedOn,
      }));
    };
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

  // Back to the Dashboard, with the creation's screens gone. navigate('Main') from here, above
  // Main, would put a second Main on the stack (React Navigation 7) and leave this screen mounted
  // under it.
  const exit = () => {
    leaving.current = true;
    dispatch(multichainNextCreateTokenReset());
    NavigationService.resetToMain();
  };

  const icon = (source) => (
    <Image source={source} style={styles.feedbackIcon} resizeMode='contain' />
  );

  // The creation is checked and waits for the user to agree to the HTR it makes public.
  const review = own ? current.review : null;
  const answer = (accept) => {
    dispatch(multichainNextCreateTokenReviewed({ draftId, accept }));
  };

  const renderOutcome = () => {
    if (review) {
      return (
        <FeedbackModal
          icon={icon(errorIcon)}
          text={publicChangeText(symbol, render(review.publicChange, nativeSymbol))}
          onDismiss={() => answer(false)}
          action={(
            <View style={styles.reviewActions}>
              <NewHathorButton title={t`Create ${symbol}`} onPress={() => answer(true)} />
              <NewHathorButton
                secondary
                wrapperStyle={styles.reviewCancel}
                title={t`Cancel`}
                onPress={() => answer(false)}
              />
            </View>
          )}
        />
      );
    }
    if (lost) {
      return (
        <FeedbackModal
          icon={icon(errorIcon)}
          text={kept?.sendId ? creationLostText() : creationUnknownText()}
          onDismiss={exit}
          action={<NewHathorButton title={t`Done`} onPress={exit} />}
        />
      );
    }
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
              // Once the registry named it: the signed transaction's id may not be the token's.
              creation.tokenId && creation.tokenIdFinal ? t`Token id: ${creation.tokenId}` : null,
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
      case OPERATION_STATUS.EXPIRED:
        return (
          <FeedbackModal
            icon={icon(errorIcon)}
            text={`${nextStatusLabel('expired')}. ${t`The creation expired before the network got its signatures, so the token wasn't created. Nothing left your wallet and no fee was paid.`}`}
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
        onBackPress={authorized && (own || answerComing) ? null : () => navigation.goBack()}
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
  reviewActions: {
    width: '100%',
  },
  reviewCancel: {
    marginTop: 12,
  },
});
