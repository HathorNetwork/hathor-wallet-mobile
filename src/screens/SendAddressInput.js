/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';
import { t } from 'ttag';
import { Network } from '@hathor/wallet-lib';
import { useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';

import NewHathorButton from '../components/NewHathorButton';
import SimpleInput from '../components/SimpleInput';
import HathorHeader from '../components/HathorHeader';
import { getKeyboardAvoidingViewTopDistance, validateAddress } from '../utils';
import OfflineBar from '../components/OfflineBar';
import { THOTH_ID_RESOLUTION_DEBOUNCE } from '../constants';
import {
  THOTH_ID_ERROR,
  isThothIdEnabled,
  isThothIdName,
  normalizeThothName,
  resolveThothName,
} from '../utils/thothId';

/** Status of the thoth.id name typed in the address field. */
export const NAME_RESOLUTION_STATUS = {
  /** The field holds an address, or nothing that looks like a name. */
  NONE: 'none',
  LOADING: 'loading',
  RESOLVED: 'resolved',
  ERROR: 'error',
};

const NO_RESOLUTION = {
  status: NAME_RESOLUTION_STATUS.NONE, name: '', address: null, error: null,
};

/**
 * User facing message for a failed resolution.
 *
 * @param {Error} e Error thrown by the resolution
 * @param {string} name Name being resolved
 */
const getResolutionErrorMessage = (e, name) => {
  switch (e.code) {
    case THOTH_ID_ERROR.NAME_NOT_FOUND:
      return t`${name} is not registered.`;
    case THOTH_ID_ERROR.UNKNOWN_DOMAIN:
      return t`There is no thoth.id registry for this domain on the connected network.`;
    case THOTH_ID_ERROR.UNSUPPORTED_NETWORK:
      return t`thoth.id names can only be used on testnet.`;
    case THOTH_ID_ERROR.INVALID_ADDRESS:
      return t`${name} resolved to an invalid address.`;
    default:
      return t`Could not resolve ${name}. Please check your connection and try again.`;
  }
};

/**
 * Screen where the user types who to send to.
 *
 * The field also accepts a thoth.id name (`alice.htr`), which is resolved to an
 * address against the naming service's nano contracts. Only the resolved
 * address moves on to the next screen: the name travels beside it purely so the
 * confirmation screen can show what was typed.
 */
export const SendAddressInput = () => {
  const route = useRoute();
  const navigation = useNavigation();
  /**
   * address {string} send tokens to this address
   * error {string} address validation error
   */
  const [formModel, setFormModel] = useState({
    // we can optionally receive a string to fill out the address
    // input (for eg, user scanned QR code)
    address: route.params?.address ?? null,
    error: null,
  });
  /**
   * status {string} One of NAME_RESOLUTION_STATUS
   * name {string} The name the current status refers to
   * address {string|null} Address the name resolved to
   * error {string|null} Message to show when the resolution failed
   */
  const [resolution, setResolution] = useState(NO_RESOLUTION);

  const networkName = useSelector((state) => state.networkSettings.network);
  const nodeUrl = useSelector((state) => state.networkSettings.nodeUrl);
  const network = useMemo(() => new Network(networkName), [networkName]);

  const typedAddress = (formModel.address || '').trim();
  // Off the supported networks nothing is a name, so the text goes through as
  // an address and fails the usual address validation.
  const isName = isThothIdEnabled(networkName) && isThothIdName(typedAddress);

  /**
   * Resolves the typed name once typing pauses. The cleanup covers both halves
   * of the race: it drops the pending lookup when the field changes again, and
   * ignores an answer that arrives for a name no longer typed.
   */
  useEffect(() => {
    if (!isName) {
      setResolution((prev) => (prev.status === NAME_RESOLUTION_STATUS.NONE ? prev : NO_RESOLUTION));
      return undefined;
    }

    const name = normalizeThothName(typedAddress);
    setResolution((prev) => (
      // An address already found for this exact name stays on screen, so
      // retyping the same text does not flash the spinner over it
      prev.status === NAME_RESOLUTION_STATUS.RESOLVED && prev.name === name
        ? prev
        : { status: NAME_RESOLUTION_STATUS.LOADING, name, address: null, error: null }
    ));

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { address } = await resolveThothName(name, { network: networkName, nodeUrl });
        if (!cancelled) {
          setResolution({
            status: NAME_RESOLUTION_STATUS.RESOLVED, name, address, error: null,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setResolution({
            status: NAME_RESOLUTION_STATUS.ERROR,
            name,
            address: null,
            error: getResolutionErrorMessage(e, name),
          });
        }
      }
    }, THOTH_ID_RESOLUTION_DEBOUNCE);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [typedAddress, isName, networkName, nodeUrl]);

  const onAddressChange = (text) => {
    setFormModel({ address: text, error: null });
  }

  const onButtonPress = () => {
    if (isName) {
      if (resolution.status === NAME_RESOLUTION_STATUS.RESOLVED) {
        navigation.navigate('SendAmountInput', {
          address: resolution.address,
          name: resolution.name,
        });
        return;
      }
      // Nothing to send to yet: the name is still being resolved, or it failed
      setFormModel((prev) => ({
        ...prev,
        error: resolution.status === NAME_RESOLUTION_STATUS.LOADING
          ? t`Resolving the name, please wait.`
          : resolution.error,
      }));
      return;
    }

    const validation = validateAddress(typedAddress, network);
    if (validation.isValid) {
      navigation.navigate('SendAmountInput', { address: typedAddress });
    } else {
      // Keeps what was typed so the user can correct it instead of retyping
      setFormModel((prev) => ({ ...prev, error: validation.message }));
    }
  }

  /** Feedback shown under the field while a thoth.id name is typed there. */
  const getNameSubtitle = () => {
    if (resolution.status === NAME_RESOLUTION_STATUS.LOADING) {
      return t`Resolving ${resolution.name}...`;
    }
    if (resolution.status === NAME_RESOLUTION_STATUS.RESOLVED) {
      return `${resolution.name} → ${resolution.address}`;
    }
    return null;
  };

  return (
    <View style={{ flex: 1 }}>
      <HathorHeader
        withBorder
        title={t`SEND`}
        onBackPress={() => navigation.goBack()}
      />
      <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getKeyboardAvoidingViewTopDistance()}>
        <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
          <SimpleInput
            label={isThothIdEnabled(networkName) ? t`Address or name to send` : t`Address to send`}
            autoFocus
            autoCapitalize='none'
            onChangeText={onAddressChange}
            error={formModel.error
              || (resolution.status === NAME_RESOLUTION_STATUS.ERROR ? resolution.error : null)}
            subtitle={getNameSubtitle()}
            value={formModel.address}
          />
          <NewHathorButton
            title={t`Next`}
            disabled={!formModel.address
              || (isName && resolution.status === NAME_RESOLUTION_STATUS.LOADING)}
            onPress={onButtonPress}
          />
        </View>
        <OfflineBar style={{ position: 'relative' }} />
      </KeyboardAvoidingView>
    </View>
  );
}

export default SendAddressInput;
