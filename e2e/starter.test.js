describe('Launch and go to main screen', () => {
  beforeAll(async () => {
    // await device.launchApp();
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should display the pinscreen', async () => {
    await expect(element(by.id('Numpad'))).toBeVisible();
  });
});
