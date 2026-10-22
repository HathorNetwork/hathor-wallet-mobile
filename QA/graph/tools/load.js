/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const fs = require('fs');
// yaml is a devDependency: these are dev-only QA tools, never bundled into the app.
// eslint-disable-next-line import/no-extraneous-dependencies
const { parse } = require('yaml');

const TOP_LEVEL_LISTS = [
  'environments', 'features', 'flags', 'axes', 'setups', 'actions', 'constraints',
];
const CONSTRAINT_CLASSES = ['invalid', 'rejected', 'edge', 'lib-risk'];
const FEATURE_STATUSES = ['in-scope', 'out-of-scope'];
const AXIS_KINDS = ['setup', 'action'];
const APPLIES_AT = ['live', 'next-start', 'next-pin'];
const OUTCOME_KINDS = ['success', 'error'];

/**
 * Parse a graph YAML file.
 * @param {string} filePath
 * @returns {object}
 * @throws {Error} message includes the file path on read or syntax errors.
 */
function loadGraph(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    throw new Error(`Cannot read graph file ${filePath}: ${e.message}`);
  }
  try {
    return parse(text);
  } catch (e) {
    throw new Error(`Invalid YAML in ${filePath}: ${e.message}`);
  }
}

const asList = (value) => (Array.isArray(value) ? value : []);
const asArray = (value) => (Array.isArray(value) ? value : [value]);

/**
 * Warn about constraints that can never produce a scenario. A non-invalid constraint
 * is dead when it matches no combination surviving the `invalid` exclusions; an
 * `invalid` one when it matches no combination at all. Checked across the action's setups.
 */
function deadConstraintWarnings(graph) {
  // Required lazily, as the plan mandates; it keeps load.js usable without scenarios.js loaded.
  // There is no actual require cycle.
  // eslint-disable-next-line global-require
  const { enumerateCombos, matches, classifyCombo } = require('./scenarios');
  return asList(graph.constraints).filter((c) => {
    const action = asList(graph.actions).find((a) => a.id === c.action);
    const combos = asList(action.setups)
      .map((id) => asList(graph.setups).find((s) => s.id === id))
      .filter(Boolean)
      .flatMap((setup) => enumerateCombos(graph, action, setup));
    const pool = c.class === 'invalid'
      ? combos
      : combos.filter((values) => !classifyCombo(graph, c.action, values).excluded);
    return !pool.some((values) => matches(c, values));
  }).map((c) => `constraint ${c.id}: matches no combination, so it never produces a scenario`);
}

/**
 * Check the graph schema and cross-references.
 * @param {object} graph
 * @returns {{errors: string[], warnings: string[]}}
 */
