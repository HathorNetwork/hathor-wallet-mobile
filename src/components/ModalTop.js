/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

const ModalTop = (props) => (
  <View style={{
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, marginTop: 16,
  }}
  >
    <View style={{ flex: 1 }} />
    <Text style={{ flex: 3, textAlign: 'center', fontSize: 24 }}>{props.title}</Text>
    <View style={{ justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 16 }}>
      <TouchableOpacity style={{ paddingHorizontal: 4 }} onPress={() => props.navigation.goBack()}>
        <FontAwesomeIcon icon={faTimes} size={24} />
      </TouchableOpacity>
    </View>
  </View>
);

export default ModalTop;
