/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect } from '@jest/globals';
import { runSaga } from 'redux-saga';
import { constants as hathorLibConstants } from '@hathor/wallet-lib';
import { handleTx } from '../../src/sagas/wallet';
import {
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
} from '../../src/constants';
import {
  tokenImportNewTxTokens,
  tokenFetchBalanceRequested,
  tokenFetchHistoryRequested,
  tokenInvalidateHistory,
  walletRefreshSharedAddress,
} from '../../src/actions';

const HTR = hathorLibConstants.NATIVE_TOKEN_UID;
const TOKEN = '00000000aaaabbbbccccddddeeeeffff00001111222233334444555566667777';
// A token the wallet holds and hasn't registered.
const NEW_TOKEN = '00000000111122223333444455556666777788889999aaaabbbbccccddddeeee';
// The wallet's addresses: a legacy one, and the spend P2PKH that labels the shielded outputs paid
// to one of its shielded addresses.
const WALLET_ADDRESS = 'WZ7pDnkPnxbs14GHdUFivFzPbzitwNtvZo';
const WALLET_SPEND_ADDRESS = 'WewDeXWyvHP7jJTs7tjLoQfoB72LLxJQqN';
const OTHER_ADDRESS = 'WYBwT3xLpDnHNtYZiU52oanupVeDKhAvNp';
const OTHER_SPEND_ADDRESS = 'WP2rHoxmSv9YrPFFcz4xS6JuBXLhUXT3gf';

// A shielded output as the 'new-tx' event delivers it. The wallet decoded it when value, token
// and the blinding factor are set; decoded.address is wire data, set for every output.
const decodedShieldedOutput = (address, token, value) => ({
  mode: 1,
  commitment: 'aa',
  range_proof: 'bb',
  ephemeral_pubkey: 'cc',
  token_data: 0,
  decoded: { type: 'P2PKH', address },
  value,
  token,
  blindingFactor: 'dd',
});
const undecodedShieldedOutput = (address) => ({
  mode: 2,
  commitment: 'aa',
  range_proof: 'bb',
  ephemeral_pubkey: 'cc',
  asset_commitment: 'ee',
  decoded: { type: 'P2PKH', address },
});
const transparent = (address, token, value) => ({ decoded: { type: 'P2PKH', address }, token, value });

