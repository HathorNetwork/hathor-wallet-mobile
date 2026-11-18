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
const HTR = { name: 'Hathor', symbol: 'HTR' };
const target = (token = HTR) => ({ address: 'Wabc', token, symbols: ['HTR', 'E2ED'] });
const steps = (flow) => YAML.parseAllDocuments(flow)[1].toJS();
const has = (list, predicate) => list.some(predicate);

describe('send flow', () => {
  it('goes to the success message for a send that succeeds', () => {
    const flow = steps(buildSendFlow(scenario({}), outcome('authorize', 'Your transfer of **${amountAndToken}** has been confirmed', 'success'), target()));
    expect(has(flow, (s) => s.inputText === 'Wabc')).toBe(true);
    expect(has(flow, (s) => s.tapOn === 'SEND')).toBe(true);
    expect(has(flow, (s) => s.runFlow === '../enter_pin.yaml')).toBe(true);
    expect(flow[flow.length - 1].extendedWaitUntil.visible).toBe('Your transfer of .* has been confirmed');
  });

  it('stops at the amount step for an amount error, without sending', () => {
    const flow = steps(buildSendFlow(scenario({ amount: 'over-balance' }), outcome('amount', 'Insufficient funds'), target()));
    expect(flow[flow.length - 1].extendedWaitUntil.visible).toBe('Insufficient funds');
    expect(flow[flow.length - 2]).toEqual({ tapOn: 'NEXT' });
    expect(has(flow, (s) => s.tapOn === 'SEND')).toBe(false);
  });

  it('checks that Next stays disabled when that is the outcome', () => {
    const flow = steps(buildSendFlow(scenario({ amount: 'empty' }), outcome('amount', 'Next stays disabled'), target()));
    expect(flow[flow.length - 1]).toEqual({ assertVisible: { text: 'NEXT', enabled: false } });
  });

  it('types one unit more than the available balance for an over-balance amount', () => {
    const flow = buildSendFlow(scenario({ amount: 'over-balance' }), outcome('amount', 'Insufficient funds'), target());
    expect(flow).toContain('copyTextFrom');
    expect(flow).toContain('+ 1');
  });

  it('picks the privacy mode on the sheet', () => {
    const publicFlow = steps(buildSendFlow(scenario({}), outcome('amount', 'x'), target()));
    const privateFlow = steps(buildSendFlow(scenario({ privacy: 'private' }), outcome('amount', 'x'), target()));
    const taps = (flow) => flow.filter((s) => s.tapOn && s.tapOn.point).map((s) => s.tapOn.point);
    expect(taps(publicFlow)).not.toEqual(taps(privateFlow));
  });
});

describe('token and confirm steps', () => {
  it('picks the scenario token on the amount screen, then waits for its balance', () => {
    const flow = steps(buildSendFlow(scenario({ token: 'deposit' }), outcome('amount', 'x'), target({ name: 'E2E Deposit', symbol: 'E2ED' })));
    const box = flow.findIndex((s) => s.tapOn && s.tapOn.text === 'HTR|E2ED');
    expect(box).toBeGreaterThan(-1);
    expect(flow[box + 1]).toEqual({ tapOn: 'E2E Deposit' });
    expect(flow[box + 2].extendedWaitUntil.visible).toBe('[0-9][0-9,.]* E2ED available');
  });

  it('types 2^40 units for a private over-limit amount', () => {
    const flow = steps(buildSendFlow(scenario({ amount: 'private-over-limit' }), outcome('amount', 'x'), target()));
    expect(has(flow, (s) => s.inputText === '10995116277.76')).toBe(true);
  });

  it('checks a confirm error without waiting for the summary', () => {
    const flow = steps(buildSendFlow(scenario({}), outcome('confirm', 'Insufficient HTR to cover the network fee.'), target()));
    expect(has(flow, (s) => s.extendedWaitUntil && s.extendedWaitUntil.visible === 'Transaction summary')).toBe(false);
    expect(flow[flow.length - 2]).toEqual({ tapOn: 'NEXT' });
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

  it('runs custom-token sends, including 2^40 amounts', () => {
    expect(unrunnableReason(scenario({ token: 'deposit', amount: 'private-over-limit' }))).toBeNull();
    expect(unrunnableReason(scenario({ token: 'fee', funding: 'zero-htr' }))).toBeNull();
  });

  it('says why it cannot run the rest', () => {
    expect(unrunnableReason(scenario({ 'private-balance': 'locked' }))).toMatch(/private balance/);
  });
});
