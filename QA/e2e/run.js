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
//   node QA/e2e/run.js --setup pn-fn-seed-multi [--scenarios <id>,<id>] [--dry-run] [--no-cleanup]
//                      [--no-record]
//
// The run records the emulator's screen through each flow but onboarding, and writes viewer.html
// in its evidence dir: the recordings as a playlist, each beside its steps, the running one
// marked, for a person to watch what the run did (README "Watching a run"). --no-record skips the
// recordings.
//
// After the scenarios, the run's HTR and token deposits go back to the genesis wallet (cleanup in
// tools/wallet.js), so a privnet lasts hundreds of runs. --no-cleanup keeps them, to look at the
// wallets afterwards; `node QA/e2e/tools/wallet.js cleanup <evidence dir>` gives them back later.
//
// Needs the privnet up (QA/e2e/privnet) and the emulator running the app: a release build (README
// "Run"), or a debug build with Metro serving its JS. Scenarios the kit can't set up yet are
// recorded as skipped, with the reason.

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
// eslint-disable-next-line import/no-extraneous-dependencies
const YAML = require('yaml');
const { loadGraph } = require('../graph/tools/load');
const { allScenarios } = require('../graph/tools/scenarios');
const { assertEmulator } = require('./lib/device');
const { buildSendFlow, unrunnableReason } = require('./lib/sendFlow');
const { runOrder } = require('./lib/runOrder');
const { startRecording } = require('./lib/recorder');
const { entriesFrom, runnerEntry, skipRanges } = require('./lib/timeline');

const E2E = __dirname;
const REPO = path.resolve(E2E, '..', '..');
const ADB = process.env.ADB || path.join(os.homedir(), 'Android/Sdk/platform-tools/adb');
const MAESTRO = process.env.MAESTRO || path.join(os.homedir(), '.maestro/maestro/bin/maestro');
const NODE_URL = 'http://localhost:18083/v1a/';
const FUNDING_URL = 'http://localhost:13020';
const UNLEASH_URL = 'http://localhost:18042';
const TOP_UP_HTR = '20';
// The custom tokens minted for the app wallet, by the graph's token value. Deposit sends of 2^40
// units use their own token holding exactly that, so other deposit sends see an ordinary balance
// (a balance above 2^40 makes a private "max" send fail the 2^40 limit before the fee check).
const TOKENS = {
  htr: { name: 'Hathor', symbol: 'HTR', uid: '00' },
  deposit: { kind: 'deposit', name: 'E2E Deposit', symbol: 'E2ED', units: '100000' },
  depositLarge: { kind: 'deposit', name: 'E2E Large', symbol: 'E2EL', units: String(2 ** 40) },
  fee: { kind: 'fee', name: 'E2E Fee', symbol: 'E2EF', units: '100000' },
};

/** The key in TOKENS of the token a scenario sends. */
const tokenFor = ({ token, amount }) => (
  token === 'deposit' && amount === 'private-over-limit' ? 'depositLarge' : token);

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const log = (msg) => console.log(`${new Date().toISOString().slice(11, 19)} ${msg}`);

