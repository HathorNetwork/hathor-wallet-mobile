/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Text,
  Image,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';

import chevronDown from '../../assets/icons/chevron-down.png';
import chevronUp from '../../assets/icons/chevron-up.png';
import HathorHeader from '../../components/HathorHeader';
import { NanoContractTransactionsListItem } from '../../components/NanoContract/NanoContractTransactionsListItem.component';
import { formatNanoContractRegistryEntry } from '../../sagas/nanoContract';
import { COLORS } from '../../styles/themes';
import { getShortContent, getShortHash } from '../../utils';
import SimpleButton from '../SimpleButton';
import { NanoContractIcon } from './NanoContractIcon.svg.component';

const getNanoContractHistory = (ncKey) => (state) => {
  // const history = state.nanoContract.contractHistory[ncKey];
  // return Object.values(history);
  return [
    {
      txId: "000000203e87e8575f121de16d0eb347bd1473eedd9f46cc76c1bc8d4e5a5fce",
      timestamp: 1708356261,
      tokens: [
        "00000117b0502e9eef9ccbe987af65f153aa899d6eba88d50a6c89e78644713d",
        "0000038c49253f86e6792006dd9124e2c50e6487fde3296b7bd637e3e1a497e7"
      ],
      isVoided: false,
      ncId: "000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a",
      ncMethod: "swap",
      callerOrigin: 'mine',
    },
    {
      txId: "000000203e87e8575f121de16d0eb347bd1473eedd9f46cc76c1bc8d4e5a5fcd",
      timestamp: 1708356261,
      tokens: [
        "00000117b0502e9eef9ccbe987af65f153aa899d6eba88d50a6c89e78644713d",
        "0000038c49253f86e6792006dd9124e2c50e6487fde3296b7bd637e3e1a497e7"
      ],
      isVoided: false,
      ncId: "000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a",
      ncMethod: "swap",
      callerOrigin: 'oracle',
    },
    {
      txId: "000000203e87e8575f121de16d0eb347bd1473eedd9f46cc76c1bc8d4e5a5fcc",
      timestamp: 1708356261,
      tokens: [
        "00000117b0502e9eef9ccbe987af65f153aa899d6eba88d50a6c89e78644713d",
        "0000038c49253f86e6792006dd9124e2c50e6487fde3296b7bd637e3e1a497e7"
      ],
      isVoided: false,
      ncId: "000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a",
      ncMethod: "swap",
      callerOrigin: 'wallet',
    },
    {
      txId: "000000203e87e8575f121de16d0eb347bd1473eedd9f46cc76c1bc8d4e5a5fcb",
      timestamp: 1708356261,
      tokens: [
        "00000117b0502e9eef9ccbe987af65f153aa899d6eba88d50a6c89e78644713d",
        "0000038c49253f86e6792006dd9124e2c50e6487fde3296b7bd637e3e1a497e7"
      ],
      isVoided: false,
      ncId: "000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a",
      ncMethod: "swap",
      callerOrigin: 'other',
    },
    {
      txId: "000000203e87e8575f121de16d0eb347bd1473eedd9f46cc76c1bc8d4e5a5fca",
      timestamp: 1708356261,
      tokens: [
        "00000117b0502e9eef9ccbe987af65f153aa899d6eba88d50a6c89e78644713d",
        "0000038c49253f86e6792006dd9124e2c50e6487fde3296b7bd637e3e1a497e7"
      ],
      isVoided: true,
      ncId: "000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a",
      ncMethod: "swap",
      callerOrigin: 'other',
    },
  ].filter((tx) => tx.isVoided === false);
}

export const NanoContractTransactionsList = ({ nc }) => {
  const ncKey = formatNanoContractRegistryEntry(nc.address, nc.ncId);
  const ncHistory = useSelector(getNanoContractHistory(ncKey));
  const navigation = useNavigation();
  const navigatesToNanoContractTransaction = (tx) => {
    navigation.navigate('NanoContractTransaction', { tx });
  };

  return (
    <Wrapper>
      <Header nc={nc} />
      <ListWrapper>
        <FlatList
          data={ncHistory}
          renderItem={({item, index}) => (
            <NanoContractTransactionsListItem
              item={item}
              index={index}
              onPress={() => navigatesToNanoContractTransaction(item)}
            />)}
          keyExtractor={(nc) => formatNanoContractRegistryEntry(nc.address, nc.ncId)}
        />
      </ListWrapper>
    </Wrapper>
  );
};

