import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faTimes } from '@fortawesome/free-solid-svg-icons'

const ModalTop = props => {
  return (
    <View style={{flexDirection: "row", justifyContent: "space-between", marginBottom: 24, marginTop: 16}}>
      <View style={{flex: 1}}></View>
      <Text style={{flex: 3, textAlign: "center", fontSize: 24}}>{props.title}</Text>
      <View style={{justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 16}}>
        <TouchableOpacity style={{paddingHorizontal: 4}} onPress={() => props.navigation.goBack()}>
          <FontAwesomeIcon icon={ faTimes } size={24} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default ModalTop;