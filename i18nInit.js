import { addLocale, useLocale } from 'ttag';
import RNLanguages from 'react-native-languages';

const availableLocales = {
  'pt-BR': () => require('./src/locale/pt-br/texts.po.json'),
};
for (const locale of RNLanguages.languages) {
  if (locale === 'en-US') {
    break;
  }
  if (locale in availableLocales) {
    const data = availableLocales[locale]();
    addLocale(locale, data);
    useLocale(locale);
    break;
  }
}
