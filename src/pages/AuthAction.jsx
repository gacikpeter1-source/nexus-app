// src/pages/AuthAction.jsx
// Custom handler for Firebase auth actions (email verification, password reset, etc.)
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '../firebase/config';
import { applyActionCode } from 'firebase/auth';

export default function AuthAction() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  useEffect(() => {
    handleAction();
  }, [mode, oobCode]);

  const handleAction = async () => {
    if (!mode || !oobCode) {
      setStatus('error');
      setMessage('Invalid verification link');
      return;
    }

    switch (mode) {
      case 'verifyEmail':
        await handleVerifyEmail();
        break;
      case 'resetPassword':
        // Handle password reset (future feature)
        navigate(`/reset-password?oobCode=${oobCode}`);
        break;
      default:
        setStatus('error');
        setMessage('Unknown action');
    }
  };

  const handleVerifyEmail = async () => {
    try {
      // Apply the verification code
      await applyActionCode(auth, oobCode);
      setStatus('success');
      setMessage('Email verified successfully!');
    } catch (error) {
      console.error('Verification error:', error);
      setStatus('error');
      if (error.code === 'auth/invalid-action-code') {
        setMessage('Invalid or expired verification link');
      } else if (error.code === 'auth/expired-action-code') {
        setMessage('Verification link has expired');
      } else {
        setMessage('Verification failed. Please try again.');
      }
    }
  };

  const handleClose = () => {
    window.close();
    // Fallback if window.close() doesn't work
    setTimeout(() => {
      alert('Please close this tab manually');
    }, 100);
  };

  // Verifying state
  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying Email...</h2>
          <p className="text-gray-600">Please wait while we verify your email address.</p>
        </div>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 mb-3">✅ Email Verified!</h2>
          <p className="text-gray-600 mb-6">{message}</p>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800">
              You can now close this window and return to the registration page to login.
            </p>
          </div>

          <button
            onClick={handleClose}
            className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold text-lg hover:bg-green-700 transition shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            Verification Completed ✓
          </button>
          
          <p className="text-xs text-gray-500 mt-4">
            Click the button to close this window
          </p>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-3">❌ Verification Failed</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-800">
            The verification link may have expired or already been used.
          </p>
        </div>

        <button
          onClick={handleClose}
          className="w-full bg-gray-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-700 transition"
        >
          Close Window
        </button>
      </div>
    </div>
  );
}
