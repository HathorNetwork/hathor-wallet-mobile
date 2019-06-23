import React, {Component} from 'react';
import {
  Text,
  TouchableHighlight,
  StyleSheet,
  View,
  Image,
  Share,
} from 'react-native';
import moment from 'moment';
import hathorLib from '@hathor/wallet-lib';
import { getShortHash, getTokenLabel } from '../utils';
import Modal from "react-native-modal";
import { ListItem, ListButton } from './HathorList';
import SlideIndicatorBar from './SlideIndicatorBar';

class TxDetailsModal extends Component {
  style = StyleSheet.create({
    modal: {
      justifyContent: 'flex-end',
    },
    inner: {
      backgroundColor: '#fff',
      borderRadius: 8,
    },
  });

  render() {
    const {tx, ...props} = this.props;
    const fullTokenStr = getTokenLabel(this.props.token);
    const description = tx.getDescription(this.props.token);
    const timestampStr = tx.getTimestampFormat();
    const idStr = getShortHash(tx.tx_id, 12);
    return (
      <Modal
        isVisible={true}
        animationIn='slideInUp'
        swipeDirection={['down']}
        onSwipeComplete={this.props.onRequestClose}
        onBackButtonPress={this.props.onRequestClose}
        onBackdropPress={this.props.onRequestClose}
        style={this.style.modal}
      >
        <View>
          <View style={this.style.inner}>
            <SlideIndicatorBar />
            <BalanceView tx={tx} token={this.props.token} />
            <View>
              <ListItem title='Token' text={fullTokenStr} />
              <ListItem title='Description' text={description} />
              <ListItem title='Date & Time' text={timestampStr} />
              <ListItem title='ID' text={idStr} isLast={true} />
            </View>
          </View>
        </View>
      </Modal>
    );
  }
}

class BalanceView extends Component {
  style = StyleSheet.create({
    view: {
      marginTop: 32,
      marginBottom: 32,
      alignItems: 'center',
      paddingLeft: 54,
      paddingRight: 54,
    },
    balance: {
      fontSize: 32,
      fontWeight: 'bold',
    },
    text1: {
      paddingTop: 8,
      fontSize: 12,
      fontWeight: 'bold',
      color: 'rgba(0, 0, 0, 0.5)',
    },
  });

  render() {
    const tx = this.props.tx;
    const balanceStr = hathorLib.helpers.prettyValue(tx.balance);
    return (
      <View style={this.style.view}>
        <Text style={this.style.balance} adjustsFontSizeToFit={true} minimumFontScale={0.5} numberOfLines={1}>
          {balanceStr} {this.props.token.symbol}
        </Text>
        <Text style={this.style.text1}>Amount</Text>
      </View>
    );
  }
}

export default TxDetailsModal;
