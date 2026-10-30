/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Turns one send scenario of the QA graph into a Maestro flow: the send path (address, amount,
// privacy, confirm, PIN) up to the step where the expected outcome shows, then a check for it.
// It finds what it taps and types into by the app's testIDs, and checks what the user should see
// by its text (README "Selectors").

// eslint-disable-next-line import/no-extraneous-dependencies
const YAML = require('yaml');

const STEP_ORDER = ['address', 'amount', 'confirm', 'authorize'];

// The app's privacy modes (PRIVACY_MODE in src/constants.js) by the graph's privacy value.
const PRIVACY_MODES = { public: 'public', 'hide-amount': 'hide_amount', private: 'private' };

const tap = (id) => ({ tapOn: { id } });

// private-over-limit is 2^40 units, the first amount a private output can't hold.
const AMOUNTS = { normal: '1.50', decimals: '1.234', 'private-over-limit': '10995116277.76' };

// The balance line under the amount: "<amount> <symbol> available".
const AVAILABLE = 'send-amount-available';

/** A Maestro regex for an outcome message: placeholders match anything, the rest literally. */
function messagePattern(message) {
  return message
    .replace(/\*\*/g, '')
    .split(/\$\{[^}]+\}/)
    .map((part) => part.replace(/[.*+?^$()[\]{}|\\]/g, '\\$&'))
    .join('.*');
}

/** Why the kit can't run this scenario yet, or null when it can. */
function unrunnableReason({ values }) {
  if (values['private-balance'] !== 'unlocked') {
    return `the private balance state '${values['private-balance']}' can't be set up yet`;
  }
  return null;
}

function amountSteps(amount) {
  if (amount === 'empty') {
    return [];
  }
  if (amount === 'max' || amount === 'over-balance') {
    const extra = amount === 'max' ? '' : ' + 1';
    return [
      { copyTextFrom: { id: AVAILABLE } },
      { evalScript: `\${output.amount = (parseFloat(maestro.copiedText.split(' ')[0].replace(/,/g, ''))${extra}).toFixed(2)}` },
      // A Maestro expression, not a JS template.
      // eslint-disable-next-line no-template-curly-in-string
      { inputText: '${output.amount}' },
    ];
  }
  return [{ inputText: AMOUNTS[amount] }];
}

function outcomeCheck(outcome) {
  if (outcome.message === 'Next stays disabled') {
    const next = outcome.at === 'address' ? 'send-address-next' : 'send-amount-next';
    return { assertVisible: { id: next, enabled: false } };
  }
  return { extendedWaitUntil: { visible: messagePattern(outcome.message), timeout: 60000 } };
}

const PRIVACY_NAMES = { public: 'Public', 'hide-amount': 'Hide amount', private: 'Private' };

/**
 * The Maestro flow for one send scenario. Each step of the graph's send path is one labelled
 * group, and the expected outcome another, so the run's log, and its video when recorded, show
 * which step is running in the graph's terms.
 *
 * @param {{ id: string, values: object }} scenario from the graph
 * @param {{ id: string, at: string, message: string }} outcome the expected outcome
 * @param {object} target
 * @param {string} target.address the destination address for the scenario's dest
 * @param {{ name: string, symbol: string }} target.token the token to send
 */
function buildSendFlow(scenario, outcome, { address, token }) {
  const { values } = scenario;
  const stopAt = STEP_ORDER.indexOf(outcome.at);
  const groups = [];
  const group = (step, text, commands) => groups.push({
    runFlow: { label: `${STEP_ORDER.indexOf(step) + 1}/${STEP_ORDER.length} ${step}: ${text}`, commands },
  });

  group('address', `type the ${values.dest} address`, [
    tap('tab-send'),
    { extendedWaitUntil: { visible: { id: 'send-address-input' }, timeout: 15000 } },
    // The runner has emptied the field the Send tab keeps (clearSendAddress in run.js).
    tap('send-address-input'),
    { inputText: address },
    // The field must hold exactly this address: leftovers from the last scenario fail here.
    { assertVisible: address },
  ]);
  if (stopAt >= 1) {
    const amount = [
      tap('send-address-next'),
      { extendedWaitUntil: { visible: { id: AVAILABLE }, timeout: 15000 } },
      // The screen opens on the last token picked, so always pick: the token box, then the token
      // by its name in the list.
      tap('send-amount-token'),
      { tapOn: token.name },
      { extendedWaitUntil: { visible: `[0-9][0-9,.]* ${token.symbol} available`, timeout: 15000 } },
      ...amountSteps(values.amount),
      // The privacy card hides the keyboard as it opens the sheet.
      tap('send-amount-privacy-mode'),
      tap(`privacy-mode-switch-${PRIVACY_MODES[values.privacy]}`),
      tap('transaction-privacy-done'),
    ];
    // The amount screen sets its errors when Next is tapped; a disabled Next is checked as is.
    if (stopAt > 1 || outcome.message !== 'Next stays disabled') {
      amount.push(tap('send-amount-next'));
    }
    group('amount', `pick ${token.symbol}, type the ${values.amount} amount, pick ${PRIVACY_NAMES[values.privacy]}`, amount);
  }
  // A confirm screen that can't build the transaction shows only the error, no summary.
  if (stopAt >= 3) {
    group('confirm', 'check the summary and tap Send', [
      { extendedWaitUntil: { visible: 'Transaction summary', timeout: 30000 } },
      tap('send-confirm-send'),
    ]);
    group('authorize', 'enter the PIN', [{ runFlow: '../enter_pin.yaml' }]);
  }
  // Maestro evaluates ${...} in a label, so the message's placeholders become <name>.
  const expected = outcome.message.replace(/\*\*/g, '').replace(/\$\{([^}]+)\}/g, '<$1>');
  groups.push({ runFlow: { label: `expect ${outcome.id}: ${expected}`, commands: [outcomeCheck(outcome)] } });
  const yaml = (doc) => YAML.stringify(doc, { lineWidth: 0 });
  return `${yaml({ appId: 'network.hathor.wallet', name: scenario.id })}---\n${yaml(groups)}`;
}

module.exports = { buildSendFlow, unrunnableReason, messagePattern };