const Header = ({ nc }) => {
  const [isShrank, toggleShrank] = useState(true);
  const isExpanded = () => !isShrank;

  return (
    <HathorHeader>
      <HathorHeader.Central style={styles.headerCentral}>
        <TouchableWithoutFeedback onPress={() => toggleShrank(!isShrank)}>
          <View style={styles.headerCentralWrapper}>
            <HeaderIcon />
            <Text style={[styles.headerTitle]}>{t`Nano Contract`}</Text>
            {isShrank &&
              <HeaderShrank />}
            {isExpanded() &&
              <HeaderExpanded nc={nc} />}
          </View>
        </TouchableWithoutFeedback>
      </HathorHeader.Central>
    </HathorHeader>
  )
};

const HeaderIcon = () => (
  <View style={styles.headerIcon}>
    <NanoContractIcon />
  </View>
);

const HeaderShrank = () => (
  <ArrowDown />
);

const HeaderExpanded = ({ nc }) => (
  <>
    <View style={styles.contentWrapper}>
      <Text style={[styles.text, styles.property]}>{getShortHash(nc.ncId, 7)}</Text>
      <Text style={[styles.text]}>{'Nano Contract ID'}</Text>
      <Text style={[styles.text, styles.property]}>{nc.blueprintName}</Text>
      <Text style={[styles.text]}>{'Blueprint Name'}</Text>
      <Text style={[styles.text, styles.property]}>{getShortContent(nc.address, 7)}</Text>
      <Text style={[styles.text, styles.padding0]}>{'Registered Address'}</Text>
      <View style={[styles.headerCentralActionWrapper]}>
        <SimpleButton
          title={'See status details'}
          containerStyle={[styles.actionButton, styles.actionDetailsContainerButton]}
          textStyle={styles.actionDetailsButton} />
        <SimpleButton
          title={'Unregister contract'}
          containerStyle={[styles.actionButton]}
          textStyle={styles.actionUnregisterButton} />
      </View>
    </View>
    <ArrowUp />
  </>
);

const ArrowDown = () => (
  <View style={styles.headerArrow}>
    <Image source={chevronDown} width={24} height={24} />
  </View>
);

const ArrowUp = () => (
  <View style={styles.headerArrow}>
    <Image source={chevronUp} width={24} height={24} />
  </View>
);

const Wrapper = ({ children }) => (
  <View style={styles.wrapper}>
    {children}
  </View>
);

const ListWrapper = ({ children }) => (
  <View style={[styles.listWrapper]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.lowContrastDetail, // Defines an outer area on the main list content
  },
  listWrapper: {
    alignSelf: 'stretch',
    flex: 1,
    marginTop: 16,
    backgroundColor: COLORS.backgroundColor,
    marginHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowOffset: { height: 2, width: 0 },
    shadowRadius: 4,
    shadowColor: COLORS.textColor,
    shadowOpacity: 0.08,
  },
  header: {
    paddingTop: 24,
  },
  headerCentral: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 24,
  },
  headerCentralWrapper: {
    alignItems: 'center',
  },
  headerIcon: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: 'bold',
    paddingTop: 16,
  },
  headerArrow: {
    paddingTop: 16,
  },
  contentWrapper: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 12,
    lineHeight: 20,
    paddingBottom: 16,
    color: 'hsla(0, 0%, 38%, 1)',
  },
  property: {
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 4,
    fontWeight: 'bold',
    color: 'black',
  },
  padding0: {
    paddingBottom: 0,
  },
  headerCentralActionWrapper: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  actionButton: {
    paddingTop: 24,
  },
  actionDetailsContainerButton: {
    display: 'inline-block',
    /* We are using negative margin here to correct the text position
     * and create an optic effect of alignment. */
    marginBottom: -2,
    borderBottomWidth: 1,
    borderColor: COLORS.primary,
  },
  actionDetailsButton: {
    fontWeight: 'bold',
    fontStyle: 'underline',
  },
  actionUnregisterButton: {
    marginStart: 24,
    color: 'hsla(0, 100%, 41%, 1)',
  },
});
