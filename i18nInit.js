import { addLocale, useLocale } from 'ttag';
import { findBestAvailableLanguage } from 'react-native-localize';

const availableLocales = {
  en: () => null,
  pt: () => require('./src/locale/pt-br/texts.po.json'), // eslint-disable-line global-require
  'pt-BR': () => require('./src/locale/pt-br/texts.po.json'), // eslint-disable-line global-require
  ru: () => require('./src/locale/ru-ru/texts.po.json'), // eslint-disable-line global-require
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
