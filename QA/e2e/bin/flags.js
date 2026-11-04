#!/usr/bin/env node
/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Sets the flags the app reads on the local privnet, through the fake Unleash (../unleash).
//
//   flags.js list
//   flags.js set <flag>=on|off ... [--wait]   --wait: until the app has fetched them
//   flags.js reset [--wait]
//
// The app fetches flags when it connects to a network and then every 15 s, so --wait takes up
// to about 15 s. Set flags before switching the app to the privnet and no wait is needed.

const BASE = process.env.UNLEASH_FAKE_URL || 'http://localhost:18042';
const WAIT_MS = 60 * 1000;

async function call(method, route, body) {
  const response = await fetch(`${BASE}${route}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error || `${method} ${route}: ${response.status}`);
  }
  return json;
}

function parseAssignments(args) {
  const changes = {};
  for (const arg of args) {
    const match = /^([^=]+)=(on|off)$/.exec(arg);
    if (!match) {
      throw new Error(`expected <flag>=on|off, got '${arg}'`);
    }
    const [, name, value] = match;
    changes[name] = value === 'on';
  }
  return changes;
}

async function waitServed() {
  const deadline = Date.now() + WAIT_MS;
  /* eslint-disable no-await-in-loop -- polling: each check waits for the last */
  while (Date.now() < deadline) {
    if ((await call('GET', '/flags')).served) {
      return;
    }
    await new Promise((resolve) => { setTimeout(resolve, 500); });
  }
  /* eslint-enable no-await-in-loop */
  throw new Error(`the app did not fetch the flags within ${WAIT_MS / 1000} s`);
}

function print({ flags }) {
  for (const [name, enabled] of Object.entries(flags).sort()) {
    console.log(`${enabled ? 'on ' : 'off'}  ${name}`);
  }
}

async function main(argv) {
  const [command, ...rest] = argv;
  const wait = rest.includes('--wait');
  const args = rest.filter((a) => a !== '--wait');
  let state;
  if (command === 'list') {
    state = await call('GET', '/flags');
  } else if (command === 'set') {
    state = await call('PUT', '/flags', parseAssignments(args));
  } else if (command === 'reset') {
    state = await call('POST', '/flags/reset');
  } else {
    throw new Error('usage: flags.js list | set <flag>=on|off ... [--wait] | reset [--wait]');
  }
  if (wait) {
    await waitServed();
  }
  print(state);
}

main(process.argv.slice(2)).catch((e) => {
  console.error(`flags: ${e.message}`);
  process.exit(1);
});
