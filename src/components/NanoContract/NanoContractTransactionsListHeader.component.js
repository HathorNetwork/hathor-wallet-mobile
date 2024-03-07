import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableWithoutFeedback,
  Linking,
} from 'react-native';
import { t } from 'ttag';

import HathorHeader from '../../components/HathorHeader';
import { COLORS } from '../../styles/themes';
import { combineURLs, getShortContent, getShortHash } from '../../utils';
import SimpleButton from '../SimpleButton';
import { NanoContractIcon } from '../Icon/NanoContract.icon';
import { ArrowDownIcon } from '../Icon/ArrowDown.icon';
import { ArrowUpIcon } from '../Icon/ArrowUp.icon';
import { useDispatch, useSelector } from 'react-redux';
import { nanoContractUnregisterRequest } from '../../actions';
import { formatNanoContractRegistryEntry } from '../../sagas/nanoContract';

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

const HeaderExpanded = ({ nc }) => {
  const dispatch = useDispatch();
  const baseExplorerUrl = useSelector((state) => state.networkSettings.explorerUrl);

  const navigatesToExplorer = () => {
    const txUrl = `transaction/${nc.ncId}`;
    const explorerLink = combineURLs(baseExplorerUrl, txUrl);
    Linking.openURL(explorerLink);
  };

  const onUnregisterContract = () => {
    const ncKey = formatNanoContractRegistryEntry(nc.address, nc.ncId);
    dispatch(nanoContractUnregisterRequest({ ncKey }));
  };

  return (
    <>
      <View style={styles.wrapper}>
        <InfoContainer>
          <TextValue>{getShortHash(nc.ncId, 7)}</TextValue>
          <TextLabel>{t`Nano Contract ID`}</TextLabel>
        </InfoContainer>
        <InfoContainer>
          <TextValue>{nc.blueprintName}</TextValue>
          <TextLabel>{t`Blueprint Name`}</TextLabel>
        </InfoContainer>
        <InfoContainer lastElement>
          <TextValue>{getShortContent(nc.address, 7)}</TextValue>
          <TextLabel>{t`Registered Address`}</TextLabel>
        </InfoContainer>
        <TwoActionsWrapper>
          <PrimaryTextButton title={t`See status details`} onPress={navigatesToExplorer} />
          <DenyTextButton title={t`Unregister contract`} onPress={onUnregisterContract} />
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

const TextValue = ({ children }) => (
  <Text style={[styles.textValue]}>{children}</Text>
);

const TextLabel = ({ children }) => (
  <Text style={[styles.textLabel]}>{children}</Text>
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

const DenyTextButton = ({ title, onPress }) => (
  <SimpleButton
    title={title}
    containerStyle={[styles.buttonWrapper]}
    textStyle={styles.buttonUnregister}
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
  textLabel: {
    fontSize: 12,
    lineHeight: 20,
    color: 'hsla(0, 0%, 38%, 1)',
  },
  textValue: {
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 4,
    fontWeight: 'bold',
    color: 'black',
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
