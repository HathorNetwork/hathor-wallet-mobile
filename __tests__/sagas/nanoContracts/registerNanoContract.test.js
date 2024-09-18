import { put } from 'redux-saga/effects';
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
    const gen = registerNanoContract(nanoContractRegisterRequest({ ncId }));
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
    const gen = registerNanoContract(nanoContractRegisterRequest({ ncId }));
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
    const gen = registerNanoContract(nanoContractRegisterRequest({ ncId }));
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

  test('getNanoContractState error', async () => {
    // arrange Nano Contract registration inputs
    const { address, ncId } = fixtures;

    // call effect to register nano contract
    const gen = registerNanoContract(nanoContractRegisterRequest({ ncId }));
    // call select wallet
    gen.next();
    // feed back the selector
    gen.next(fixtures.wallet.readyAndMine);
    // feed back isNanoContractRegistered
    gen.next(false);
    // feed back isAddressMine call
    gen.next(fixtures.wallet.readyAndMine.isAddressMine());

    // assert failure
    // resume getNanoContractState call and advance generator to failure
    expect(gen.throw(fixtures.ncSaga.getNanoContractState.errorResponse).value)
      .toStrictEqual(put(nanoContractRegisterFailure(failureMessage.nanoContractStateFailure)))
    // assert termination
    expect(gen.next().value).toBeUndefined();
  });

  test('register with success', async () => {
    // arrange Nano Contract registration inputs
    const { address, ncId } = fixtures;

    // call effect to register nano contract
    const gen = registerNanoContract(nanoContractRegisterRequest({ ncId }));
    // call select wallet
    gen.next();
    // feed back the selector
    gen.next(fixtures.wallet.readyAndMine);
    // feed back isNanoContractRegistered
    gen.next(false);
    // feed back isAddressMine call
    gen.next(fixtures.wallet.readyAndMine.isAddressMine());
    // feed back getNanoContractState call
    gen.next(fixtures.ncSaga.getNanoContractState.successResponse);
    // feed back registerNanoContract
    const actionResult = gen.next().value;

    // assert success
    expect(actionResult.payload.action.type)
      .toBe(types.NANOCONTRACT_REGISTER_SUCCESS);
    expect(actionResult.payload.action.payload.entryKey).toBe(ncId);
    expect(actionResult.payload.action.payload.entryValue).toEqual(expect.objectContaining({
      address,
      ncId,
      blueprintId: expect.any(String),
      blueprintName: expect.any(String),
    }));
    // assert termination
    expect(gen.next().value).toBeUndefined();
  });
});
