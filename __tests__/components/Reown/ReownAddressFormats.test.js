/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
  dispatch: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}));

/* eslint-disable import/first */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { reducer } from '../../../src/reducers/reducer';
import {
  networkSettingsUpdateState,
  selectAddressAddressesSuccess,
} from '../../../src/actions';
import { DEFAULT_TOKEN, PRE_SETTINGS_TESTNET } from '../../../src/constants';
import { PortalProvider } from '../../../src/components/Portal';
import { SendTransactionRequest } from '../../../src/components/Reown/SendTransactionRequest';
import { GetAddressClientRequest } from '../../../src/components/Reown/GetAddressClientRequest';
import { SelectAddressModal } from '../../../src/components/NanoContract/SelectAddressModal';
import { SignMessageRequestData } from '../../../src/components/Reown/SignMessageRequest';
import { GetAddressRequestData } from '../../../src/components/Reown/GetAddressRequest';
import { CreateTokenRequestData } from '../../../src/components/Reown/CreateTokenRequest';
import { GetUtxosRequestData } from '../../../src/components/Reown/GetUtxosRequest';
import { SignOracleDataRequestData } from '../../../src/components/Reown/SignOracleDataRequest';
import { NanoContractActions } from '../../../src/components/Reown/NanoContract/NanoContractActions';
import { NanoContractMethodArgs } from '../../../src/components/Reown/NanoContract/NanoContractMethodArgs';
import { NanoContractExecInfo } from '../../../src/components/Reown/NanoContract/NanoContractExecInfo';
import { EditAddressModal } from '../../../src/components/NanoContract/EditAddressModal';
/* eslint-enable import/first */

// Testnet addresses built with wallet-lib's address encoders from fixed keys: a legacy P2PKH
// address (34 characters) and a new address (95 characters).
const P2PKH = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const SHIELDED = 'K3KokZRo7DyNRRiyijpsVix2VADrd4HeA8vWLR5itAj81BVC4Vv7xoXbrYyKYwsLMWhefXqXKgJvC6HcVkDuJ7AJ7qUMS7fVc';
const ADDRESSES = [['a legacy address', P2PKH], ['a new address', SHIELDED]];

const DAPP = { icon: null, proposer: 'dApp', url: 'https://dapp.example', description: '' };

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  jest.clearAllMocks();
});

/**
 * Renders the element in a store on the testnet. `afterMount` runs once it mounted, as a saga
 * answers what the element requested.
 */
async function render(element, afterMount = () => {}) {
  const store = createStore(reducer);
  store.dispatch(networkSettingsUpdateState(PRE_SETTINGS_TESTNET));
  await act(async () => {
    mounted = create(<Provider store={store}><PortalProvider>{element}</PortalProvider></Provider>);
  });
  await act(async () => { afterMount(store); });
  // BackdropModal shows its content 100 ms after it opens.
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 150); }); });
  return mounted;
}

const textOf = (node) => [].concat(node.props.children).join('');
// The Text elements that show the address, whole.
const addressTexts = (renderer, address) => renderer.root.findAll(
  (node) => node.type === 'Text' && textOf(node).includes(address),
);
const styleOf = (node) => StyleSheet.flatten(node.props.style) ?? {};
// The View that holds a node.
const viewOf = (node) => {
  let { parent } = node;
  while (parent && parent.type !== 'View') {
    parent = parent.parent;
  }
  return parent;
};

describe('SendTransactionRequest', () => {
  test.each(ADDRESSES)('shows the start and the end of %s, on one line', async (_label, address) => {
    const renderer = await render(
      <SendTransactionRequest
        sendTransactionRequest={{
          dapp: DAPP,
          data: {
            params: { outputs: [{ address, value: '100', token: DEFAULT_TOKEN.uid }] },
            changeAddress: address,
            fee: 0n,
            pushTx: true,
          },
        }}
        onAccept={jest.fn()}
        onReject={jest.fn()}
      />,
    );

    // The output's address and the change address: the whole address is copied on a tap.
    const texts = addressTexts(renderer, address);
    expect(texts).toHaveLength(2);
    for (const text of texts) {
      expect(textOf(text)).toBe(address);
      expect(text.props.numberOfLines).toBe(1);
      expect(text.props.ellipsizeMode).toBe('middle');
    }
  });
});

describe('GetAddressClientRequest', () => {
  test('wraps each address of the list within its row', async () => {
    const renderer = await render(
      <GetAddressClientRequest getAddressClientRequest={{ dapp: DAPP }} />,
      (store) => store.dispatch(selectAddressAddressesSuccess({
        addresses: [{ address: SHIELDED, index: 0 }, { address: P2PKH, index: 1 }],
      })),
    );

    for (const address of [SHIELDED, P2PKH]) {
      const [text] = addressTexts(renderer, address);
      expect(text.props.numberOfLines).toBeUndefined();
      // The row lays its content out in a line: the content shrinks to the row, so the text
      // wraps instead of running past it.
      expect(styleOf(viewOf(text)).flexShrink).toBe(1);
    }
  });
});

