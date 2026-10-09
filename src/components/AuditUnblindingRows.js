/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';

import { ListButton } from './HathorList';
import { OpenInNewIcon } from './Icons/OpenInNew.icon';
import { COLORS } from '../styles/themes';
import { SENSITIVE_COPY_FEEDBACK_MS } from '../constants';
import { combineURLs } from '../utils';
import { isShieldedEnabled } from '../shielded/gating';
import { isTxPaidByWallet } from '../shielded/fees';
import { getUnblindingEncoder, supportsUnblindLink } from '../utils/privacy';
import { copySensitive } from '../utils/sensitiveClipboard';

/**
 * The audit rows of a tx's details. They share the unblinding values of the private outputs the
 * wallet received in the tx, which reveal their amounts and tokens to whoever checks them against
 * the tx's commitments:
 * - "View in Explorer unblinded" opens the explorer at the tx, with the values in the #unblind=
 *   fragment of the link, after a warning that the link stays in the browser's history. Only an
 *   explorer that reads the fragment gets the row: the shielded testnet's;
 * - "Copy unblinding values" copies them through the clipboard that clears itself.
 *
 * It renders nothing unless the wallet decodes its private outputs (isShieldedEnabled) and the
 * wallet-lib build has the encoder of the values, looked up as it renders. Then it reads the values
 * through getShieldedUnblindingForTx, which gives the openings of the wallet's own outputs only. It
 * renders nothing for a tx the wallet paid, whose values it never reads: the values of its change
 * would reveal a lone recipient's amount by subtraction. Nor for a tx without private outputs of
 * the wallet, or when a read fails. The values are encoded only when a row is pressed, and never
 * leave the component but through the explorer link or the clipboard.
 *
 * @param {Object} props
 * @param {string} props.txId
 */
export default function AuditUnblindingRows({ txId }) {
  const wallet = useSelector((state) => state.wallet);
  const enabled = useSelector(isShieldedEnabled);
  const explorerUrl = useSelector((state) => state.networkSettings.explorerUrl);
  const encoder = getUnblindingEncoder();
  const active = enabled && encoder !== null && Boolean(wallet);

  const [openings, setOpenings] = useState(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(null);

  useEffect(() => {
    setOpenings(null);
    if (!active) {
      return undefined;
    }
    let cancelled = false;
    const load = async () => {
      try {
        if (await isTxPaidByWallet(wallet, txId)) {
          return;
        }
        const result = await wallet.getShieldedUnblindingForTx(txId);
        const outputs = result?.outputs ?? [];
        const inputs = result?.inputs ?? [];
        // An opening of an input is one of the wallet's outputs spent here: the wallet paid.
        if (!cancelled && outputs.length > 0 && inputs.length === 0) {
          setOpenings({ outputs, inputs });
        }
      } catch (e) {
        // The rows stay hidden. The error isn't logged: it could quote the values.
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [active, wallet, txId]);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  if (!active || openings === null) {
    return null;
  }

  const encodeValues = () => encoder(txId, openings.outputs, openings.inputs);

  const openExplorer = () => {
    Alert.alert(
      t`Open the unblinded link?`,
      t`The link holds the values that reveal the amounts and tokens you received in this transaction. Your browser keeps it in its history, which may sync to your other devices.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Open`,
          onPress: () => {
            const txUrl = combineURLs(explorerUrl, `transaction/${txId}`);
            Linking.openURL(`${txUrl}#unblind=${encodeValues()}`);
          },
        },
      ],
    );
  };

  const copyValues = () => {
    copySensitive(encodeValues());
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), SENSITIVE_COPY_FEEDBACK_MS);
  };

  return (
    <>
      {supportsUnblindLink(explorerUrl) && (
        <ListButton
          title={t`View in Explorer unblinded`}
          button={<OpenInNewIcon size={24} color={COLORS.black} />}
          onPress={openExplorer}
          titleStyle={{ color: COLORS.textColorShadow }}
        />
      )}
      <ListButton
        title={copied ? t`Copied. The clipboard clears in one minute.` : t`Copy unblinding values`}
        button={<FontAwesomeIcon icon={faCopy} size={20} color={COLORS.textColorShadow} />}
        onPress={copyValues}
        titleStyle={{ color: copied ? COLORS.primary : COLORS.textColorShadow }}
      />
    </>
  );
}
