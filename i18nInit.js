import { addLocale, useLocale } from 'ttag';
import RNLanguages from 'react-native-languages';

const availableLocales = {
  en: () => null,
  'en-US': () => null,
  'en-CA': () => null,
  'en-GB': () => null,
  'en-AU': () => null,
  'en-NZ': () => null,
  'en-ZA': () => null,
  'pt-BR': () => require('./src/locale/pt-br/texts.po.json'), // eslint-disable-line global-require
};
for (const locale of RNLanguages.languages) {
  if (locale in availableLocales) {
    const data = availableLocales[locale]();
    if (!data) {
      break;
    }
    addLocale(locale, data);
    useLocale(locale);
    break;
  }
}
