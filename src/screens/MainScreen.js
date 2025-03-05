/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  Image,
  TouchableWithoutFeedback,
  TouchableHighlight,
} from 'react-native';
import { connect } from 'react-redux';
import { t } from 'ttag';
import { get } from 'lodash';

import moment from 'moment';
import hathorLib from '@hathor/wallet-lib';
import IconTabBar from '../icon-font';
import HathorHeader from '../components/HathorHeader';
import SimpleButton from '../components/SimpleButton';
import TxDetailsModal from '../components/TxDetailsModal';
import OfflineBar from '../components/OfflineBar';
import { HathorList } from '../components/HathorList';
import { Strong, str2jsx, renderValue, isTokenNFT } from '../utils';
import chevronUp from '../assets/icons/chevron-up.png';
import chevronDown from '../assets/icons/chevron-down.png';
import { IS_MULTI_TOKEN } from '../constants';
import { fetchMoreHistory, updateTokenHistory } from '../actions';
import Spinner from '../components/Spinner';
import { TOKEN_DOWNLOAD_STATUS } from '../sagas/tokens';
import { COLORS } from '../styles/themes';
import { HathorFlatList } from '../components/HathorFlatList';
import { ActionDot } from '../components/Icons/ActionDot.icon';
import { getNetworkSettings } from '../sagas/helpers';

// Declare BigInt for ESLint
/* global BigInt */

/**
 * txList {Array} array with transactions of the selected token
 * balance {Object} object with token balance {'available', 'locked'}
 * selectedToken {string} uid of the selected token
 */
const mapStateToProps = (state) => ({
  tokenHistory: get(state.tokensHistory, state.selectedToken.uid, {
    status: TOKEN_DOWNLOAD_STATUS.LOADING,
  }),
  // If we are on this screen, we can be sure that the balance is loaded since we don't navigate
  // to it if the status is `failed`
  balance: get(state.tokensBalance, `${state.selectedToken.uid}.data`, { available: 0, locked: 0 }),
  selectedToken: state.selectedToken,
  isOnline: state.isOnline,
  network: getNetworkSettings(state).network,
  wallet: state.wallet,
  tokenMetadata: state.tokenMetadata,
});

const mapDispatchToProps = (dispatch) => ({
  updateTokenHistory: (token, history) => dispatch(updateTokenHistory(token, history)),
  getHistory: (token) => dispatch({
    type: 'TOKEN_FETCH_HISTORY_REQUESTED',
    tokenId: token.uid,
  })
});

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
    },
  });

  closeTxDetails = () => {
    this.setState({ modal: null });
  }

  componentDidMount() {
    this.props.getHistory(this.props.selectedToken);
  }

  isNFT = () => (
    isTokenNFT(get(this.props, 'selectedToken.uid'), this.props.tokenMetadata)
  )

  onTxPress = (tx) => {
    const txDetailsModal = (
      <TxDetailsModal
        tx={tx}
        token={this.props.selectedToken}
        onRequestClose={this.closeTxDetails}
        isNFT={this.isNFT()}
      />
    );
    this.setState({ modal: txDetailsModal });
  }

  tokenInfo = () => {
    if (this.props.selectedToken.uid !== hathorLib.NATIVE_TOKEN_UID) {
      this.props.navigation.navigate('TokenDetail');
    }
  }

  retryTxHistory = () => {
    this.props.getHistory(this.props.selectedToken);
  }

  render() {
    const renderEmptyHistory = () => (
      <HathorList infinity>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Strong>{t`No transactions`}</Strong>
          <Text style={{ marginTop: 8, lineHeight: 20, textAlign: 'center', width: 220 }}>
            {str2jsx(
              t`|share:Share your address| with friends and start exchanging tokens`,
              { share: (x, i) => (
                <Text
                  key={i}
                  onPress={() => this.props.navigation.navigate('Receive')}
                  style={{ color: COLORS.primary, fontWeight: 'bold' }}
                >{x}</Text>
              ) }
            )}
          </Text>
        </View>
      </HathorList>
    );

    const renderLoadingHistory = () => (
      <HathorList infinity>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Strong>{t`Loading transactions`}</Strong>
          <Spinner size={48} animating style={{ marginTop: 32 }} />
        </View>
      </HathorList>
    );

    const renderErrorHistory = () => (
      <HathorList infinity>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 64 }}>
          <Strong style={{ textAlign: 'center' }}>{t`There was an error loading your transaction history`}</Strong>
          <Text style={{ marginTop: 8, lineHeight: 20, textAlign: 'center', width: 220 }}>
            {str2jsx(
              t`Please |tryAgain:try again|`,
              {
                tryAgain: (x, i) => (
                  <Text
                    key={i}
                    onPress={() => this.retryTxHistory()}
                    style={{ color: COLORS.primary, fontWeight: 'bold' }}
                  > {x} </Text>
                )
              }
            )}
          </Text>
        </View>
      </HathorList>
    );

    const renderTxHistory = () => {
      const status = get(this.props.tokenHistory, 'status');
      if (status === 'ready') {
        if (get(this.props.tokenHistory, 'data.length') <= 0) {
          // empty history
          return renderEmptyHistory();
        }

        return (
          <TxHistoryView
            txList={this.props.tokenHistory.data}
            token={this.props.selectedToken}
            onTxPress={this.onTxPress}
            wallet={this.props.wallet}
            updateTokenHistory={this.props.updateTokenHistory}
            isNFT={this.isNFT()}
          />
        );
      }

      if (status === 'loading') {
        return renderLoadingHistory();
      }

      return renderErrorHistory();
    };

    const renderRightElement = () => {
      if (this.props.selectedToken.uid !== hathorLib.NATIVE_TOKEN_UID) {
        return (
          <SimpleButton onPress={this.tokenInfo}>
            <ActionDot />
          </SimpleButton>
        );
      }

      return null;
    };

    return (
      <View style={{
        flex: 1, backgroundColor: COLORS.lowContrastDetail, justifyContent: 'flex-start', alignItems: 'center',
      }}
      >
        {this.state.modal}
        <HathorHeader
          title={this.props.selectedToken.name.toUpperCase()}
          onBackPress={IS_MULTI_TOKEN ? () => this.props.navigation.goBack() : null}
          rightElement={renderRightElement()}
        />
        <BalanceView
          network={this.props.network}
          balance={this.props.balance}
          token={this.props.selectedToken}
          isNFT={this.isNFT()}
        />
        {renderTxHistory()}
        <OfflineBar />
      </View>
    );
  }
}

