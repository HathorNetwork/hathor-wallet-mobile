import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableWithoutFeedback,
  Linking,
} from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';

import HathorHeader from '../HathorHeader';
import { COLORS } from '../../styles/themes';
import { combineURLs, getShortContent, getShortHash } from '../../utils';
import SimpleButton from '../SimpleButton';
import { NanoContractIcon } from '../Icon/NanoContract.icon';
import { ArrowDownIcon } from '../Icon/ArrowDown.icon';
import { ArrowUpIcon } from '../Icon/ArrowUp.icon';
import { TextValue } from '../TextValue.component';
import { TextLabel } from '../TextLabel.component';
import { EditInfoContainer } from '../EditInfoContainer.component';
import { SelectAddressModal } from './SelectAddressModal.component';
import { UnregisterNanoContractModal } from './UnregisterNanoContractModal.component';

export const NanoContractTransactionsListHeader = ({ nc, address, onAddressChange }) => {
  const [isShrank, toggleShrank] = useState(true);
  const [selectedAddress, setSelectedAddress] = useState(address);
  const [showSelectAddressModal, setShowSelectAddressModal] = useState(false);
  const [showUnregisterNanoContractModal, setShowUnregisterNanoContractModal] = useState(false);

  const isExpanded = () => !isShrank;

  const onEditAddress = () => {
    setShowSelectAddressModal(true);
  };

  const toggleSelectAddressModal = () => {
    setShowSelectAddressModal(!showSelectAddressModal);
  };

  const onUnregisterNanoContract = () => {
    setShowUnregisterNanoContractModal(true);
  };

  const toggleUnregisterNanoContractModal = () => {
    setShowUnregisterNanoContractModal(!showUnregisterNanoContractModal);
  };

  const hookSelectAddress = (address) => {
    setSelectedAddress(address);
    toggleSelectAddressModal();
    onAddressChange(address);
  };

  return (
    <HathorHeader>
      <HathorHeader.Central style={styles.headerCentral}>
        <TouchableWithoutFeedback onPress={() => toggleShrank(!isShrank)}>
          <View style={styles.headerWrapper}>
            <HeaderIcon />
            <Text style={[styles.headerTitle]}>{t`Nano Contract`}</Text>
            {isShrank
              && <HeaderShrank />}
            {isExpanded()
              && (
              <HeaderExpanded
                nc={nc}
                address={address}
                onEditAddress={onEditAddress}
                onUnregisterNanoContract={onUnregisterNanoContract}
              />
              )}
          </View>
        </TouchableWithoutFeedback>
        <SelectAddressModal
          address={selectedAddress}
          show={showSelectAddressModal}
          onDismiss={toggleSelectAddressModal}
          onSelectAddress={hookSelectAddress}
        />
        <UnregisterNanoContractModal
          ncId={nc.ncId}
          show={showUnregisterNanoContractModal}
          onDismiss={toggleUnregisterNanoContractModal}
        />
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

const HeaderExpanded = ({ nc, address, onEditAddress, onUnregisterNanoContract }) => {
  const baseExplorerUrl = useSelector((state) => state.networkSettings.explorerUrl);

  const navigatesToExplorer = () => {
    const txUrl = `transaction/${nc.ncId}`;
    const explorerLink = combineURLs(baseExplorerUrl, txUrl);
    Linking.openURL(explorerLink);
  };

  return (
    <>
      <View style={styles.wrapper}>
        <InfoContainer>
          <TextValue bold pb4>{getShortHash(nc.ncId, 7)}</TextValue>
          <TextLabel>{t`Nano Contract ID`}</TextLabel>
        </InfoContainer>
        <InfoContainer>
          <TextValue bold pb4>{nc.blueprintName}</TextValue>
          <TextLabel>{t`Blueprint Name`}</TextLabel>
        </InfoContainer>
        <EditInfoContainer center onPress={onEditAddress}>
          <TextValue bold pb4>{getShortContent(address, 7)}</TextValue>
          <TextLabel>{t`Registered Address`}</TextLabel>
        </EditInfoContainer>
        <TwoActionsWrapper>
          <PrimaryTextButton title={t`See status details`} onPress={navigatesToExplorer} />
          <DenyTextButton title={t`Unregister contract`} onPress={onUnregisterNanoContract} />
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
  TwoActionsWrapper: {
    flexDirection: 'row',
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
});
