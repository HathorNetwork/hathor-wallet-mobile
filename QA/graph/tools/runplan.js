/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const asList = (value) => (Array.isArray(value) ? value : []);
const findById = (list, id) => asList(list).find((item) => item.id === id);

/**
 * Directional cost of moving one axis from `from` to `to`.
 * An impossible switch goes through the axis fallback; without one it costs Infinity.
 * @returns {{cost: number, impossible: boolean, via: 'switch'|'fallback'|'none', how: string}}
 */
function transitionCost(graph, axisId, from, to) {
  if (from === to) return { cost: 0, impossible: false, via: 'none', how: '' };
  const axis = findById(graph.axes, axisId);
  const sw = (axis && axis.switch) || {};
  const costOf = (key) => graph.costs[key];
  const rule = asList(sw.transitions).find((t) => t.from === from && t.to === to);

  if (rule && rule.impossible) {
    if (sw.fallback) {
      return {
        cost: costOf(sw.fallback.cost), impossible: true, via: 'fallback', how: sw.fallback.how,
      };
    }
    return {
      cost: Infinity, impossible: true, via: 'none', how: '',
    };
  }
  return {
    cost: costOf((rule && rule.cost) || sw.cost),
    impossible: false,
    via: 'switch',
    how: axis.how,
  };
}

/** Sum of per-axis transition costs over the setup axes whose values differ. */
function setupDistance(graph, fromSetupId, toSetupId) {
  const from = findById(graph.setups, fromSetupId);
  const to = findById(graph.setups, toSetupId);
  const steps = [];
  let cost = 0;
  Object.keys(to.values).forEach((axis) => {
    if (from.values[axis] === to.values[axis]) return;
    const t = transitionCost(graph, axis, from.values[axis], to.values[axis]);
    cost += t.cost;
    steps.push({
      axis, from: from.values[axis], to: to.values[axis], via: t.via, how: t.how,
    });
  });
  return { cost, steps };
}

/**
 * Groups scenarios by setup and orders the groups greedily by the cheapest next switch.
 * @returns {{setup: string, cost: number, steps: object[], scenarios: object[]}[]}
 */
function planRun(graph, scenarios, { start } = {}) {
  const bySetup = new Map();
  scenarios.forEach((s) => {
    if (!bySetup.has(s.setup)) bySetup.set(s.setup, []);
    bySetup.get(s.setup).push(s);
  });
  const remaining = asList(graph.setups).map((s) => s.id).filter((id) => bySetup.has(id));
  if (remaining.length === 0) return [];

  let current = start && bySetup.has(start) ? start : remaining[0];
  remaining.splice(remaining.indexOf(current), 1);
  const plan = [{
    setup: current, cost: 0, steps: [], scenarios: bySetup.get(current),
  }];

  while (remaining.length > 0) {
    const from = current;
    const best = remaining
      .map((id) => ({ id, d: setupDistance(graph, from, id) }))
      .reduce((a, b) => (b.d.cost < a.d.cost ? b : a));
    if (best.d.cost === Infinity) {
      throw new Error(`No reachable switch from ${current} to ${best.id}`);
    }
    plan.push({
      setup: best.id, cost: best.d.cost, steps: best.d.steps, scenarios: bySetup.get(best.id),
    });
    remaining.splice(remaining.indexOf(best.id), 1);
    current = best.id;
  }
  return plan;
}

module.exports = { transitionCost, setupDistance, planRun };
