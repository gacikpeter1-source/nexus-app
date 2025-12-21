// src/main.jsx - FIXED: All providers in one place
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App.jsx';
import './index.css';

// Import ALL Contexts
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import { ChatProvider } from './contexts/ChatContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Configure React Query with better defaults
const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        {/* ✅ SINGLE provider hierarchy - no duplicates */}
        <AuthProvider>
          <SubscriptionProvider>
            <LanguageProvider>
              <ToastProvider>
                <ChatProvider>
                  <NotificationProvider>
                    <App />
                  </NotificationProvider>
                </ChatProvider>
              </ToastProvider>
            </LanguageProvider>
          </SubscriptionProvider>
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
