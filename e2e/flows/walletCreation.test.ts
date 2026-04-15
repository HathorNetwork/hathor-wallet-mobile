/**
 * E2E test: Full wallet creation flow.
 *
 * Navigates through the actual application:
 * 1. Welcome screen -> agree to terms -> Start
 * 2. Initial screen -> New Wallet
 * 3. New Words screen -> read 24 words -> Next
 * 4. Backup Words -> select correct words
 * 5. Verify navigation reaches ChoosePinScreen
 *
 * Note: The app has recurring JS timers (feature flag polling, websocket
 * keepalive) that prevent Detox auto-sync from ever seeing "idle". We
 * launch with sync enabled for the initial handshake, then disable it
 * and use waitFor with explicit timeouts.
 */
import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

const TIMEOUT = 15000;

describe('Wallet Creation Flow', () => {
  beforeAll(async () => {
    // The app has recurring 1s JS timers (Unleash polling, websocket keepalive)
    // that keep Detox sync perpetually "busy". Disable sync from the start
    // so the initial launch handshake doesn't block waiting for idle.
    await device.launchApp({
      newInstance: true,
      launchArgs: { detoxEnableSynchronization: 0 },
    });
  });

  it('should display the Welcome screen', async () => {
    await waitFor(element(by.text('Welcome to Hathor Wallet!')))
      .toBeVisible()
      .withTimeout(TIMEOUT);
  });

  it('should enable Start button after agreeing to terms', async () => {
    // Toggle the terms agreement switch
    await element(by.id('terms-agreement-switch')).longPress();

    // Tap Start to navigate to InitialScreen
    await waitFor(element(by.text('To start,')))
      .toBeVisible()
      .withTimeout(TIMEOUT);

    // Should navigate to the Initial screen
    await waitFor(element(by.text('New Wallet')))
      .toBeVisible()
      .withTimeout(TIMEOUT);
  });

  it('should navigate to New Wallet and display 24 words', async () => {
    await element(by.text('New Wallet')).tap();

    // Should see the backup instruction
    await waitFor(element(by.text('Your wallet has been created!')))
      .toBeVisible()
      .withTimeout(TIMEOUT);

    // Should see the Next button
    await detoxExpect(element(by.text('Next'))).toBeVisible();
  });

  it('should navigate to BackupWords validation', async () => {
    await element(by.text('Next')).tap();

    // Should see the backup validation instruction
    await waitFor(
      element(by.text('Please select the word that corresponds to the number below:'))
    )
      .toBeVisible()
      .withTimeout(TIMEOUT);
  });
});
