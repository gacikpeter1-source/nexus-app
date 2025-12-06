// src/pages/CompleteRegistration.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const CompleteRegistration = () => {
  const [searchParams] = useSearchParams();
  const verified = searchParams.get('verified');

  const handleClose = () => {
    // Close the current tab/window
    window.close();
    
    // Fallback: if window.close() doesn't work (some browsers block it)
    // Show a message
    setTimeout(() => {
      alert('Please close this tab and return to the registration page');
    }, 100);
  };

  if (verified === 'true') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">✅ Email Verified!</h2>
          <p className="text-gray-600 mb-6">Your email has been successfully verified.</p>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800">
              You can now return to the registration page and login with your credentials.
            </p>
          </div>

          <button
            onClick={handleClose}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition shadow-lg hover:shadow-xl"
          >
            OK - Close This Window
          </button>
          
          <p className="text-xs text-gray-500 mt-4">
            This window will close automatically
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
        <p className="text-gray-600 mb-4">Invalid verification link</p>
        <button
          onClick={handleClose}
          className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition"
        >
          Close Window
        </button>
      </div>
    </div>
  );
};

export default CompleteRegistration;