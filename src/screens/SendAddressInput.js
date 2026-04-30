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

/**
 * First screen of the Send flow. Manual address entry is the primary
 * input — the QR scanner is an alternative entry path reachable from the
 * top-right icon (and pre-fills this screen on success). Replaces the
 * older flow that opened the QR scanner first when a camera was
 * available.
 */
export const SendAddressInput = () => {
  const route = useRoute();
  const navigation = useNavigation();
  // address: text in the input. Hydrated from route.params when the QR
  //   scanner returns a result.
  // error:   transient validation error message; cleared on edit.
  // dirty:   whether the user has interacted, so we don't show
  //   "address is required" the moment they enter the screen.
  const [formModel, setFormModel] = useState({
    address: route.params?.address ?? null,
    error: null,
    dirty: false,
  });
  const network = useSelector((state) => new Network(state.networkSettings.network));
  // Held so a tap anywhere on the surrounding card focuses the input —
  // the multiline TextInput is only as tall as one line when empty,
  // so the card padding wouldn't otherwise capture taps.
  const inputRef = useRef(null);

  // Sync from QR scanner results when this screen is re-focused with a
  // new `address` route param.
  useEffect(() => {
    if (route.params?.address) {
      setFormModel((prev) => ({ ...prev, address: route.params.address, error: null }));
    }
  }, [route.params?.address]);

  const onAddressChange = (text) => {
    setFormModel({ address: text, error: null, dirty: true });
  };

  const isAddressValid = () => {
    if (!formModel.address) return false;
    return validateAddress(formModel.address, network).isValid;
  };

  const onButtonPress = () => {
    const validation = validateAddress(formModel.address, network);
    if (!validation.isValid) {
      setFormModel((prev) => ({ ...prev, error: validation.message }));
      return;
    }
    navigation.navigate('SendAmountInput', { address: formModel.address });
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
      <HathorHeader
        withBorder
        title={t`SEND TOKENS`}
        rightElement={QRButton}
      />
      <KeyboardAvoidingView
        behavior='padding'
        style={{ flex: 1 }}
        keyboardVerticalOffset={getKeyboardAvoidingViewTopDistance()}
      >
        {/* Tap-outside-to-dismiss: the Pressable fires only when the
            tap doesn't land on a child that captures it (TextInput,
            QR button, NEXT button). That's how we get keyboard
            dismissal without breaking nested touches — the user can
            still type, scan, or tap NEXT, and tapping the empty
            white area collapses the keyboard so the bottom tab bar
            is reachable again. */}
        <Pressable
          onPress={Keyboard.dismiss}
          style={{ flex: 1 }}
          accessible={false}
        >
          <View style={styles.body}>
          <View>
            <Text style={styles.label}>{t`Address to send`}</Text>
            {/* The card-as-a-Pressable forwards taps anywhere inside
                the box to the TextInput's `focus()`. Without this,
                tapping the empty padding below the cursor line on an
                empty multiline input would do nothing because the
                input itself only spans a single text-line of height. */}
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
                // Hathor addresses (legacy ~34 chars; shielded ~95) need
                // to wrap so the user can read the full address. Multi-
                // line + textAlignVertical: top keeps the cursor at the
                // start when the field is empty.
                multiline
                textAlignVertical='top'
                scrollEnabled={false}
              />
            </Pressable>
            {formModel.error ? (
              <Text style={styles.errorText}>{formModel.error}</Text>
            ) : null}
          </View>
          <NewHathorButton
            title={t`Next`}
            disabled={!isAddressValid()}
            onPress={onButtonPress}
          />
          </View>
        </Pressable>
        <OfflineBar style={{ position: 'relative' }} />
      </KeyboardAvoidingView>
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
  // Address input card. Layout matches figma (bg #F9FAFB, border 1px
  // #E5E7EB, radius 8, padding 12/14/12/14). The figma frame was
  // 53px tall around a 10px placeholder, but at 10px shielded
  // addresses (~95 chars) are unreadable on-device. We bump the
  // typography to a comfortable 14px and let the card grow to fit
  // (minHeight ≈ 2 lines at this size). The placeholder still uses
  // the same style so empty + filled states look consistent.
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
  // Error state: replace the neutral border with a red one. Keeps the
  // same dimensions / padding so the layout doesn't shift when the
  // error appears.
  inputCardError: {
    borderColor: '#E55B5B',
  },
  // Placeholder + content typography matches the figma typography
  // panel: Space Mono, 10px, regular, color #9CA3AF for the
  // placeholder. Falling back to the platform's built-in monospace
  // face since Space Mono isn't bundled in this project (drop
  // SpaceMono-Regular.ttf into src/assets/fonts/ and re-link if you
  // want the exact figma font). Both placeholder and typed text
  // inherit the same fontFamily/fontSize from this style, so they
  // render identically — only the color differs (set via
  // placeholderTextColor on the TextInput).
  input: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    // Tight line-height keeps the wrapped address from overflowing
    // the card by a couple of characters when it spans 2–3 lines.
    lineHeight: 16,
    color: COLORS.textColor,
    padding: 0,
    margin: 0,
    // No flex:1 — let the TextInput size itself to its content so the
    // outer card grows naturally beyond minHeight when the address
    // wraps to a 3rd line.
    alignSelf: 'stretch',
    // Android-only: removes the extra vertical breathing room the
    // platform adds around glyphs, so the typed text aligns with
    // the placeholder at the top of the card.
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
