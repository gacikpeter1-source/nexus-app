// src/pages/Language.jsx
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

export default function Language() {
  const { currentLanguage, changeLanguage, languages, t } = useLanguage();
  const navigate = useNavigate();

  const handleLanguageChange = (langCode) => {
    changeLanguage(langCode);
    alert(t('language.changeSuccess'));
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 text-light/60 hover:text-light flex items-center gap-2 transition-colors"
          >
            ← {t('common.back')}
          </button>
          <h1 className="font-display text-5xl md:text-6xl text-light tracking-wider">
            🌍 {t('language.title')}
          </h1>
          <p className="text-light/60 text-lg mt-2">
            {t('language.subtitle')}
          </p>
        </div>

        {/* Current Language */}
        <div className="mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 rounded-xl p-5">
            <div className="flex items-center gap-4">
              <span className="text-5xl">
                {languages.find(l => l.code === currentLanguage)?.flag || '🌐'}
              </span>
              <div>
                <h3 className="text-light font-title text-xl mb-1">{t('language.current')}</h3>
                <p className="text-light/80 text-lg font-semibold">
                  {languages.find(l => l.code === currentLanguage)?.nativeName || 'English'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Language Grid */}
        <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <h2 className="font-title text-2xl text-light mb-4 flex items-center gap-3">
            <span className="w-1 h-6 bg-primary rounded"></span>
            {t('language.selectLanguage')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {languages.map((lang, idx) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`relative p-5 rounded-xl transition-all transform hover:scale-105 ${
                  currentLanguage === lang.code
                    ? 'bg-primary/20 border-2 border-primary shadow-lg'
                    : 'bg-white/5 border-2 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                {/* Selected Badge */}
                {currentLanguage === lang.code && (
                  <div className="absolute top-3 right-3">
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-dark text-xs font-bold">✓</span>
                    </div>
                  </div>
                )}

                {/* Language Info */}
                <div className="flex items-center gap-4">
                  <span className="text-5xl">{lang.flag}</span>
                  <div className="text-left">
                    <div className="text-light font-bold text-lg">{lang.nativeName}</div>
                    <div className="text-light/60 text-sm">{lang.name}</div>
                  </div>
                </div>

                {/* Hover Indicator */}
                {currentLanguage !== lang.code && (
                  <div className="mt-3 text-xs text-light/50 text-center">
                    Click to switch
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Language Stats */}
        <div className="mt-8 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-light font-title text-xl mb-4 flex items-center gap-2">
              <span>🌐</span> Available Languages
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="text-3xl font-bold text-primary">{languages.length}</div>
                <div className="text-sm text-light/60 mt-1">Total Languages</div>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="text-3xl font-bold text-accent">🇪🇺</div>
                <div className="text-sm text-light/60 mt-1">European Focus</div>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="text-3xl font-bold text-secondary">💾</div>
                <div className="text-sm text-light/60 mt-1">Auto-Saved</div>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="text-3xl font-bold text-warning">🔄</div>
                <div className="text-sm text-light/60 mt-1">Instant Switch</div>
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="bg-blue-600/10 border border-blue-600/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">ℹ️</span>
              <div>
                <h4 className="text-blue-400 font-semibold mb-1">Language Preference</h4>
                <p className="text-blue-400/80 text-sm">
                  Your language preference is automatically saved and will be applied across all pages.
                  You can change it anytime from the user menu.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
