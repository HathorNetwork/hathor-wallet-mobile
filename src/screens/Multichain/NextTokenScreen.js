/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import HathorHeader from '../../components/HathorHeader';
import OfflineBar from '../../components/OfflineBar';
import { ChainTag } from '../../components/Multichain/ChainTag';
import { NextBalanceView } from '../../components/Multichain/MultichainTokenBody';
import { NextTxDetailsModal } from '../../components/Multichain/NextTxDetailsModal';
import { NextTxRow } from '../../components/Multichain/NextTxRow';
import { TokenHistoryList } from '../../components/Multichain/TokenHistoryList';
import { TransferDetailsModal } from '../../components/Multichain/TransferDetailsModal';
import { TransferRow } from '../../components/Multichain/TransferRow';
import { multichainNextHistoryRequested } from '../../actions';
import { nextAmountForDisplay } from '../../multichain/amount';
import { isSideChainConnected } from '../../multichain/gating';
import { HISTORY_ROW, HISTORY_VIEW, tokenHistory } from '../../multichain/history';
import { TOKEN_DOWNLOAD_STATUS } from '../../sagas/tokens';
import { getDisplayAmountFormat, renderHomeValue } from '../../utils';
import { COLORS } from '../../styles/themes';

/**
 * A token only Hathor Next has: its balance and its history, with Hathor Next's rules. An
 * incoming payment has no sender, the fee is a row of its own, and the statuses are Hathor Next's.
 * It closes when the side chain is turned off.
 */
export default function NextTokenScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const { tokenId } = route.params;
  const connected = useSelector(isSideChainConnected);
  const token = useSelector((state) => state.multichain.next.tokens[tokenId]);
  const available = useSelector(
    (state) => state.multichain.next.balances[tokenId]?.data?.available ?? 0n,
  );
  const sweeping = useSelector((state) => state.multichain.next.sweeping);
  const history = useSelector((state) => state.multichain.next.history[tokenId]);
  // Transfers to this wallet arrive here as the native token: each shows as its arrival.
  const transfers = useSelector((state) => state.multichain.transfers);
  const hathorDecimalPlaces = useSelector((state) => state.serverInfo?.decimal_places ?? 2);
  const amountFormat = useSelector(getDisplayAmountFormat);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedTransfer, setSelectedTransfer] = useState(null);

  useEffect(() => {
    dispatch(multichainNextHistoryRequested({ tokenId }));
  }, [tokenId]);

  useEffect(() => {
    if (!connected) {
      navigation.goBack();
    }
  }, [connected]);

  const rows = useMemo(() => tokenHistory({
    view: HISTORY_VIEW.HATHOR_NEXT,
    ids: { hathor: null, next: tokenId },
    hathorTxs: [],
    hathorHasMore: false,
    nextRows: history?.data ?? [],
    nextHasMore: Boolean(history) && history.cursor !== null,
    transfers,
  }), [tokenId, history, transfers]);

  if (!token) {
    return null;
  }

  const shown = nextAmountForDisplay(available, hathorDecimalPlaces);
  const balance = renderHomeValue(shown.amount, false, shown.decimalPlaces, amountFormat);
  const status = history?.status ?? TOKEN_DOWNLOAD_STATUS.LOADING;

  return (
    <View style={styles.wrapper}>
      <HathorHeader
        title={token.name.toUpperCase()}
        onBackPress={() => navigation.goBack()}
      />
      <NextBalanceView balance={balance} symbol={token.symbol} sweeping={sweeping}>
        <ChainTag style={styles.chain} />
      </NextBalanceView>
      <TokenHistoryList
        rows={rows}
        loading={status === TOKEN_DOWNLOAD_STATUS.LOADING}
        failed={status === TOKEN_DOWNLOAD_STATUS.FAILED}
        onRetry={() => dispatch(multichainNextHistoryRequested({ tokenId }))}
        renderRow={(row) => (row.kind === HISTORY_ROW.NEXT ? (
          <NextTxRow row={row.data} amountFormat={amountFormat} onPress={setSelectedRow} />
        ) : (
          <TransferRow
            transfer={row.data}
            kind={row.kind}
            symbol={token.symbol}
            hathorDecimalPlaces={hathorDecimalPlaces}
            amountFormat={amountFormat}
            onPress={setSelectedTransfer}
          />
        ))}
        onEndReached={() => dispatch(multichainNextHistoryRequested({ tokenId, more: true }))}
      />
      <NextTxDetailsModal
        row={selectedRow}
        token={token}
        onDismiss={() => setSelectedRow(null)}
      />
      <TransferDetailsModal
        transfer={selectedTransfer}
        symbol={token.symbol}
        hathorDecimalPlaces={hathorDecimalPlaces}
        onDismiss={() => setSelectedTransfer(null)}
      />
      <OfflineBar />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.lowContrastDetail,
    alignItems: 'center',
  },
  chain: {
    marginTop: 12,
    alignSelf: 'center',
  },
});
