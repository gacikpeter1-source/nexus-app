// src/pages/Login.jsx - DARK THEME VERSION
import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResendButton, setShowResendButton] = useState(false);
  const [resending, setResending] = useState(false);
  const { login, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const from = location.state?.from?.pathname || '/';

  // Fix for browser autofill
  useEffect(() => {
    const checkAutofill = () => {
      if (emailRef.current && emailRef.current.value !== email) {
        setEmail(emailRef.current.value);
      }
      if (passwordRef.current && passwordRef.current.value !== password) {
        setPassword(passwordRef.current.value);
      }
    };

    const timer = setTimeout(checkAutofill, 100);
    return () => clearTimeout(timer);
  }, [email, password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Get values directly from inputs as backup
    const emailValue = emailRef.current?.value || email;
    const passwordValue = passwordRef.current?.value || password;

    if (!emailValue || !passwordValue) {
      setError('Please enter both email and password');
      setLoading(false);
      return;
    }

    try {
      const result = await login(emailValue, passwordValue);
      if (result.ok) {
        navigate(from, { replace: true });
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      const errorMessage = err.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      
      // Show resend button if email not verified
      if (errorMessage.includes('verify your email')) {
        setShowResendButton(true);
      } else {
        setShowResendButton(false);
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleResendVerification = async () => {
    setResending(true);
    setError('');
    
    const emailValue = emailRef.current?.value || email;
    const passwordValue = passwordRef.current?.value || password;
    
    try {
      const result = await resendVerificationEmail(emailValue, passwordValue);
      if (result.ok) {
        setError('✅ ' + result.message);
        setShowResendButton(false);
      } else {
        setError('❌ ' + result.message);
      }
    } catch (err) {
      setError('❌ Failed to resend verification email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
        {/* Login Card */}
      <div className="max-w-md w-full">
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              {t('auth.welcomeBack')}
            </h2>
            <p className="text-slate-400">
              {t('auth.signInAccount')}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                {t('auth.emailAddress')}
              </label>
              <input
                ref={emailRef}
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onInput={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition"
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onInput={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300 transition"
                  tabIndex="-1"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  className="h-4 w-4 text-pink-500 focus:ring-pink-500 bg-slate-900/50 border-slate-700 rounded"
                />
                <label htmlFor="remember" className="ml-2 block text-sm text-slate-400">
                  {t('auth.rememberMe')}
                </label>
              </div>
              <Link 
                to="/forgot-password" 
                className="text-sm text-pink-400 hover:text-pink-300 transition"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>

            {/* Error Message */}
            {error && (
              <div className={`px-4 py-3 rounded-lg text-sm ${
                error.startsWith('✅') 
                  ? 'bg-green-500/10 border border-green-500/50 text-green-400'
                  : 'bg-red-500/10 border border-red-500/50 text-red-400'
              }`}>
                {error}
              </div>
            )}
            
            {/* Resend Verification Button */}
            {showResendButton && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed border border-blue-500/50"
              >
                {resending ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Sending...</span>
                  </div>
                ) : (
                  '📧 Resend Verification Email'
                )}
              </button>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-pink-500/20"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{t('auth.signingIn')}</span>
                </div>
              ) : (
                t('auth.signIn')
              )}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400">
              {t('auth.dontHaveAccount')}{' '}
              <Link 
                to="/register" 
                className="text-pink-400 hover:text-pink-300 font-semibold transition"
              >
                {t('auth.createOne')}
              </Link>
            </p>
          </div>
        </div>

        {/* Footer Text */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
