# Hathor Wallet Mobile

## Install

`npm install`

`npm run node-hack`

## Run

`npm run ios` to open on iOS simulator, or `npm run ios -- --simulator "iPhone 11"

To list all available simulators, use `xcrun simctl list devices`.

### Run linter

`npm run lint`

## i18n

We use the `ttag` lib. Check out the docs [here](https://ttag.js.org/docs/quickstart.html).

Run `npm run locale-update-pot` to update the pot file (`locale/texts.pot`).

Run `msgmerge pt-br/texts.po texts.pot -o pt-br/texts.po` to merge a pot file with a po file.

Finally, run `./compile_js_i18n` to compile all po files to json files.

## License

Code released under [the MIT license](https://github.com/HathorNetwork/hathor-wallet-mobile/blob/master/LICENSE).
