#!/usr/bin/env node
/**
 * Removes the `"crypto": "react-native-crypto"` mapping injected by
 * `rn-nodeify --hack` from packages that ship their own crypto
 * implementations.
 *
 * Why this is needed:
 *   `rn-nodeify --hack` (run by `npm run setup`) writes a `react-native`
 *   and `browser` field into every package.json under node_modules,
 *   redirecting `require('crypto')` to the browserify polyfill. That is
 *   correct for legacy consumers like bitcore-lib but fatal for the
 *   Web3Auth ecosystem, which brings its own EC crypto via
 *   `@noble/curves` / `@toruslabs/eccrypto`. The polyfill is incomplete
 *   (missing `subtle`, partial `createHash`) and causes the
 *   `@web3auth/auth` barrel export to crash on load
 *   (`LOGIN_PROVIDER` becomes undefined).
 *
 *   See `explicacao-hacky-web3-auth.md` for the full story.
 *
 * Order in the `setup` script:
 *   npm install
 *     -> allow-scripts
 *       -> rn-nodeify --hack          (writes the bad mapping)
 *         -> node scripts/fix-web3auth-crypto-hack.js   (THIS script)
 *           -> npx patch-package      (applies bitcore-lib patches)
 *
 * The script is idempotent and safe to re-run.
 */

const fs = require('fs');
const path = require('path');

const PACKAGES = [
  '@toruslabs/base-controllers',
  '@toruslabs/broadcast-channel',
  '@toruslabs/constants',
  '@toruslabs/eccrypto',
  '@toruslabs/ffjavascript',
  '@toruslabs/http-helpers',
  '@toruslabs/metadata-helpers',
  '@toruslabs/react-native-web-browser',
  '@toruslabs/secure-pub-sub',
  '@toruslabs/session-manager',
  '@toruslabs/starkware-crypto',
  '@toruslabs/tweetnacl-js',
  '@web3auth/auth',
  '@web3auth/base',
  '@web3auth/base-provider',
  '@web3auth/react-native-sdk',
  'elliptic',
  'brorand',
  'hash.js',
  'hmac-drbg',
];

const FIELDS = ['react-native', 'browser'];
const KEY_TO_REMOVE = 'crypto';

let touched = 0;
let missing = [];

for (const pkg of PACKAGES) {
  const pjsonPath = path.join('node_modules', pkg, 'package.json');
  if (!fs.existsSync(pjsonPath)) {
    missing.push(pkg);
    continue;
  }

  const raw = fs.readFileSync(pjsonPath, 'utf8');
  const data = JSON.parse(raw);

  let changed = false;
  for (const field of FIELDS) {
    const value = data[field];
    if (value && typeof value === 'object' && KEY_TO_REMOVE in value) {
      delete value[KEY_TO_REMOVE];
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(pjsonPath, JSON.stringify(data, null, 2) + '\n');
    touched += 1;
    console.log(`  fixed ${pkg}`);
  }
}

console.log(`\nfix-web3auth-crypto-hack: cleaned ${touched}/${PACKAGES.length} packages`);

if (missing.length) {
  console.warn(
    `\nWARNING: ${missing.length} expected packages are missing from node_modules:`,
  );
  for (const pkg of missing) console.warn(`  - ${pkg}`);
  console.warn(
    'This may indicate that the Web3Auth dependency tree has changed. ' +
      'Update the PACKAGES list in this script.',
  );
}