class TxHistoryView extends React.Component {
  state = { loading: false, canLoadMore: true };

  renderItem = ({ item, index }) => {
    const isFirst = (index === 0);
    const isLast = (index === (this.props.txList.length - 1));
    return (
      <TxListItem
        item={item}
        isFirst={isFirst}
        isLast={isLast}
        token={this.props.token}
        onTxPress={this.props.onTxPress}
        isNFT={this.props.isNFT}
      />
    );
  }

  renderFooter = () => {
    if (!this.state.loading) return null;
    return (
      <View style={{ marginTop: 16 }}>
        <ActivityIndicator />
      </View>
    );
  };

  loadMoreHistory = async () => {
    if (!this.state.canLoadMore) {
      // Already loaded all history
      return;
    }

    this.setState({ loading: true });
    const newHistory = await fetchMoreHistory(
      this.props.wallet,
      this.props.token.uid,
      this.props.txList
    );

    if (newHistory.length) {
      this.props.updateTokenHistory(this.props.token.uid, newHistory);
      this.setState({ loading: false });
    } else {
      this.setState({ canLoadMore: false, loading: false });
    }
  }

  render() {
    return (
      <HathorFlatList
        data={this.props.txList}
        renderItem={this.renderItem}
        keyExtractor={(item) => item.txId}
        onEndReached={this.loadMoreHistory}
        onEndReachedThreshold={0.2}
        ListFooterComponent={this.renderFooter}
      />
    );
  }
}

class TxListItem extends React.Component {
  state = { timestamp: null };

  style = StyleSheet.create({
    view: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      minHeight: 80,
      paddingVertical: 24,
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
    secondaryText: {
      fontSize: 12,
      lineHeight: 20,
      color: COLORS.textColorShadow,
    },
    bold: {
      fontWeight: 'bold',
    },
  });

  styleVoided = ({ ...this.style,
    ...StyleSheet.create({
      description: {
        ...this.style.description,
        color: COLORS.textColorShadowLight,
      },
      timestamp: {
        ...this.style.secondaryText,
        color: COLORS.textColorShadowLight,
      },
      balance: {
        ...this.style.balance,
        color: COLORS.textColorShadowLight,
        textDecorationLine: 'line-through',
      },
    }) });

  stylePositive = ({ ...this.style,
    ...StyleSheet.create({
      balance: {
        ...this.style.balance,
        color: COLORS.positiveBalanceColor,
        fontWeight: 'bold',
      },
    }) });

  componentDidMount() {
    this.updateTimestamp();
  }

  componentWillUnmount() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  onItemPress = (item) => {
    this.props.onTxPress(item);
  }

