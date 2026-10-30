/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import FitText from '../FitText';
import { ChainFilter } from './ChainFilter';
import { ChainMark } from './ChainTag';
import { NextTxDetailsModal } from './NextTxDetailsModal';
import { NextTxRow } from './NextTxRow';
import { SimulatedTagIfMock } from './SimulatedTag';
import { SyncingNotice } from './SyncingNotice';
import { TokenHistoryList } from './TokenHistoryList';
import { TransferDetailsModal } from './TransferDetailsModal';
import { TransferRow } from './TransferRow';
import { multichainNextHistoryRequested } from '../../actions';
import { hathorToNextAmount, nextAmountForDisplay } from '../../multichain/amount';
import { CHAIN, NEXT_COLORS } from '../../multichain/chains';
import { HISTORY_ROW, HISTORY_VIEW, tokenHistory } from '../../multichain/history';
import { arrivingAmounts } from '../../multichain/tokens';
import { TOKEN_DOWNLOAD_STATUS } from '../../sagas/tokens';
import { getDisplayAmountFormat, renderHomeValue } from '../../utils';
import { COLORS } from '../../styles/themes';

const isLoading = (status) => (
  !status
  || status === TOKEN_DOWNLOAD_STATUS.LOADING
  || status === TOKEN_DOWNLOAD_STATUS.INVALIDATED
);

/**
 * A Hathor Next balance, as the token screen shows it: while the first sync runs, it is a rising
 * lower bound and says so.
 *
 * @param {Object} props
 * @param {string} props.balance As shown
 * @param {string} props.symbol
 * @param {boolean} props.sweeping
 * @param {React.ReactNode} [props.children] Under the label
 */
export const NextBalanceView = ({ balance, symbol, sweeping, children = null }) => (
  <View style={styles.balanceView}>
    <FitText style={styles.balance}>{`${balance} ${symbol}`}</FitText>
    <Text style={styles.balanceLabel}>
      {sweeping ? t`Available Balance (so far)` : t`Available Balance`}
    </Text>
    {children}
    <SimulatedTagIfMock style={styles.simulated} />
    {sweeping && <SyncingNotice style={styles.syncing} />}
  </View>
);

/**
 * The token screen of a token on both chains: its balance and history on all chains, or on one,
 * picked with the chain chip. Hathor Network's own view is the token screen it always was: the
 * screen passes its balance view and its transaction rows in.
 *
 * @param {Object} props
 * @param {{ uid: string, name: string, symbol: string }} props.token The Hathor Network token
 * @param {string} props.nextTokenId Its id on Hathor Next
 * @param {{ status: string, data?: Object[] }} props.hathorHistory state.tokensHistory[uid]
 * @param {Function} props.fetchMoreHathor Loads Hathor Network's next page; resolves to how many
 *   rows it added
 * @param {Function} props.retryHathor
 * @param {Function} props.renderHathorBalance
 * @param {Function} props.renderHathorTx Called with a transaction and an accessory to show in it
 */
