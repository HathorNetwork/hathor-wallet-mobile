import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { connect } from 'react-redux';
import { getTokenLabel } from '../utils';
import QRCode from 'react-native-qrcode-svg';

import HathorHeader from '../components/HathorHeader';

import hathorLib from '@hathor/wallet-lib';


/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 */
const mapStateToProps = (state) => {
  return {
    selectedToken: state.selectedToken,
  };
}


const TokenDetail = (props) => {
  const configString = hathorLib.tokens.getConfigurationString(props.selectedToken.uid, props.selectedToken.name, props.selectedToken.symbol);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }}>
      <HathorHeader
        title='TOKEN DETAIL'
        onBackPress={() => props.navigation.goBack()}
        wrapperStyle={{ borderBottomWidth: 0 }}
      />
      <View style={styles.contentWrapper}>
        <View style={styles.tokenWrapper}>
          <Text style={{ fontSize: 18, lineHeight: 22, fontWeight: 'bold' }}>{getTokenLabel(props.selectedToken)}</Text>
        </View>
        <View style={styles.qrcodeWrapper}>
          <QRCode
            value={configString}
            size={200}
          />
        </View>
        <View style={styles.configStringWrapper}>
          <Text style={{ fontSize: 14 }} selectable={true}>{configString}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#f7f7f7',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch'
  },
  contentWrapper: {
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    shadowOffset: { height: 2, width: 0 },
    shadowRadius: 4,
    shadowColor: 'black',
    shadowOpacity: 0.08,
  },
  tokenWrapper: {
    marginTop: 24,
    alignItems: 'center',
  },
  qrcodeWrapper: {
    paddingVertical: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#e5e5ea',
  },
  configStringWrapper: {
    margin: 16,
    borderRadius: 8,
    alignSelf: 'stretch',
  },
});


export default connect(mapStateToProps)(TokenDetail);
