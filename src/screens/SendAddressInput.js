/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { t } from 'ttag';
import { Network } from '@hathor/wallet-lib';
import { useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';

import NewHathorButton from '../components/NewHathorButton';
import HathorHeader from '../components/HathorHeader';
import QRCodeIcon from '../components/Icons/QRCodeIcon';
import { getKeyboardAvoidingViewTopDistance, validateAddress } from '../utils';
import OfflineBar from '../components/OfflineBar';
import { COLORS } from '../styles/themes';
import { isShieldedEnvironment } from '../shielded/gating';
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
  status: NAME_RESOLUTION_STATUS.NONE,
  name: '',
  address: null,
  error: null,
  networkName: null,
  nodeUrl: null,
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
 * First screen of the Send flow. The address is typed or pasted here; the QR code scanner, which
 * the icon at the top right opens, fills it in.
 *
 * The field also accepts a thoth.id name (`alice.htr`), which is resolved to an address against
 * the naming service's nano contracts. Only the resolved address moves on to the next screen:
 * the name travels beside it purely so the confirmation screen can show what was typed.
 */
export const SendAddressInput = () => {
  const route = useRoute();
  const navigation = useNavigation();
  /**
   * address {string} send tokens to this address; the QR code scanner passes it in the route
   *   params
   * error {string} address validation error, cleared on edit
   */
  const [formModel, setFormModel] = useState({
    address: route.params?.address ?? null,
    error: null,
  });
  const networkName = useSelector((state) => state.networkSettings.network);
  const nodeUrl = useSelector((state) => state.networkSettings.nodeUrl);
  const network = useMemo(() => new Network(networkName), [networkName]);
  // A private address, typed or scanned, can be paid in the shielded environment: privately
  // where the wallet sends privately, and in public, to the address of its spend key, anywhere
  // there.
  const allowShielded = useSelector(isShieldedEnvironment);
  // A tap anywhere on the card around the input focuses it: an empty multiline input is one
  // line tall, so the card's padding wouldn't take the tap otherwise.
  const inputRef = useRef(null);

  // The QR code scanner comes back to this screen with the address it read.
  useEffect(() => {
    if (route.params?.address) {
      setFormModel((prev) => ({ ...prev, address: route.params.address, error: null }));
    }
  }, [route.params?.address]);

  /**
   * status {string} One of NAME_RESOLUTION_STATUS
   * name {string} The name the current status refers to
   * address {string|null} Address the name resolved to
   * error {string|null} Message to show when the resolution failed
   * networkName {string|null} Network the name was resolved on
   * nodeUrl {string|null} Node the name was resolved against
   */
  const [resolution, setResolution] = useState(NO_RESOLUTION);

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
    const context = { networkName, nodeUrl };
    setResolution((prev) => (
      // An address already found for this exact name, on this same network and
      // node, stays on screen, so retyping the same text does not flash the
      // spinner over it
      prev.status === NAME_RESOLUTION_STATUS.RESOLVED && prev.name === name
        && prev.networkName === networkName && prev.nodeUrl === nodeUrl
        ? prev
        : {
          status: NAME_RESOLUTION_STATUS.LOADING, name, address: null, error: null, ...context,
        }
    ));

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { address } = await resolveThothName(name, { network: networkName, nodeUrl });
        if (!cancelled) {
          setResolution({
            status: NAME_RESOLUTION_STATUS.RESOLVED, name, address, error: null, ...context,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setResolution({
            status: NAME_RESOLUTION_STATUS.ERROR,
            name,
            address: null,
            error: getResolutionErrorMessage(e, name),
            ...context,
          });
        }
      }
    }, THOTH_ID_RESOLUTION_DEBOUNCE);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [typedAddress, isName, networkName, nodeUrl]);

  // The resolution counts only for the name in the field and the network and
  // node the wallet is on now. Until the effect catches up with a change, the
  // name is treated as still being resolved, so Next never sends to an address
  // found for another name, or on another chain.
  const currentName = isName ? normalizeThothName(typedAddress) : '';
  const isCurrentResolution = resolution.name === currentName
    && resolution.networkName === networkName
    && resolution.nodeUrl === nodeUrl;
  let activeResolution = NO_RESOLUTION;
  if (isName) {
    activeResolution = isCurrentResolution
      ? resolution
      : { ...NO_RESOLUTION, status: NAME_RESOLUTION_STATUS.LOADING, name: currentName };
  }

  const onAddressChange = (text) => {
    setFormModel({ address: text, error: null });
  };

  const validate = () => validateAddress(typedAddress, network, { allowShielded });

  const isAddressValid = () => {
    if (!typedAddress) return false;
    // A name can be sent to once it resolved; its address was validated by the resolution
    if (isName) return activeResolution.status === NAME_RESOLUTION_STATUS.RESOLVED;
    return validate().isValid;
  };

  const onButtonPress = () => {
    if (isName) {
      if (activeResolution.status === NAME_RESOLUTION_STATUS.RESOLVED) {
        navigation.navigate('SendAmountInput', {
          address: activeResolution.address,
          name: activeResolution.name,
        });
        return;
      }
      // Nothing to send to yet: the name is still being resolved, or it failed
      setFormModel((prev) => ({
        ...prev,
        error: activeResolution.status === NAME_RESOLUTION_STATUS.LOADING
          ? t`Resolving the name, please wait.`
          : activeResolution.error,
      }));
      return;
    }

    const validation = validate();
    if (!validation.isValid) {
      setFormModel((prev) => ({ ...prev, error: validation.message }));
      return;
    }
    navigation.navigate('SendAmountInput', { address: typedAddress });
  };

  const onScanPress = () => {
    navigation.navigate('SendScanQRCode');
  };

  const QRButton = (
    <TouchableOpacity onPress={onScanPress} accessibilityLabel={t`Scan QR code`}>
      <QRCodeIcon size={24} color={COLORS.primary} />
    </TouchableOpacity>
  );

  /** Feedback shown under the field while a thoth.id name is typed there. */
  const getNameSubtitle = () => {
    const { status, name, address } = activeResolution;
    if (status === NAME_RESOLUTION_STATUS.LOADING) {
      return t`Resolving ${name}...`;
    }
    if (status === NAME_RESOLUTION_STATUS.RESOLVED) {
      return `${name} → ${address}`;
    }
    return null;
  };

  const errorMessage = formModel.error
    || (activeResolution.status === NAME_RESOLUTION_STATUS.ERROR ? activeResolution.error : null);
  const nameSubtitle = getNameSubtitle();

  return (
    <View style={{ flex: 1 }}>
      {/* It dismisses the keyboard, and wraps the header and the KeyboardAvoidingView, as on
          SendAmountInput. */}
      <Pressable
        style={{ flex: 1 }}
        onPress={Keyboard.dismiss}
        accessible={false}
      >
        <HathorHeader
          withBorder
          title={t`SEND TOKENS`}
          rightElement={QRButton}
        />
        <KeyboardAvoidingView
          behavior='padding'
          style={{ flex: 1 }}
          // The distance from the top of the screen to the top of the KeyboardAvoidingView,
          // which is under the header.
          keyboardVerticalOffset={getKeyboardAvoidingViewTopDistance()}
        >
          <View style={styles.body}>
            <View>
              <Text style={styles.label}>
                {isThothIdEnabled(networkName) ? t`Address or name to send` : t`Address to send`}
              </Text>
              <Pressable
                onPress={() => inputRef.current?.focus()}
                style={[
                  styles.inputCard,
                  errorMessage ? styles.inputCardError : null,
                ]}
              >
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  autoFocus
                  value={formModel.address ?? ''}
                  onChangeText={onAddressChange}
                  placeholder={t`Paste or type address`}
                  placeholderTextColor='#9CA3AF'
                  autoCorrect={false}
                  spellCheck={false}
                  autoCapitalize='none'
                  autoCompleteType='off'
                  underlineColorAndroid='transparent'
                  // An address wraps, so the whole of it shows: a private address is about 95
                  // characters long. The cursor starts at the top of an empty field.
                  multiline
                  textAlignVertical='top'
                  scrollEnabled={false}
                />
              </Pressable>
              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}
              {!errorMessage && nameSubtitle ? (
                <Text style={styles.subtitleText}>{nameSubtitle}</Text>
              ) : null}
            </View>
            <NewHathorButton
              title={t`Next`}
              disabled={!isAddressValid()}
              onPress={onButtonPress}
            />
          </View>
          <OfflineBar style={{ position: 'relative' }} />
        </KeyboardAvoidingView>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    color: COLORS.textColorShadow,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  // The card grows with the address, from about two lines.
  inputCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingTop: 12,
    paddingRight: 14,
    paddingBottom: 12,
    paddingLeft: 14,
    minHeight: 80,
    justifyContent: 'flex-start',
  },
  // The same size as the card without an error, so the layout doesn't shift.
  inputCardError: {
    borderColor: '#E55B5B',
  },
  // A monospace face for the address and the placeholder alike.
  input: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    lineHeight: 16,
    color: COLORS.textColor,
    padding: 0,
    margin: 0,
    alignSelf: 'stretch',
    // Android adds room around the glyphs; without it, the text lines up with the placeholder.
    includeFontPadding: false,
  },
  subtitleText: {
    color: COLORS.textColorShadow,
    fontSize: 12,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  errorText: {
    color: '#E55B5B',
    fontSize: 12,
    marginTop: 6,
    paddingHorizontal: 4,
  },
});

export default SendAddressInput;