describe('SelectAddressModal', () => {
  test('wraps each address of the list within its row, and the current one', async () => {
    const renderer = await render(
      <SelectAddressModal
        address={SHIELDED}
        show
        onDismiss={jest.fn()}
        onEditAddress={jest.fn()}
      />,
      (store) => store.dispatch(selectAddressAddressesSuccess({
        addresses: [{ address: SHIELDED, index: 0 }, { address: P2PKH, index: 1 }],
      })),
    );

    for (const address of [SHIELDED, P2PKH]) {
      const rowText = addressTexts(renderer, address).find((node) => textOf(node) === address);
      expect(rowText.props.numberOfLines).toBeUndefined();
      expect(styleOf(viewOf(rowText)).flexShrink).toBe(1);
    }
    // The current address heads the list.
    expect(addressTexts(renderer, `:\u00A0${SHIELDED}`)).not.toEqual([]);
  });
});

// These screens already show an address whole, wrapping it within a card of bounded width.
describe('Reown requests that wrap an address', () => {
  const expectWrapped = (renderer, address) => {
    const texts = addressTexts(renderer, address);
    expect(texts).not.toEqual([]);
    for (const text of texts) {
      expect(text.props.numberOfLines).toBeUndefined();
    }
  };

  test.each(ADDRESSES)('sign message: %s', async (_label, address) => {
    const renderer = await render(
      <SignMessageRequestData
        data={{ message: 'hello', address: { address, addressPath: "m/44'/280'/0'/0/0" } }}
      />,
    );
    expectWrapped(renderer, address);
  });

  test.each(ADDRESSES)('get address: %s', async (_label, address) => {
    const renderer = await render(
      <GetAddressRequestData data={{ type: 'index', index: 0, address }} />,
    );
    expectWrapped(renderer, address);
  });

  test.each(ADDRESSES)('create token: %s', async (_label, address) => {
    const renderer = await render(
      <CreateTokenRequestData
        data={{
          name: 'Token',
          symbol: 'TKN',
          amount: 100n,
          address,
          changeAddress: address,
          mintAuthorityAddress: address,
          meltAuthorityAddress: address,
        }}
      />,
    );
    expect(addressTexts(renderer, address)).toHaveLength(4);
    expectWrapped(renderer, address);
  });

  test.each(ADDRESSES)('get UTXOs: %s', async (_label, address) => {
    const renderer = await render(
      <GetUtxosRequestData data={{ utxos: [], filterParams: { filterAddress: address } }} />,
    );
    expectWrapped(renderer, address);
  });

  test.each(ADDRESSES)('sign oracle data: %s', async (_label, address) => {
    const renderer = await render(
      <SignOracleDataRequestData
        oracle={{ isAddress: true, address, raw: address, scriptType: 'p2pkh' }}
        data='result'
      />,
    );
    expectWrapped(renderer, address);
  });

  test.each(ADDRESSES)('nano contract actions: %s', async (_label, address) => {
    const renderer = await render(
      <NanoContractActions
        ncActions={[
          { type: 'withdrawal', token: DEFAULT_TOKEN.uid, amount: 100n, address },
          {
            type: 'deposit',
            token: DEFAULT_TOKEN.uid,
            amount: 1n,
            address,
            changeAddress: address,
          },
        ]}
        tokens={{ [DEFAULT_TOKEN.uid]: DEFAULT_TOKEN }}
        isTokenRegistered={() => true}
        showTokenInfo={jest.fn()}
      />,
    );
    expect(addressTexts(renderer, address)).toHaveLength(3);
    expectWrapped(renderer, address);
  });

  test.each(ADDRESSES)('nano contract arguments: %s', async (_label, address) => {
    const renderer = await render(
      <NanoContractMethodArgs
        blueprintId='blueprint'
        method='pay'
        ncArgs={[{ name: 'payee', type: 'Address', parsed: address, field: {} }]}
      />,
    );
    expectWrapped(renderer, address);
  });

  test.each(ADDRESSES)('nano contract caller: %s', async (_label, address) => {
    const renderer = await render(
      <NanoContractExecInfo
        nc={{
          ncId: 'nano-contract',
          blueprintId: 'blueprint',
          method: 'pay',
          caller: address,
          contractPaysFees: false,
        }}
        onSelectAddress={jest.fn()}
      />,
    );
    expectWrapped(renderer, address);
    // It shares its row with the edit icon: it shrinks to the row, and wraps.
    expect(styleOf(viewOf(addressTexts(renderer, address)[0])).flexShrink).toBe(1);
  });

  test.each(ADDRESSES)('the confirmation of a new caller: %s', async (_label, address) => {
    const renderer = await render(
      <EditAddressModal
        item={{ address, index: 0 }}
        show
        onAddressChange={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );
    expectWrapped(renderer, address);
  });
});
