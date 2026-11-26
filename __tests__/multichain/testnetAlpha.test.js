/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import {
  FULL_NETWORK_NEXT_TESTNET,
  NETWORK_TESTNET,
  PRE_SETTINGS_NEXT_TESTNET,
  STAGE_TESTNET,
} from '../../src/constants';
import {
  devBackendSideChain,
  getSideChainConfig,
  mintedTokenId,
  nextExplorerTxUrl,
  transferReceiveSymbol,
} from '../../src/multichain/chains';
import { pinMismatch, prepareError } from '../../src/multichain/next/backendClient';
import { BackendError } from '../../src/multichain/next/backendApi';
import { createBackendBridge, recordOf } from '../../src/multichain/next/backendBridge';
import {
  isUsableBackendConfig,
  usedBackendConfig,
} from '../../src/components/Multichain/DevBackendSettings';
import {
  NEXT_CLIENT_ERROR,
  NextClientError,
  nextClientErrorMessage,
} from '../../src/multichain/nextClientErrors';
import { publicTokenNote } from '../../src/screens/Multichain/NextCreateTokenScreen';

const USDT = 'd957d448377de9c9d313d545398677cd6df99ac051dcf2afcd1b38dcb22f92d8';
const NHTR = '664cf15052b6f66f1f06ac32189381a27f1bfe1eda2f77cea4fde760b5884d33';
const TX_ID = '2243044bc6be978eec0d8ab1ef80422f011bbee6f13dbde11a43612e1b0a3213';

// testnet-alpha's GET /v1/config, as its backend answered it on 2026-11-25.
const LIVE = {
  contract: 1,
  hathor: { network: 'testnet-juliet' },
  next: {
    network_id: 1004,
    native_token: USDT,
    service_view_pub: 'ee29df21a6c64fe43fc8ec6cd7b8c1ecfc4c89eec9370086129e367693bbf400',
    wire_format: 'v3',
    amount_width: 'u64',
    genesis_ms: 1795542160000,
    epoch_ms: 500,
    send_fee: '5000000',
    native_token_symbol: 'USDT',
    native_token_name: 'US Dollar Tether (testnet-alpha play money)',
  },
  transfer: {
    transfer_address: 'WScTqhLsBQnz3HMdQqh66JBgWqb255XffL',
    destination_network: 'fb3694106fd98e1dc5aa959ef2dc8b1792d593846de685af69c39590a7642b23',
    confirmations: 21,
    mean_block_ms: 30000,
    data_output_value: '1',
    hathor_network: 'testnet-juliet',
    mint_token: NHTR,
    mint_token_symbol: 'nHTR',
    mint_token_name: "new HTR (testnet-juliet's HTR on testnet-alpha)",
  },
  issuance: true,
};

const withTransfer = (transfer) => ({ ...LIVE, transfer: { ...LIVE.transfer, ...transfer } });
const testnet = () => getSideChainConfig(
  FULL_NETWORK_NEXT_TESTNET,
  null,
  PRE_SETTINGS_NEXT_TESTNET.nodeUrl,
);

