/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { getShortHash, isTokenNFT, renderValue } from '../utils';
import { TxHistory } from '../models';
import { updateSelectedToken } from '../actions';
import HathorModal from './HathorModal';
import SlideIndicatorBar from './SlideIndicatorBar';
import { ListButton, ListItem } from './HathorList';
import { PublicExplorerListButton } from './PublicExplorerListButton';
import { COLORS } from '../styles/themes';

const style = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
  },
  registeredToken: {
    color: COLORS.primary,
  },
  wrapperView: {
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 8,
  },
});

const getTimestampFormat = (tx) => {
  const txHistory = new TxHistory({ txId: tx.txId, timestamp: tx.timestamp });
  const timestampStr = txHistory.getTimestampFormat();
  return timestampStr;
};

const getTokenTitle = (token) => `${token.symbol} - ${token.name}`;
const getTokenBalance = (token, isNFT) => renderValue(token.balance, isNFT);

export default function PushTxDetailsModal(props) {
  const { tx, tokens } = props;
  const tokenMetadata = useSelector((state) => state.tokenMetadata);
  const dispatch = useDispatch();

  const idStr = getShortHash(tx.txId, 12);
  const timestampStr = getTimestampFormat(tx);
  const navigateToTokenDetailPage = (token) => {
    if (!token.isRegistered) {
      return;
    }

    props.onRequestClose();
    dispatch(updateSelectedToken(token));
    props.navigation.navigate('MainScreen');
  };

  return (
    <HathorModal onDismiss={props.onRequestClose} viewStyle={style.wrapperView}>
      <SlideIndicatorBar />
      <NewTransactionTitle />
      <View>
        {tokens.map((token) => (
          <ListButton
            key={token.uid}
            onPress={() => navigateToTokenDetailPage(token)}
            title={getTokenTitle(token)}
            titleStyle={token.isRegistered && style.registeredToken}
            button={(
              <Text>{getTokenBalance(token, isTokenNFT(token.uid, tokenMetadata))}</Text>
            )}
          />
        ))}
        <ListItem title={t`Date & Time`} text={timestampStr} />
        <ListItem title={t`ID`} text={idStr} />
        <PublicExplorerListButton txId={tx.txId} />
      </View>
    </HathorModal>
  );
}

const styleModalTitle = StyleSheet.create({
  view: {
    marginTop: 32,
    marginBottom: 32,
    alignItems: 'center',
    paddingLeft: 54,
    paddingRight: 54,
  },
  text1: {
    fontSize: 18,
    paddingTop: 8,
  },
});

function NewTransactionTitle() {
  return (
    <View style={styleModalTitle.view}>
      <Text style={styleModalTitle.text1}>{t`New Transaction`}</Text>
    </View>
  );
}