function parseArgs(argv) {
  const args = { action: 'send' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--setup') args.setup = argv[i += 1];
    else if (argv[i] === '--scenarios') args.scenarios = argv[i += 1].split(',');
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--no-cleanup') args.noCleanup = true;
    else if (argv[i] === '--no-record') args.noRecord = true;
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (!args.setup) {
    throw new Error('usage: run.js --setup <setup id> [--scenarios <id>,<id>] [--dry-run] [--no-cleanup] [--no-record]');
  }
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

function maestro(flow, outDir, retries = 1) {
  const result = spawnSync(MAESTRO, ['test', `--test-output-dir=${outDir}`, `--debug-output=${outDir}`, flow], {
    encoding: 'utf8',
    env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: '1', JAVA_HOME: process.env.JAVA_HOME || '/usr/lib/jvm/java-17-openjdk-amd64' },
  });
  fs.writeFileSync(path.join(outDir, 'maestro.out'), `${result.stdout}\n${result.stderr}`);
  // Maestro's on-device driver sometimes fails to start; that's not the flow's doing.
  if (retries > 0 && `${result.stdout}${result.stderr}`.includes('MaestroDriverStartupException')) {
    return maestro(flow, outDir, retries - 1);
  }
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
    ['emulator', async () => assertEmulator(ADB)],
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

async function receivedBy(address, uid = '00') {
  const body = await getJson(`${NODE_URL}thin_wallet/address_balance?address=${address}`);
  return BigInt((body.tokens_data && body.tokens_data[uid] && body.tokens_data[uid].received) || 0);
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

/**
 * Runs `body` as one chapter of the run's recording: the screen is recorded from start to end,
 * and the chapter's timeline (the runner's own steps and every flow's commands) goes to the
 * viewer. `body` gets `step(text, fn)`, to time a runner step, and `flow(file, outDir, as)`, to
 * run a Maestro flow; with `as`, the flow's commands nest under a step of that name.
 */
async function chapter(ctx, info, dir, body) {
  fs.mkdirSync(dir, { recursive: true });
  const parts = [];
  const api = {
    async step(text, fn) {
      const start = Date.now();
      try {
        return await fn();
      } finally {
        parts.push({ start, end: Date.now(), text });
      }
    },
    flow(file, outDir, as) {
      const start = Date.now();
      const result = maestro(file, outDir);
      parts.push({ start, end: Date.now(), text: as, outDir });
      return result;
    },
  };
  if (!ctx.record) return body(api);
  const recording = await startRecording(ADB);
  let result;
  let error;
  try {
    result = await body(api);
  } catch (e) {
    error = e;
  }
  const video = path.join(dir, 'screen.mp4');
  const stoppedAt = await recording.stop(video);
  const { t0 } = recording;
  const flowDirs = parts.filter((part) => part.outDir).map((part) => part.outDir);
  const entries = parts.flatMap((part) => {
    if (!part.outDir) return [runnerEntry(part, t0)];
    // A flow's own logs, not those of a flow run from a folder inside its own.
    const nested = flowDirs.filter((other) => other !== part.outDir && other.startsWith(`${part.outDir}${path.sep}`));
    const commands = findFiles(part.outDir, 'commands.json')
      .filter((file) => !nested.some((other) => file.startsWith(other)))
      .flatMap((file) => entriesFrom(JSON.parse(fs.readFileSync(file, 'utf8')), t0, part.text ? 1 : 0));
    return part.text ? [runnerEntry(part, t0), ...commands] : commands;
  }).sort((a, b) => a.t - b.t || a.depth - b.depth);
  const duration = (stoppedAt - t0) / 1000;
  ctx.chapters.push({
    ...info,
    status: error ? 'failed' : (result && result.status) || 'done',
    notes: error ? error.message : (result && result.notes) || '',
    video: path.relative(ctx.runDir, video),
    duration,
    entries,
    skips: skipRanges(entries, duration),
  });
  writeViewer(ctx);
  if (error) throw error;
  return result;
}

/** Writes the run's viewer.html (the viewer with the run's data in it) and the runs' index. */
function writeViewer(ctx) {
  const template = fs.readFileSync(path.join(E2E, 'viewer', 'viewer.html'), 'utf8');
  const data = { ...ctx.runInfo, chapters: ctx.chapters };
  // In a <script>, "</" would end it early.
  const json = JSON.stringify(data).replace(/<\//g, '<\\/');
  fs.writeFileSync(path.join(ctx.runDir, 'viewer.html'), template.replace('/* RUN_DATA */ null', () => json));
  const evidence = path.dirname(ctx.runDir);
  const runs = fs.readdirSync(evidence).filter((name) => fs.existsSync(path.join(evidence, name, 'viewer.html'))).sort().reverse();
  const items = runs.map((name) => `<li><a href="${name}/viewer.html">${name}</a></li>`).join('\n');
  fs.writeFileSync(path.join(evidence, 'index.html'), `<!doctype html><meta charset="utf-8"><title>e2e runs</title>
<style>body{font:15px system-ui;margin:2em;background:#111;color:#eee}a{color:#8cf}</style><h1>e2e runs</h1><ul>${items}</ul>`);
}

/** A digest of the flow a scenario runs, the same in every run while the flow is: the viewer
 * uses it to tell which scenarios changed since someone watched them. */
function flowVersion(scenario, outcome, token) {
  const flow = buildSendFlow(scenario, outcome, { address: '<address>', token });
  return crypto.createHash('sha1').update(flow).digest('hex').slice(0, 12);
}

async function prepareSetup(setup, runDir, ctx) {
  const fbt = setup.values['flag-fbt'];
  if (fbt) {
    await getJson(`${UNLEASH_URL}/flags`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ 'fee-based-tokens.rollout': fbt === 'on' }),
    });
  }
  log('app: fresh install on the privnet');
  execFileSync(path.join(E2E, 'bin', 'app-on-privnet.sh'), ['--fresh'], { stdio: ['ignore', 'ignore', 'inherit'] });
  const onboardDir = path.join(runDir, 'onboard');
  const onboardInfo = { kind: 'setup', id: 'onboard', title: 'Onboarding: a new wallet on the privnet' };
  // Not recorded: its screen shows the seed, and the viewer and recordings are made to be shared.
  await chapter({ ...ctx, record: false }, onboardInfo, onboardDir, async ({ flow }) => {
    const onboard = flow(path.join(E2E, 'flows', 'onboard.yaml'), onboardDir);
    if (!onboard.ok) throw new Error(`onboarding failed: ${onboard.failed}`);
  });
  const seed = findFiles(onboardDir, 'maestro.log')
    .map((file) => (fs.readFileSync(file, 'utf8').match(/JsConsole: E2E_SEED ([a-z ]+)/) || [])[1])
    .find(Boolean);
  if (!seed || seed.trim().split(' ').length !== 24) throw new Error('could not read the wallet seed from onboarding');
  const seedFile = path.join(runDir, 'app.seed');
  fs.writeFileSync(seedFile, `${seed.trim()}\n`, { mode: 0o600 });
  const appAddress = walletTool('address', seedFile);
  log(`app: wallet ${appAddress}`);

  // The treasury keeps the tokens' authorities, so the cleanup can melt them; tokens.json tells
  // the cleanup what was minted, even when the run stops half-way.
  const treasurySeed = path.join(runDir, 'treasury.seed');
  fs.writeFileSync(treasurySeed, `${walletTool('new-seed')}\n`, { mode: 0o600 });
  const tokens = { htr: TOKENS.htr };
  const minted = [];
  for (const key of ['deposit', 'depositLarge', 'fee']) {
    const { kind, name, symbol, units } = TOKENS[key];
    tokens[key] = { name, symbol, uid: walletTool('mint', appAddress, kind, name, symbol, units, treasurySeed) };
    minted.push({ uid: tokens[key].uid, kind, symbol });
    fs.writeFileSync(path.join(runDir, 'tokens.json'), JSON.stringify(minted, null, 2));
    log(`app: minted ${symbol} ${tokens[key].uid}`);
  }
  const importDir = path.join(runDir, 'import-tokens');
  const importInfo = { kind: 'setup', id: 'import-tokens', title: 'Setup: import the minted E2ED, E2EL and E2EF' };
  await chapter(ctx, importInfo, importDir, async ({ flow }) => {
    const imported = flow(path.join(E2E, 'flows', 'import_tokens.yaml'), importDir);
    if (!imported.ok) throw new Error(`importing the minted tokens failed: ${imported.failed}`);
  });

  const peerSeed = path.join(runDir, 'peer.seed');
  fs.writeFileSync(peerSeed, `${walletTool('new-seed')}\n`, { mode: 0o600 });
  // Both single-key destinations are the peer's, a seed the runner holds, so the cleanup can give
  // back what they received; the multisig's keys stay with the helper.
  const destinations = {
    simple: walletTool('address', peerSeed),
    multisig: (await getJson(`${FUNDING_URL}/multisigWallet?participants=3&numSignatures=2`)).wallets[0].addresses[0],
    shielded: walletTool('shielded-address', peerSeed),
  };
  log(`destinations: ${JSON.stringify(destinations)}`);
  return { appAddress, destinations, tokens };
}

/**
 * The centre of the element with this testID, from uiautomator dumps: it waits up to 10 s for
 * the element to show, as a screen opens.
 */
async function centreOf(testID) {
  const pattern = new RegExp(`resource-id="${testID}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`);
  for (let i = 0; i < 10; i += 1) {
    const xml = execFileSync(ADB, ['exec-out', 'uiautomator', 'dump', '/dev/tty'], { encoding: 'utf8' });
    const node = pattern.exec(xml);
    if (node) {
      const [x1, y1, x2, y2] = node.slice(1).map(Number);
      return [String(Math.round((x1 + x2) / 2)), String(Math.round((y1 + y2) / 2))];
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(1000);
  }
  throw new Error(`${testID} did not show`);
}

/**
 * Empties the address the Send tab keeps from the last scenario. A flow can't do it reliably:
 * eraseText deletes only what's before the cursor, and a tap can land mid-way through a 3-line
 * shielded address. Ctrl+A then Delete clears it wherever the cursor is; Maestro sends neither.
 */
async function clearSendAddress() {
  const input = (...args) => execFileSync(ADB, ['shell', 'input', ...args]);
  input('tap', ...(await centreOf('tab-send')));
  input('tap', ...(await centreOf('send-address-input')));
  await sleep(1000); // Ctrl+A goes nowhere until the field has focus
  input('keycombination', '113', '29'); // Ctrl+A
  input('keyevent', '67'); // Delete
}

async function runScenario(scenario, outcome, ctx, dir, { step, flow }) {
  const { values } = scenario;
  if (values.funding === 'enough-htr') {
    await step(`runner: pay the app wallet ${TOP_UP_HTR} HTR`, async () => {
      await fund(ctx.appAddress, TOP_UP_HTR);
      await sleep(6000); // the app picks the payment up over its websocket
    });
  }
  const address = ctx.destinations[values.dest];
  const token = ctx.tokens[tokenFor(values)];
  const before = values.dest !== 'shielded' ? await receivedBy(address, token.uid) : null;
  const flowFile = path.join(dir, 'flow.yaml');
  fs.writeFileSync(flowFile, buildSendFlow(scenario, outcome, { address, token }));
  // The generated flow refers to ../enter_pin.yaml; keep a copy of the sub-flows beside it.
  fs.copyFileSync(path.join(E2E, 'flows', 'enter_pin.yaml'), path.join(dir, '..', 'enter_pin.yaml'));
  await step('runner: empty the Send tab\'s address field (adb)', clearSendAddress);
  const result = flow(flowFile, dir);
  let notes = result.ok ? `reached: ${outcome.id}` : `${result.failed || 'flow failed'}`;
  let { ok } = result;
  if (ok && outcome.kind === 'success' && before !== null) {
    const landed = (await receivedBy(address, token.uid)) > before;
    ok = landed;
    notes += landed ? '; the destination received it' : '; but the destination received nothing';
  }
  const back = flow(path.join(E2E, 'flows', 'to_dashboard.yaml'), path.join(dir, 'reset'), 'runner: back to the dashboard for the next scenario');
  if (!back.ok) notes += '; could not return to the dashboard';
  return { status: ok ? 'passed' : 'failed', notes };
}

/** Which build of the app the emulator has: debug or release, its version, when installed. */
function appBuild(toolsCommit) {
  const info = execFileSync(ADB, ['shell', 'dumpsys', 'package', 'network.hathor.wallet'], { encoding: 'utf8' });
  const field = (name) => ((new RegExp(`${name}=(\\S+)`).exec(info) || [])[1] || '?');
  const installed = (/lastUpdateTime=([\d-]+ [\d:]+)/.exec(info) || [])[1] || '?';
  // A debug build takes its JS from Metro, which serves the checkout at hand.
  if (/flags=\[[^\]]*DEBUGGABLE/.test(info)) return `debug build ${field('versionName')}, JS from Metro at ${toolsCommit}`;
  return `release build ${field('versionName')}, installed ${installed}`;
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
    appBuild: appBuild(`${toolsCommit}${dirty}`),
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

  const plan = runOrder(scenarios.map((s) => ({
    scenario: s, skip: unrunnableReason(s), outcome: outcomes[s.expected[0]],
  })));
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
  try {
    await runPlan(setup, plan, runDir, startedAt, !args.noRecord);
  } finally {
    if (args.noCleanup) {
      log(`cleanup skipped; later: node QA/e2e/tools/wallet.js cleanup ${path.relative(REPO, runDir)}`);
    } else if (fs.existsSync(path.join(runDir, 'treasury.seed'))) {
      log('cleanup: giving the run\'s HTR and deposits back to genesis');
      try {
        execFileSync('node', [path.join(E2E, 'tools', 'wallet.js'), 'cleanup', runDir], { encoding: 'utf8' })
          .split('\n').filter((line) => line.startsWith('cleanup: '))
          .forEach((line) => log(line));
      } catch (e) {
        log(`cleanup failed (${e.message.split('\n')[0]}); retry: node QA/e2e/tools/wallet.js cleanup ${path.relative(REPO, runDir)}`);
      }
    }
  }
  log('when done: tear down the emulator and the privnet, and Metro if a debug build ran (README)');
}

async function runPlan(setup, plan, runDir, startedAt, record) {
  const runInfo = {
    setup: setup.id, startedAt, toolsCommit: git('rev-parse', '--short', 'HEAD'), branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  };
  const ctx = { record, runDir, runInfo, chapters: [] };
  Object.assign(ctx, await prepareSetup(setup, runDir, ctx));
  const results = [];
  for (const [i, p] of plan.entries()) {
    const info = {
      kind: 'scenario',
      id: p.scenario.id,
      title: p.scenario.id.split(':').pop(),
      values: p.scenario.values,
      expected: p.outcome && { id: p.outcome.id, message: p.outcome.message },
    };
    if (p.skip) {
      results.push({ scenario: p.scenario.id, status: 'skipped', notes: p.skip });
      ctx.chapters.push({ ...info, status: 'skipped', notes: p.skip });
      // eslint-disable-next-line no-continue
      continue;
    }
    const token = ctx.tokens[tokenFor(p.scenario.values)];
    info.flowVersion = flowVersion(p.scenario, p.outcome, token);
    const dir = path.join(runDir, 'scenarios', String(i + 1).padStart(2, '0'));
    log(`run  ${p.scenario.id} -> ${p.outcome.id}`);
    let result;
    try {
      // eslint-disable-next-line no-await-in-loop
      result = await chapter(ctx, info, dir, (api) => (
        runScenario(p.scenario, p.outcome, ctx, dir, api)));
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
  if (record) {
    writeViewer(ctx);
    log(`viewer: ${path.relative(REPO, path.join(runDir, 'viewer.html'))}`);
  }
}

main().catch((e) => {
  console.error(`run: ${e.message}`);
  process.exit(1);
});
