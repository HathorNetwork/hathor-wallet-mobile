import React from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Image,
  TouchableWithoutFeedback,
  TouchableHighlight
} from 'react-native';
import { connect } from 'react-redux';
import * as Keychain from 'react-native-keychain';

import HathorHeader from '../components/HathorHeader';
import SimpleButton from '../components/SimpleButton';
import TxDetailsModal from '../components/TxDetailsModal';
import moment from 'moment';
import OfflineBar from '../components/OfflineBar';

import hathorLib from '@hathor/wallet-lib';


/**
 * txList {Array} array with transactions of the selected token
 * balance {Object} object with token balance {'available', 'locked'}
 * selectedToken {string} uid of the selected token
 */
const mapStateToProps = (state) => ({
  txList: state.tokensHistory[state.selectedToken.uid] || [],
  balance: state.tokensBalance[state.selectedToken.uid] || {available: 0, locked: 0},
  selectedToken: state.selectedToken,
  isOnline: state.isOnline,
  network: state.serverInfo.network,
})

class MainScreen extends React.Component {
  /**
   * modal {Optional[Modal]}
   *   It is null if there is no modal to be shown.
   *   It must be set to the Modal object to be shown. It can by any modal.
   *   Currently, it is used to show the TxDetailsModal.
   */
  state = {
    modal: null,
  };

  style = StyleSheet.create({
    pickerContainerStyle: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
    }
  });

  closeTxDetails = () => {
    this.setState({modal: null});
  }

  onTxPress = (tx) => {
    const txDetailsModal = (
      <TxDetailsModal
        tx={tx}
        token={this.props.selectedToken}
        onRequestClose={this.closeTxDetails}
      />
    );
    this.setState({modal: txDetailsModal});
  }

  tokenInfo = () => {
    if (this.props.selectedToken.uid !== hathorLib.constants.HATHOR_TOKEN_CONFIG.uid) {
      this.props.navigation.navigate('TokenDetail');
    }
  }

  render() {
    const renderTxHistory = () => {
      if (this.props.txList && (this.props.txList.length > 0)) {
        return (
          <TxHistoryView txList={this.props.txList} token={this.props.selectedToken} onTxPress={this.onTxPress} />
        );
      } else {
        //empty history
        return <Text style={{ fontSize: 16, textAlign: "center" }}>You don't have any transactions</Text>;
      }
    }

    const renderRightElement = () => {
      if (this.props.selectedToken.uid !== hathorLib.constants.HATHOR_TOKEN_CONFIG.uid) {
        return (
          <SimpleButton
            icon={require('../assets/icons/info-circle.png')}
            onPress={this.tokenInfo}
          />
        );
      }

      return null;
    }

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7', justifyContent: "center", alignItems: "center" }}>
        {this.state.modal}
        <HathorHeader
          title={this.props.selectedToken.name.toUpperCase()}
          onBackPress={() => this.props.navigation.goBack()}
          rightElement={renderRightElement()}
          wrapperStyle={{ borderBottomWidth: 0 }}
        />
        <BalanceView network={this.props.network} balance={this.props.balance} token={this.props.selectedToken} />
        <View style={{ flex: 1, justifyContent: "center", alignSelf: "stretch" }}>
          {renderTxHistory()}
        </View>
        <OfflineBar />
      </SafeAreaView>
    );
  }
}

class TxHistoryView extends React.Component {
  renderItem = ({item, index}) => {
    const isFirst = (index == 0);
    const isLast = (index == (this.props.txList.length - 1));
    return <TxListItem item={item} isFirst={isFirst} isLast={isLast} token={this.props.token} onTxPress={this.props.onTxPress} />
  }

  render() {
    return (
      <View style={{ flex: 1, alignSelf: "stretch" }}>
        <FlatList
          data={this.props.txList}
          renderItem={this.renderItem}
          keyExtractor={(item, index) => item.tx_id}
        />
      </View>
    );
  }
}

class TxListItem extends React.Component {
  state = {timestamp: null};

