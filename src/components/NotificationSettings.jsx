// src/components/NotificationSettings.jsx - Entry point with link to detailed preferences
import { useState } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import UserNotificationPreferences from './UserNotificationPreferences';

export default function NotificationSettings() {
  const { 
    notificationPermission, 
    requestPermission, 
    isNotificationsEnabled,
    loading 
  } = useNotifications();
  
  const [showInfo, setShowInfo] = useState(false);
  const [showDetailedPreferences, setShowDetailedPreferences] = useState(false);

  // Handle toggle switch
  const handleToggle = async () => {
    if (notificationPermission === 'denied') {
      setShowInfo(true);
      return;
    }

    if (!isNotificationsEnabled) {
      await requestPermission();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔔</span>
          <span className="text-light text-sm">Push Notifications</span>
        </div>
        <div className="w-11 h-6 bg-white/20 rounded-full animate-pulse" />
      </div>
    );
  }

  // If detailed preferences view is active, show it
  if (showDetailedPreferences) {
    return (
      <div className="space-y-4">
        {/* Back Button */}
        <button
          onClick={() => setShowDetailedPreferences(false)}
          className="flex items-center gap-2 text-light/60 hover:text-light transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Profile</span>
        </button>
        
        {/* Detailed Preferences */}
        <UserNotificationPreferences />
      </div>
    );
  }

  return (
    <>
      {/* Quick Overview Card */}
      <div className="bg-white/5 rounded-lg p-6 border border-white/10">
        {/* Browser Push Permission Toggle */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {notificationPermission === 'denied' ? '🔕' : '🔔'}
            </span>
            <div>
              <div className="text-light font-semibold">Browser Push Notifications</div>
              <div className="text-light/60 text-sm">
                {isNotificationsEnabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Info Button */}
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-2 text-light/50 hover:text-light hover:bg-white/10 rounded-lg transition-all"
              aria-label="Information"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Toggle Switch */}
            <button
              onClick={handleToggle}
              disabled={notificationPermission === 'denied'}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300
                focus:outline-none focus:ring-2 focus:ring-primary/50
                ${isNotificationsEnabled ? 'bg-green-500' : 'bg-white/30'}
                ${notificationPermission === 'denied' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
              `}
              aria-label="Toggle notifications"
            >
              <span className={`
                inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-300
                ${isNotificationsEnabled ? 'translate-x-6' : 'translate-x-1'}
              `} />
            </button>
          </div>
        </div>

        {/* Link to Detailed Preferences */}
        <button
          onClick={() => setShowDetailedPreferences(true)}
          className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-primary/20 to-accent/20 
            border border-primary/30 rounded-lg hover:border-primary hover:from-primary/30 hover:to-accent/30 
            transition-all group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <div className="text-left">
              <div className="text-light font-semibold">Detailed Notification Preferences</div>
              <div className="text-light/60 text-sm">
                Customize per notification type, quiet hours, mute clubs & more
              </div>
            </div>
          </div>
          <svg className="w-6 h-6 text-primary group-hover:translate-x-1 transition-transform" 
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Quick Info */}
        {isNotificationsEnabled && (
          <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <p className="text-green-400 text-sm">
              ✅ You will receive push notifications. Click "Detailed Preferences" to customize which notifications you receive.
            </p>
          </div>
        )}
      </div>

      {/* Info Popup - Same as before */}
      {showInfo && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowInfo(false)}
          />
          
          {/* Popup */}
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-50 bg-gradient-to-br from-dark via-mid-dark to-dark border border-white/20 rounded-xl shadow-2xl p-6">
            {/* Close Button */}
            <button
              onClick={() => setShowInfo(false)}
              className="absolute top-4 right-4 text-light/60 hover:text-light transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="text-3xl">🔔</div>
              <h3 className="text-xl font-bold text-light">Push Notifications</h3>
            </div>

            {/* Content */}
            {notificationPermission === 'denied' ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 font-semibold mb-2">Notifications Blocked</p>
                <p className="text-light/70 text-sm mb-3">
                  To enable notifications:
                </p>
                <ol className="text-light/60 text-sm space-y-2 list-decimal list-inside">
                  <li>Click the lock icon 🔒 in your browser's address bar</li>
                  <li>Find "Notifications" in permissions</li>
                  <li>Change from "Block" to "Allow"</li>
                  <li>Refresh this page</li>
                </ol>
              </div>
            ) : isNotificationsEnabled ? (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <p className="text-green-400 font-semibold mb-2">✅ Notifications Enabled</p>
                  <p className="text-light/70 text-sm mb-3">
                    You will receive notifications for:
                  </p>
                  <ul className="space-y-1.5 text-light/60 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="text-green-400">•</span>
                      <span>New events in your clubs/teams</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-400">•</span>
                      <span>Event changes and updates</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-400">•</span>
                      <span>Event cancellations</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-400">•</span>
                      <span>New orders and deadlines</span>
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-blue-400 font-semibold mb-2">Stay Updated</p>
                  <p className="text-light/70 text-sm mb-3">
                    Enable notifications to receive updates about:
                  </p>
                  <ul className="space-y-1.5 text-light/60 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="text-blue-400">•</span>
                      <span>New events</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-blue-400">•</span>
                      <span>Event changes</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-blue-400">•</span>
                      <span>Cancellations</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-blue-400">•</span>
                      <span>Orders and reminders</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={async () => {
                    await handleToggle();
                    setShowInfo(false);
                  }}
                  className="w-full px-6 py-3 bg-gradient-to-r from-primary to-accent text-white font-semibold rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
                >
                  Enable Notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
