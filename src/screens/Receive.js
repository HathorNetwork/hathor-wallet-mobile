/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { t } from 'ttag';

import HathorHeader from '../components/HathorHeader';
import ReceiveMyAddress from '../components/ReceiveMyAddress';
import OfflineBar from '../components/OfflineBar';
import { TwoOptionsToggle } from '../components/TwoOptionsToggle';
import { NextReceiveAddress } from '../components/Multichain/NextReceiveAddress';
import { CHAIN, CHAIN_NAME } from '../multichain/chains';
import { isSideChainConnected } from '../multichain/gating';

const ReceiveScreen = ({ navigation }) => {
  // With the side chain connected, a selector picks the chain to receive on: Hathor Network
  // first, every time the screen opens.
  const sideChainConnected = useSelector(isSideChainConnected);
  const [chain, setChain] = useState(CHAIN.HATHOR);
  // The toggle keeps its own selection, so it is drawn again whenever the screen opens.
  const [openCount, setOpenCount] = useState(0);
  useFocusEffect(React.useCallback(() => {
    setChain(CHAIN.HATHOR);
    setOpenCount((count) => count + 1);
  }, []));

  const onNext = sideChainConnected && chain === CHAIN.HATHOR_NEXT;
  return (
    <View style={{ flex: 1 }}>
      <HathorHeader
        title={t`RECEIVE`}
        withBorder
      />
      {sideChainConnected && (
        <View style={styles.chains}>
          <TwoOptionsToggle
            key={openCount}
            options={{
              first: { value: CHAIN_NAME[CHAIN.HATHOR], onTap: () => setChain(CHAIN.HATHOR) },
              second: {
                value: CHAIN_NAME[CHAIN.HATHOR_NEXT],
                onTap: () => setChain(CHAIN.HATHOR_NEXT),
              },
            }}
            defaultOption='first'
          />
        </View>
      )}
      {onNext ? <NextReceiveAddress /> : <ReceiveMyAddress navigation={navigation} />}
      <OfflineBar />
    </View>
  );
};

const styles = StyleSheet.create({
  chains: {
    alignItems: 'center',
    paddingTop: 16,
  },
});

export default ReceiveScreen;
