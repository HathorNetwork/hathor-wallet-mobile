# LavaMoat and SES (Secure Ecmascript) maintenance

### Hermes

SES does not yet work with Hermes, so we had to disable it on both platforms https://github.com/facebook/hermes/issues/957

### SES injection

LavaMoat does not yet fully support react-native, there is a compatibility tracker [here](https://github.com/LavaMoat/docs/issues/12). Until then, we're using [SES](https://github.com/endojs/endo/tree/master/packages/ses) directly, injecting it directly into the InitializeCore which is the entrypoint for the react-native's bundle so it hardens our app as soon as possible in the process.

This is done through a patch on the react-native package, using `patch-package`.

We are currently using version `1.5.0` of SES, which is the latest version that works with react-native, it is loaded from the project root, `lockdown.umd.js`.


### Understanding SES Hardening

SES hardens JavaScript's built-in objects ("intrinsics") to prevent malicious code from modifying them. This includes:

- Object prototype methods (e.g. `Object.prototype.toString`)
- Array methods (e.g. `Array.prototype.push`)
- String methods
- Promise implementation
- Math object
- JSON object
- And other global objects

Common issues you might encounter:
1. "TypeError: Cannot assign to read only property": This means code is trying to modify a hardened object
2. "TypeError: Object.prototype.foo is not configurable": Attempting to add methods to hardened prototypes
3. "Cannot create property 'bar' on frozen object": Trying to modify frozen global objects

Debug tips:
- If you see these errors, check if your code or a third-party library is trying to:
  - Modify built-in prototypes
  - Add properties to global objects
  - Override native methods
- Consider using proper alternatives:
  - Create new objects instead of modifying built-ins
  - Use class inheritance instead of prototype modification
  - Keep modifications within your own object instances

### Updating SES

Once React Native is fully supported by LavaMoat, we'll replace the current patch with its official npm package. Until then, to update SES:

1. Update the `lockdown.umd.js` file to the latest supported SES lockdown file
2. Update the sha256sum of the lockdown library in the SHA256SUMS file

### Future Plans

We plan to migrate to LavaMoat's full implementation once React Native support is complete. This will provide:
- Better integration with the ecosystem
- Easier updates through npm
- Additional security features from LavaMoat
