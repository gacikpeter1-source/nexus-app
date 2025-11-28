// src/pages/VerifyEmail.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase/config';

export default function VerifyEmail() {
  const { user, refreshUser, resendVerificationEmail, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Check if user is already verified
  useEffect(() => {
    if (user && user.emailVerified) {
      navigate('/');
    }
  }, [user, navigate]);

  // Auto-check verification status every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      if (auth.currentUser && !checkingStatus) {
        setCheckingStatus(true);
        try {
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified) {
            setMessage('✅ Email verified! Redirecting...');
            await refreshUser();
            setTimeout(() => navigate('/'), 2000);
          }
        } catch (err) {
          console.error('Error checking verification:', err);
        }
        setCheckingStatus(false);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [checkingStatus, refreshUser, navigate]);

  const handleResendEmail = async () => {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const result = await resendVerificationEmail();
      setMessage(result.message);
    } catch (err) {
      setError(err.message || 'Failed to resend verification email');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        setMessage('✅ Email verified! Redirecting...');
        await refreshUser();
        setTimeout(() => navigate('/'), 2000);
      } else {
        setError('Email not verified yet. Please check your inbox and click the verification link.');
      }
    } catch (err) {
      setError('Failed to check verification status');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📧 Verify Your Email</h1>
          <p className="text-gray-600">
            We've sent a verification link to:
          </p>
          <p className="text-blue-600 font-semibold mt-2">
            {user?.email || auth.currentUser?.email}
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">📬 Check your inbox!</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• Click the verification link in the email</li>
            <li>• The link expires in 24 hours</li>
            <li>• Check your spam folder if you don't see it</li>
            <li>• This page will auto-detect when you verify</li>
          </ul>
        </div>

        {/* Success Message */}
        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {message}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleCheckStatus}
            disabled={loading || checkingStatus}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Checking...
              </>
            ) : checkingStatus ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Auto-checking...
              </>
            ) : (
              <>
                ✅ I've Verified - Check Status
              </>
            )}
          </button>

          <button
            onClick={handleResendEmail}
            disabled={loading}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : '📨 Resend Verification Email'}
          </button>

          <button
            onClick={handleLogout}
            className="w-full bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition"
          >
            🚪 Logout
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Need help? Contact support at{' '}
            <a href="mailto:support@nexus.com" className="text-blue-600 hover:underline">
              support@nexus.com
            </a>
          </p>
        </div>

        {/* Auto-check indicator */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400 flex items-center justify-center gap-2">
            <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Auto-checking verification status...
          </p>
        </div>
      </div>
    </div>
  );
}
