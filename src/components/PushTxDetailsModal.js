import React from 'react';
import { Image, Linking, Text, StyleSheet, View } from 'react-native';
import Modal from 'react-native-modal';
import { t } from 'ttag';

import { getShortHash } from '../utils';
import { ListButton, ListItem } from './HathorList';
import SlideIndicatorBar from './SlideIndicatorBar';
import icShareActive from '../assets/icons/icShareActive.png';
import { TxHistory } from '../models';

const style = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
  },
  registeredToken: {
    color: '#8C46FF',
  },
  inner: {
    backgroundColor: '#fff',
    borderRadius: 8,
  },
});

const getTimestampFormat = (tx) => {
  const txHistory = new TxHistory({ txId: tx.txId, timestamp: tx.timestamp });
  const timestampStr = txHistory.getTimestampFormat();
  return timestampStr;
};

const getTokenTitle = (token) => `${token.symbol} - ${token.name}`;
const getTokenBalance = (token) => (token.balance / 100).toFixed(2);

export default function PushTxDetailsModal(props) {
  const { tx, tokens } = props;

  const idStr = getShortHash(tx.txId, 12);
  const timestampStr = getTimestampFormat(tx);
  const explorerIcon = <Image source={icShareActive} width={24} height={24} />;
  const explorerLink = `https://explorer.hathor.network/transaction/${tx.txId}`;

  return (
    <Modal
      isVisible
      animationIn='slideInUp'
      swipeDirection={['down']}
      onSwipeComplete={props.onRequestClose}
      onBackButtonPress={props.onRequestClose}
      onBackdropPress={props.onRequestClose}
      style={style.modal}
    >
      <View>
        <View style={style.inner}>
          <SlideIndicatorBar />
          <NewTransactionTitle />
          <View>
            {tokens.map((token) => (<ListItem titleStyle={token.isRegistered && style.registeredToken} key={token.uid} title={getTokenTitle(token)} text={getTokenBalance(token)} />))}
            <ListItem title={t`Date & Time`} text={timestampStr} />
            <ListItem title={t`ID`} text={idStr} />
            <ListButton title={t`Public Explorer`} button={explorerIcon} onPress={() => { Linking.openURL(explorerLink); }} titleStyle={{ color: 'rgba(0, 0, 0, 0.5)' }} isLast />
          </View>
        </View>
      </View>
    </Modal>
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
