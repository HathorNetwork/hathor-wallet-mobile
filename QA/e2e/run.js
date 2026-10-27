#!/usr/bin/env node
/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Runs the QA graph's send scenarios of one setup on the emulator, against the local privnet,
// and writes one results file in QA/graph/runs/.
//
//   node QA/e2e/run.js --setup pn-fn-seed-multi [--scenarios <id>,<id>] [--dry-run]
//
// Needs the privnet up (QA/e2e/privnet), the emulator running the debug app, and Metro serving
// it. Scenarios the kit can't set up yet are recorded as skipped, with the reason.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
// eslint-disable-next-line import/no-extraneous-dependencies
const YAML = require('yaml');
const { loadGraph } = require('../graph/tools/load');
const { allScenarios } = require('../graph/tools/scenarios');
const { buildSendFlow, unrunnableReason } = require('./lib/sendFlow');

const E2E = __dirname;
const REPO = path.resolve(E2E, '..', '..');
const ADB = process.env.ADB || path.join(os.homedir(), 'Android/Sdk/platform-tools/adb');
const MAESTRO = process.env.MAESTRO || path.join(os.homedir(), '.maestro/maestro/bin/maestro');
const NODE_URL = 'http://localhost:18083/v1a/';
const FUNDING_URL = 'http://localhost:13020';
const UNLEASH_URL = 'http://localhost:18042';
const TOP_UP_HTR = '20';

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const log = (msg) => console.log(`${new Date().toISOString().slice(11, 19)} ${msg}`);

