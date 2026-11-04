/**
 * @jest-environment node
 *
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { assertEmulator } from '../../QA/e2e/lib/device';

const SCRIPT = path.resolve(__dirname, '../../QA/e2e/bin/app-on-privnet.sh');

// Store and e2e builds share the app id, so these stubs stand in for the device: the kit must
// never be pointed at a real one, not even to test this guard.
const STUB_ADB = `#!/bin/sh
echo "$*" >> "$STUB_LOG"
case "$*" in
  "shell getprop ro.boot.qemu")
    if [ -n "$STUB_NO_DEVICE" ]; then echo "adb: no devices/emulators found" >&2; exit 1; fi
    echo "$STUB_QEMU" ;;
  "shell id -u") echo "$STUB_UID" ;;
  root) echo "$STUB_ROOT_ANSWER" ;;
  *SELECT*) echo '{"fullNetwork":"stub-net"}' ;;
esac
`;
const STUB_CURL = `#!/bin/sh
echo '{"server":{"network":"stub-net"}}'
`;

let dir;
let adb;
let logFile;

const stub = (name, body) => {
  const file = path.join(dir, name);
  fs.writeFileSync(file, body, { mode: 0o755 });
  return file;
};
const adbCalls = () => (fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').trim().split('\n') : []);

// A production adbd refuses root, and the adb client still exits 0.
const PHONE = { STUB_QEMU: '', STUB_UID: '2000', STUB_ROOT_ANSWER: 'adbd cannot run as root in production builds' };
const EMULATOR = { STUB_QEMU: '1', STUB_UID: '0', STUB_ROOT_ANSWER: 'restarting adbd as root' };
const EMULATOR_WITHOUT_ROOT = { ...EMULATOR, STUB_UID: '2000', STUB_ROOT_ANSWER: 'adbd cannot run as root in production builds' };
const NO_DEVICE = { STUB_NO_DEVICE: '1' };

function runScript(device, ...args) {
  return spawnSync(SCRIPT, args, {
    encoding: 'utf8',
    env: { ...process.env, ...device, STUB_LOG: logFile, ADB: adb, PATH: `${dir}${path.delimiter}${process.env.PATH}` },
  });
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-guard-'));
  logFile = path.join(dir, 'adb.log');
  adb = stub('adb', STUB_ADB);
  stub('curl', STUB_CURL);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('app-on-privnet.sh', () => {
  it('refuses a device that is not an emulator before touching the app', () => {
    const { status, stderr } = runScript(PHONE, '--fresh');
    expect(status).toBe(1);
    expect(stderr).toContain('emulators only');
    expect(adbCalls()).toEqual(['shell getprop ro.boot.qemu']);
  });

  it('refuses when adb reaches no single device', () => {
    expect(runScript(NO_DEVICE, '--fresh').status).toBe(1);
    expect(adbCalls()).toEqual(['shell getprop ro.boot.qemu']);
  });

  it('refuses an emulator where adb did not get root, though adb root exits 0', () => {
    const { status, stderr } = runScript(EMULATOR_WITHOUT_ROOT, '--fresh');
    expect(status).toBe(1);
    expect(stderr).toContain('root');
    expect(adbCalls().join('\n')).not.toMatch(/pm clear|force-stop/);
  });

  it('wipes the app on an emulator', () => {
    const { status, stderr } = runScript(EMULATOR, '--fresh');
    expect(stderr).toBe('');
    expect(status).toBe(0);
    expect(adbCalls()).toContain('shell pm clear network.hathor.wallet');
  });

  it('keeps the app\'s data on an emulator without --fresh', () => {
    expect(runScript(EMULATOR).status).toBe(0);
    expect(adbCalls().join('\n')).not.toContain('pm clear');
  });
});

describe('the runner\'s emulator check', () => {
  // Only the property the check must read answers, so a check that reads another one fails.
  const adbAnswering = (qemu) => stub('adb-device', `#!/bin/sh
if [ "$*" = "shell getprop ro.boot.qemu" ]; then echo "${qemu}"; fi
`);

  it('accepts an emulator', () => {
    expect(() => assertEmulator(adbAnswering('1'))).not.toThrow();
  });

  it('refuses a device that adb lists but is not an emulator', () => {
    expect(() => assertEmulator(adbAnswering(''))).toThrow('not an emulator');
  });

  it('refuses when adb reaches no single device', () => {
    const failing = stub('adb-device', '#!/bin/sh\necho "adb: no devices/emulators found" >&2\nexit 1\n');
    expect(() => assertEmulator(failing)).toThrow('no devices/emulators found');
  });
});
