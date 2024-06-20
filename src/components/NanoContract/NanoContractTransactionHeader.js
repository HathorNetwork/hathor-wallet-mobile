/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableWithoutFeedback,
  Linking,
  Text,
} from 'react-native';
import { t } from 'ttag';
import { useSelector } from 'react-redux';
import HathorHeader from '../HathorHeader';
import { COLORS } from '../../styles/themes';
import { combineURLs, getShortContent, getShortHash, getTimestampFormat } from '../../utils';
import SimpleButton from '../SimpleButton';
import { ArrowDownIcon } from '../Icons/ArrowDown.icon';
import { ArrowUpIcon } from '../Icons/ArrowUp.icon';
import { TextValue } from '../TextValue';
import { TextLabel } from '../TextLabel';
import { TransactionStatusLabel } from '../TransactionStatusLabel';

/**
 * It presents the header of Nano Contract Transaction screen.
 *
 * @param {Obejct} props
 * @param {Obejct} props.tx Transaction data
 */
export const NanoContractTransactionHeader = ({ tx }) => {
  // XXX: the set function for the state is beeing ignored because we can't
  // use the shrank format just yet. We need the actions component first.
  // For his, we also need hathor-core support for actions in each nano contract
  // transaction.
  const [isShrank] = useState(false);

  return (
    <HathorHeader>
      <HathorHeader.Central style={styles.headerCentral}>
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.headerWrapper}>
            <InfoContainer>
              <TextValue title pb4>{getShortHash(tx.txId, 7)}</TextValue>
              <TextLabel>{t`Transaction ID`}</TextLabel>
            </InfoContainer>
            {isShrank ? <HeaderShrank /> : <HeaderExpanded tx={tx} />}
          </View>
        </TouchableWithoutFeedback>
      </HathorHeader.Central>
    </HathorHeader>
  )
};

const HeaderShrank = () => (
  <ArrowDownIcon />
);

/**
 * It presents the expanded header of Nano Contract Transaction screen
 * containing contextual information about the Nano Contract and the transaction.
 *
 * @param {Obejct} props
 * @param {Obejct} props.tx Transaction data
 */
const HeaderExpanded = ({ tx }) => {
  const baseExplorerUrl = useSelector((state) => state.networkSettings.explorerUrl);
  const ncId = getShortHash(tx.ncId, 7);
  const callerAddr = getShortContent(tx.caller, 7);
  const hasFirstBlock = tx.firstBlock != null;

  const navigatesToExplorer = () => {
    const txUrl = `transaction/${tx.txId}`;
    const explorerLink = combineURLs(baseExplorerUrl, txUrl);
    Linking.openURL(explorerLink);
  };

  /* XXX: add <ArrowUpIcon /> when shrank component can be used. */
  return (
    <View style={styles.wrapper}>
      <InfoContainer>
        <TransactionStatusLabel hasFirstBlock={hasFirstBlock} isVoided={tx.isVoided} />
      </InfoContainer>
      <InfoContainer>
        <TextValue bold pb4>{ncId}</TextValue>
        <TextLabel>{t`Nano Contract ID`}</TextLabel>
      </InfoContainer>
      <InfoContainer>
        <TextValue bold pb4>{tx.ncMethod}</TextValue>
        <TextLabel>{t`Blueprint Method`}</TextLabel>
      </InfoContainer>
      <InfoContainer>
        <TextValue bold pb4>{getTimestampFormat(tx.timestamp)}</TextValue>
        <TextLabel>{t`Date and Time`}</TextLabel>
      </InfoContainer>
      <InfoContainer lastElement>
        <TextValue bold>{callerAddr}</TextValue>
        {tx.isMine
          && (
          <View style={styles.headlineLabel}>
            <Text style={styles.isMineLabel}>{t`From this wallet`}</Text>
          </View>
          )}
        <TextLabel>{t`Caller`}</TextLabel>
      </InfoContainer>
      <ActionsWrapper>
        <PrimaryTextButton title={t`See transaction details`} onPress={navigatesToExplorer} />
      </ActionsWrapper>
    </View>
  )
};

/**
 * Container for value and label pair components.
 *
 * @param {Object} props
 * @param {Object} props.children
 */
const InfoContainer = ({ lastElement, children }) => (
  <View style={[styles.infoContainer, lastElement && styles.lastElement]}>
    {children}
  </View>
);

/**
 * It presents the action button as inline text. It can contain at maximum two actions.
 *
 * @param {Object} props
 * @param {Object} props.children
 */
const ActionsWrapper = ({ children }) => (
  <View style={[styles.actionsWrapper]}>
    {children}
  </View>
);

/**
 * Text button in primary color and style.
 *
 * @param {Object} props
 * @param {string} props.title Text content
 * @param {() => void} props.onPress Callback for interaction
 */
const PrimaryTextButton = ({ title, onPress }) => (
  <SimpleButton
    title={title}
    containerStyle={[styles.buttonWrapper, styles.buttonDetails]}
    textStyle={styles.buttonText}
    onPress={onPress}
  />
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
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  infoContainer: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  lastElement: {
    paddingBottom: 0,
  },
  actionsWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'nowrap',
  },
  buttonWrapper: {
    paddingTop: 24,
  },
  buttonText: {
    fontWeight: 'bold',
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
  headlineLabel: {
    marginVertical: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 2,
    backgroundColor: COLORS.freeze100,
  },
  isMineLabel: {
    fontSize: 12,
    lineHeight: 20,
  },
});
