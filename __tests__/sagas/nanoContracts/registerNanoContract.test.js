import { put } from 'redux-saga/effects';
import { NanoRequest404Error } from '@hathor/wallet-lib/lib/errors';
import { jest, test, expect, beforeEach, describe } from '@jest/globals';
import { registerNanoContract, failureMessage } from '../../../src/sagas/nanoContract';
import { nanoContractRegisterFailure, nanoContractRegisterRequest, onExceptionCaptured, types } from '../../../src/actions';
import { STORE } from '../../../src/store';
import { fixtures } from './fixtures';

beforeEach(() => {
  jest.clearAllMocks();
  STORE.clearItems();
});

describe('sagas/nanoContract/registerNanoContract', () => {
  test('contract already registered', async () => {
    // arrange Nano Contract registration inputs
    const { address, ncId } = fixtures;

    // call effect to register nano contract
    const gen = registerNanoContract(nanoContractRegisterRequest({ address, ncId }));
    // call select wallet
    gen.next();
    // feed back the selector
    gen.next(fixtures.wallet.addressNotMine);

    // assert failure
    // feed back isNanoContractRegistered
    expect(gen.next(true).value)
      .toStrictEqual(put(nanoContractRegisterFailure(failureMessage.alreadyRegistered)))
    // assert termination
    expect(gen.next().value).toBeUndefined();
  });

  test('wallet not ready', async () => {
    // arrange Nano Contract registration inputs
    const { address, ncId } = fixtures;

    // call effect to register nano contract
    const gen = registerNanoContract(nanoContractRegisterRequest({ address, ncId }));
    // call select wallet
    gen.next();

    // assert failure
    // feed back the selector and advance generator to failure
    // first emmit NANOCONTRACT_REGISTER_FAILURE
    expect(gen.next(fixtures.wallet.notReady).value)
      .toStrictEqual(put(nanoContractRegisterFailure(failureMessage.walletNotReadyError)))
    // then emmit EXCEPTION_CAPTURED
    expect(gen.next().value)
      .toStrictEqual(
        put(onExceptionCaptured(new Error(failureMessage.walletNotReadyError), false))
      );
    // assert termination
    expect(gen.next().value).toBeUndefined();
  });

  test('address not mine', async () => {
    // arrange Nano Contract registration inputs
    const { address, ncId } = fixtures;

    // call effect to register nano contract
    const gen = registerNanoContract(nanoContractRegisterRequest({ address, ncId }));
    // call select wallet
    gen.next();
    // feed back the selector
    gen.next(fixtures.wallet.addressNotMine);
    // feed back isNanoContractRegistered
    gen.next(false);

    // assert failure
    // resume isAddressMine call and advance generator to failure
    expect(gen.next(fixtures.wallet.addressNotMine.isAddressMine()).value)
      .toStrictEqual(put(nanoContractRegisterFailure(failureMessage.addressNotMine)))
    // assert termination
    expect(gen.next().value).toBeUndefined();
  });

  test('getBlueprintId returns null', async () => {
    // arrange Nano Contract registration inputs
    const { address, ncId } = fixtures;

    // call effect to register nano contract
    const gen = registerNanoContract(nanoContractRegisterRequest({ address, ncId }));
    // call select wallet
    gen.next();
    // feed back the selector
    gen.next(fixtures.wallet.readyAndMine);
    // feed back isNanoContractRegistered
    gen.next(false);
    // feed back isAddressMine call
    gen.next(fixtures.wallet.readyAndMine.isAddressMine());

    // feed back getBlueprintId call with null (failure)
    expect(gen.next(null).value)
      .toStrictEqual(put(nanoContractRegisterFailure(failureMessage.nanoContractFailure)));
    // assert termination
    expect(gen.next().value).toBeUndefined();
  });

  test('register with success', async () => {
    // arrange Nano Contract registration inputs
    const { address, ncId } = fixtures;
    const mockBlueprintId = '000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a';
    const mockBlueprintInfo = { name: 'Bet', id: mockBlueprintId };

    // call effect to register nano contract
    const gen = registerNanoContract(nanoContractRegisterRequest({ address, ncId }));
    // call select wallet
    gen.next();
    // feed back the selector
    gen.next(fixtures.wallet.readyAndMine);
    // feed back isNanoContractRegistered
    gen.next(false);
    // feed back isAddressMine call
    gen.next(fixtures.wallet.readyAndMine.isAddressMine());
    // feed back getBlueprintId call
    gen.next(mockBlueprintId);
    // feed back getBlueprintInformation call
    gen.next(mockBlueprintInfo);
    // feed back nanoContractBlueprintInfoSuccess put
    // The next yield is the registerNanoContract call on storage
    gen.next();
    // feed back registerNanoContract storage call
    const actionResult = gen.next().value;

    // assert success
    expect(actionResult.payload.action.type)
      .toBe(types.NANOCONTRACT_REGISTER_SUCCESS);
    expect(actionResult.payload.action.payload.entryKey).toBe(ncId);
    expect(actionResult.payload.action.payload.entryValue).toEqual(expect.objectContaining({
      address,
      ncId,
      blueprintId: mockBlueprintId,
      blueprintName: 'Bet',
    }));
    // assert termination — saga should end after the success put. Pinning
    // this catches a future regression where extra trailing yields leak
    // (e.g. an inadvertent log/dispatch added below the success path).
    expect(gen.next().value).toBeUndefined();
  });

  test('getBlueprintInformation throws NanoRequest404Error', async () => {
    const { address, ncId } = fixtures;
    const mockBlueprintId = '000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a';

    const gen = registerNanoContract(nanoContractRegisterRequest({ address, ncId }));
    // call select wallet
    gen.next();
    // feed back the selector
    gen.next(fixtures.wallet.readyAndMine);
    // feed back isNanoContractRegistered = false
    gen.next(false);
    // feed back isAddressMine call
    gen.next(fixtures.wallet.readyAndMine.isAddressMine());
    // feed back getBlueprintId call → returns valid id, advances to ncApi.getBlueprintInformation
    gen.next(mockBlueprintId);

    // Throw a 404 at the getBlueprintInformation call site → catch should
    // dispatch the specific blueprintInfoNotFound failure.
    const failureResult = gen.throw(new NanoRequest404Error('not found')).value;
    expect(failureResult).toStrictEqual(
      put(nanoContractRegisterFailure(failureMessage.blueprintInfoNotFound))
    );
    // assert termination — saga returns from inside the catch block
    expect(gen.next().value).toBeUndefined();
  });

  test('getBlueprintInformation throws non-404 dispatches generic failure', async () => {
    const { address, ncId } = fixtures;
    const mockBlueprintId = '000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a';

    const gen = registerNanoContract(nanoContractRegisterRequest({ address, ncId }));
    gen.next();
    gen.next(fixtures.wallet.readyAndMine);
    gen.next(false);
    gen.next(fixtures.wallet.readyAndMine.isAddressMine());
    gen.next(mockBlueprintId);

    // Plain Error (not NanoRequest404Error) → catch falls through to the
    // generic blueprintInfoFailure branch.
    const failureResult = gen.throw(new Error('boom')).value;
    expect(failureResult).toStrictEqual(
      put(nanoContractRegisterFailure(failureMessage.blueprintInfoFailure))
    );
    expect(gen.next().value).toBeUndefined();
  });
});
