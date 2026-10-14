/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { errors } from '@hathor/wallet-lib';
import {
  RECEIVE_REASON_ERROR,
  RECEIVE_REASON_NOT_WATCHED,
  SHIELDED_RECEIVE_INITIAL_STATE,
  SHIELDED_RECEIVE_STATUS,
  isSameReceiveState,
  receiveReasonText,
  receiveStateFromCapability,
  receiveStateFromError,
  selectShieldedReceive,
} from '../../src/shielded/receiveState';

const { IDLE, LOADING, LOCKED, READY, UNAVAILABLE } = SHIELDED_RECEIVE_STATUS;

const capability = (level, reason, cause = null, overrides = {}) => ({
  level,
  reason,
  cause,
  canReceive: level === 'view' || level === 'full',
  canSpend: level === 'full',
  historyComplete: level !== 'none',
  undecoded: { txIds: [], locked: 0, unreadable: 0, error: 0 },
  ...overrides,
});

describe('receiveStateFromCapability', () => {
  test.each([
    ['full', capability('full', null)],
    ['view', capability('view', 'no-spend-authority')],
  ])('asks for the current address at level %s', (_label, current) => {
    expect(receiveStateFromCapability(current)).toBeNull();
  });

  test.each([
    ['a wallet that has not started', capability('none', 'not-started'), LOADING, null],
    ['a wallet with no crypto provider', capability('none', 'no-provider'), UNAVAILABLE, 'no-provider'],
    ['a wallet whose keys need the password', capability('none', 'needs-password'), UNAVAILABLE, 'needs-password'],
    ['a wallet whose keys do not match', capability('none', 'integrity', 'key-mismatch'), UNAVAILABLE, 'integrity'],
    ['a multisig wallet', capability('none', 'multisig'), UNAVAILABLE, 'multisig'],
    ['a wallet locked by a stale PIN', capability('watch', 'locked', 'wrong-pin'), LOCKED, 'wrong-pin'],
    ['a wallet that got no PIN', capability('watch', 'locked', 'not-supplied'), LOCKED, 'not-supplied'],
    ['a wallet whose unlock failed', capability('watch', 'locked', 'error'), LOCKED, 'error'],
    ['a wallet whose scan key is corrupt', capability('watch', 'locked', 'corrupt-key'), UNAVAILABLE, 'corrupt-key'],
    [
      'a decoding wallet that does not watch its shielded addresses',
      capability('full', null, null, { canReceive: false }),
      UNAVAILABLE,
      RECEIVE_REASON_NOT_WATCHED,
    ],
  ])('maps %s', (_label, current, status, reason) => {
    expect(receiveStateFromCapability(current)).toEqual({ status, reason });
  });

  test('waits while there is no capability yet', () => {
    expect(receiveStateFromCapability(null)).toEqual({ status: LOADING, reason: null });
  });
});

describe('receiveStateFromError', () => {
  test.each([
    ['a locked scan key', new errors.ShieldedKeyError('shielded-locked', 'locked'), LOCKED, null],
    ['a stopped wallet', new errors.ShieldedKeyError('shielded-not-started', 'not started'), LOADING, null],
    ['no crypto provider', new errors.ShieldedKeyError('shielded-no-provider', 'no provider'), UNAVAILABLE, 'shielded-no-provider'],
    ['no shielded keys', new errors.ShieldedKeyError('shielded-no-keys', 'no keys'), UNAVAILABLE, 'shielded-no-keys'],
    [
      'shielded addresses not loaded yet',
      new Error('Current shielded address is not loaded (index=0). Derive at least one shielded address before calling getCurrentAddress.'),
      LOADING,
      null,
    ],
  ])('maps %s', (_label, error, status, reason) => {
    expect(receiveStateFromError(error)).toEqual({ status, reason });
  });

  test.each([
    ['another error', new Error('storage closed')],
    ['the legacy chain not loaded', new Error('Current legacy address is not loaded (index=0).')],
    ['a value that is not an error', 'shielded-locked'],
  ])('does not expect %s', (_label, error) => {
    expect(receiveStateFromError(error)).toBeNull();
  });
});

describe('selectShieldedReceive', () => {
  test('reads state.shielded.receive', () => {
    const receive = { status: READY, address: 'addr', index: 2, reason: null };
    expect(selectShieldedReceive({ shielded: { receive } })).toBe(receive);
  });

  test('starts idle', () => {
    expect(SHIELDED_RECEIVE_INITIAL_STATE).toEqual({
      status: IDLE, address: null, index: null, reason: null,
    });
    expect(selectShieldedReceive({})).toEqual(SHIELDED_RECEIVE_INITIAL_STATE);
  });
});

describe('isSameReceiveState', () => {
  const ready = { status: READY, address: 'addr', index: 2, reason: null };

  test('compares every field', () => {
    expect(isSameReceiveState(ready, { ...ready })).toBe(true);
    expect(isSameReceiveState(ready, { ...ready, status: LOADING })).toBe(false);
    expect(isSameReceiveState(ready, { ...ready, address: 'other' })).toBe(false);
    expect(isSameReceiveState(ready, { ...ready, index: 3 })).toBe(false);
    expect(isSameReceiveState(ready, { ...ready, reason: 'error' })).toBe(false);
  });
});

describe('receiveReasonText', () => {
  test.each(['no-provider', 'shielded-no-provider'])('blames the device for the reason %s', (reason) => {
    expect(receiveReasonText(reason)).toBe('Private transfers could not be loaded on this device.');
  });

  test.each([
    'needs-password', 'integrity', 'corrupt-key', RECEIVE_REASON_NOT_WATCHED, null,
  ])('says the wallet cannot use them for the reason %s', (reason) => {
    expect(receiveReasonText(reason)).toBe('Private transfers are not available for this wallet.');
  });

  test('says the address could not be loaded after an error nothing expects', () => {
    expect(receiveReasonText(RECEIVE_REASON_ERROR)).toBe('Could not load your private address.');
  });
});
