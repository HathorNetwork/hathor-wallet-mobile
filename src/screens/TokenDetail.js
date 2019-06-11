import React from "react";
import { Alert, Image, SafeAreaView, Text, View } from "react-native";
import { connect } from 'react-redux';
import ModalTop from '../components/ModalTop';
import { getTokenLabel } from '../utils';
import QRCode from 'react-native-qrcode-svg';


/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 */
const mapStateToProps = (state) => {
  return {
    selectedToken: state.selectedToken,
  };
}


const TokenDetail = (props) => {
  const configString = global.hathorLib.tokens.getConfigurationString(props.selectedToken.uid, props.selectedToken.name, props.selectedToken.symbol);

  return (
    <SafeAreaView style={{ display: 'flex', flex: 1, justifyContent: "flex-start", alignItems: "flex-start" }}>
      <ModalTop title='Token detail' navigation={props.navigation} />
      <View style={{ flex: 1, alignItems: "center", marginTop: 32 }}>
        <Text style={{ lineHeight: 30, fontSize: 18, fontWeight: "bold" }}>{getTokenLabel(props.selectedToken)}</Text>
        <View style={{ marginTop: 32 }}>
          <QRCode
            value={configString}
            size={200}
          />
        </View>
        <View style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, marginLeft: 8, marginRight: 8, marginTop: 32, borderRadius: 8, backgroundColor: "#eee" }}>
          <Text style={{ fontSize: 14 }} selectable={true}>{configString}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default connect(mapStateToProps)(TokenDetail);