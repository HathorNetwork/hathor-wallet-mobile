/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import { TransferDetailsModal } from './TransferDetailsModal';
import { TransferRow } from './TransferRow';
import { isSideChainConnected } from '../../multichain/gating';
import { HISTORY_ROW } from '../../multichain/history';
import { TRANSFER_STATUS } from '../../multichain/state';
import { getDisplayAmountFormat } from '../../utils';
import { COLORS } from '../../styles/themes';

/**
 * The transfers of a Hathor Network token that are still on their way to Hathor Next, or that
 * failed, above the token's history where the token shows on Hathor Network alone (no token map
 * merges it): the transaction the transfer left in shows there as a plain payment, and this says
 * where the transfer stands.
 *
 * @param {Object} props
 * @param {{ uid: string, symbol: string }} props.token
 */
export function TransfersOnTheirWay({ token }) {
  const connected = useSelector(isSideChainConnected);
  const transfers = useSelector((state) => state.multichain.transfers);
  const hathorDecimalPlaces = useSelector((state) => state.serverInfo?.decimal_places ?? 2);
  const amountFormat = useSelector(getDisplayAmountFormat);
  const [selected, setSelected] = useState(null);

  const open = connected
    ? transfers.filter((transfer) => transfer.hathorTokenId === token.uid
      && transfer.status !== TRANSFER_STATUS.ARRIVED)
    : [];
  if (!open.length) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{t`Transfers between chains`}</Text>
      {open.map((transfer) => (
        <TransferRow
          key={transfer.id}
          transfer={transfer}
          kind={HISTORY_ROW.TRANSFER}
          symbol={token.symbol}
          hathorDecimalPlaces={hathorDecimalPlaces}
          amountFormat={amountFormat}
          onPress={setSelected}
        />
      ))}
      <TransferDetailsModal
        transfer={selected}
        symbol={token.symbol}
        hathorDecimalPlaces={hathorDecimalPlaces}
        onDismiss={() => setSelected(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.backgroundColor,
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textColorShadow,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
