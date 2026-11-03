/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useRef, useState } from 'react';
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
import {
  getMultichainFeatureToggle,
  isSideChainConnected,
  selectSideChainConfig,
} from '../multichain/gating';
import { addressChain, normalizeNextAddress } from '../multichain/address';
import { CHAIN, isTransferAddress } from '../multichain/chains';
import { ChainTag } from '../components/Multichain/ChainTag';

/**
 * First screen of the Send flow. The address is typed or pasted here; the QR code scanner, which
 * the icon at the top right opens, fills it in.
 *
 * With the side chain connected, the address says which chain the send is on: a Hathor Next
 * address sends on Hathor Next, and its chain shows under it. "Transfer between chains" at the
 * bottom opens the transfer.
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
  const network = useSelector((state) => new Network(state.networkSettings.network));
  // A private address, typed or scanned, can be paid in the shielded environment: privately
  // where the wallet sends privately, and in public, to the address of its spend key, anywhere
  // there.
  const allowShielded = useSelector(isShieldedEnvironment);
  const sideChainConnected = useSelector(isSideChainConnected);
  const sideChainConfig = useSelector(selectSideChainConfig);
  const multichainOn = useSelector(getMultichainFeatureToggle);
  // The chain transfer's own address is refused at once, typed or scanned: what pays it directly
  // burns, and only the transfer may pay it. Like everything multichain, only behind the flag.
  const transferAddressError = (address) => (multichainOn
    && isTransferAddress(address, sideChainConfig)
    ? t`This address moves HTR to Hathor Next, and HTR sent to it directly is lost. Use Transfer between chains instead.`
    : null);
  // A tap anywhere on the card around the input focuses it: an empty multiline input is one
  // line tall, so the card's padding wouldn't take the tap otherwise.
  const inputRef = useRef(null);

  // The QR code scanner comes back to this screen with the address it read.
  useEffect(() => {
    if (route.params?.address) {
      setFormModel((prev) => ({
        ...prev,
        address: route.params.address,
        error: transferAddressError(route.params.address),
      }));
    }
  }, [route.params?.address]);

  const onAddressChange = (text) => {
    setFormModel({ address: text, error: transferAddressError(text) });
  };

  // The chain of a valid address, once the side chain is connected: before, a Hathor Next address
  // is an invalid address, as it always was.
  const chain = sideChainConnected
    ? addressChain(formModel.address, network, { allowShielded })
    : null;

  const validate = () => {
    const transferError = transferAddressError(formModel.address);
    if (transferError) {
      return { isValid: false, message: transferError };
    }
    return chain === CHAIN.HATHOR_NEXT
      ? { isValid: true }
      : validateAddress(formModel.address, network, { allowShielded });
  };

  const isAddressValid = () => {
    if (!formModel.address) return false;
    return validate().isValid;
  };

  const onButtonPress = () => {
    const validation = validate();
    if (!validation.isValid) {
      setFormModel((prev) => ({ ...prev, error: validation.message }));
      return;
    }
    navigation.navigate(
      chain === CHAIN.HATHOR_NEXT ? 'NextSendAmountInput' : 'SendAmountInput',
      {
        address: chain === CHAIN.HATHOR_NEXT
          ? normalizeNextAddress(formModel.address)
          : formModel.address.trim(),
      },
    );
  };

  const onScanPress = () => {
    navigation.navigate('SendScanQRCode');
  };

  const QRButton = (
    <TouchableOpacity onPress={onScanPress} accessibilityLabel={t`Scan QR code`}>
      <QRCodeIcon size={24} color={COLORS.primary} />
    </TouchableOpacity>
  );

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
              <Text style={styles.label}>{t`Address to send`}</Text>
              <Pressable
                onPress={() => inputRef.current?.focus()}
                style={[
                  styles.inputCard,
                  formModel.error ? styles.inputCardError : null,
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
              {formModel.error ? (
                <Text style={styles.errorText}>{formModel.error}</Text>
              ) : null}
              {chain && !formModel.error ? (
                <ChainTag chain={chain} style={styles.chain} />
              ) : null}
            </View>
            <View>
              <NewHathorButton
                title={t`Next`}
                disabled={!isAddressValid()}
                onPress={onButtonPress}
              />
              {sideChainConnected && (
                <NewHathorButton
                  secondary
                  title={t`Transfer between chains`}
                  onPress={() => navigation.navigate('ChainTransfer')}
                  style={styles.transfer}
                />
              )}
            </View>
          </View>
          <OfflineBar style={{ position: 'relative' }} />
        </KeyboardAvoidingView>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  chain: {
    marginTop: 8,
    marginLeft: 4,
  },
  transfer: {
    marginTop: 8,
  },
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
  errorText: {
    color: '#E55B5B',
    fontSize: 12,
    marginTop: 6,
    paddingHorizontal: 4,
  },
});

export default SendAddressInput;