function parseArgs(argv) {
  const args = { action: 'send' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--setup') args.setup = argv[i += 1];
    else if (argv[i] === '--scenarios') args.scenarios = argv[i += 1].split(',');
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (!args.setup) throw new Error('usage: run.js --setup <setup id> [--scenarios <id>,<id>] [--dry-run]');
  return args;
}

async function getJson(url, options, retries = 1) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (e) {
    // Usually a kept-alive connection the server closed while the app onboarded. A retry is
    // harmless here: at worst a /fund is paid twice, in privnet coins.
    if (retries > 0) return getJson(url, options, retries - 1);
    throw new Error(`${url}: ${(e.cause && e.cause.message) || e.message}`);
  }
  const body = await response.json();
  if (!response.ok) throw new Error(`${url}: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

// wallet-lib logs to stdout too, so the answer is the last line.
const walletTool = (...args) => execFileSync('node', [path.join(E2E, 'tools', 'wallet.js'), ...args], { encoding: 'utf8' })
  .trim().split('\n').pop();
const git = (...args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim();

function maestro(flow, outDir) {
  const result = spawnSync(MAESTRO, ['test', `--test-output-dir=${outDir}`, `--debug-output=${outDir}`, flow], {
    encoding: 'utf8',
    env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: '1', JAVA_HOME: process.env.JAVA_HOME || '/usr/lib/jvm/java-17-openjdk-amd64' },
  });
  fs.writeFileSync(path.join(outDir, 'maestro.out'), `${result.stdout}\n${result.stderr}`);
  const failed = (result.stdout.match(/^.*FAILED.*$/m) || [])[0];
  return { ok: result.status === 0, failed: failed && failed.trim() };
}

// Maestro puts its logs in timestamped folders under --debug-output.
function findFiles(dir, name) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findFiles(full, name);
    return entry.name === name ? [full] : [];
  });
}

async function preflight() {
  const checks = [
    ['privnet fullnode', () => getJson(`${NODE_URL}status`)],
    ['funding helper', async () => { if (!(await getJson(`${FUNDING_URL}/ready`)).ready) throw new Error('not ready'); }],
    ['fake Unleash', () => getJson(`${UNLEASH_URL}/flags`)],
    ['Metro', async () => { if (!(await (await fetch('http://localhost:8081/status')).text()).includes('running')) throw new Error('not running'); }],
    ['emulator', async () => { if (!execFileSync(ADB, ['devices'], { encoding: 'utf8' }).includes('\tdevice')) throw new Error('no device'); }],
  ];
  for (const [name, check] of checks) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await check();
    } catch (e) {
      throw new Error(`${name} is not available (${e.message}); see QA/e2e/README.md "Run"`);
    }
  }
}

async function receivedBy(address) {
  const body = await getJson(`${NODE_URL}thin_wallet/address_balance?address=${address}`);
  return BigInt((body.tokens_data && body.tokens_data['00'] && body.tokens_data['00'].received) || 0);
}

async function fund(address, htr) {
  const before = await receivedBy(address);
  const cents = Math.round(Number(htr) * 100);
  await getJson(`${FUNDING_URL}/fund`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, amount: cents }),
  });
  for (let i = 0; i < 30; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await receivedBy(address) > before) return;
    // eslint-disable-next-line no-await-in-loop
    await sleep(500);
  }
  throw new Error(`funding ${address} did not land`);
}

async function prepareSetup(setup, runDir) {
  const fbt = setup.values['flag-fbt'];
  if (fbt) {
    await getJson(`${UNLEASH_URL}/flags`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ 'fee-based-tokens.rollout': fbt === 'on' }),
    });
  }
  log('app: fresh install on the privnet');
  execFileSync(path.join(E2E, 'bin', 'app-on-privnet.sh'), ['--fresh'], { stdio: 'ignore' });
  const onboardDir = path.join(runDir, 'onboard');
  fs.mkdirSync(onboardDir, { recursive: true });
  const onboard = maestro(path.join(E2E, 'flows', 'onboard.yaml'), onboardDir);
  if (!onboard.ok) throw new Error(`onboarding failed: ${onboard.failed}`);
  const seed = findFiles(onboardDir, 'maestro.log')
    .map((file) => (fs.readFileSync(file, 'utf8').match(/JsConsole: E2E_SEED ([a-z ]+)/) || [])[1])
    .find(Boolean);
  if (!seed || seed.trim().split(' ').length !== 24) throw new Error('could not read the wallet seed from onboarding');
  const seedFile = path.join(runDir, 'app.seed');
  fs.writeFileSync(seedFile, `${seed.trim()}\n`, { mode: 0o600 });
  const appAddress = walletTool('address', seedFile);
  log(`app: wallet ${appAddress}`);

  const peerSeed = path.join(runDir, 'peer.seed');
  fs.writeFileSync(peerSeed, `${walletTool('new-seed')}\n`, { mode: 0o600 });
  const destinations = {
    simple: (await getJson(`${FUNDING_URL}/simpleWallet`)).addresses[0],
    multisig: (await getJson(`${FUNDING_URL}/multisigWallet?participants=3&numSignatures=2`)).wallets[0].addresses[0],
    shielded: walletTool('shielded-address', peerSeed),
  };
  log(`destinations: ${JSON.stringify(destinations)}`);
  return { appAddress, destinations };
}

async function runScenario(scenario, outcome, ctx, dir) {
  const { values } = scenario;
  if (values.funding === 'enough-htr') {
    await fund(ctx.appAddress, TOP_UP_HTR);
    await sleep(6000); // the app picks the payment up over its websocket
  }
  const address = ctx.destinations[values.dest];
  const before = values.dest !== 'shielded' ? await receivedBy(address) : null;
  const flowFile = path.join(dir, 'flow.yaml');
  fs.writeFileSync(flowFile, buildSendFlow(scenario, outcome, { address }));
  // The generated flow refers to ../enter_pin.yaml; keep a copy of the sub-flows beside it.
  fs.copyFileSync(path.join(E2E, 'flows', 'enter_pin.yaml'), path.join(dir, '..', 'enter_pin.yaml'));
  const result = maestro(flowFile, dir);
  let notes = result.ok ? `reached: ${outcome.id}` : `${result.failed || 'flow failed'}`;
  let { ok } = result;
  if (ok && outcome.kind === 'success' && before !== null) {
    const landed = (await receivedBy(address)) > before;
    ok = landed;
    notes += landed ? '; the destination received it' : '; but the destination received nothing';
  }
  const back = maestro(path.join(E2E, 'flows', 'to_dashboard.yaml'), path.join(dir, 'reset'));
  if (!back.ok) notes += '; could not return to the dashboard';
  return { status: ok ? 'passed' : 'failed', notes };
}

function writeResults(setupId, results, startedAt) {
  const graphFile = 'QA/graph/graph.yaml';
  const yamlCommit = git('log', '-1', '--format=%h', '--', graphFile);
  const yamlDate = git('log', '-1', '--format=%cs', '--', graphFile);
  const toolsCommit = git('rev-parse', '--short', 'HEAD');
  const dirty = git('status', '--porcelain', '--', 'QA') ? ' (with uncommitted changes)' : '';
  const doc = {
    yamlCommit,
    yamlDate,
    toolsCommit: `${toolsCommit}${dirty}`,
    appBuild: `debug build, JS from Metro at ${toolsCommit}${dirty}`,
    device: 'Android emulator (AVD hnni, android-36 x86_64)',
    platform: 'android',
    environment: 'local-privnet',
    scope: { reason: `e2e runner: send scenarios of ${setupId}`, picks: [] },
    results,
  };
  const file = path.join(REPO, 'QA', 'graph', 'runs', `${startedAt.slice(0, 19).replace(/[:T]/g, '-')}-${setupId}-send.yaml`);
  const header = `# This test was run based on the YAML of ${yamlDate}, version from commit ${yamlCommit}, `
    + `with the tools at commit ${toolsCommit}${dirty}.\n`;
  fs.writeFileSync(file, header + YAML.stringify(doc));
  return file;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const graph = loadGraph(path.join(REPO, 'QA', 'graph', 'graph.yaml'));
  const setup = graph.setups.find((s) => s.id === args.setup);
  if (!setup) throw new Error(`unknown setup ${args.setup}`);
  const action = graph.actions.find((a) => a.id === args.action);
  const outcomes = Object.fromEntries(action.path.outcomes.map((o) => [o.id, o]));
  const scenarios = allScenarios(graph)
    .filter((s) => s.setup === setup.id && s.action === action.id)
    .filter((s) => !args.scenarios || args.scenarios.includes(s.id));

  const plan = scenarios.map((s) => ({
    scenario: s, skip: unrunnableReason(s), outcome: outcomes[s.expected[0]],
  }));
  log(`${plan.length} scenarios, ${plan.filter((p) => !p.skip).length} runnable`);
  if (args.dryRun) {
    plan.forEach((p) => {
      console.log(`${p.skip ? 'skip' : 'run '}  ${p.scenario.id}  ${p.skip || `-> ${p.outcome.id}`}`);
    });
    return;
  }

  await preflight();
  const runDir = path.join(E2E, 'evidence', startedAt.slice(0, 19).replace(/[:T]/g, '-'));
  fs.mkdirSync(runDir, { recursive: true });
  const ctx = await prepareSetup(setup, runDir);
  const results = [];
  for (const [i, p] of plan.entries()) {
    if (p.skip) {
      results.push({ scenario: p.scenario.id, status: 'skipped', notes: p.skip });
      // eslint-disable-next-line no-continue
      continue;
    }
    const dir = path.join(runDir, 'scenarios', String(i + 1).padStart(2, '0'));
    fs.mkdirSync(dir, { recursive: true });
    log(`run  ${p.scenario.id} -> ${p.outcome.id}`);
    let result;
    try {
      // eslint-disable-next-line no-await-in-loop
      result = await runScenario(p.scenario, p.outcome, ctx, dir);
    } catch (e) {
      result = { status: 'failed', notes: `runner error: ${e.message}` };
    }
    log(`     ${result.status}: ${result.notes}`);
    results.push({ scenario: p.scenario.id, status: result.status, notes: result.notes });
  }
  const file = writeResults(setup.id, results, startedAt);
  const count = (status) => results.filter((r) => r.status === status).length;
  log(`passed ${count('passed')}, failed ${count('failed')}, skipped ${count('skipped')}`);
  log(`results: ${path.relative(REPO, file)}; evidence: ${path.relative(REPO, runDir)}`);
  log('when done: tear down the emulator, Metro and the privnet (QA/e2e/README.md)');
}

main().catch((e) => {
  console.error(`run: ${e.message}`);
  process.exit(1);
});
