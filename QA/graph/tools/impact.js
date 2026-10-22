/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { allScenarios } = require('./scenarios');
const { planRun } = require('./runplan');

const asList = (value) => (Array.isArray(value) ? value : []);
const findById = (list, id) => asList(list).find((item) => item.id === id);

function changedBy(graph, pick) {
  const changed = { features: [], flags: [], axisValues: [] };
  if (pick.type === 'feature') {
    const feature = findById(graph.features, pick.id);
    changed.features.push(pick.id);
    changed.flags.push(...asList(feature && feature.flags));
    changed.axisValues.push(...asList(feature && feature.introduces));
  } else if (pick.type === 'flag') {
    changed.flags.push(pick.id);
  } else {
    changed.axisValues.push(pick.id);
  }
  return changed;
}

/** Does the action vary on, or run under a setup that sets, this axis? */
function actionUsesAxis(graph, action, axisId) {
  if (asList(action.axes).includes(axisId)) return true;
  return asList(action.setups)
    .some((id) => {
      const setup = findById(graph.setups, id);
      return setup && setup.values && axisId in setup.values;
    });
}

function touchedFeatures(graph, changed) {
  const touched = new Map();
  const add = (featureId, via, why) => {
    const entry = touched.get(featureId) || { feature: featureId, reasons: [] };
    if (!entry.reasons.some((r) => r.via === via && r.why === why)) {
      entry.reasons.push({ via, why });
    }
    touched.set(featureId, entry);
  };

  changed.features.forEach((id) => add(id, 'code', 'changed directly'));

  asList(graph.features).forEach((feature) => {
    asList(feature.links)
      .filter((link) => changed.features.includes(link.to))
      .forEach((link) => add(feature.id, 'code', link.reason));
  });

  changed.flags.forEach((flagId) => {
    const flag = findById(graph.flags, flagId);
    asList(flag && flag.gates).forEach((featureId) => add(
      featureId,
      'flag',
      `must be tested with ${flag.name} on and off`,
    ));
  });

  changed.axisValues.forEach((key) => {
    const [axisId, valueId] = key.split(':');
    const axis = findById(graph.axes, axisId);
    const value = findById(axis && axis.values, valueId);
    asList(graph.actions)
      .filter((action) => actionUsesAxis(graph, action, axisId))
      .forEach((action) => add(
        action.feature,
        'axis',
        `${action.name} varies on ${axis.name}; new value ${value ? value.name : valueId}`,
      ));
  });

  return [...touched.values()];
}

/**
 * What a change reaches: features (each with reasons), scenarios to re-run, and their run plan.
 * @param {{type: 'feature'|'flag'|'axisValue', id: string}} pick
 */
function computeImpact(graph, pick) {
  const changed = changedBy(graph, pick);
  const touched = touchedFeatures(graph, changed);
  const everything = allScenarios(graph);

  let scenarios;
  if (pick.type === 'axisValue') {
    const [axisId, valueId] = pick.id.split(':');
    scenarios = everything.filter((s) => s.values[axisId] === valueId);
  } else {
    const ownedActions = new Set(asList(graph.actions)
      .filter((a) => touched.some((t) => t.feature === a.feature))
      .map((a) => a.id));
    scenarios = everything.filter((s) => ownedActions.has(s.action));
  }

  const plan = scenarios.length > 0 ? planRun(graph, scenarios) : [];
  return {
    pick, changed, touched, scenarios, plan,
  };
}

/** Every in-scope feature, every flag, every `axis:value`. */
function allPicks(graph) {
  return [
    ...asList(graph.features)
      .filter((f) => f.status === 'in-scope')
      .map((f) => ({ type: 'feature', id: f.id })),
    ...asList(graph.flags).map((f) => ({ type: 'flag', id: f.id })),
    ...asList(graph.axes).flatMap((axis) => asList(axis.values)
      .map((v) => ({ type: 'axisValue', id: `${axis.id}:${v.id}` }))),
  ];
}

module.exports = { computeImpact, allPicks };
