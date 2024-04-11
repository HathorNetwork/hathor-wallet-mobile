# LavaMoat and SES (Secure Ecmascript) maintenance

### Hermes

SES does not yet work with Hermes, so we had to disable it on both platforms https://github.com/facebook/hermes/issues/957

### SES injection

LavaMoat does not yet fully support react-native, there is a compatibility tracker [here](https://github.com/LavaMoat/docs/issues/12). Until then, we're using [SES](https://github.com/endojs/endo/tree/master/packages/ses) directly, injecting it directly into the InitializeCore which is the entrypoint for the react-native's bundle so it hardens our app as soon as possible in the process.

This is done through a patch on the react-native package, using `patch-package`.

We are currently using version `1.0.1` of SES, which is the latest version that works with react-native, it is loaded from the project root, `lockdown.umd.js`.


### Updating SES

As soon as react-native is fully supported by LavaMoat, we will replace the current patch with its official package and install it using npm, but until then, in order to update SES we should do the following steps:

1. Update the `lockdown.umd.js` file to the latest supported SES lockdown file
2. Update the sha256sum of the lockdown library in the SHA256SUMS file
