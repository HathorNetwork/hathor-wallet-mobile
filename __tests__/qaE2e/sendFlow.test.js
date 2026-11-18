/**
 * @jest-environment node
 *
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable no-template-curly-in-string -- the app's messages carry ${placeholders} */
import { describe, expect, it } from '@jest/globals';
import YAML from 'yaml';
import { buildSendFlow, unrunnableReason, messagePattern } from '../../QA/e2e/lib/sendFlow';

const scenario = (values) => ({
  id: 'send:pn:x',
  values: {
    dest: 'simple', token: 'htr', privacy: 'public', amount: 'normal', funding: 'enough-htr', 'private-balance': 'unlocked', ...values,
  },
});
const outcome = (at, message, kind = 'error') => ({ id: 'o', at, message, kind });
const steps = (flow) => YAML.parseAllDocuments(flow)[1].toJS();
const has = (list, predicate) => list.some(predicate);

describe('send flow', () => {
  it('goes to the success message for a send that succeeds', () => {
    const flow = steps(buildSendFlow(scenario({}), outcome('authorize', 'Your transfer of **${amountAndToken}** has been confirmed', 'success'), { address: 'Wabc' }));
    expect(has(flow, (s) => s.inputText === 'Wabc')).toBe(true);
    expect(has(flow, (s) => s.tapOn === 'SEND')).toBe(true);
    expect(has(flow, (s) => s.runFlow === '../enter_pin.yaml')).toBe(true);
    expect(flow[flow.length - 1].extendedWaitUntil.visible).toBe('Your transfer of .* has been confirmed');
  });

  it('stops at the amount step for an amount error, without sending', () => {
    const flow = steps(buildSendFlow(scenario({ amount: 'over-balance' }), outcome('amount', 'Insufficient funds'), { address: 'Wabc' }));
    expect(flow[flow.length - 1].extendedWaitUntil.visible).toBe('Insufficient funds');
    expect(flow[flow.length - 2]).toEqual({ tapOn: 'NEXT' });
    expect(has(flow, (s) => s.tapOn === 'SEND')).toBe(false);
  });

  it('checks that Next stays disabled when that is the outcome', () => {
    const flow = steps(buildSendFlow(scenario({ amount: 'empty' }), outcome('amount', 'Next stays disabled'), { address: 'Wabc' }));
    expect(flow[flow.length - 1]).toEqual({ assertVisible: { text: 'NEXT', enabled: false } });
  });

  it('types one unit more than the available balance for an over-balance amount', () => {
    const flow = buildSendFlow(scenario({ amount: 'over-balance' }), outcome('amount', 'Insufficient funds'), { address: 'Wabc' });
    expect(flow).toContain('copyTextFrom');
    expect(flow).toContain('+ 1');
  });

  it('picks the privacy mode on the sheet', () => {
    const publicFlow = steps(buildSendFlow(scenario({}), outcome('amount', 'x'), { address: 'Wabc' }));
    const privateFlow = steps(buildSendFlow(scenario({ privacy: 'private' }), outcome('amount', 'x'), { address: 'Wabc' }));
    const taps = (flow) => flow.filter((s) => s.tapOn && s.tapOn.point).map((s) => s.tapOn.point);
    expect(taps(publicFlow)).not.toEqual(taps(privateFlow));
  });
});

describe('message patterns', () => {
  it('matches placeholders and escapes the rest', () => {
    expect(messagePattern('A private send can be at most ${max} ${symbol}.')).toBe('A private send can be at most .* .*\\.');
    expect(new RegExp(`^${messagePattern('Insufficient HTR to cover the network fee.')}$`).test('Insufficient HTR to cover the network fee.')).toBe(true);
  });
});

describe('what the kit can run today', () => {
  it('runs HTR sends with an unlocked private balance', () => {
    expect(unrunnableReason(scenario({}))).toBeNull();
    expect(unrunnableReason(scenario({ dest: 'shielded', privacy: 'private' }))).toBeNull();
  });

  it('says why it cannot run the rest', () => {
    expect(unrunnableReason(scenario({ token: 'deposit' }))).toMatch(/token/);
    expect(unrunnableReason(scenario({ 'private-balance': 'locked' }))).toMatch(/private balance/);
    expect(unrunnableReason(scenario({ amount: 'private-over-limit' }))).toMatch(/2\^40/);
  });
});
