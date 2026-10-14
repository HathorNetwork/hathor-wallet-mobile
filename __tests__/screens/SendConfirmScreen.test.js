/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { errors } from '@hathor/wallet-lib';
import { mapTxError } from '../../src/screens/SendConfirmScreen';

describe('mapTxError', () => {
  const smallerAmount = 'This amount needs more inputs than a transaction can hold. Try sending a smaller amount.';

  // The messages wallet-lib throws when a send needs more inputs than a transaction can hold.
  // The first one tells the user to consolidate the wallet's UTXOs, which this app cannot do.
  test.each([
    "The transaction needs at least 301 inputs, more than the 255 a transaction can hold. Consolidate the wallet's UTXOs and try again.",
    'The transaction needs 300 inputs, more than the 255 a transaction can hold.',
    'Transaction has 301 inputs and can have at most 255.',
  ])('asks for a smaller amount for "%s"', (message) => {
    expect(mapTxError(new Error(message))).toBe(smallerAmount);
  });

  test('keeps the message of other errors', () => {
    expect(mapTxError(new Error('Transaction has 256 outputs and can have at most 255.')))
      .toBe('Transaction has 256 outputs and can have at most 255.');
  });
});

// The messages wallet-lib throws while it builds a send on the fullnode facade, as the shielded
// selection rules write them.
const TRANSPARENT_HINT = '; pass changeShieldedMode: OutputKind.TRANSPARENT to keep the change transparent.';
const STAND_IN = "The change must be shielded (so the amount of its token's only shielded output cannot be computed by subtraction), but";
const FORCED = 'The change must be shielded (so the value of the shielded UTXO spent exactly cannot be computed by subtraction), but';
const CUSTOM_TOKEN = '00000943573723a28e3dd980c10e08419d0e00bc647a95f4ca9671ebea7d5669';

describe('mapTxError for fullnode and shielded sends', () => {
  const HTR_SHORT = 'Insufficient HTR to cover this transaction and its fees.';
  const PRIVACY_FEES = 'Insufficient HTR to cover the privacy fees of this transaction.';
  const KEEP_HIDDEN_AMOUNT = 'To keep the amount it sends hidden, this transaction needs a private change, and there is not enough HTR to pay its privacy fee.';
  const KEEP_HIDDEN_FUNDS = 'To keep the value of the private funds it spends hidden, this transaction needs a private change, and there is not enough HTR to pay its privacy fee.';
  const NO_PRIVATE_CHANGE = 'This wallet cannot receive the private change this transaction needs.';

  test("maps the fullnode's insufficient HTR", () => {
    expect(mapTxError(new Error('Token: 00. Insufficient amount of tokens to fill the amount.')))
      .toBe(HTR_SHORT);
  });

  test("maps the fullnode's insufficient balance of another token", () => {
    expect(mapTxError(new Error(`Token: ${CUSTOM_TOKEN}. Insufficient amount of tokens to fill the amount.`)))
      .toBe('Insufficient balance to send this transaction.');
  });

  test('maps insufficient HTR because a change is private to the privacy fees', () => {
    const message = `Token: 00. Insufficient amount of tokens to fill the amount. The amount includes the fee to shield the change${TRANSPARENT_HINT}`;
    expect(mapTxError(new errors.SendTxError(message))).toBe(PRIVACY_FEES);
  });

  test.each([
    `${STAND_IN} no HTR change is left and no additional HTR is available to make one${TRANSPARENT_HINT}`,
    `${STAND_IN} it is too small to fund its shielded-output fee and no additional HTR is available to cover the difference${TRANSPARENT_HINT}`,
    `${STAND_IN} it is too small to fund its shielded-output fee and no additional HTR is available to cover the difference.`,
  ])('maps a change that hides the amount sent, and can not be funded: "%s"', (message) => {
    expect(mapTxError(new errors.SendTxError(message))).toBe(KEEP_HIDDEN_AMOUNT);
  });

  test.each([
    `${FORCED} it is too small to fund its shielded-output fee and no additional HTR is available to cover the difference${TRANSPARENT_HINT}`,
    `${FORCED} it is too small to split into the two shielded outputs the protocol requires, and no additional HTR is available${TRANSPARENT_HINT}`,
  ])('maps a change forced to hide a private UTXO spent exactly, without HTR to fund it: "%s"', (message) => {
    expect(mapTxError(new errors.SendTxError(message))).toBe(KEEP_HIDDEN_FUNDS);
  });

  test.each([
    'HTR change is too small to fund its shielded-output fee and no additional HTR is available to cover the difference.',
    'The shielded HTR change is too small to split into the two shielded outputs the protocol requires, and no additional HTR is available.',
    'The HTR change cannot fund the shielded-output split the protocol requires, and no additional HTR is available.',
    'Splitting the lone shielded output requires extra HTR for its fee, and no additional HTR is available.',
    "The transaction's only shielded output holds 1 unit, too little to split into the two shielded outputs the protocol requires, and no HTR is available for a shielded change.",
  ])('maps a privacy fee the HTR can not pay: "%s"', (message) => {
    expect(mapTxError(new errors.SendTxError(message))).toBe(PRIVACY_FEES);
  });

  test.each([
    `${STAND_IN} the wallet has no shielded address to receive it${TRANSPARENT_HINT}`,
    `A shielded change is required, but the wallet has no shielded address to receive it${TRANSPARENT_HINT}`,
    "The transaction's only shielded output holds 1 unit, too little to split into the two shielded outputs the protocol requires, and the wallet cannot receive a shielded change as the second one.",
  ])('maps a private change the wallet can not receive: "%s"', (message) => {
    expect(mapTxError(new errors.SendTxError(message))).toBe(NO_PRIVATE_CHANGE);
  });

  test('maps the error type of a private change the wallet can not receive', () => {
    expect(mapTxError(new errors.ShieldedChangeUnavailableError('any message'))).toBe(NO_PRIVATE_CHANGE);
  });

  test('maps a private output too large for its range proof', () => {
    expect(mapTxError(new Error('Shielded output 1: value must be in [1, 2^40)')))
      .toBe('An amount in this transaction, its change included, is too large to be private.');
  });

  test('maps a missing crypto provider', () => {
    expect(mapTxError(new errors.SendTxError('Shielded crypto provider is not set. Cannot create shielded outputs.')))
      .toBe('Private transfers could not be loaded on this device.');
  });

  test('maps a private change address the wallet could not read', () => {
    const message = "The wallet's shielded change address could not be resolved: store read failed";
    expect(mapTxError(new errors.SendTxError(message)))
      .toBe('The private change of this transaction could not be prepared. Try again.');
  });

  test('maps a locked private balance', () => {
    const error = new errors.ShieldedKeyError(
      'shielded-locked',
      "The wallet's scan key is not unlocked, so it cannot see what a shielded address receives.",
    );
    expect(mapTxError(error)).toBe('Your private balance is locked. Unlock it to send privately.');
  });

  test('keeps the message of other shielded key errors', () => {
    const error = new errors.ShieldedKeyError('shielded-not-ready', 'The wallet is not ready.');
    expect(mapTxError(error)).toBe('The wallet is not ready.');
  });

  test("keeps the wallet-service facade's HTR message and the input limit", () => {
    expect(mapTxError(new errors.SendTxError('No UTXOs available for the token 00.')))
      .toBe('Insufficient HTR to cover the network fee.');
    expect(mapTxError(new errors.InputLimitError('The transaction needs 300 inputs, more than the 255 a transaction can hold.')))
      .toBe('This amount needs more inputs than a transaction can hold. Try sending a smaller amount.');
  });
});
