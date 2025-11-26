// src/contexts/LanguageContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

// Import all translations directly
import en from '../translations/en.json';
import es from '../translations/es.json';
import de from '../translations/de.json';
import fr from '../translations/fr.json';
import it from '../translations/it.json';
import pt from '../translations/pt.json';
import nl from '../translations/nl.json';
import pl from '../translations/pl.json';
import cs from '../translations/cs.json';
import sk from '../translations/sk.json';
import ru from '../translations/ru.json';
import uk from '../translations/uk.json';
import hu from '../translations/hu.json';

const LanguageContext = createContext();

export const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧', nativeName: 'English' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
  { code: 'de', name: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
  { code: 'fr', name: 'French', flag: '🇫🇷', nativeName: 'Français' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹', nativeName: 'Português' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱', nativeName: 'Polski' },
  { code: 'cs', name: 'Czech', flag: '🇨🇿', nativeName: 'Čeština' },
  { code: 'sk', name: 'Slovak', flag: '🇸🇰', nativeName: 'Slovenčina' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'uk', name: 'Ukrainian', flag: '🇺🇦', nativeName: 'Українська' },
  { code: 'hu', name: 'Hungarian', flag: '🇭🇺', nativeName: 'Magyar' },
];

// Map translations
const translations = {
  en, es, de, fr, it, pt, nl, pl, cs, sk, ru, uk, hu
};

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');

  // Load saved language preference
  useEffect(() => {
    const savedLang = localStorage.getItem('app_language');
    if (savedLang && LANGUAGES.find(l => l.code === savedLang)) {
      setCurrentLanguage(savedLang);
    }
  }, []);

  const changeLanguage = (langCode) => {
    if (LANGUAGES.find(l => l.code === langCode)) {
      setCurrentLanguage(langCode);
      localStorage.setItem('app_language', langCode);
    }
  };

  // Translation function
  const t = (key) => {
    const currentTranslations = translations[currentLanguage] || translations.en;
    const keys = key.split('.');
    let value = currentTranslations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English if translation not found
        const enTranslations = translations.en;
        let enValue = enTranslations;
        for (const enK of keys) {
          if (enValue && typeof enValue === 'object' && enK in enValue) {
            enValue = enValue[enK];
          } else {
            return key; // Return key if not found
          }
        }
        return enValue;
      }
    }
    
    return value || key;
  };

  const value = {
    currentLanguage,
    changeLanguage,
    t,
    languages: LANGUAGES,
    currentLanguageObj: LANGUAGES.find(l => l.code === currentLanguage) || LANGUAGES[0],
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export default LanguageContext;
