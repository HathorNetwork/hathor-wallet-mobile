#!/usr/bin/env node
/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadGraph, validateGraph } = require('./load');
const { renderHtml } = require('./render');
const { checkFreshness, describeVersion } = require('./freshness');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULTS = {
  graph: 'QA/graph/graph.yaml',
  out: 'QA/graph/dist/graph.html',
  base: 'origin/master',
};

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { ...DEFAULTS };
  for (let i = 0; i < rest.length; i += 1) {
    const flag = rest[i];
    const key = flag.replace(/^--/, '');
    if (!flag.startsWith('--') || !(key in DEFAULTS) || i + 1 >= rest.length) {
      throw new Error(`Unknown or incomplete option '${flag}'`);
    }
    i += 1;
    options[key] = rest[i];
  }
  return { command, options };
}

const git = (args) => execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function printValidation(graph) {
  const { errors, warnings } = validateGraph(graph);
  errors.forEach((e) => console.log(`ERROR ${e}`));
  warnings.forEach((w) => console.log(`WARN ${w}`));
  return errors.length;
}

function graphVersion(graphPath) {
  try {
    const [commit, date] = git(['log', '-1', '--format=%h %cs', '--', graphPath]).trim().split(' ');
    const dirty = git(['status', '--porcelain', graphPath]).trim() !== '';
    return describeVersion({ commit: commit || 'unknown', date: date || 'unknown', dirty });
  } catch (e) {
    return 'unknown version (git unavailable)';
  }
}

function changedFilesSince(base) {
  try {
    return git(['diff', '--name-only', `${base}...HEAD`]).split('\n').filter(Boolean);
  } catch (e) {
    console.log(`WARN Cannot diff against '${base}' (${e.message.split('\n')[0]}); assuming no changed files`);
    return [];
  }
}

const readRepoFile = (rel) => {
  try {
    return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
  } catch (e) {
    console.log(`WARN Cannot read ${rel}: ${e.message}`);
    return '';
  }
};

function run(argv) {
  const { command, options } = parseArgs(argv);
  const graph = loadGraph(options.graph);

  if (command === 'validate') {
    return printValidation(graph) > 0 ? 1 : 0;
  }

  if (command === 'render') {
    if (printValidation(graph) > 0) return 1;
    const html = renderHtml(graph, { label: graphVersion(options.graph) });
    fs.mkdirSync(path.dirname(options.out), { recursive: true });
    fs.writeFileSync(options.out, html);
    console.log(`Wrote ${options.out}`);
    return 0;
  }

  if (command === 'check') {
    const errorCount = printValidation(graph);
    const changedFiles = changedFilesSince(options.base);
    const graphRel = path.relative(REPO_ROOT, path.resolve(options.graph));
    const { warnings, notes } = checkFreshness(graph, {
      constantsSrc: readRepoFile('src/constants.js'),
      appSrc: readRepoFile('src/App.js'),
      changedFiles,
      graphChanged: changedFiles.includes(graphRel),
    });
    warnings.forEach((w) => console.log(`WARN ${w}`));
    notes.forEach((n) => console.log(`NOTE ${n}`));
    return errorCount > 0 ? 1 : 0;
  }

  throw new Error('Usage: cli.js validate|render|check [--graph <file>] [--out <file>] [--base <ref>]');
}

try {
  process.exitCode = run(process.argv.slice(2));
} catch (e) {
  console.error(`ERROR ${e.message}`);
  process.exitCode = 1;
}
