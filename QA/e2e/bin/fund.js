#!/usr/bin/env node
/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Sends HTR from the privnet's genesis wallet to an address, through wallet-lib's
// integration-test helper (the privnet's `funding` service).
//
//   fund.js <address> <amount in HTR, e.g. 10 or 10.50>
//
// Prints the transaction id. Public (W...) addresses only: the helper refuses shielded ones.

const BASE = process.env.FUNDING_URL || 'http://localhost:13020';

async function main([address, htr]) {
  if (!address || !/^\d+(\.\d{1,2})?$/.test(htr || '')) {
    throw new Error('usage: fund.js <address> <amount in HTR, e.g. 10 or 10.50>');
  }
  const [whole, cents = ''] = htr.split('.');
  const amount = Number(whole) * 100 + Number(cents.padEnd(2, '0'));
  const response = await fetch(`${BASE}/fund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, amount }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${response.status} ${body.error}: ${body.message}`);
  }
  console.log(body.txId);
}

main(process.argv.slice(2)).catch((e) => {
  console.error(`fund: ${e.message}`);
  process.exit(1);
});
