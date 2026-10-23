/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const asList = (value) => (Array.isArray(value) ? value : []);

/** Names of the `*.rollout` string constants exported from the constants source. */
function extractFlagNames(constantsSrc) {
  const names = [];
  const re = /export\s+const\s+\w+\s*=\s*(['"])([^'"]+\.rollout)\1/g;
  let m = re.exec(constantsSrc);
  while (m) {
    names.push(m[2]);
    m = re.exec(constantsSrc);
  }
  return names;
}

/** Route names registered via `<Stack.Screen name=...>` or `<Tab.Screen name=...>`. */
function extractRoutes(appSrc) {
  const routes = [];
  const re = /(?:Stack|Tab)\.Screen\b[^>]*?\bname\s*=\s*(['"])([^'"]+)\1/g;
  let m = re.exec(appSrc);
  while (m) {
    routes.push(m[2]);
    m = re.exec(appSrc);
  }
  return routes;
}

/** A `files` entry ending in `/` is a directory prefix; anything else is an exact path. */
const matchesEntry = (entry, file) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry);

/**
 * Compare the graph with the code, deterministically.
 * @param {object} graph
 * @param {object} input `{constantsSrc, appSrc, changedFiles, graphChanged}`
 * @returns {{warnings: string[], notes: string[]}}
 */
function checkFreshness(graph, input) {
  const { constantsSrc, appSrc, changedFiles, graphChanged, } = input;
  const warnings = [];
  const notes = [];

  const codeFlags = extractFlagNames(constantsSrc);
  const graphFlags = asList(graph.flags).map((f) => f.name);
  codeFlags.filter((n) => !graphFlags.includes(n)).forEach((n) => {
    warnings.push(`Flag '${n}' is in the code but missing from the graph flags`);
  });
  graphFlags.filter((n) => !codeFlags.includes(n)).forEach((n) => {
    warnings.push(`Flag '${n}' is in the graph but not in the code (renamed or removed?)`);
  });

  const graphScreens = new Set(asList(graph.features).flatMap((f) => asList(f.screens)));
  extractRoutes(appSrc).filter((r) => !graphScreens.has(r)).forEach((r) => {
    warnings.push(`Route '${r}' is in the code but not listed in any feature's screens`);
  });

  asList(graph.features).forEach((feature) => {
    const hits = changedFiles
      .filter((file) => asList(feature.files).some((entry) => matchesEntry(entry, file)));
    if (hits.length === 0) return;
    const text = `Feature '${feature.id}' has changed files (${hits.join(', ')})`;
    if (feature.status !== 'in-scope') {
      notes.push(`${text}; it is out of scope`);
    } else if (!graphChanged) {
      warnings.push(`${text} but the graph did not change: did its paths, axes or outcomes change?`);
    }
  });

  asList(graph.actions).forEach((action) => {
    asList(action.path && action.path.outcomes)
      .filter((o) => o.verified === false && o.source)
      .forEach((o) => {
        const file = String(o.source).replace(/:\d+$/, '');
        if (changedFiles.includes(file)) {
          notes.push(`Unverified outcome '${o.id}' of action '${action.id}': its source ${file} changed`);
        }
      });
  });

  return { warnings, notes };
}

/**
 * One-line description of which graph and tools versions a rendered page shows; the tools
 * generate the scenarios, so they matter as much as the YAML.
 */
function describeVersion({ commit, date, dirty, toolsCommit, toolsDirty, }) {
  const mark = (isDirty) => (isDirty ? ' + UNCOMMITTED changes' : '');
  return `YAML of ${date}, commit ${commit}${mark(dirty)} · tools ${toolsCommit}${mark(toolsDirty)}`;
}

module.exports = {
  extractFlagNames, extractRoutes, checkFreshness, describeVersion,
};
