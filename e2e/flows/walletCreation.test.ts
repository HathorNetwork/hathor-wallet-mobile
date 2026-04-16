/**
 * E2E test: Wallet creation flow with Detox.
 *
 * Tests the same flow as .maestro/flows/walletCreation.yaml using Detox.
 * Purpose: validate whether Detox works with the same Fabric workarounds
 * that made Maestro work (ToggleSwitch, Pressable, flex container fix).
 *
 * Note: Sync is disabled because the app has recurring 1s JS timers
 * (Unleash polling, websocket keepalive) that block Detox auto-sync.
 */
import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

const TIMEOUT = 15000;

describe('Wallet Creation Flow (Detox)', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { detoxEnableSynchronization: 0 },
    });
  });

  it('Step 1: WelcomeScreen — toggle terms and tap Start', async () => {
    // Wait for the welcome screen
    await waitFor(element(by.text('Welcome to Hathor Wallet!')))
      .toBeVisible()
      .withTimeout(TIMEOUT);

    // Toggle the custom ToggleSwitch (Pressable-based, not native Switch)
    await element(by.id('terms-agreement-switch')).tap();

    // Tap the Start button (now Pressable, outside flex container)
    await element(by.id('welcome-start-button')).tap();

    // Verify we navigated to InitialScreen
    await waitFor(element(by.text('To start,')))
      .toBeVisible()
      .withTimeout(TIMEOUT);
  });

  it('Step 2: InitialScreen — tap New Wallet', async () => {
    // NewHathorButton applies textTransform: 'uppercase'
    // Detox matches exact rendered text on iOS
    await element(by.text('NEW WALLET')).tap();

    await waitFor(element(by.text('Your wallet has been created!')))
      .toBeVisible()
      .withTimeout(TIMEOUT);
  });

  it('Step 3: NewWordsScreen — tap Next', async () => {
    await element(by.text('NEXT')).tap();

    await waitFor(
      element(by.text('Please select the word that corresponds to the number below:'))
    )
      .toBeVisible()
      .withTimeout(TIMEOUT);
  });
});
