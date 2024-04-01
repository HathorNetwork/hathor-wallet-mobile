/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View, FlatList } from 'react-native';
import { useSelector } from 'react-redux';
import { transactionUtils } from '@hathor/wallet-lib';
import { t } from 'ttag';

import { COLORS } from '../../styles/themes';
import { NanoContractTransactionBalanceListItem } from './NanoContractTransactionBalanceListItem.component';
import { HathorFlatList } from '../HathorFlatList.component';

/**
 * Calculate the balance of a transaction
 *
 * @param tx Transaction to get balance from
 * @param storage Storage to get metadata from
 * @returns {Promise<Record<string, IBalance>>} Balance of the transaction
 */
async function getTxBalance(tx, storage) {
  const balance = {};
  const getEmptyBalance = () => ({
    tokens: { locked: 0, unlocked: 0 },
    authorities: {
      mint: { locked: 0, unlocked: 0 },
      melt: { locked: 0, unlocked: 0 },
    },
  });

  const nowTs = Math.floor(Date.now() / 1000);
  const nowHeight = await storage.getCurrentHeight();
  const rewardLock = storage.version?.reward_spend_min_blocks;
  const isHeightLocked = this.isHeightLocked(tx.height, nowHeight, rewardLock);

  for (const output of tx.outputs) {
    // Removed isAddressMine filter
    if (!balance[output.token]) {
      balance[output.token] = getEmptyBalance();
    }
    const isLocked = this.isOutputLocked(output, { refTs: nowTs }) || isHeightLocked;

    if (this.isAuthorityOutput(output)) {
      if (this.isMint(output)) {
        if (isLocked) {
          balance[output.token].authorities.mint.locked += 1;
        } else {
          balance[output.token].authorities.mint.unlocked += 1;
        }
      }
      if (this.isMelt(output)) {
        if (isLocked) {
          balance[output.token].authorities.melt.locked += 1;
        } else {
          balance[output.token].authorities.melt.unlocked += 1;
        }
      }
    } else if (isLocked) {
      balance[output.token].tokens.locked += output.value;
    } else {
      balance[output.token].tokens.unlocked += output.value;
    }
  }

  for (const input of tx.inputs) {
    // Removed isAddressMine filter
    if (!balance[input.token]) {
      balance[input.token] = getEmptyBalance();
    }

    if (this.isAuthorityOutput(input)) {
      if (this.isMint(input)) {
        balance[input.token].authorities.mint.unlocked -= 1;
      }
      if (this.isMelt(input)) {
        balance[input.token].authorities.melt.unlocked -= 1;
      }
    } else {
      balance[input.token].tokens.unlocked -= input.value;
    }
  }

  return balance;
}

async function getTokensBalance(tx, wallet) {
  const tokensBalance = await getTxBalance.bind(transactionUtils)(tx, wallet.storage);
  const balances = [];
  for (const [key, balance] of Object.entries(tokensBalance)) {
    const tokenBalance = {
      tokenUid: key,
      available: balance.tokens.unlocked,
      locked: balance.tokens.locked
    };
    balances.push(tokenBalance);
  }
  return balances;
}

export const NanoContractTransactionBalanceList = ({ tx }) => {
  const wallet = useSelector((state) => state.wallet);
  const [tokensBalance, setTokensBalance] = useState([]);

  useEffect(() => {
    const fetchTokensBalance = async () => {
      const balance = await getTokensBalance(tx, wallet);
      console.log('tokens balance', balance);
      setTokensBalance(balance);
    };
    fetchTokensBalance();
  }, []);

  return (
    <Wrapper>
      <HathorFlatList
        data={tokensBalance}
        renderItem={({ item, index }) => (
          <NanoContractTransactionBalanceListItem
            item={item}
            index={index}
          />
        )}
        keyExtractor={(item) => item.tokenUid}
      />
    </Wrapper>
  );
};

const Wrapper = ({ children }) => (
  <View style={styles.wrapper}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: COLORS.lowContrastDetail, // Defines an outer area on the main list content
  },
});
