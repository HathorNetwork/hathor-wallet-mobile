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
import { planRun, transitionCost } from '../../QA/graph/tools/runplan';

const fixture = path.join(__dirname, 'fixtures', 'mini.yaml');
const fresh = () => structuredClone(loadGraph(fixture));

describe('qa graph run plan', () => {
  it('same value costs nothing', () => {
    expect(transitionCost(fresh(), 'addr', 'multi', 'multi').cost).toBe(0);
  });

  it('single to multi uses the cheap switch', () => {
    const t = transitionCost(fresh(), 'addr', 'single', 'multi');
    expect(t.cost).toBe(1);
    expect(t.via).toBe('switch');
  });

  it('multi to single goes through the fallback', () => {
    const t = transitionCost(fresh(), 'addr', 'multi', 'single');
    expect(t.via).toBe('fallback');
    expect(t.cost).toBe(60);
    expect(t.how).toContain('reset wallet');
  });

  it('orders setups by cheapest next switch', () => {
    const g = fresh();
    const plan = planRun(g, allScenarios(g));
    expect(plan.map((s) => s.setup)).toEqual(['ws-single', 'ws-multi', 'fn-multi', 'fn-single']);
    expect(plan[3].steps[0].via).toBe('fallback');
  });

  it('no step is ever impossible', () => {
    const g = fresh();
    const plan = planRun(g, allScenarios(g));
    plan.forEach((group) => {
      expect(group.cost).not.toBe(Infinity);
      group.steps.forEach((step) => expect(step.via).not.toBe('none'));
    });
  });

  it('throws when a setup is unreachable', () => {
    const g = fresh();
    delete g.axes.find((a) => a.id === 'addr').switch.fallback;
    const scenarios = allScenarios(g).filter((s) => ['ws-multi', 'ws-single'].includes(s.setup));
    expect(() => planRun(g, scenarios, { start: 'ws-multi' })).toThrow('ws-single');
  });

  it('keeps every scenario exactly once', () => {
    const g = fresh();
    const all = allScenarios(g);
    const ids = planRun(g, all).flatMap((s) => s.scenarios.map((x) => x.id));
    expect(ids).toHaveLength(all.length);
    expect(new Set(ids)).toEqual(new Set(all.map((s) => s.id)));
  });
});
