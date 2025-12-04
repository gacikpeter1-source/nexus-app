// src/components/NotificationSettings.jsx
import { useNotifications } from '../contexts/NotificationContext';

export default function NotificationSettings() {
  const { 
    notificationPermission, 
    requestPermission, 
    isNotificationsEnabled 
  } = useNotifications();

  // Permission denied by user
  if (notificationPermission === 'denied') {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">🔕</div>
          <div className="flex-1">
            <h3 className="text-red-400 font-semibold text-lg mb-2">
              Notifications Blocked
            </h3>
            <p className="text-light/70 text-sm mb-3">
              You have blocked notifications for this site. To receive notifications about events, orders, and updates, you'll need to enable them in your browser settings.
            </p>
            <details className="text-light/60 text-sm">
              <summary className="cursor-pointer text-red-400 hover:text-red-300 mb-2">
                How to enable notifications
              </summary>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Click the lock icon in your browser's address bar</li>
                <li>Find "Notifications" in the permissions list</li>
                <li>Change from "Block" to "Allow"</li>
                <li>Refresh this page</li>
              </ol>
            </details>
          </div>
        </div>
      </div>
    );
  }

  // Notifications already enabled
  if (isNotificationsEnabled) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">🔔</div>
          <div className="flex-1">
            <h3 className="text-green-400 font-semibold text-lg mb-2">
              Notifications Enabled
            </h3>
            <p className="text-light/70 text-sm mb-3">
              You'll receive notifications for:
            </p>
            <ul className="space-y-2 text-light/60 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>New events in your clubs and teams</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>Event changes and cancellations</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>New orders waiting for review</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>Order deadline reminders</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>Attendance updates</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Notifications not enabled yet - show enable button
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/[0.07] transition-colors">
      <div className="flex items-start gap-4">
        <div className="text-3xl">🔔</div>
        <div className="flex-1">
          <h3 className="text-light font-semibold text-lg mb-2">
            Enable Push Notifications
          </h3>
          <p className="text-light/70 text-sm mb-4">
            Stay updated with real-time notifications about events, orders, and important updates in your clubs and teams.
          </p>
          
          <div className="bg-white/5 rounded-lg p-4 mb-4">
            <p className="text-light/60 text-sm mb-2 font-semibold">You'll be notified about:</p>
            <ul className="space-y-1.5 text-light/60 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-primary">📅</span>
                <span>New events created in your clubs/teams</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">📝</span>
                <span>Changes to events you're attending</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">❌</span>
                <span>Cancelled events</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">🛒</span>
                <span>New orders (if you're an admin)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">⏰</span>
                <span>Order deadline reminders</span>
              </li>
            </ul>
          </div>

          <button
            onClick={requestPermission}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-primary to-accent text-white font-semibold rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <span className="text-xl">🔔</span>
            <span>Enable Notifications</span>
          </button>

          <p className="text-light/40 text-xs mt-3">
            You can disable notifications at any time in your browser settings.
          </p>
        </div>
      </div>
    </div>
  );
}
