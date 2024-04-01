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
import { ArrowDownIcon } from '../Icon/ArrowDown.icon';
import { ArrowUpIcon } from '../Icon/ArrowUp.icon';
import { TextValue } from '../TextValue.component';
import { TextLabel } from '../TextLabel.component';
import { TransactionStatusLabel } from '../TransactionStatusLabel.component';

export const NanoContractTransactionHeader = ({ tx }) => {
  const [isShrank, toggleShrank] = useState(true);

  const isExpanded = () => !isShrank;

  return (
    <HathorHeader>
      <HathorHeader.Central style={styles.headerCentral}>
        <TouchableWithoutFeedback onPress={() => toggleShrank(!isShrank)}>
          <View style={styles.headerWrapper}>
            <InfoContainer>
              <TextValue title pb4>{getShortHash(tx.txId, 7)}</TextValue>
              <TextLabel>{t`Transaction ID`}</TextLabel>
            </InfoContainer>
            {isShrank
              && <HeaderShrank />}
            {isExpanded()
              && <HeaderExpanded tx={tx} />}
          </View>
        </TouchableWithoutFeedback>
      </HathorHeader.Central>
    </HathorHeader>
  )
};

const HeaderShrank = () => (
  <ArrowDownIcon />
);

const HeaderExpanded = ({ tx }) => {
  const baseExplorerUrl = useSelector((state) => state.networkSettings.explorerUrl);
  const ncId = getShortHash(tx.ncId, 7);
  const callerAddr = getShortContent(tx.caller.base58, 7);

  const navigatesToExplorer = () => {
    const txUrl = `transaction/${tx.txId}`;
    const explorerLink = combineURLs(baseExplorerUrl, txUrl);
    Linking.openURL(explorerLink);
  };

  return (
    <>
      <View style={styles.wrapper}>
        <InfoContainer>
          <TransactionStatusLabel processingStatus={tx.processingStatus} isVoided={tx.isVoided} />
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
        <TwoActionsWrapper>
          <PrimaryTextButton title={t`See transaction details`} onPress={navigatesToExplorer} />
        </TwoActionsWrapper>
      </View>
      <ArrowUpIcon />
    </>
  )
};

const InfoContainer = ({ lastElement, children }) => (
  <View style={[styles.infoContainer, lastElement && styles.lastElement]}>
    {children}
  </View>
);

const TwoActionsWrapper = ({ children }) => (
  <View style={[styles.TwoActionsWrapper]}>
    {children}
  </View>
);

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
  TwoActionsWrapper: {
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
