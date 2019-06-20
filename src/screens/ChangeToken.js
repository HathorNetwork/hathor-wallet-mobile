import React from 'react';
import { FlatList, StyleSheet, View, Text, TouchableHighlight } from 'react-native';
import HathorHeader from '../components/HathorHeader';

import { getInset } from 'react-native-safe-area-view';
import hathorLib from '@hathor/wallet-lib';

import { connect } from 'react-redux';

/**
 * tokens {Array} Array of token configs registered on this wallet
 * tokensBalance {Object} Object with the balance of each token {uid: {available, locked}}
 */
const mapStateToProps = (state) => ({
  tokens: state.tokens,
  tokensBalance: state.tokensBalance,
})

const safeViewTop = getInset('top');
const safeViewBottom = getInset('bottom');

class ChangeToken extends React.Component {
  constructor(props) {
    super(props);

    // Selected token
    this.token = props.navigation.getParam('token', null);

    // Callback on token press
    this.onPressCallback = props.navigation.getParam('onItemPress', null);
  }

  onItemPress = (item) => {
    if (this.onPressCallback) {
      this.onPressCallback(item);
    }

    this.props.navigation.goBack();
  }

  render() {
    const renderItem = ({ item, index }) => {
      const symbolWrapperStyle = [styles.symbolWrapper];
      const symbolTextStyle = [styles.text, styles.leftText, styles.symbolText];
      if (this.token && this.token.uid === item.uid) {
        symbolWrapperStyle.push(styles.symbolWrapperSelected);
        symbolTextStyle.push(styles.symbolTextSelected);
      }

      const balance = item.uid in this.props.tokensBalance ? this.props.tokensBalance[item.uid].available : 0;
      return (
        <TouchableHighlight style={index === 0 ? styles.firstItemWrapper : null} onPress={() => this.onItemPress(item)} underlayColor='rgba(227, 0, 82, 0.5)'>
          <View style={styles.itemWrapper}>
            <View style={styles.itemLeftWrapper}>
              <View style={symbolWrapperStyle}>
                <Text style={symbolTextStyle}>{item.symbol}</Text>
              </View>
              <Text style={[styles.text, styles.leftText]}>{item.name}</Text>
            </View>
            <Text style={[styles.text, styles.rightText]}>{hathorLib.helpers.prettyValue(balance)} {item.symbol}</Text>
          </View>
        </TouchableHighlight>
      )
    }

    // Can't use SafeAreaView because the list view must go until the end of the screen
    return (
      <View style={styles.wrapper}>
        <HathorHeader
          title='TOKENS'
          onBackPress={() => this.props.navigation.goBack()}
          wrapperStyle={{ borderBottomWidth: 0 }}
        />
        <View style={styles.listWrapper}> 
          <FlatList data={this.props.tokens} renderItem={renderItem} keyExtractor={(item, index) => item.uid} />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#f7f7f7',
    paddingTop: safeViewTop,
  },
  listWrapper: {
    alignSelf: 'stretch',
    flex: 1,
    marginTop: 16,
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowOffset: { height: 2, width: 0 },
    shadowRadius: 4,
    shadowColor: 'black',
    shadowOpacity: 0.08,
    paddingBottom: safeViewBottom,
  },
  itemWrapper: {
    height: 80,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  firstItemWrapper: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  itemLeftWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  symbolWrapper: {
    padding: 4,
    backgroundColor: '#f7f7f7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderRadius: 4,
  },
  text: {
    lineHeight: 20
  },
  rightText: {
    fontSize: 16,
  },
  leftText: {
    fontSize: 14,
  },
  symbolText: {
    fontWeight: 'bold',
  },
  symbolTextSelected: {
    color: 'white',
  },
  symbolWrapperSelected: {
    backgroundColor: '#E30052',
  }
});


export default connect(mapStateToProps)(ChangeToken);