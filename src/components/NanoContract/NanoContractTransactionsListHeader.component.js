import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableWithoutFeedback,
} from 'react-native';
import { t } from 'ttag';

import HathorHeader from '../../components/HathorHeader';
import { COLORS } from '../../styles/themes';
import { getShortContent, getShortHash } from '../../utils';
import SimpleButton from '../SimpleButton';
import { NanoContractIcon } from '../Icon/NanoContract.icon';
import { ArrowDownIcon } from '../Icon/ArrowDown.icon';
import { ArrowUpIcon } from '../Icon/ArrowUp.icon';

export const NanoContractTransactionsListHeader = ({ nc }) => {
  const [isShrank, toggleShrank] = useState(true);
  const isExpanded = () => !isShrank;

  return (
    <HathorHeader>
      <HathorHeader.Central style={styles.headerCentral}>
        <TouchableWithoutFeedback onPress={() => toggleShrank(!isShrank)}>
          <View style={styles.headerWrapper}>
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
  <View>
    <NanoContractIcon type='fill' color={COLORS.white} />
  </View>
);

const HeaderShrank = () => (
  <ArrowDownIcon />
);

const HeaderExpanded = ({ nc }) => (
  <>
    <View style={styles.wrapper}>
      <Text style={[styles.text, styles.value]}>{getShortHash(nc.ncId, 7)}</Text>
      <Text style={[styles.text]}>{t`Nano Contract ID`}</Text>
      <Text style={[styles.text, styles.value]}>{nc.blueprintName}</Text>
      <Text style={[styles.text]}>{t`Blueprint Name`}</Text>
      <Text style={[styles.text, styles.value]}>{getShortContent(nc.address, 7)}</Text>
      <Text style={[styles.text, styles.lastElement]}>{t`Registered Address`}</Text>
      <View style={[styles.TwoActionsWrapper]}>
        <SimpleButton
          title={t`See status details`}
          containerStyle={[styles.buttonWrapper, styles.buttonDetails]}
          textStyle={styles.buttonText} />
        <SimpleButton
          title={t`Unregister contract`}
          containerStyle={[styles.buttonWrapper]}
          textStyle={styles.buttonUnregister} />
      </View>
    </View>
    <ArrowUpIcon />
  </>
);

const styles = StyleSheet.create({
  headerCentral: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 24,
  },
  headerWrapper: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: 'bold',
    paddingVertical: 16,
  },
  wrapper: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  text: {
    fontSize: 12,
    lineHeight: 20,
    paddingBottom: 16,
    color: 'hsla(0, 0%, 38%, 1)',
  },
  value: {
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 4,
    fontWeight: 'bold',
    color: 'black',
  },
  lastElement: {
    paddingBottom: 0,
  },
  TwoActionsWrapper: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  buttonWrapper: {
    paddingTop: 24,
  },
  buttonText: {
    fontWeight: 'bold',
    fontStyle: 'underline',
  },
  buttonUnregister: {
    marginStart: 24,
    color: 'hsla(0, 100%, 41%, 1)',
  },
  buttonDetails: {
    display: 'inline-block',
    /* We are using negative margin here to correct the text position
     * and create an optic effect of alignment. */
    marginBottom: -2,
    borderBottomWidth: 1,
    borderColor: COLORS.primary,
  },
});
