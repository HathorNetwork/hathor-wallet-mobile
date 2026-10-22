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
import { allScenarios } from '../../QA/graph/tools/scenarios';
import { computeImpact, allPicks } from '../../QA/graph/tools/impact';

const graph = structuredClone(loadGraph(path.join(__dirname, 'fixtures', 'mini.yaml')));
const entry = (impact, feature) => impact.touched.find((t) => t.feature === feature);

describe('qa graph impact', () => {
  it('feature pick spreads via its links', () => {
    const impact = computeImpact(graph, { type: 'feature', id: 'pin-f' });
    expect(entry(impact, 'send-f').reasons)
      .toContainEqual({ via: 'code', why: 'PIN confirms send' });
    expect(entry(impact, 'pin-f').reasons)
      .toContainEqual({ via: 'code', why: 'changed directly' });
  });

  it('flag pick spreads via gates', () => {
    const impact = computeImpact(graph, { type: 'flag', id: 'fbt' });
    const reason = entry(impact, 'fee-f').reasons.find((r) => r.via === 'flag');
    expect(reason.why).toContain('fee-based-tokens.rollout');
  });

  it('axis value pick spreads via axis to unchanged code', () => {
    const impact = computeImpact(graph, { type: 'axisValue', id: 'token:fee' });
    expect(entry(impact, 'send-f').reasons.map((r) => r.via)).toContain('axis');
    expect(impact.scenarios.length).toBeGreaterThan(0);
    impact.scenarios.forEach((s) => expect(s.values.token).toBe('fee'));
    expect(impact.plan.length).toBeGreaterThan(0);
  });

  it('feature introducing a value spreads via axis', () => {
    const impact = computeImpact(graph, { type: 'feature', id: 'fee-f' });
    expect(impact.changed.axisValues).toEqual(['token:fee']);
    expect(entry(impact, 'send-f').reasons.map((r) => r.via)).toContain('axis');
  });

  it('merges reasons per feature and gives each a non-empty why', () => {
    const impact = computeImpact(graph, { type: 'feature', id: 'fee-f' });
    const ids = impact.touched.map((t) => t.feature);
    expect(new Set(ids).size).toBe(ids.length);
    impact.touched.forEach((t) => {
      expect(t.reasons.length).toBeGreaterThan(0);
      t.reasons.forEach((r) => expect(r.why.length).toBeGreaterThan(0));
    });
  });

  it('limits an axis-only feature to scenarios on the changed value', () => {
    const impact = computeImpact(graph, { type: 'feature', id: 'fee-f' });
    expect(impact.scenarios.length).toBeGreaterThan(0);
    impact.scenarios.forEach((s) => expect(s.values.token).toBe('fee'));
  });

  it('re-runs all scenarios of a feature reached via code', () => {
    const impact = computeImpact(graph, { type: 'feature', id: 'pin-f' });
    const sends = allScenarios(graph).filter((s) => s.action === 'send');
    expect(impact.scenarios.map((s) => s.id)).toEqual(sends.map((s) => s.id));
  });

  it('returns an empty plan when no scenarios are reached', () => {
    const none = computeImpact(graph, { type: 'flag', id: 'fbt' });
    expect(none.scenarios).toEqual([]);
    expect(none.plan).toEqual([]);
  });

  it('throws on unknown picks', () => {
    expect(() => computeImpact(graph, { type: 'flag', id: 'nope' }))
      .toThrow("Unknown flag 'nope'");
    expect(() => computeImpact(graph, { type: 'axisValue', id: 'token:zzz' }))
      .toThrow("Unknown axisValue 'token:zzz'");
  });

  it('allPicks excludes out-of-scope features', () => {
    const picks = allPicks(graph);
    expect(picks.find((p) => p.id === 'swap-f')).toBeUndefined();
    expect(picks).toContainEqual({ type: 'flag', id: 'fbt' });
    expect(picks).toContainEqual({ type: 'axisValue', id: 'token:fee' });
  });
});