// The shielded environment of a wallet on the shielded testnet's wallet-service facade.
const WALLET_SERVICE_ENVIRONMENT = {
  useWalletService: true,
  fullNodeNetworkName: FULL_NETWORK_SHIELDED_TESTNET,
  featureToggles: { ...FEATURE_TOGGLE_DEFAULTS, [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: true },
  shielded: { providerStatus: SHIELDED_PROVIDER_STATUS.READY, providerError: null },
};

// A shielded output as the wallet-service facade's 'new-tx' event delivers it: the service
// decodes it, and the event carries no value nor token, only its on-chain spend address.
const walletServiceShieldedOutput = (address) => ({
  mode: 2,
  decoded: { address },
});

// The shielded environment of a wallet on the shielded testnet's fullnode facade.
const FULLNODE_ENVIRONMENT = { ...WALLET_SERVICE_ENVIRONMENT, useWalletService: false };

/**
 * Runs handleTx for the tx. `walletTokens` is the wallet's token list (by default its registered
 * tokens), or an error its read fails with; `listed` the unregistered tokens already listed, and
 * `txBalance` what the wallet's getTxBalance returns.
 */
async function run(tx, environment = {}, {
  shieldedEnabled = true,
  walletTokens = [HTR, TOKEN],
  listed = {},
  txBalance = {},
} = {}) {
  const mine = new Set([WALLET_ADDRESS, WALLET_SPEND_ADDRESS]);
  const wallet = {
    isReady: () => true,
    // Only the wallet-service facade's wallet has it: the fullnode facade's would throw here.
    ...(environment.useWalletService ? { isShieldedEnabled: () => shieldedEnabled } : {}),
    getTxBalance: jest.fn(async () => txBalance),
    getTokens: jest.fn(async () => {
      if (walletTokens instanceof Error) throw walletTokens;
      return walletTokens;
    }),
    checkAddressesMine: jest.fn(async (addresses) => Object.fromEntries(
      addresses.map((address) => [address, mine.has(address)]),
    )),
  };
  const state = {
    wallet,
    tokens: { [HTR]: { uid: HTR }, [TOKEN]: { uid: TOKEN } },
    tokenImport: { unregisteredTokens: listed },
    ...environment,
  };
  const dispatched = [];
  await runSaga(
    { dispatch: (action) => dispatched.push(action), getState: () => state },
    handleTx,
    { payload: tx },
  ).toPromise();
  return { dispatched, wallet };
}

describe('handleTx with shielded outputs', () => {
  test('refreshes HTR when the wallet receives it in a shielded output', async () => {
    const { dispatched } = await run({
      tx_id: 'tx-private-receive',
      inputs: [transparent(OTHER_ADDRESS, HTR, 100n)],
      outputs: [transparent(OTHER_ADDRESS, HTR, 58n)],
      shielded_outputs: [decodedShieldedOutput(WALLET_SPEND_ADDRESS, HTR, 40n)],
    });

    expect(dispatched).toEqual([
      tokenFetchBalanceRequested(HTR, true),
      tokenFetchHistoryRequested(HTR, true),
      walletRefreshSharedAddress(),
    ]);
  });

  test('refreshes a custom token the wallet receives in a shielded output', async () => {
    const { dispatched } = await run({
      tx_id: 'tx-private-token',
      inputs: [transparent(OTHER_ADDRESS, TOKEN, 10n), transparent(OTHER_ADDRESS, HTR, 3n)],
      outputs: [],
      shielded_outputs: [
        decodedShieldedOutput(WALLET_SPEND_ADDRESS, TOKEN, 10n),
        undecodedShieldedOutput(OTHER_SPEND_ADDRESS),
      ],
    });

    expect(dispatched).toEqual([
      tokenFetchBalanceRequested(TOKEN, true),
      tokenInvalidateHistory(TOKEN),
      walletRefreshSharedAddress(),
    ]);
  });

  test('refreshes the wallet\'s own private change once, and checks no foreign output', async () => {
    const { dispatched, wallet } = await run({
      tx_id: 'tx-private-send',
      inputs: [transparent(WALLET_ADDRESS, HTR, 100n)],
      outputs: [],
      shielded_outputs: [
        undecodedShieldedOutput(OTHER_SPEND_ADDRESS),
        decodedShieldedOutput(WALLET_SPEND_ADDRESS, HTR, 57n),
      ],
    });

    expect(dispatched).toEqual([
      tokenFetchBalanceRequested(HTR, true),
      tokenFetchHistoryRequested(HTR, true),
      walletRefreshSharedAddress(),
    ]);
    expect(wallet.checkAddressesMine).toHaveBeenCalledWith([WALLET_ADDRESS, WALLET_SPEND_ADDRESS]);
  });

  test('ignores a shielded output the wallet did not decode, whatever address it claims', async () => {
    const { dispatched, wallet } = await run({
      tx_id: 'tx-foreign',
      inputs: [transparent(OTHER_ADDRESS, HTR, 100n)],
      outputs: [transparent(OTHER_ADDRESS, HTR, 98n)],
      shielded_outputs: [undecodedShieldedOutput(WALLET_SPEND_ADDRESS)],
    });

    expect(dispatched).toEqual([walletRefreshSharedAddress()]);
    expect(wallet.checkAddressesMine).toHaveBeenCalledWith([OTHER_ADDRESS]);
  });

  test('refreshes only the decoded token in the shielded environment, and checks no spend address', async () => {
    const { dispatched, wallet } = await run({
      tx_id: 'tx-private-receive-environment',
      inputs: [transparent(OTHER_ADDRESS, HTR, 100n)],
      outputs: [transparent(OTHER_ADDRESS, HTR, 58n)],
      shielded_outputs: [
        decodedShieldedOutput(WALLET_SPEND_ADDRESS, HTR, 40n),
        undecodedShieldedOutput(OTHER_SPEND_ADDRESS),
      ],
    }, FULLNODE_ENVIRONMENT);

    expect(dispatched).toEqual([
      tokenFetchBalanceRequested(HTR, true),
      tokenFetchHistoryRequested(HTR, true),
      walletRefreshSharedAddress(),
    ]);
    expect(wallet.checkAddressesMine).toHaveBeenCalledWith([OTHER_ADDRESS, WALLET_SPEND_ADDRESS]);
  });

  test('handles a transparent tx as before', async () => {
    const { dispatched } = await run({
      tx_id: 'tx-transparent',
      inputs: [transparent(OTHER_ADDRESS, HTR, 100n)],
      outputs: [transparent(WALLET_ADDRESS, HTR, 30n), transparent(OTHER_ADDRESS, HTR, 70n)],
    });

    expect(dispatched).toEqual([
      tokenFetchBalanceRequested(HTR, true),
      tokenFetchHistoryRequested(HTR, true),
      walletRefreshSharedAddress(),
    ]);
  });
});

describe('handleTx with shielded outputs on the wallet-service facade', () => {
  const REFRESH_ALL = [
    tokenFetchBalanceRequested(HTR, true),
    tokenFetchHistoryRequested(HTR, true),
    tokenFetchBalanceRequested(TOKEN, true),
    tokenInvalidateHistory(TOKEN),
    walletRefreshSharedAddress(),
  ];
  // The refresh with tokens detected in the wallet's token list, listed after the balance requests.
  const withDetected = (uids) => [
    ...REFRESH_ALL.slice(0, -1),
    tokenImportNewTxTokens(uids),
    walletRefreshSharedAddress(),
  ];

  test('refreshes every registered token when a shielded output pays the wallet', async () => {
    const { dispatched, wallet } = await run({
      tx_id: 'tx-ws-private-receive',
      inputs: [transparent(OTHER_ADDRESS, HTR, 100n)],
      outputs: [transparent(OTHER_ADDRESS, HTR, 58n)],
      shielded_outputs: [
        walletServiceShieldedOutput(OTHER_SPEND_ADDRESS),
        walletServiceShieldedOutput(WALLET_SPEND_ADDRESS),
      ],
    }, WALLET_SERVICE_ENVIRONMENT);

    expect(dispatched).toEqual(REFRESH_ALL);
    expect(wallet.checkAddressesMine).toHaveBeenCalledWith(
      [OTHER_ADDRESS, OTHER_SPEND_ADDRESS, WALLET_SPEND_ADDRESS],
    );
  });

  test('refreshes them for a receive with only shielded outputs', async () => {
    const { dispatched } = await run({
      tx_id: 'tx-ws-fully-private',
      inputs: [],
      outputs: [],
      shielded_outputs: [walletServiceShieldedOutput(WALLET_SPEND_ADDRESS)],
    }, WALLET_SERVICE_ENVIRONMENT);

    expect(dispatched).toEqual(REFRESH_ALL);
  });

  test('refreshes no token for shielded outputs paid to others', async () => {
    const { dispatched } = await run({
      tx_id: 'tx-ws-foreign',
      inputs: [transparent(OTHER_ADDRESS, HTR, 100n)],
      outputs: [],
      shielded_outputs: [walletServiceShieldedOutput(OTHER_SPEND_ADDRESS)],
    }, WALLET_SERVICE_ENVIRONMENT);

    expect(dispatched).toEqual([walletRefreshSharedAddress()]);
  });

  test('refreshes them with the shielded UI flag off, as the balance still counts them', async () => {
    const { dispatched } = await run({
      tx_id: 'tx-ws-flag-off',
      inputs: [transparent(OTHER_ADDRESS, HTR, 100n)],
      outputs: [],
      shielded_outputs: [walletServiceShieldedOutput(WALLET_SPEND_ADDRESS)],
    }, {
      ...WALLET_SERVICE_ENVIRONMENT,
      featureToggles: { ...FEATURE_TOGGLE_DEFAULTS, [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: false },
    });

    expect(dispatched).toEqual(REFRESH_ALL);
  });

  test('refreshes each token once when the tx pays the wallet both publicly and privately', async () => {
    const { dispatched } = await run({
      tx_id: 'tx-ws-mixed-receive',
      inputs: [transparent(OTHER_ADDRESS, HTR, 100n)],
      outputs: [transparent(WALLET_ADDRESS, HTR, 30n), transparent(WALLET_ADDRESS, TOKEN, 5n)],
      shielded_outputs: [walletServiceShieldedOutput(WALLET_SPEND_ADDRESS)],
    }, WALLET_SERVICE_ENVIRONMENT);

    expect(dispatched).toEqual(REFRESH_ALL);
  });

  test('checks no shielded output when the wallet registered no shielded keys', async () => {
    const { dispatched, wallet } = await run({
      tx_id: 'tx-ws-no-keys',
      inputs: [transparent(OTHER_ADDRESS, HTR, 100n)],
      outputs: [],
      shielded_outputs: [walletServiceShieldedOutput(WALLET_SPEND_ADDRESS)],
    }, WALLET_SERVICE_ENVIRONMENT, { shieldedEnabled: false });

    expect(dispatched).toEqual([walletRefreshSharedAddress()]);
    expect(wallet.checkAddressesMine).toHaveBeenCalledWith([OTHER_ADDRESS]);
  });

  test('lists a token first received in a fully shielded output', async () => {
    const { dispatched } = await run({
      tx_id: 'tx-ws-new-token',
      inputs: [],
      outputs: [],
      shielded_outputs: [walletServiceShieldedOutput(WALLET_SPEND_ADDRESS)],
    }, WALLET_SERVICE_ENVIRONMENT, { walletTokens: [HTR, TOKEN, NEW_TOKEN] });

    expect(dispatched).toEqual(withDetected([NEW_TOKEN]));
  });

  test('lists no token that is already listed, or that the tx balance already reported', async () => {
    const { dispatched } = await run({
      tx_id: 'tx-ws-known-token',
      inputs: [],
      outputs: [],
      shielded_outputs: [walletServiceShieldedOutput(WALLET_SPEND_ADDRESS)],
    }, WALLET_SERVICE_ENVIRONMENT, {
      walletTokens: [HTR, TOKEN, NEW_TOKEN, 'reported'],
      listed: { [NEW_TOKEN]: { uid: NEW_TOKEN } },
      txBalance: { reported: { tokens: { locked: 0n, unlocked: 1n } } },
    });

    // The tx balance reports its own token; the wallet token list adds nothing.
    expect(dispatched).toEqual([tokenImportNewTxTokens(['reported']), ...REFRESH_ALL]);
  });

  test('still refreshes the balances when the wallet tokens cannot be read', async () => {
    const { dispatched } = await run({
      tx_id: 'tx-ws-tokens-fail',
      inputs: [],
      outputs: [],
      shielded_outputs: [walletServiceShieldedOutput(WALLET_SPEND_ADDRESS)],
    }, WALLET_SERVICE_ENVIRONMENT, { walletTokens: new Error('offline') });

    expect(dispatched).toEqual(REFRESH_ALL);
  });

  test('reads no wallet token for shielded outputs paid to others', async () => {
    const { wallet } = await run({
      tx_id: 'tx-ws-foreign-tokens',
      inputs: [transparent(OTHER_ADDRESS, HTR, 100n)],
      outputs: [],
      shielded_outputs: [walletServiceShieldedOutput(OTHER_SPEND_ADDRESS)],
    }, WALLET_SERVICE_ENVIRONMENT, { walletTokens: [HTR, TOKEN, NEW_TOKEN] });

    expect(wallet.getTokens).not.toHaveBeenCalled();
  });
});
