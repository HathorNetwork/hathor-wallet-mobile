/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Turns one send scenario of the QA graph into a Maestro flow: the send path (address, amount,
// privacy, confirm, PIN) up to the step where the expected outcome shows, then a check for it.
// Selectors are visible text, or screen points where the app exposes none (the privacy sheet).

// eslint-disable-next-line import/no-extraneous-dependencies
const YAML = require('yaml');

const STEP_ORDER = ['address', 'amount', 'confirm', 'authorize'];

// Screen points on a 1080x2400 emulator. The privacy sheet isn't in the accessibility tree.
const POINTS = {
  sendTab: '50%,93%',
  addressField: '50%,24%',
  blank: '50%,40%', // dismisses the keyboard on the amount screen
  privacyCard: '50%,77%',
  privacyDone: '50%,93%',
  privacyToggle: { private: '84%,53%', 'hide-amount': '84%,65%', public: '85%,77%' },
};

// private-over-limit is 2^40 units, the first amount a private output can't hold.
const AMOUNTS = { normal: '1.50', decimals: '1.234', 'private-over-limit': '10995116277.76' };

// The balance line under the amount; the screen's accessibility group ("SEND X, ... available")
// also ends in "available", so the pattern starts at the number.
const AVAILABLE = '[0-9][0-9,.]* \\S+ available';

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
      { copyTextFrom: { text: AVAILABLE } },
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
    return { assertVisible: { text: 'NEXT', enabled: false } };
  }
  return { extendedWaitUntil: { visible: messagePattern(outcome.message), timeout: 60000 } };
}

/**
 * The Maestro flow for one send scenario.
 *
 * @param {{ id: string, values: object }} scenario from the graph
 * @param {{ at: string, message: string }} outcome the expected outcome
 * @param {object} target
 * @param {string} target.address the destination address for the scenario's dest
 * @param {{ name: string, symbol: string }} target.token the token to send
 * @param {string[]} target.symbols every token symbol the wallet holds
 */
function buildSendFlow(scenario, outcome, { address, token, symbols }) {
  const { values } = scenario;
  const stopAt = STEP_ORDER.indexOf(outcome.at);
  const steps = [
    { tapOn: { point: POINTS.sendTab } },
    { extendedWaitUntil: { visible: 'Address to send', timeout: 15000 } },
    // The runner has emptied the field the Send tab keeps (clearSendAddress in run.js).
    { tapOn: { point: POINTS.addressField } },
    { inputText: address },
    // The field must hold exactly this address: leftovers from the last scenario fail here.
    { assertVisible: address },
  ];
  const done = () => [...steps, outcomeCheck(outcome)];
  if (stopAt === 0) {
    return render(scenario, done());
  }
  steps.push(
    { tapOn: 'NEXT' },
    { extendedWaitUntil: { visible: AVAILABLE, timeout: 15000 } },
    // The screen opens on the last token picked, so always pick: its symbol box, then its name.
    { tapOn: { text: symbols.join('|') } },
    { tapOn: token.name },
    { extendedWaitUntil: { visible: `[0-9][0-9,.]* ${token.symbol} available`, timeout: 15000 } },
    ...amountSteps(values.amount),
    { tapOn: { point: POINTS.blank } },
    { tapOn: { point: POINTS.privacyCard } },
    { tapOn: { point: POINTS.privacyToggle[values.privacy] } },
    { tapOn: { point: POINTS.privacyDone } },
  );
  if (stopAt === 1) {
    // The amount screen sets its errors when Next is tapped; a disabled Next is checked as is.
    if (outcome.message !== 'Next stays disabled') {
      steps.push({ tapOn: 'NEXT' });
    }
    return render(scenario, done());
  }
  steps.push({ tapOn: 'NEXT' });
  if (stopAt === 2) {
    // A confirm screen that can't build the transaction shows only the error, no summary.
    return render(scenario, done());
  }
  steps.push(
    { extendedWaitUntil: { visible: 'Transaction summary', timeout: 30000 } },
    { tapOn: 'SEND' },
    { runFlow: '../enter_pin.yaml' },
  );
  return render(scenario, done());
}

function render(scenario, steps) {
  return `appId: network.hathor.wallet\n---\n# ${scenario.id}\n${YAML.stringify(steps)}`;
}

module.exports = { buildSendFlow, unrunnableReason, messagePattern };
