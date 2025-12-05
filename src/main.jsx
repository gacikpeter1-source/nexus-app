// src/main.jsx - WITH SERVICE WORKER REGISTRATION
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App.jsx';
import './index.css';

// Import Contexts
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);

// ============================================
// Service Worker Registration (PWA + FCM)
// ============================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // 1. Register PWA Service Worker (for offline caching)
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('✅ PWA Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.log('❌ PWA Service Worker failed:', error);
      });

    // 2. Register Firebase Cloud Messaging Service Worker (for notifications)
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then((registration) => {
        console.log('✅ Firebase Messaging SW registered:', registration.scope);
      })
      .catch((error) => {
        console.error('❌ Firebase Messaging SW failed:', error);
      });
  });
}