describe('the Hathor Next Testnet preset', () => {
  test('runs the wallet on testnet-juliet, through its node, wallet-service and explorer', () => {
    expect(PRE_SETTINGS_NEXT_TESTNET).toEqual({
      stage: STAGE_TESTNET,
      network: NETWORK_TESTNET,
      fullNetwork: 'testnet-juliet',
      nodeUrl: 'https://legacy-node.testnet-alpha.samba.hathor.network/v1a/',
      txMiningServiceUrl: 'https://tx-mining.testnet-alpha.samba.hathor.network/',
      walletServiceUrl: 'https://legacy-wallet-service.testnet-alpha.samba.hathor.network/',
      walletServiceWsUrl: 'wss://legacy-wallet-service-ws.testnet-alpha.samba.hathor.network/',
      explorerUrl: 'https://legacy-explorer.testnet-alpha.samba.hathor.network/',
      explorerServiceUrl: 'https://legacy-node.testnet-alpha.samba.hathor.network/',
    });
  });

  test('has testnet-alpha as its side chain, by the name its node reports, on any node', () => {
    expect(testnet()).toMatchObject({
      backendUrl: 'https://wallet-backend.testnet-alpha.samba.hathor.network',
      nextNetworkId: 1004,
      nativeTokenId: USDT,
      hathorNetwork: 'testnet-juliet',
      holdsValue: false,
    });
    expect(getSideChainConfig('testnet-juliet', null, 'http://10.0.0.2:8080/v1a/'))
      .toMatchObject({ nextNetworkId: 1004 });
  });

  test('leaves devnet-alpha and every other privatenet without a side chain', () => {
    expect(getSideChainConfig(
      'privatenet',
      null,
      'https://legacy-node.devnet-alpha.samba.hathor.network/v1a/',
    )).toBeNull();
    expect(getSideChainConfig('testnet-india', null, PRE_SETTINGS_NEXT_TESTNET.nodeUrl)).toBeNull();
  });

  test("takes testnet-alpha's backend as it answers, and refuses one that changed any pin", () => {
    const config = testnet();
    expect(pinMismatch(config, LIVE)).toBeNull();
    expect(pinMismatch(config, { ...LIVE, next: { ...LIVE.next, native_token: NHTR } }))
      .toBe('native_token');
    expect(pinMismatch(config, { ...LIVE, hathor: { network: 'privatenet' } }))
      .toBe('hathor.network');
  });
});

describe('a side chain whose transfers mint HTR as a token of its own', () => {
  test('carries HTR to that token, and keeps the native token, which pays the fees, apart', () => {
    const config = testnet();
    expect(config.tokenMap).toEqual([{ hathor: '00', next: NHTR }]);
    expect(mintedTokenId(config)).toBe(NHTR);
    expect(config.nativeTokenSymbol).toBe('USDT');
    expect(config.nativeTokenName).toBe('US Dollar Tether (testnet-alpha play money)');
    expect(transferReceiveSymbol(config, 'HTR')).toBe('HTR');
  });

  test('is refused when its backend mints another token, or names none', () => {
    const config = testnet();
    expect(pinMismatch(config, withTransfer({ mint_token: 'ab'.repeat(32) })))
      .toBe('transfer.mint_token');
    expect(pinMismatch(config, withTransfer({ mint_token: undefined })))
      .toBe('transfer.mint_token');
  });

  test('the bridge carries HTR to that token', () => {
    const bridge = createBackendBridge(testnet(), { wallet: null, network: null, client: {} });
    expect(bridge.tokenMap).toEqual([{ hathor: '00', next: NHTR }]);
  });

  test("records an arriving transfer in that token, at the network's scale", () => {
    const record = recordOf({
      id: 't1', status: 'arrived', amount: '150', created_at: 1, mint_tx_id: TX_ID,
    }, testnet(), null);
    expect(record).toMatchObject({
      nextTokenId: NHTR,
      receiveAmount: '150000000',
      progress: { mintTxId: TX_ID },
    });
  });

  test('is how a backend set up for local testing shows one that names such a token', () => {
    const config = devBackendSideChain({ url: 'http://backend.test', pins: usedBackendConfig(LIVE) });
    expect(config.tokenMap).toEqual([{ hathor: '00', next: NHTR }]);
    expect(config.nativeTokenSymbol).toBe('USDT');
    expect(pinMismatch(config, LIVE)).toBeNull();
  });

  test("keeps a backend's minted token only when it is a token id", () => {
    expect(usedBackendConfig(LIVE).transfer.mint_token).toBe(NHTR);
    expect(isUsableBackendConfig(LIVE)).toBe(true);
    expect(isUsableBackendConfig(withTransfer({ mint_token: 'nHTR' }))).toBe(false);
  });
});

