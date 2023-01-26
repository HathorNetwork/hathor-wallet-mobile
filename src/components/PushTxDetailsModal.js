import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import Modal from 'react-native-modal';
import { t } from 'ttag';
import { ListItem } from './HathorList';
import SlideIndicatorBar from './SlideIndicatorBar';
import { TxHistory } from '../models';
import { PublicExplorerListButton } from './PublicExplorerListButton';

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
const getTokenBalance = (token, isNFT) => {
  const dividend = isNFT ? 1 : 100;
  const decimal = isNFT ? 0 : 2;
  return (token.balance / dividend).toFixed(decimal);
};

export default function PushTxDetailsModal(props) {
  const { tx, tokens, isNft } = props;

  const idStr = getShortHash(tx.txId, 12);
  const timestampStr = getTimestampFormat(tx);

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
            {tokens.map((token) => (
              <ListItem
                titleStyle={token.isRegistered && style.registeredToken}
                key={token.uid}
                title={getTokenTitle(token)}
                text={getTokenBalance(token, isNft)}
              />
            ))}
            <ListItem title={t`Date & Time`} text={timestampStr} />
            <ListItem title={t`ID`} text={idStr} />
            <PublicExplorerListButton txId={tx.txId} />
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
