/**
 * @jest-environment node
 *
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from '@jest/globals';
import path from 'path';
import { loadGraph } from '../../QA/graph/tools/load';
import { computeImpact, allPicks } from '../../QA/graph/tools/impact';
import { allScenarios } from '../../QA/graph/tools/scenarios';
import {
  extractFlagNames, extractRoutes, checkFreshness, describeVersion,
} from '../../QA/graph/tools/freshness';

const fixture = loadGraph(path.join(__dirname, 'fixtures', 'mini.yaml'));
const knownConstants = "export const FBT_FEATURE_TOGGLE = 'fee-based-tokens.rollout';";
const check = (overrides) => checkFreshness(structuredClone(fixture), {
  constantsSrc: knownConstants,
  appSrc: '',
  changedFiles: [],
  graphChanged: false,
  ...overrides,
});

describe('qa graph freshness', () => {
  it('extracts rollout flags', () => {
    const src = "export const A = 'x.rollout';\nexport const B = 'other';";
    expect(extractFlagNames(src)).toEqual(['x.rollout']);
  });

  it('extracts screen routes', () => {
    const src = `<Stack.Screen name='Foo' component={F} />\n<Tab.Screen name="Bar" />`;
    expect(extractRoutes(src)).toEqual(['Foo', 'Bar']);
  });

  it('warns about a flag missing from the graph', () => {
    const constantsSrc = `${knownConstants}\nexport const N = 'new.rollout';`;
    const { warnings } = check({ constantsSrc });
    expect(warnings.some((w) => w.includes('new.rollout'))).toBe(true);
  });

  it('warns about a flag removed from code', () => {
    const { warnings } = check({ constantsSrc: '' });
    expect(warnings.some((w) => w.includes('fee-based-tokens.rollout'))).toBe(true);
  });

  it('warns about a route missing from every feature', () => {
    const { warnings } = check({ appSrc: '<Stack.Screen name="Ghost" component={G} />' });
    expect(warnings.some((w) => w.includes('Ghost'))).toBe(true);
  });

  it('warns when an in-scope feature changes without a graph update', () => {
    const { warnings } = check({ changedFiles: ['src/screens/Send/SendConfirm.js'] });
    expect(warnings.some((w) => w.includes('send-f'))).toBe(true);
  });

  it('matches a file entry exactly, not as a prefix', () => {
    const { warnings } = check({ changedFiles: ['src/screens/PinScreen.jsx'] });
    expect(warnings).toEqual([]);
    const hit = check({ changedFiles: ['src/screens/PinScreen.js'] });
    expect(hit.warnings.some((w) => w.includes('pin-f'))).toBe(true);
  });

  it('only notes out-of-scope changes', () => {
    const { warnings, notes } = check({ changedFiles: ['src/screens/TokenSwap/X.js'] });
    expect(warnings).toEqual([]);
    expect(notes.some((n) => n.includes('swap-f'))).toBe(true);
  });

  it('stays quiet when the graph changed too', () => {
    const { warnings } = check({
      changedFiles: ['src/screens/Send/SendConfirm.js'],
      graphChanged: true,
    });
    expect(warnings.some((w) => w.includes('send-f'))).toBe(false);
  });

  it('notes an unverified outcome whose source changed', () => {
    const { notes } = check({ changedFiles: ['src/screens/Send/SendAmountInput.js'] });
    expect(notes.some((n) => n.includes('err-priv'))).toBe(true);
  });

  it('describes an uncommitted version', () => {
    expect(describeVersion({ commit: 'ab123cd', date: '2026-10-22', dirty: true }))
      .toContain('UNCOMMITTED');
    expect(describeVersion({ commit: 'ab123cd', date: '2026-10-22', dirty: false }))
      .toBe('YAML of 2026-10-22, commit ab123cd');
  });
});

describe('computeImpact with precomputed scenarios', () => {
  it('returns identical results with and without the parameter', () => {
    const scenarios = allScenarios(fixture);
    allPicks(fixture).forEach((pick) => {
      expect(computeImpact(fixture, pick, scenarios)).toEqual(computeImpact(fixture, pick));
    });
  });
});
