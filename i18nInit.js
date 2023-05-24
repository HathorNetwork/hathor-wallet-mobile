import { addLocale, useLocale } from 'ttag';
import { findBestAvailableLanguage } from 'react-native-localize';

const availableLocales = {
  da: () => require('./src/locale/da/texts.po.json'), // eslint-disable-line
  en: () => null,
  pt: () => require('./src/locale/pt-br/texts.po.json'), // eslint-disable-line
  'pt-BR': () => require('./src/locale/pt-br/texts.po.json'), // eslint-disable-line
  ru: () => require('./src/locale/ru-ru/texts.po.json'), // eslint-disable-line
};

const bestLanguage = findBestAvailableLanguage(Object.keys(availableLocales));
if (bestLanguage) {
  const locale = bestLanguage.languageTag;
  const data = availableLocales[locale]();
  if (data) {
    addLocale(locale, data);
    useLocale(locale);
  }
}
