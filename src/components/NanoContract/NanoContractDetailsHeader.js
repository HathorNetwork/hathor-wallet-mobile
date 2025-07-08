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
  Text,
  TouchableWithoutFeedback,
  Linking,
} from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import { COLORS } from '../../styles/themes';
import { combineURLs, getShortContent, getShortHash } from '../../utils';
import SimpleButton from '../SimpleButton';
import HathorHeader from '../HathorHeader';
import { NanoContractIcon } from '../Icons/NanoContract.icon';
import { ArrowDownIcon } from '../Icons/ArrowDown.icon';
import { ArrowUpIcon } from '../Icons/ArrowUp.icon';
import { TextValue } from '../TextValue';
import { TextLabel } from '../TextLabel';
import { EditInfoContainer } from '../EditInfoContainer';
import { SelectAddressModal } from './SelectAddressModal';
import { UnregisterNanoContractModal } from './UnregisterNanoContractModal';

/**
 * It presents the header for Nano Contract Details screen and provides the following
 * actions to users:
 * - Open Nano Contract details at the Explorer
 * - Edit the registered address for the Nano Contract
 * - Unregister the Nano Contract
 *
 * @param {Object} props
 * @param {Object} props.nc Nano Contract data
 * @param {string} props.address Default address selected
 * @param {(address:string) => {}} props.onAddressChange Function called when address changes
 */
export const NanoContractDetailsHeader = ({ nc, address, onAddressChange }) => {
  const [isShrank, toggleShrank] = useState(true);
  const [selectedAddress, setSelectedAddress] = useState(address);
  const [showSelectAddressModal, setShowSelectAddressModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState({ address });
  const [showUnregisterNanoContractModal, setShowUnregisterNanoContractModal] = useState(false);
  const [modalStep, setModalStep] = useState('select');

  const isExpanded = () => !isShrank;

  const onEditAddress = () => {
    setModalStep('select');
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

  const handleEditAddress = (item) => {
    setSelectedItem(item);
    setModalStep('edit');
  };

  const onDismissEditAddressModal = () => {
    // Reset to original address when dismissing edit modal
    setSelectedItem({ address });
    setModalStep('select');
  };

  const handleSelectAddress = (pickedAddress) => {
    setSelectedAddress(pickedAddress);
    toggleSelectAddressModal();
    onAddressChange(pickedAddress);
  };

  const hookAddressChange = (newSelectedAddress) => {
    setShowSelectAddressModal(false);
    setModalStep('select');
    handleSelectAddress(newSelectedAddress);
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
          onSelectAddress={handleSelectAddress}
          onEditAddress={handleEditAddress}
          modalStep={modalStep}
          selectedItem={selectedItem}
          onDismissEdit={onDismissEditAddressModal}
          onAddressChange={hookAddressChange}
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

/**
 * Presents all the information.
 *
 * @param {Object} props
 * @param {Object} props.nc Nano Contract data
 * @param {string} props.address Current address
 * @param {() => void} props.onEditAddress Function called on address edition trigger
 * @param {() => void} props.onUnregisterNanoContract Function called on unregister trigger
 */
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

/**
 * Container for value and label pair components.
 *
 * @param {Object} props
 * @param {Object} props.children
 */
const InfoContainer = ({ children }) => (
  <View style={[styles.infoContainer]}>
    {children}
  </View>
);

/**
 * It presents two button options inline.
 *
 * @param {Object} props
 * @param {Object} props.children
 */
const TwoActionsWrapper = ({ children }) => (
  <View style={[styles.TwoActionsWrapper]}>
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

/**
 * Text button in red.
 *
 * @param {Object} props
 * @param {string} props.title Text content
 * @param {() => void} props.onPress Callback for interaction
 */
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
    /* It also increases touch area. */
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
