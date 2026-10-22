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

function assertKnown(graph, pick) {
  let known;
  if (pick.type === 'feature') known = findById(graph.features, pick.id);
  else if (pick.type === 'flag') known = findById(graph.flags, pick.id);
  else {
    const [axisId, valueId] = String(pick.id).split(':');
    known = findById(findById(graph.axes, axisId) && findById(graph.axes, axisId).values, valueId);
  }
  if (!known) throw new Error(`Unknown ${pick.type} '${pick.id}'`);
}

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
  // Per feature: axis values that reached it, and whether any non-axis reason did.
  const scope = new Map();
  const add = (featureId, via, why, axisKey) => {
    const s = scope.get(featureId) || { whole: false, axisKeys: [] };
    if (via === 'axis') s.axisKeys.push(axisKey);
    else s.whole = true;
    scope.set(featureId, s);
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
        key,
      ));
  });

  return { touched: [...touched.values()], scope };
}

/**
 * What a change reaches: features (each with reasons), scenarios to re-run, and their run plan.
 * @param {{type: 'feature'|'flag'|'axisValue', id: string}} pick
 */
function computeImpact(graph, pick) {
  assertKnown(graph, pick);
  const changed = changedBy(graph, pick);
  const { touched, scope } = touchedFeatures(graph, changed);
  const everything = allScenarios(graph);

  // A feature reached only via axis re-runs just the scenarios on the changed values;
  // one reached via code or flag re-runs all its scenarios.
  const actionFeature = new Map(asList(graph.actions).map((a) => [a.id, a.feature]));
  const scenarios = everything.filter((s) => {
    const sc = scope.get(actionFeature.get(s.action));
    if (!sc) return false;
    if (sc.whole) return true;
    return sc.axisKeys.some((key) => {
      const [axisId, valueId] = key.split(':');
      return s.values[axisId] === valueId;
    });
  });

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