describe('a side chain whose transfers mint its native token', () => {
  const NATIVE = LIVE.next.native_token;

  test('names its native token HTR and carries HTR to it, with or without naming it', () => {
    for (const transfer of [{ mint_token: undefined }, { mint_token: NATIVE }]) {
      const pins = withTransfer(transfer);
      const config = devBackendSideChain({ url: 'http://backend.test', pins });
      expect(config.tokenMap).toEqual([{ hathor: '00', next: NATIVE }]);
      expect(config.nativeTokenSymbol).toBe('HTR');
      expect(mintedTokenId(config)).toBe(NATIVE);
      expect(pinMismatch(config, pins)).toBeNull();
    }
  });

  test('carries nothing, under its own name, when its backend transfers nothing', () => {
    const config = devBackendSideChain({ url: 'http://backend.test', pins: { ...LIVE, transfer: null } });
    expect(config.tokenMap).toEqual([]);
    expect(config.nativeTokenSymbol).toBe('USDT');
    expect(pinMismatch(config, { ...LIVE, transfer: null })).toBeNull();
  });
});

describe("a Hathor Next transaction's page on its explorer", () => {
  test("is hathor-next-explorer's page of the transaction, on testnet-alpha", () => {
    expect(nextExplorerTxUrl(testnet(), TX_ID))
      .toBe(`https://samba.explorer.hathor.dev/tx/${TX_ID}`);
    expect(nextExplorerTxUrl(testnet(), TX_ID.toUpperCase()))
      .toBe(`https://samba.explorer.hathor.dev/tx/${TX_ID}`);
    expect(nextExplorerTxUrl({ explorerUrl: 'https://explorer.test//' }, TX_ID))
      .toBe(`https://explorer.test/tx/${TX_ID}`);
  });

  test('is none without an explorer, or for anything but a transaction id', () => {
    const local = devBackendSideChain({ url: 'http://backend.test', pins: LIVE });
    expect(nextExplorerTxUrl(local, TX_ID)).toBeNull();
    expect(nextExplorerTxUrl(null, TX_ID)).toBeNull();
    expect(nextExplorerTxUrl(testnet(), null)).toBeNull();
    expect(nextExplorerTxUrl(testnet(), `${TX_ID}/../../x`)).toBeNull();
    expect(nextExplorerTxUrl(testnet(), TX_ID.slice(2))).toBeNull();
  });
});

describe('what the user is told about a fee, on a network whose fees are paid in USDT', () => {
  test('names USDT when the fee would make its change public', () => {
    const e = prepareError(
      new BackendError(422, `amount-leak: token=${USDT}`),
      { tokenId: NHTR, nativeTokenId: USDT, feeSymbol: 'USDT' },
    );
    expect(e).toBeInstanceOf(NextClientError);
    expect(e.code).toBe(NEXT_CLIENT_ERROR.FEE_AMOUNT_VISIBLE);
    expect(e.message).toBe(nextClientErrorMessage(NEXT_CLIENT_ERROR.FEE_AMOUNT_VISIBLE, { feeSymbol: 'USDT' }));
    expect(e.message).toContain('Send some USDT to your own Hathor Next address');
    expect(e.message).not.toMatch(/HTR/);
  });

  test('names USDT when one coin must pay a creation', () => {
    const { message } = new NextClientError(
      NEXT_CLIENT_ERROR.TOKEN_EXTRA_COINS,
      { feeSymbol: 'USDT' },
    );
    expect(message).toContain('one of your USDT coins');
    expect(message).toContain('Send some USDT');
    expect(message).not.toMatch(/HTR/);
  });

  test("names USDT as a creation's public change", () => {
    expect(publicTokenNote('USDT')).toContain('the USDT that comes back to you as change');
    expect(publicTokenNote('USDT')).toContain("You'll see how much USDT");
    expect(publicTokenNote('USDT')).not.toMatch(/HTR/);
  });

  test('still names HTR where HTR pays the fees', () => {
    expect(nextClientErrorMessage(NEXT_CLIENT_ERROR.FEE_AMOUNT_VISIBLE))
      .toContain('Send some HTR to your own Hathor Next address');
    expect(publicTokenNote('HTR')).toContain('the HTR that comes back to you as change');
  });
});
