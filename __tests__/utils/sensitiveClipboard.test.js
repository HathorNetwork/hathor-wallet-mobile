/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { AppState, Clipboard } from 'react-native';
import { SENSITIVE_CLIPBOARD_CLEAR_MS } from '../../src/constants';
import { copySensitive } from '../../src/utils/sensitiveClipboard';

const START = new Date('2026-10-09T12:00:00Z').getTime();

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(START);
  Clipboard.setString.mockClear();
  Clipboard.getString.mockClear();
  AppState.addEventListener.mockClear();
});

afterEach(() => {
  // Each test ends with the pending clear done, so the next one starts with none.
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

const writes = () => Clipboard.setString.mock.calls.map(([text]) => text);
// The handler the helper gave AppState.addEventListener, and the subscription it got back.
const appStateHandler = () => AppState.addEventListener.mock.calls[0][1];
const subscription = () => AppState.addEventListener.mock.results[0].value;

describe('copySensitive', () => {
  test('copies the text, and clears the clipboard a minute later', () => {
    expect(SENSITIVE_CLIPBOARD_CLEAR_MS).toBe(60 * 1000);

    copySensitive('xprv-secret');
    expect(writes()).toEqual(['xprv-secret']);

    jest.advanceTimersByTime(SENSITIVE_CLIPBOARD_CLEAR_MS - 1);
    expect(writes()).toEqual(['xprv-secret']);

    jest.advanceTimersByTime(1);
    expect(writes()).toEqual(['xprv-secret', '']);
  });

  test('clears after the time it is given', () => {
    copySensitive('payload', { clearAfterMs: 5000 });

    jest.advanceTimersByTime(5000);
    expect(writes()).toEqual(['payload', '']);
  });

  test('restarts the minute on a newer copy, and clears once', () => {
    copySensitive('first');
    jest.advanceTimersByTime(30 * 1000);
    copySensitive('second');
    jest.advanceTimersByTime(SENSITIVE_CLIPBOARD_CLEAR_MS - 1);
    expect(writes()).toEqual(['first', 'second']);

    jest.advanceTimersByTime(1);
    jest.runOnlyPendingTimers();
    expect(writes()).toEqual(['first', 'second', '']);
  });

  test('never reads the clipboard', () => {
    copySensitive('xprv-secret');
    jest.advanceTimersByTime(SENSITIVE_CLIPBOARD_CLEAR_MS);

    expect(Clipboard.getString).not.toHaveBeenCalled();
  });

  test('clears when the app comes back after the minute, though its timers did not run', () => {
    copySensitive('xprv-secret');
    // In the background, iOS suspends the app's timers while the clock goes on.
    jest.setSystemTime(START + 2 * SENSITIVE_CLIPBOARD_CLEAR_MS);

    appStateHandler()('active');
    expect(writes()).toEqual(['xprv-secret', '']);
    expect(subscription().remove).toHaveBeenCalledTimes(1);

    // Its timer was cancelled: it clears nothing more.
    jest.runOnlyPendingTimers();
    expect(writes()).toEqual(['xprv-secret', '']);
  });

  test('keeps the copy when the app comes back within the minute', () => {
    copySensitive('xprv-secret');
    jest.setSystemTime(START + 30 * 1000);

    appStateHandler()('background');
    appStateHandler()('active');
    expect(writes()).toEqual(['xprv-secret']);
    expect(subscription().remove).not.toHaveBeenCalled();

    jest.advanceTimersByTime(SENSITIVE_CLIPBOARD_CLEAR_MS);
    expect(writes()).toEqual(['xprv-secret', '']);
  });

  test('listens to the app state once while a clear is pending, and stops after it', () => {
    copySensitive('first');
    copySensitive('second');
    expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    jest.advanceTimersByTime(SENSITIVE_CLIPBOARD_CLEAR_MS);
    expect(subscription().remove).toHaveBeenCalledTimes(1);

    copySensitive('third');
    expect(AppState.addEventListener).toHaveBeenCalledTimes(2);
  });
});