  style = StyleSheet.create({
    container: {
      marginLeft: 16,
      marginRight: 16,
      marginTop: 0,
      marginBottom: 2,
    },
    view: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'white',
      height: 80,
    },
    firstItemBorder: {
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    },
    lastItemBorder: {
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
    },
    middleView: {
      flex: 1,
    },
    icon: {
      marginLeft: 16,
      marginRight: 16,
      width: 24,
      height: 24,
    },
    iconDisabled: {
      opacity: 0.3,
    },
    balance: {
      fontSize: 16,
      marginRight: 16,
    },
    description: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: 'bold',
    },
    timestamp: {
      fontSize: 12,
      lineHeight: 20,
      color: 'rgba(0, 0, 0, 0.5)',
    },
  });

  styleVoided = Object.assign({}, this.style, StyleSheet.create({
    description: {
      ...this.style.description,
      color: 'rgba(0, 0, 0, 0.3)',
    },
    timestamp: {
      ...this.style.timestamp,
      color: 'rgba(0, 0, 0, 0.3)',
    },
    balance: {
      ...this.style.balance,
      color: 'rgba(0, 0, 0, 0.3)',
      textDecorationLine: 'line-through',
    },
  }));

  stylePositive = Object.assign({}, this.style, StyleSheet.create({
    balance: {
      ...this.style.balance,
      color: '#0DA0A0',
      fontWeight: 'bold',
    },
  }));

  componentDidMount() {
    this.updateTimestamp();
  }

  componentWillUnmount() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  updateTimestamp = () => {
    const timestamp = this.props.item.getTimestampCalendar();
    if (timestamp !== this.state.timestamp) {
      this.setState({timestamp});
    }

    const diff = moment.unix(this.props.item.timestamp).diff(moment(), 'days', true);
    if (!this.interval && diff >= -6) {
      // Schedule if the transaction timestamp is less than 6 days.
      this.interval = setInterval(this.updateTimestamp, 10000);
    } else if (this.interval && diff < -6) {
      // Otherwise, the timestamp text will never be updated.
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getImage(item) {
    if (item.balance === 0) {
      return <View style={this.style.icon} />;
    }
    let icon;
    let style = [this.style.icon];
    if (item.is_voided) {
      style.push(this.style.iconDisabled);
    }
    if (item.balance > 0) {
      icon = require('../assets/icons/receive-active.png');
    } else if (item.balance < 0) {
      icon = require('../assets/icons/send-active.png');
    } else {
      throw "should not happen";
    }
    return <Image style={style} source={icon} width={24} height={24} />;
  }

  getStyle(item) {
    if (item.is_voided) {
      return this.styleVoided;

    } else if (item.balance > 0) {
      return this.stylePositive;

    } else {
      return this.style;
    }
  }

  getDescription(item) {
    return item.getDescription(this.props.token);
  }

  onItemPress(item) {
    this.props.onTxPress(item);
  }

  render() {
    const item = this.props.item;
    const style = this.getStyle(item);
    const image = this.getImage(item);

    const viewStyle = [style.view];
    const touchStyle = [];
    if (this.props.isFirst) {
      viewStyle.push(style.firstItemBorder);
      touchStyle.push(style.firstItemBorder);
    }
    if (this.props.isLast) {
      viewStyle.push(style.lastItemBorder);
      touchStyle.push(style.lastItemBorder);
    }

    const balanceStr = hathorLib.helpers.prettyValue(item.balance);
    const description = item.getDescription(this.props.token);
    const timestamp = this.state.timestamp;
    return (
      <View style={style.container}>
        <TouchableHighlight style={touchStyle} onPress={() => this.onItemPress(item)}>
          <View style={viewStyle}>
            {image}
            <View style={style.middleView}>
              <Text style={style.description}>{description}</Text>
              <Text style={style.timestamp}>{timestamp}</Text>
            </View>
            <Text style={style.balance} numberOfLines={1}>{balanceStr}</Text>
          </View>
        </TouchableHighlight>
      </View>
    )
  }
}

class BalanceView extends React.Component {
  state = {
    isExpanded: false,
  };

  style = StyleSheet.create({
    toucharea: {
      alignSelf: 'stretch',
    },
    center: {
      alignItems: 'center',
    },
    view: {
      paddingTop: 32,
      paddingLeft: 54,
      paddingRight: 54,
    },
    balanceLocked: {
      marginTop: 24,
      fontSize: 18,
      fontWeight: 'bold',
    },
    balanceAvailable: {
      fontSize: 32,
      fontWeight: 'bold',
    },
    text1: {
      paddingTop: 8,
      fontSize: 12,
      fontWeight: 'bold',
      color: 'rgba(0, 0, 0, 0.5)',
    },
    expandButton: {
      marginTop: 24,
      marginBottom: 24,
    },
    networkView: {
      backgroundColor: 'rgba(227, 0, 82, 0.1)',
      padding: 8,
      marginTop: 32,
      borderRadius: 8,
    },
    networkText: {
      color: '#E30052',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });

  toggleExpanded = () => {
    this.setState({isExpanded: !this.state.isExpanded});
  }

  renderExpanded() {
    const availableStr = hathorLib.helpers.prettyValue(this.props.balance.available);
    const lockedStr = hathorLib.helpers.prettyValue(this.props.balance.locked);
    const network = this.props.network;
    const token = this.props.token;
    const style = this.style;
    return (
      <View style={style.center}>
        <Text style={style.balanceAvailable} adjustsFontSizeToFit={true} minimumFontScale={0.5} numberOfLines={1}>
          {availableStr} {token.symbol}
        </Text>
        <Text style={style.text1}>Available Balance</Text>
        <Text style={style.balanceLocked} adjustsFontSizeToFit={true} minimumFontScale={0.5} numberOfLines={1}>
          {lockedStr} {token.symbol}
        </Text>
        <Text style={style.text1}>Locked</Text>
        <View style={style.networkView}>
          <Text style={style.networkText}>{network}</Text>
        </View>
        <Image style={style.expandButton} source={require('../assets/icons/chevron-up.png')} width={12} height={7} />
      </View>
    );
  }

  renderSimple() {
    const availableStr = hathorLib.helpers.prettyValue(this.props.balance.available);
    const token = this.props.token;
    const style = this.style;
    return (
      <View style={style.center}>
        <Text style={style.balanceAvailable} adjustsFontSizeToFit={true} minimumFontScale={0.5} numberOfLines={1}>
          {availableStr} {token.symbol}
        </Text>
        <Text style={style.text1}>Available Balance</Text>
        <Image style={style.expandButton} source={require('../assets/icons/chevron-down.png')} width={12} height={7} />
      </View>
    );
  }

  render() {
    const style = this.style;
    return (
      <TouchableWithoutFeedback style={style.toucharea} onPress={this.toggleExpanded}>
        <View style={style.view}>
          {!this.state.isExpanded
            ? this.renderSimple()
            : this.renderExpanded()
          }
        </View>
      </TouchableWithoutFeedback>
    );
  }
}


export default connect(mapStateToProps)(MainScreen)