function validateGraph(graph) {
  const errors = [];
  const warnings = [];
  const err = (msg) => errors.push(msg);

  if (!graph || typeof graph !== 'object') {
    return { errors: ['graph: expected a YAML mapping at the top level'], warnings };
  }

  if (graph.version !== 1) err(`graph: version must be 1, got '${graph.version}'`);
  if (!graph.costs || typeof graph.costs !== 'object') err('graph: missing field \'costs\'');
  TOP_LEVEL_LISTS.forEach((key) => {
    if (!Array.isArray(graph[key])) err(`graph: field '${key}' must be a list`);
  });
  const costs = graph.costs && typeof graph.costs === 'object' ? graph.costs : {};
  const checkCost = (where, cost) => {
    if (!(cost in costs)) err(`${where}: unknown cost '${cost}'`);
  };

  // Unique ids per collection, and id lookup tables.
  const ids = {};
  TOP_LEVEL_LISTS.forEach((key) => {
    ids[key] = new Set();
    asList(graph[key]).forEach((item, index) => {
      if (!item || typeof item.id !== 'string' || !item.id) {
        err(`${key}[${index}]: missing field 'id'`);
        return;
      }
      if (ids[key].has(item.id)) err(`${key} ${item.id}: duplicate id`);
      ids[key].add(item.id);
    });
  });

  const axesById = new Map(asList(graph.axes).map((a) => [a && a.id, a]));
  const actionsById = new Map(asList(graph.actions).map((a) => [a && a.id, a]));
  const axisHasValue = (axis, valueId) => asList(axis.values).some((v) => v.id === valueId);

  // Features
  asList(graph.features).forEach((f) => {
    const where = `feature ${f.id}`;
    if (!FEATURE_STATUSES.includes(f.status)) err(`${where}: invalid status '${f.status}'`);
    asList(f.flags).forEach((id) => {
      if (!ids.flags.has(id)) err(`${where}: unknown flag '${id}'`);
    });
    asList(f.links).forEach((link) => {
      if (!ids.features.has(link.to)) err(`${where}: link to unknown feature '${link.to}'`);
      if (!link.reason) err(`${where}: link to '${link.to}' has no reason`);
    });
    asList(f.actions).forEach((id) => {
      if (!ids.actions.has(id)) err(`${where}: unknown action '${id}'`);
    });
    asList(f.introduces).forEach((ref) => {
      const [axisId, valueId] = String(ref).split(':');
      const axis = axesById.get(axisId);
      if (!axis) err(`${where}: introduces unknown axis '${axisId}'`);
      else if (!axisHasValue(axis, valueId)) {
        err(`${where}: introduces unknown value '${valueId}' for axis '${axisId}'`);
      }
    });
  });

  // Flags
  asList(graph.flags).forEach((flag) => {
    const where = `flag ${flag.id}`;
    if (!APPLIES_AT.includes(flag.appliesAt)) err(`${where}: invalid appliesAt '${flag.appliesAt}'`);
    asList(flag.gates).forEach((id) => {
      if (!ids.features.has(id)) err(`${where}: gates unknown feature '${id}'`);
    });
  });

  // Impact spreads via `gates`, so they must be the inverse of the features' `flags`.
  const flagsById = new Map(asList(graph.flags).map((f) => [f && f.id, f]));
  asList(graph.flags).forEach((flag) => {
    asList(flag.gates).forEach((id) => {
      const feature = asList(graph.features).find((f) => f.id === id);
      if (feature && !asList(feature.flags).includes(flag.id)) {
        warnings.push(`flag ${flag.id}: gates feature '${id}', but that feature does not list the flag`);
      }
    });
  });
  asList(graph.features).forEach((f) => {
    asList(f.flags).forEach((id) => {
      const flag = flagsById.get(id);
      if (flag && !asList(flag.gates).includes(f.id)) {
        warnings.push(`feature ${f.id}: lists flag '${id}', but the flag does not gate it`);
      }
    });
  });

  // Axes
  asList(graph.axes).forEach((axis) => {
    const where = `axis ${axis.id}`;
    if (!AXIS_KINDS.includes(axis.kind)) err(`${where}: invalid kind '${axis.kind}'`);
    if (asList(axis.values).length === 0) err(`${where}: has no values`);
    const valueIds = new Set();
    asList(axis.values).forEach((v) => {
      if (valueIds.has(v.id)) err(`${where}: duplicate value '${v.id}'`);
      valueIds.add(v.id);
    });
    const sw = axis.switch;
    if (!sw) {
      err(`${where}: missing field 'switch'`);
      return;
    }
    checkCost(`${where} switch`, sw.cost);
    asList(sw.transitions).forEach((t) => {
      ['from', 'to'].forEach((end) => {
        if (!valueIds.has(t[end])) {
          err(`${where}: transition ${end} unknown value '${t[end]}'`);
        }
      });
      if (t.cost !== undefined) checkCost(`${where} transition ${t.from}->${t.to}`, t.cost);
    });
    if (sw.fallback) checkCost(`${where} fallback`, sw.fallback.cost);
  });

  // Setups
  asList(graph.setups).forEach((setup) => {
    const where = `setup ${setup.id}`;
    if (!ids.environments.has(setup.environment)) {
      err(`${where}: unknown environment '${setup.environment}'`);
    }
    const values = setup.values || {};
    Object.entries(values).forEach(([axisId, valueId]) => {
      const axis = axesById.get(axisId);
      if (!axis) err(`${where}: unknown axis '${axisId}'`);
      else if (axis.kind !== 'setup') err(`${where}: axis '${axisId}' is not a setup axis`);
      else if (!axisHasValue(axis, valueId)) {
        err(`${where}: unknown value '${valueId}' for axis '${axisId}'`);
      }
    });
    asList(graph.axes).filter((a) => a.kind === 'setup' && !(a.id in values)).forEach((a) => {
      err(`${where}: missing value for setup axis '${a.id}'`);
    });
  });

  // Actions
  asList(graph.actions).forEach((action) => {
    const where = `action ${action.id}`;
    if (!ids.features.has(action.feature)) err(`${where}: unknown feature '${action.feature}'`);
    asList(action.axes).forEach((id) => {
      const axis = axesById.get(id);
      if (!axis) err(`${where}: unknown axis '${id}'`);
      else if (axis.kind !== 'action') err(`${where}: axis '${id}' is not an action axis`);
    });
    asList(action.setups).forEach((id) => {
      if (!ids.setups.has(id)) err(`${where}: unknown setup '${id}'`);
    });
    const axisIds = asList(action.axes);
    axisIds.filter((id, i) => axisIds.indexOf(id) !== i).forEach((id) => {
      err(`${where}: duplicate axis '${id}'`);
    });
    const steps = asList(action.path && action.path.steps);
    const stepIds = new Set(steps.map((s) => s.id));
    asList(action.path && action.path.outcomes).forEach((o) => {
      if (!OUTCOME_KINDS.includes(o.kind)) err(`${where}: outcome ${o.id}: invalid kind '${o.kind}'`);
      if (!stepIds.has(o.at)) err(`${where}: outcome ${o.id}: unknown step '${o.at}'`);
      if (!o.source) warnings.push(`${where}: outcome ${o.id} has no source`);
    });
  });

  // Constraints
  asList(graph.constraints).forEach((c) => {
    const where = `constraint ${c.id}`;
    if (!CONSTRAINT_CLASSES.includes(c.class)) err(`${where}: invalid class '${c.class}'`);
    const action = actionsById.get(c.action);
    if (!action) err(`${where}: unknown action '${c.action}'`);
    Object.entries(c.when || {}).forEach(([axisId, wanted]) => {
      const axis = axesById.get(axisId);
      if (!axis) {
        err(`${where}: unknown axis '${axisId}'`);
        return;
      }
      asArray(wanted).forEach((valueId) => {
        if (!axisHasValue(axis, valueId)) {
          err(`${where}: unknown value '${valueId}' for axis '${axisId}'`);
        }
      });
    });
    const outcomes = asList(action && action.path && action.path.outcomes);
    if (c.class === 'rejected' && !c.outcome) err(`${where}: rejected constraint requires 'outcome'`);
    if (c.outcome) {
      const outcome = outcomes.find((o) => o.id === c.outcome);
      if (!outcome) err(`${where}: unknown outcome '${c.outcome}'`);
      else if (c.class === 'rejected' && outcome.kind !== 'error') {
        err(`${where}: outcome '${c.outcome}' must be of kind error`);
      }
    }
  });

  if (errors.length === 0) warnings.push(...deadConstraintWarnings(graph));

  return { errors, warnings };
}

module.exports = { loadGraph, validateGraph };
