#!/usr/bin/env node
/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Wallet-side helpers for the e2e runner, with wallet-lib in plain Node (the app's node_modules
// are rewritten for React Native and don't load here). Seeds are throwaway privnet wallets.
//
//   wallet.js new-seed                       a fresh 24-word seed
//   wallet.js address <seed-file> [index]    the public (W...) address the app shows at index
//   wallet.js shielded-address <seed-file>   a shielded (K...) address of that wallet
//   wallet.js send-private <address> <HTR> <amount|full>
//                                            pays a shielded address with a private output
//                                            (TEMPORARY, see sendPrivate below)

const fs = require('fs');
const { walletUtils, addressUtils, HathorWallet, Connection, config } = require('@hathor/wallet-lib');

const NODE_URL = process.env.NODE_URL || 'http://localhost:18083/v1a/';
const TX_MINING_URL = process.env.TX_MINING_URL || 'http://localhost:18035/';
const FUNDING_URL = process.env.FUNDING_URL || 'http://localhost:13020';
const PIN = '123456';
const PASSWORD = 'e2e-password';

const readSeed = (file) => fs.readFileSync(file, 'utf8').trim();
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

function publicAddress(seed, index) {
  // The app derives addresses from the change-level key (m/44'/280'/0'/0), one below the account.
  const account = walletUtils.getXPubKeyFromSeed(seed, { networkName: 'testnet' });
  const change = walletUtils.xpubDeriveChild(account, 0);
  return addressUtils.deriveAddressFromXPubP2PKH(change, index, 'testnet').base58;
}

/** Runs `use` on a synced wallet-lib wallet that can build and read shielded outputs. */
async function withShieldedWallet(seed, use) {
  // Loaded here only: the shielded crypto is native and slow to load. It's a dependency of this
  // package alone, which the repo's lint doesn't install.
  // eslint-disable-next-line global-require, import/no-unresolved
  const { createDefaultShieldedCryptoProvider } = require('@hathor/ct-crypto-node/provider');
  config.setServerUrl(NODE_URL);
  config.setTxMiningUrl(TX_MINING_URL);
  const connection = new Connection({ network: 'testnet', servers: [NODE_URL], connectionTimeout: 30000 });
  const wallet = new HathorWallet({ seed, connection, password: PASSWORD, pinCode: PIN });
  wallet.setShieldedCryptoProvider(createDefaultShieldedCryptoProvider());
  await wallet.start({ pinCode: PIN, password: PASSWORD });
  try {
    for (let i = 0; i < 120 && !wallet.isReady(); i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(500);
    }
    if (!wallet.isReady()) {
      throw new Error('the wallet did not sync');
    }
    return await use(wallet);
  } finally {
    await wallet.stop({ cleanStorage: true });
  }
}

const shieldedAddress = (seed) => withShieldedWallet(
  seed,
  async (wallet) => (await wallet.getCurrentAddress({}, { legacy: false })).address,
);

/**
 * TEMPORARY: pays a shielded address with a private output, from a throwaway wallet this
 * command funds through the integration-test helper.
 *
 * Why it exists: the helper's POST /fund (hathor-integration-test-helper 0.0.2) pays public
 * addresses only; a shielded (K...) address gets a 500. The scenarios where the app receives
 * into its private address need a sender that builds shielded outputs, so this takes the place
 * of the old e2e kit's sender.js.
 *
 * Remove it when the helper's /fund can pay a shielded address with a private output: call
 * /fund for those scenarios instead, then delete this function, the `send-private` command,
 * and @hathor/ct-crypto-node from package.json if nothing else uses it.
 */
async function sendPrivate(address, htr, mode) {
  // wallet-lib's own dependency, installed with it.
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const { ShieldedOutputMode } = require('@hathor/ct-crypto-provider');
  const modes = {
    amount: ShieldedOutputMode.AMOUNT_SHIELDED, full: ShieldedOutputMode.FULLY_SHIELDED,
  };
  const shielded = modes[mode];
  if (shielded === undefined || !/^\d+(\.\d{1,2})?$/.test(htr || '')) {
    throw new Error('usage: send-private <address> <HTR, e.g. 5 or 5.50> <amount|full>');
  }
  const [whole, cents = ''] = htr.split('.');
  const value = BigInt(whole) * 100n + BigInt(cents.padEnd(2, '0'));
  const seed = walletUtils.generateWalletWords();
  // The amount plus 1 HTR for the privacy fee (0.01 to 0.02 HTR per private output).
  const funding = Number(value) + 100;
  const response = await fetch(`${FUNDING_URL}/fund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: publicAddress(seed, 0), amount: funding }),
  });
  if (!response.ok) {
    throw new Error(`funding the sender failed: ${response.status} ${await response.text()}`);
  }
  return withShieldedWallet(seed, async (wallet) => {
    for (let i = 0; i < 60; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const [balance] = await wallet.getBalance('00');
      if (balance && BigInt(balance.balance.unlocked) >= BigInt(funding)) break;
      // eslint-disable-next-line no-await-in-loop
      await sleep(500);
    }
    const tx = await wallet.sendManyOutputsTransaction(
      [{ address, value, token: '00', shielded }],
      { pinCode: PIN },
    );
    return tx.hash;
  });
}

async function main([command, ...args]) {
  if (command === 'new-seed') {
    return walletUtils.generateWalletWords();
  }
  if (command === 'address') {
    return publicAddress(readSeed(args[0]), Number(args[1] || 0));
  }
  if (command === 'shielded-address') {
    return shieldedAddress(readSeed(args[0]));
  }
  if (command === 'send-private') {
    return sendPrivate(...args);
  }
  throw new Error('usage: wallet.js new-seed | address <seed-file> [index] | shielded-address <seed-file>'
    + ' | send-private <address> <HTR> <amount|full>');
}

// wallet-lib keeps handles open after its work is done, so exit explicitly.
main(process.argv.slice(2)).then((out) => {
  console.log(out);
  process.exit(0);
}, (e) => {
  console.error(`wallet: ${e.message}`);
  process.exit(1);
});
