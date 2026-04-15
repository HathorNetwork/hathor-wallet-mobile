/**
 * E2E test: Full wallet creation flow.
 *
 * Navigates through the actual application:
 * 1. Welcome screen → agree to terms → Start
 * 2. Initial screen → New Wallet
 * 3. New Words screen → read 24 words → Next
 * 4. Backup Words → select 5 correct words
 * 5. Choose PIN → enter and confirm 6-digit PIN
 * 6. Verify wallet starts loading → reaches Dashboard
 *
 * Prerequisites:
 *   - Build the app: npx detox build --configuration ios.sim.debug
 *   - Run: npx detox test --configuration ios.sim.debug
 */
import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

describe('Wallet Creation Flow', () => {
  beforeAll(async () => {
    // Disable Detox synchronization to work around RN 0.77 compatibility issue
    // (wix/Detox#4803 — Detox hangs on isReady with RN 0.76+)
    await device.launchApp({
      newInstance: true,
      launchArgs: { detoxDisableSynchronization: 1 },
    });
  });

  it('should display the Welcome screen', async () => {
    // With sync disabled, use waitFor to poll for elements
    await waitFor(element(by.text('Welcome to Hathor Wallet!')))
      .toBeVisible()
      .withTimeout(30000);
  });

  it('should enable Start button after agreeing to terms', async () => {
    // Toggle the agreement switch
    // The Switch component doesn't have a testID, so we use the first switch found
    await element(by.type('RCTSwitch')).tap();

    // Tap the Start button
    await element(by.text('Start')).tap();

    // Should navigate to the Initial screen
    await detoxExpect(element(by.text('New Wallet'))).toBeVisible();
  });

  it('should navigate to New Wallet and display 24 words', async () => {
    await element(by.text('New Wallet')).tap();

    // Should see the backup instruction
    await detoxExpect(element(by.text('Your wallet has been created!'))).toBeVisible();

    // Should see the Next button
    await detoxExpect(element(by.text('Next'))).toBeVisible();
  });

  it('should navigate to BackupWords validation', async () => {
    // We need to capture the 24 words displayed on screen before proceeding.
    // In a real E2E test, we would read the words from the screen.
    // For now, we navigate forward and verify the backup screen appears.
    await element(by.text('Next')).tap();

    // Should see the backup validation instruction
    await detoxExpect(
      element(by.text('Please select the word that corresponds to the number below:'))
    ).toBeVisible();
  });

  // NOTE: The BackupWords validation test is complex in E2E because we need to:
  // 1. Read the word position number shown on screen
  // 2. Know which word corresponds to that position (from step 3)
  // 3. Tap the correct word button from the 5 options
  // 4. Repeat 5 times
  //
  // A full implementation would use device-level text extraction or
  // set SKIP_SEED_CONFIRMATION=true for E2E builds. This is documented
  // as a follow-up in docs/testing-ci-plan.md.
  //
  // For the PoC, we verify that the flow reaches this screen and renders correctly.
});
