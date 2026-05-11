/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import { Clipboard, Image, Linking } from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';
import icShareActive from '../assets/icons/icShareActive.png';
import { ListButton } from './HathorList';
import { COLORS } from '../styles/themes';
import { combineURLs } from '../utils';

/**
 * Two audit rows for the transaction-detail modal:
 *
 *   1. "View in Explorer unblinded" — opens the explorer at this tx with
 *      the unblinding payload embedded in the URL fragment so the
 *      explorer can render the wallet-owned shielded outputs in
 *      cleartext. Fragments are not sent to any server, so the payload
 *      stays client-side end-to-end.
 *
 *   2. "Copy unblinding values" — copies the same base64url-encoded
 *      payload to the clipboard. Lets the user paste it into the
 *      explorer's manual panel rather than carrying secrets in the URL
 *      bar / shell history.
 *
 * Both rows are gated on the wallet returning at least one shielded
 * output it owns for this tx (received + change). Outputs the wallet
 * generated for other recipients are deliberately not in scope —
 * disclosing them would leak the recipient's amount/token. See
 * `wallet-lib`'s `getShieldedUnblindingForTx`.
 */

/**
 * Build the wire envelope. Stringifies bigints because JSON.stringify
 * doesn't handle them natively, and the explorer parser will revive
 * them from string form. Schema is versioned so we can evolve later
 * without a flag day.
 */
const encodeEntry = (e) => ({
  index: e.index,
  value: typeof e.value === 'bigint' ? e.value.toString() : String(e.value),
  token: e.token,
  vbf: e.vbf,
  ...(e.abf ? { abf: e.abf } : {}),
});

const buildEnvelope = (txId, outputs, inputs) => ({
  v: 1,
  txId,
  outputs: outputs.map(encodeEntry),
  // `inputs` is only emitted when the wallet has at least one entry
  // for it. Older explorers parsing this payload were keyed by output
  // position only — leaving the key absent (rather than `[]`) keeps
  // the wire form identical for the common output-only case.
  ...(inputs && inputs.length > 0 ? { inputs: inputs.map(encodeEntry) } : {}),
});

/**
 * URL-fragment-safe base64. RFC 4648 §5: replace `+` with `-`, `/` with
 * `_`, strip padding `=`. Done by hand so we don't pull in another
 * dependency for one trivial transform.
 */
const base64url = (str) => Buffer.from(str, 'utf8')
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

const encodePayload = (txId, outputs, inputs) => base64url(
  JSON.stringify(buildEnvelope(txId, outputs, inputs)),
);

export const AuditUnblindingRows = ({ txId }) => {
  const wallet = useSelector((state) => state.wallet);
  const baseExplorerUrl = useSelector((state) => state.networkSettings.explorerUrl);

  // `null` while the fetch is in-flight; `{outputs, inputs}` once
  // settled. We gate visibility on either array being non-empty so a
  // tx where the wallet only has input openings (parent tx owned, this
  // tx all sent to others) still surfaces the rows.
  const [unblinding, setUnblinding] = useState(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      if (!wallet?.getShieldedUnblindingForTx) {
        // wallet-lib older than the API addition — feature stays hidden
        // rather than crashing. Same effect as a tx with no owned
        // shielded outputs/inputs.
        if (!cancelled) setUnblinding({ outputs: [], inputs: [] });
        return;
      }
      try {
        const result = await wallet.getShieldedUnblindingForTx(txId);
        if (!cancelled) {
          setUnblinding({
            outputs: result?.outputs ?? [],
            inputs: result?.inputs ?? [],
          });
        }
      } catch {
        if (!cancelled) setUnblinding({ outputs: [], inputs: [] });
      }
    };
    fetch();
    return () => {
      cancelled = true;
    };
  }, [wallet, txId]);

  // Keep the rows out of the modal until we know the wallet has data
  // to share. Rendering placeholders during the fetch (1-2 frames on a
  // warm wallet) would only flicker the layout.
  if (!unblinding) return null;
  const { outputs, inputs } = unblinding;
  if (outputs.length === 0 && inputs.length === 0) return null;

  const payload = encodePayload(txId, outputs, inputs);
  const explorerLink = `${combineURLs(baseExplorerUrl, `transaction/${txId}`)}#unblind=${payload}`;

  const onCopy = () => {
    Clipboard.setString(payload);
    setCopying(true);
    setTimeout(() => setCopying(false), 1500);
  };

  // Share/external-link glyph reserved for the row that hands off to
  // mobile Safari; the copy row uses FontAwesome's `faCopy` to read as
  // "writes to clipboard" rather than "opens elsewhere".
  const explorerIcon = <Image source={icShareActive} width={24} height={24} />;
  const copyIcon = (
    <FontAwesomeIcon icon={faCopy} size={20} color={COLORS.textColorShadow} />
  );

  return (
    <>
      <ListButton
        title={t`View in Explorer unblinded`}
        button={explorerIcon}
        onPress={() => Linking.openURL(explorerLink)}
        titleStyle={{ color: COLORS.textColorShadow }}
      />
      <ListButton
        title={copying ? t`Copied to clipboard!` : t`Copy unblinding values`}
        button={copyIcon}
        onPress={onCopy}
        titleStyle={{ color: copying ? COLORS.primary : COLORS.textColorShadow }}
      />
    </>
  );
};

export default AuditUnblindingRows;