  getImage = (item) => {
    // Convert balance to BigInt if it's not already
    const balance = typeof item.balance === 'bigint' ? item.balance : BigInt(item.balance || 0);

    if (balance === BigInt(0)) {
      return <View style={this.style.icon} />;
    }

    let name;
    let color;
    const style = [this.style.icon];

    if (balance > BigInt(0)) {
      name = 'icReceive';
      color = COLORS.positiveBalanceColor;
    } else if (balance < BigInt(0)) {
      name = 'icSend';
      color = COLORS.textColor;
    } else {
      throw new Error('should not happen');
    }

    if (item.isVoided) {
      style.push(this.style.iconDisabled);
      color = COLORS.textColorShadowLight;
    }

    return <IconTabBar style={style} color={color} size={24} name={name} />;
  }

  getStyle(item) {
    if (item.isVoided) {
      return this.styleVoided;
    }

    // Convert balance to BigInt if it's not already
    const balance = typeof item.balance === 'bigint' ? item.balance : BigInt(item.balance || 0);

    if (balance > BigInt(0)) {
      return this.stylePositive;
    }
    return this.style;
  }

  getDescription(item) {
    return item.getDescription(this.props.token);
  }

  updateTimestamp = () => {
    const timestamp = this.props.item.getTimestampCalendar();
    if (timestamp !== this.state.timestamp) {
      this.setState({ timestamp });
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

  render() {
    /**
     * @type {{
     *   item: TxHistory;
     * }} TxListItem properties
     */
    const { item } = this.props;
    const style = this.getStyle(item);
    const image = this.getImage(item);

    const balanceStr = renderValue(item.balance, this.props.isNFT);
    const description = item.getDescription(this.props.token);
    const { timestamp } = this.state;
    return (
      <TouchableHighlight
        onPress={() => this.onItemPress(item)}
        underlayColor={COLORS.primaryOpacity30}
      >
        <View style={style.view}>
          {image}
          <View style={style.middleView}>
            <Text style={style.description}>{description}</Text>
            <Text style={style.secondaryText}>{timestamp}</Text>
            <Text style={[style.secondaryText, style.bold]}>{item.getVersionInfo()}</Text>
          </View>
          <Text style={style.balance} numberOfLines={1}>{balanceStr}</Text>
        </View>
      </TouchableHighlight>
    );
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
      color: COLORS.textColorShadow,
    },
    expandButton: {
      marginTop: 24,
      marginBottom: 24,
    },
    networkView: {
      backgroundColor: COLORS.primaryOpacity10,
      padding: 8,
      marginTop: 32,
      borderRadius: 8,
    },
    networkText: {
      color: COLORS.primary,
      fontSize: 16,
      fontWeight: 'bold',
    },
  });

  toggleExpanded = () => {
    this.setState((prevState) => ({ isExpanded: !prevState.isExpanded }));
  }

  renderExpanded() {
    const availableStr = renderValue(this.props.balance.available, this.props.isNFT);
    const lockedStr = renderValue(this.props.balance.locked, this.props.isNFT);
    const { network, token } = this.props;
    const { style } = this;
    return (
      <View style={style.center}>
        <Text
          style={style.balanceAvailable}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          numberOfLines={1}
        >
          {`${availableStr} ${token.symbol}`}
        </Text>
        <Text style={style.text1}>{t`Available Balance`}</Text>
        <Text
          style={style.balanceLocked}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          numberOfLines={1}
        >
          {`${lockedStr} ${token.symbol}`}
        </Text>
        <Text style={style.text1}>{t`Locked`}</Text>
        <View style={style.networkView}>
          <Text style={style.networkText}>{network}</Text>
        </View>
        <Image style={style.expandButton} source={chevronUp} width={12} height={7} />
      </View>
    );
  }

  renderSimple() {
    const availableStr = renderValue(this.props.balance.available, this.props.isNFT);
    const { token } = this.props;
    const { style } = this;
    return (
      <View style={style.center}>
        <Text
          style={style.balanceAvailable}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          numberOfLines={1}
        >
          {`${availableStr} ${token.symbol}`}
        </Text>
        <Text style={style.text1}>{t`Available Balance`}</Text>
        <Image style={style.expandButton} source={chevronDown} width={12} height={7} />
      </View>
    );
  }

  render() {
    const { style } = this;
    return (
      <TouchableWithoutFeedback style={style.toucharea} onPress={this.toggleExpanded}>
        <View style={style.view}>
          {!this.state.isExpanded
            ? this.renderSimple()
            : this.renderExpanded()}
        </View>
      </TouchableWithoutFeedback>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(MainScreen);
