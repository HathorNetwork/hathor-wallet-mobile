/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
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
import { getUnblindingEncoder, supportsUnblindLink } from '../utils/privacy';
import { copySensitive } from '../utils/sensitiveClipboard';

/**
 * The audit rows of a tx's details. They share the unblinding values of the wallet's own private
 * outputs in the tx, which reveal their amounts and tokens to whoever checks them against the
 * tx's commitments:
 * - "View in Explorer unblinded" opens the explorer at the tx, with the values in the #unblind=
 *   fragment of the link, which the browser never sends to a server. Only an explorer that reads
 *   the fragment gets the row: the shielded testnet's;
 * - "Copy unblinding values" copies them through the clipboard that clears itself.
 *
 * It renders nothing unless the wallet decodes its private outputs (isShieldedEnabled) and the
 * wallet-lib build has the encoder of the values, looked up as it renders. Then it reads the values
 * through getShieldedUnblindingForTx, which gives the openings of the wallet's own outputs only:
 * the private outputs it received or got as change in the tx, and its private outputs the tx
 * spends. The outputs the wallet paid to others are never among them. It shows the rows when there
 * is at least one, the txs the wallet paid included, and renders nothing when a read fails. The
 * values are encoded only when a row is pressed, and never leave the component but through the
 * explorer link or the clipboard.
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
        const result = await wallet.getShieldedUnblindingForTx(txId);
        const outputs = result?.outputs ?? [];
        const inputs = result?.inputs ?? [];
        if (!cancelled && (outputs.length > 0 || inputs.length > 0)) {
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
    const txUrl = combineURLs(explorerUrl, `transaction/${txId}`);
    Linking.openURL(`${txUrl}#unblind=${encodeValues()}`);
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
        title={copied ? t`Copied to clipboard!` : t`Copy unblinding values`}
        button={<FontAwesomeIcon icon={faCopy} size={20} color={COLORS.textColorShadow} />}
        onPress={copyValues}
        titleStyle={{ color: copied ? COLORS.primary : COLORS.textColorShadow }}
      />
    </>
  );
}
