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
//   wallet.js mint <address> <deposit|fee> <name> <symbol> <units> <treasury-seed-file>
//                                            creates a custom token paid to the address, with
//                                            the authorities kept by the treasury; prints its uid
//   wallet.js cleanup <run-dir>              gives a run's HTR and deposits back to genesis

const fs = require('fs');
const path = require('path');
const { walletUtils, addressUtils, HathorWallet, Connection, config, TokenVersion } = require('@hathor/wallet-lib');

const NODE_URL = process.env.NODE_URL || 'http://localhost:18083/v1a/';
const TX_MINING_URL = process.env.TX_MINING_URL || 'http://localhost:18035/';
const FUNDING_URL = process.env.FUNDING_URL || 'http://localhost:13020';
const PIN = '123456';
const PASSWORD = 'e2e-password';
// The privnet's genesis output (QA/e2e/privnet/privnet.yml): index 1 of the genesis seed, in the
// wallet the helper's /fund pays from.
const GENESIS_ADDRESS = 'WY1URKUnqCTyiixW1Dw29vmeG99hNN4EW6';

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

/** The unlocked balance of a token in a started wallet, in units. */
async function unlocked(wallet, uid) {
  const [balance] = await wallet.getBalance(uid);
  return BigInt((balance && balance.balance.unlocked) || 0);
}

/**
 * Runs `use` on a wallet holding `cents` more HTR than it had, paid through the integration-test
 * helper's POST /fund to its first public address. Without a seed, the wallet is a throwaway.
 */
