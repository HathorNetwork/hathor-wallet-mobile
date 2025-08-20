/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import { get } from 'lodash';

import HathorHeader from '../components/HathorHeader';
import { COLORS } from '../styles/themes';
import { TokenSwapIcon } from '../components/Icons/TokenSwap.icon';

const TokenSwap = ({ navigation }) => {
  const tokens = useSelector((state) => state.tokens);
  const tokensBalance = useSelector((state) => state.tokensBalance);
  
  const [fromAmount, setFromAmount] = useState('0');
  const [toAmount, setToAmount] = useState('0');
  const [fromToken, setFromToken] = useState('HTR');
  const [toToken, setToToken] = useState('hUSDC');

  // Get balance for selected token
  const getTokenBalance = (symbol) => {
    const token = Object.values(tokens).find(t => t.symbol === symbol);
    if (!token) return '0.00';
    const balance = get(tokensBalance, `${token.uid}.data.available`, 0);
    const numericBalance = Number(balance) || 0;
    return numericBalance.toFixed(2);
  };

  const handleSwapTokens = () => {
    // Swap the from and to tokens
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);
    
    // Reset amounts
    setFromAmount('0');
    setToAmount('0');
  };

  return (
    <View style={styles.container}>
      <HathorHeader>
        <HathorHeader.Left>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t`TOKEN SWAP`}</Text>
        </HathorHeader.Left>
      </HathorHeader>
      
      <View style={styles.content}>
        {/* From Token Section */}
        <View style={styles.tokenSection}>
          <View style={styles.amountRow}>
            <TextInput
              style={styles.amountInput}
              value={fromAmount}
              onChangeText={setFromAmount}
              keyboardType="numeric"
              placeholder="0"
            />
            <TouchableOpacity style={styles.tokenSelector}>
              <Text style={styles.tokenText}>{fromToken}</Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.balanceText}>Balance: {getTokenBalance(fromToken)}</Text>
        </View>

        {/* Swap Button */}
        <View style={styles.swapButtonContainer}>
          <TouchableOpacity style={styles.swapButton} onPress={handleSwapTokens}>
            <TokenSwapIcon size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* To Token Section */}
        <View style={styles.tokenSection}>
          <View style={styles.amountRow}>
            <TextInput
              style={styles.amountInput}
              value={toAmount}
              onChangeText={setToAmount}
              keyboardType="numeric"
              placeholder="0"
            />
            <TouchableOpacity style={styles.tokenSelector}>
              <Text style={styles.tokenText}>{toToken}</Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.balanceText}>Balance: {getTokenBalance(toToken)}</Text>
        </View>
      </View>

      {/* Review Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity style={styles.reviewButton}>
          <Text style={styles.reviewButtonText}>{t`REVIEW`}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundColor,
  },
  backButton: {
    paddingRight: 16,
  },
  backArrow: {
    fontSize: 24,
    color: COLORS.textColor,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textColor,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  tokenSection: {
    marginBottom: 20,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 48,
    color: COLORS.textColor,
    fontWeight: '300',
    paddingRight: 16,
  },
  tokenSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderColor,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 100,
  },
  tokenText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textColor,
    marginRight: 8,
  },
  dropdownArrow: {
    fontSize: 12,
    color: COLORS.textColorShadow,
  },
  balanceText: {
    fontSize: 14,
    color: COLORS.textColorShadow,
    marginLeft: 4,
  },
  swapButtonContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  swapButton: {
    backgroundColor: COLORS.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  reviewButton: {
    backgroundColor: COLORS.borderColor,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  reviewButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textColorShadow,
  },
});

export default TokenSwap;