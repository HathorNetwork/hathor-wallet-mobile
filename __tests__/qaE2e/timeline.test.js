/**
 * @jest-environment node
 *
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from '@jest/globals';
import { describe as describeCommand, entriesFrom, runnerEntry, skipRanges } from '../../QA/e2e/lib/timeline';

const T0 = 1_000_000;
const entry = (command, timestamp, duration, depth = 0, status = 'COMPLETED', evaluatedCommand = undefined) => ({
  command, metadata: { timestamp, duration, depth, status, evaluatedCommand },
});

describe('timeline entries', () => {
  it('places each command in seconds from the video start, and drops the setup commands', () => {
    const entries = entriesFrom([
      entry({ defineVariablesCommand: { env: {} } }, T0, 5),
      entry({ runFlowCommand: { label: '1/4 address: type the simple address' } }, T0 + 500, 7000),
      entry({ tapOnPointV2Command: { point: '50%,93%' } }, T0 + 600, 1200, 1),
      entry({ assertConditionCommand: { condition: { visible: { textRegex: 'Address to send' } }, timeout: '15000' } }, T0 + 1800, 80, 1, 'FAILED'),
    ], T0);
    expect(entries).toEqual([
      { t: 0.5, d: 7, depth: 0, text: '1/4 address: type the simple address', status: 'completed' },
      { t: 0.6, d: 1.2, depth: 1, text: 'Tap on point (50%,93%)', status: 'completed' },
      { t: 1.8, d: 0.08, depth: 1, text: 'Wait until "Address to send" is visible', status: 'failed' },
    ]);
  });

  it('describes a command with its variables filled in, and nests a flow under a runner step', () => {
    const [typed] = entriesFrom([
      // eslint-disable-next-line no-template-curly-in-string
      entry({ inputTextCommand: { text: '${output.amount}' } }, T0, 100, 0, 'COMPLETED', { inputTextCommand: { text: '40.00' } }),
    ], T0, 1);
    expect(typed).toMatchObject({ text: 'Type "40.00"', depth: 1 });
    expect(runnerEntry({ start: T0 + 1000, end: T0 + 3000, text: 'runner: top up' }, T0))
      .toEqual({ t: 1, d: 2, depth: 0, text: 'runner: top up', status: 'completed', runner: true });
  });

  it('says what the common commands did', () => {
    expect(describeCommand({ tapOnElement: { selector: { textRegex: 'IMPORT TOKENS', index: 1 } } })).toBe('Tap on "IMPORT TOKENS", index 1');
    expect(describeCommand({ assertConditionCommand: { condition: { visible: { textRegex: 'NEXT', enabled: false } } } }))
      .toBe('Check that "NEXT" is visible and disabled');
    expect(describeCommand({ backPressCommand: {} })).toBe('Press back');
    expect(describeCommand({ someNewCommand: {} })).toBe('some new');
  });
});

describe('skip ranges', () => {
  it('skips the inside of long commands and long gaps, keeping a second at each end', () => {
    const entries = [
      { t: 0, d: 20, depth: 0 }, // a group: its inner commands mark the time
      { t: 0.5, d: 1, depth: 1 },
      { t: 1.5, d: 10, depth: 1 }, // a 10 s wait
      { t: 11.5, d: 0.5, depth: 1 },
    ];
    expect(skipRanges(entries, 20)).toEqual([[2.5, 10.5], [13, 19]]);
  });

  it('skips nothing in a busy stretch', () => {
    const entries = [{ t: 0, d: 2, depth: 0 }, { t: 2, d: 2, depth: 0 }, { t: 4, d: 1, depth: 0 }];
    expect(skipRanges(entries, 6)).toEqual([]);
  });
});