async function withFundedWallet(cents, use, seed = walletUtils.generateWalletWords()) {
  return withShieldedWallet(seed, async (wallet) => {
    const before = await unlocked(wallet, '00');
    const response = await fetch(`${FUNDING_URL}/fund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: publicAddress(seed, 0), amount: cents }),
    });
    if (!response.ok) {
      throw new Error(`funding the wallet failed: ${response.status} ${await response.text()}`);
    }
    for (let i = 0; i < 60; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      if (await unlocked(wallet, '00') >= before + BigInt(cents)) break;
      // eslint-disable-next-line no-await-in-loop
      await sleep(500);
    }
    // A tx must be later than the outputs it spends, to the second: one spending the funds the
    // moment they land fails the fullnode's validation.
    await sleep(1500);
    return use(wallet);
  });
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
  // The amount plus 1 HTR for the privacy fee (0.01 to 0.02 HTR per private output).
  return withFundedWallet(Number(value) + 100, async (wallet) => {
    const tx = await wallet.sendManyOutputsTransaction(
      [{ address, value, token: '00', shielded }],
      { pinCode: PIN },
    );
    return tx.hash;
  });
}

/**
 * Creates a custom token whose whole supply goes to `address`, from the treasury wallet, which
 * keeps the mint and melt authorities so `cleanup` can melt the token and free its deposit. A
 * deposit token locks 1% of its supply in HTR: 2^40 units lock about 110M HTR.
 */
async function mint(address, kind, name, symbol, units, treasuryFile) {
  const versions = { deposit: TokenVersion.DEPOSIT, fee: TokenVersion.FEE };
  if (!address || versions[kind] === undefined || !name || !symbol || !/^\d+$/.test(units || '')
    || !treasuryFile) {
    throw new Error('usage: mint <address> <deposit|fee> <name> <symbol> <units> <treasury-seed-file>');
  }
  const amount = BigInt(units);
  const deposit = kind === 'deposit' ? (amount + 99n) / 100n : 0n;
  // 1 HTR above the deposit pays the fee-token fee and leaves change.
  return withFundedWallet(Number(deposit) + 100, async (wallet) => {
    const tx = await wallet.createNewToken(name, symbol, amount, {
      address, tokenVersion: versions[kind], pinCode: PIN,
    });
    return tx.hash;
  }, readSeed(treasuryFile));
}

/** Sends a wallet's whole unlocked balance of a token; returns the units sent. */
async function sendAll(wallet, address, uid) {
  const value = await unlocked(wallet, uid);
  if (value > 0n) {
    await wallet.sendTransaction(address, value, { token: uid, pinCode: PIN });
  }
  return value;
}

/**
 * Gives back to genesis what a run took from it, so a long-lived privnet lasts hundreds of runs:
 * the run's wallets send their deposit tokens to the treasury, which melts them and frees their
 * deposits, and every wallet sends its HTR to the genesis address. Best effort: a step that fails
 * is reported and the rest go on. Left behind: fee tokens (melting them frees nothing) and what
 * the multisig destination received (the helper keeps its keys), a few HTR a run.
 *
 * The run dir holds tokens.json ([{ uid, kind, symbol }]), treasury.seed and the seeds of the
 * run's other wallets (app.seed, peer.seed), as run.js writes them.
 */
async function cleanup(runDir) {
  if (!runDir || !fs.existsSync(path.join(runDir, 'treasury.seed'))) {
    throw new Error('usage: cleanup <run-dir with treasury.seed>');
  }
  const tokensFile = path.join(runDir, 'tokens.json');
  const deposits = (fs.existsSync(tokensFile) ? JSON.parse(fs.readFileSync(tokensFile, 'utf8')) : [])
    .filter((token) => token.kind === 'deposit');
  const treasurySeed = readSeed(path.join(runDir, 'treasury.seed'));
  const treasury = publicAddress(treasurySeed, 0);
  const report = [];
  const attempt = async (what, step) => {
    try {
      // Each step may spend the change of the one before: a tx must be a second later.
      await sleep(1100);
      const units = await step();
      if (units > 0n) report.push(`${what}: ${units}`);
    } catch (e) {
      report.push(`${what}: FAILED (${e.message})`);
    }
  };

  const holders = ['app.seed', 'peer.seed'].filter((file) => fs.existsSync(path.join(runDir, file)));
  for (const file of holders) {
    // eslint-disable-next-line no-await-in-loop
    await attempt(`${file} start`, () => withShieldedWallet(readSeed(path.join(runDir, file)), async (wallet) => {
      for (const { uid, symbol } of deposits) {
        // eslint-disable-next-line no-await-in-loop
        await attempt(`${file} ${symbol} to the treasury`, () => sendAll(wallet, treasury, uid));
      }
      await attempt(`${file} HTR to genesis (cents)`, () => sendAll(wallet, GENESIS_ADDRESS, '00'));
      return 0n;
    }));
  }

  await attempt('treasury start', () => withShieldedWallet(treasurySeed, async (wallet) => {
    for (const { uid, symbol } of deposits) {
      // eslint-disable-next-line no-await-in-loop
      await attempt(`treasury ${symbol} melted`, async () => {
        const units = await unlocked(wallet, uid);
        if (units > 0n) {
          await wallet.meltTokens(uid, units, { pinCode: PIN, createAnotherMelt: false });
        }
        return units;
      });
    }
    await attempt('treasury HTR to genesis (cents)', () => sendAll(wallet, GENESIS_ADDRESS, '00'));
    return 0n;
  }));
  // Prefixed, since wallet-lib logs to stdout too.
  return (report.length ? report : ['nothing to give back']).map((line) => `cleanup: ${line}`).join('\n');
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
  if (command === 'mint') {
    return mint(...args);
  }
  if (command === 'cleanup') {
    return cleanup(args[0]);
  }
  throw new Error('usage: wallet.js new-seed | address <seed-file> [index] | shielded-address <seed-file>'
    + ' | send-private <address> <HTR> <amount|full>'
    + ' | mint <address> <deposit|fee> <name> <symbol> <units> <treasury-seed-file> | cleanup <run-dir>');
}

// wallet-lib keeps handles open after its work is done, so exit explicitly.
main(process.argv.slice(2)).then((out) => {
  console.log(out);
  process.exit(0);
}, (e) => {
  console.error(`wallet: ${e.message}`);
  process.exit(1);
});