export function MultichainTokenBody({
  token,
  nextTokenId,
  hathorHistory,
  fetchMoreHathor,
  retryHathor,
  renderHathorBalance,
  renderHathorTx,
}) {
  const dispatch = useDispatch();
  const [view, setView] = useState(HISTORY_VIEW.ALL);
  const [hathorHasMore, setHathorHasMore] = useState(true);
  const [selectedNextRow, setSelectedNextRow] = useState(null);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const loadingMore = useRef(false);

  const hathorAvailable = useSelector(
    (state) => state.tokensBalance[token.uid]?.data?.available ?? 0n,
  );
  const hathorDecimalPlaces = useSelector((state) => state.serverInfo?.decimal_places ?? 2);
  const nextToken = useSelector((state) => state.multichain.next.tokens[nextTokenId]);
  const nextAvailable = useSelector(
    (state) => state.multichain.next.balances[nextTokenId]?.data?.available ?? 0n,
  );
  const nextHistory = useSelector((state) => state.multichain.next.history[nextTokenId]);
  const sweeping = useSelector((state) => state.multichain.next.sweeping);
  const transfers = useSelector((state) => state.multichain.transfers);
  const amountFormat = useSelector(getDisplayAmountFormat);

  useEffect(() => {
    dispatch(multichainNextHistoryRequested({ tokenId: nextTokenId }));
  }, [nextTokenId]);

  const ids = { hathor: token.uid, next: nextTokenId };
  const hathorTxs = hathorHistory?.data ?? [];
  const nextRows = nextHistory?.data ?? [];
  const nextHasMore = Boolean(nextHistory) && nextHistory.cursor !== null;
  const rows = useMemo(() => tokenHistory({
    view,
    ids,
    hathorTxs,
    hathorHasMore,
    nextRows,
    nextHasMore,
    transfers,
  }), [view, token.uid, nextTokenId, hathorTxs, hathorHasMore, nextRows, nextHasMore, transfers]);

  const { arriving, inFlight } = arrivingAmounts(transfers, ids, hathorDecimalPlaces);
  const shownNext = (amount) => {
    const shown = nextAmountForDisplay(amount, hathorDecimalPlaces);
    return renderHomeValue(shown.amount, false, shown.decimalPlaces, amountFormat);
  };
  const totalBalance = shownNext(
    hathorToNextAmount(hathorAvailable, hathorDecimalPlaces) + nextAvailable + inFlight,
  );
  const nextBalance = shownNext(nextAvailable);
  const hathorBalance = renderHomeValue(hathorAvailable, false, hathorDecimalPlaces, amountFormat);
  const options = [
    { view: HISTORY_VIEW.ALL, balance: `${totalBalance} ${token.symbol}` },
    { view: HISTORY_VIEW.HATHOR, balance: `${hathorBalance} ${token.symbol}` },
    { view: HISTORY_VIEW.HATHOR_NEXT, balance: `${nextBalance} ${token.symbol}` },
  ];
  const filter = <ChainFilter view={view} options={options} onChange={setView} />;

  const showsHathor = view !== HISTORY_VIEW.HATHOR_NEXT;
  const showsNext = view !== HISTORY_VIEW.HATHOR;
  const loading = (showsHathor && isLoading(hathorHistory?.status))
    || (showsNext && isLoading(nextHistory?.status));
  const failed = (showsHathor && hathorHistory?.status === TOKEN_DOWNLOAD_STATUS.FAILED)
    || (showsNext && nextHistory?.status === TOKEN_DOWNLOAD_STATUS.FAILED);

  const retry = () => {
    if (hathorHistory?.status === TOKEN_DOWNLOAD_STATUS.FAILED) {
      retryHathor();
    }
    if (nextHistory?.status === TOKEN_DOWNLOAD_STATUS.FAILED) {
      dispatch(multichainNextHistoryRequested({ tokenId: nextTokenId }));
    }
  };

  const loadMore = async () => {
    if (showsNext && nextHasMore) {
      dispatch(multichainNextHistoryRequested({ tokenId: nextTokenId, more: true }));
    }
    if (showsHathor && hathorHasMore && !loadingMore.current) {
      loadingMore.current = true;
      try {
        const added = await fetchMoreHathor();
        if (!added) {
          setHathorHasMore(false);
        }
      } finally {
        loadingMore.current = false;
      }
    }
  };

  // Where rows of both chains mix, each one shows its chain.
  const mark = (chain) => (
    view === HISTORY_VIEW.ALL ? <ChainMark chain={chain} withName style={styles.rowMark} /> : null
  );

  const renderRow = (row) => {
    switch (row.kind) {
      case HISTORY_ROW.HATHOR:
        return renderHathorTx(row.data, mark(CHAIN.HATHOR));
      case HISTORY_ROW.NEXT:
        return (
          <NextTxRow
            row={row.data}
            amountFormat={amountFormat}
            onPress={setSelectedNextRow}
            accessory={mark(CHAIN.HATHOR_NEXT)}
          />
        );
      default:
        return (
          <TransferRow
            transfer={row.data}
            kind={row.kind}
            symbol={token.symbol}
            hathorDecimalPlaces={hathorDecimalPlaces}
            amountFormat={amountFormat}
            onPress={setSelectedTransfer}
          />
        );
    }
  };

  const renderBalance = () => {
    if (view === HISTORY_VIEW.HATHOR) {
      return (
        <View style={styles.hathorBalance}>
          {renderHathorBalance()}
          {filter}
        </View>
      );
    }
    if (view === HISTORY_VIEW.HATHOR_NEXT) {
      return (
        <NextBalanceView balance={nextBalance} symbol={token.symbol} sweeping={sweeping}>
          {filter}
        </NextBalanceView>
      );
    }
    const arrivingText = arriving > 0n ? shownNext(arriving) : null;
    return (
      <NextBalanceView balance={totalBalance} symbol={token.symbol} sweeping={sweeping}>
        {arrivingText && (
          <Text style={styles.arriving}>{t`${arrivingText} ${token.symbol} arriving`}</Text>
        )}
        {filter}
      </NextBalanceView>
    );
  };

  return (
    <>
      {renderBalance()}
      <TokenHistoryList
        rows={rows}
        loading={loading}
        failed={failed}
        onRetry={retry}
        renderRow={renderRow}
        onEndReached={loadMore}
      />
      <NextTxDetailsModal
        row={selectedNextRow}
        token={nextToken}
        onDismiss={() => setSelectedNextRow(null)}
      />
      <TransferDetailsModal
        transfer={selectedTransfer}
        symbol={token.symbol}
        hathorDecimalPlaces={hathorDecimalPlaces}
        onDismiss={() => setSelectedTransfer(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  balanceView: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 54,
  },
  hathorBalance: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingBottom: 16,
  },
  balance: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  balanceLabel: {
    paddingTop: 8,
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textColorShadow,
  },
  arriving: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: 'bold',
    color: NEXT_COLORS.accentText,
  },
  simulated: {
    marginTop: 8,
    alignSelf: 'center',
  },
  syncing: {
    marginTop: 16,
  },
  rowMark: {
    marginTop: 2,
  },
});
