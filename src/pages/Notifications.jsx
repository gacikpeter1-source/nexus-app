// src/pages/Notifications.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications
} from '../firebase/notifications';

export default function Notifications() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'unread'
  
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);
  
  const loadNotifications = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading notifications for user:', user.id);
      const notifs = await getUserNotifications(user.id);
      console.log('✅ Loaded notifications:', notifs.length, notifs);
      setNotifications(notifs);
    } catch (error) {
      console.error('❌ Error loading notifications:', error);
      console.error('Error details:', error.code, error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
      setNotifications(notifications.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      ));
    }
    
    // Navigate to action URL if exists
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };
  
  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead(user.id);
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };
  
  const handleDeleteNotification = async (notificationId, e) => {
    e.stopPropagation();
    
    if (!window.confirm('Delete this notification?')) return;
    
    try {
      await deleteNotification(notificationId);
      setNotifications(notifications.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };
  
  const handleClearAll = async () => {
    if (!window.confirm('Delete all notifications? This cannot be undone.')) return;
    
    try {
      await deleteAllNotifications(user.id);
      setNotifications([]);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };
  
  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications;
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  const getNotificationIcon = (type) => {
    const icons = {
      event: '📅',
      chat: '💬',
      waitlist: '⏰',
      order: '📦',
      announcement: '📢',
      team: '👥',
      club: '🏠',
      user: '👤',
    };
    return icons[type] || '🔔';
  };
  
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };
  
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-bg via-mid-dark to-dark-bg flex items-center justify-center">
        <div className="text-light/60">Please log in to view notifications</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-mid-dark to-dark-bg p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-light flex items-center gap-3 mb-2">
            <span>🔔</span>
            Notifications
          </h1>
          <p className="text-light/60">
            View and manage your notifications (saved for 7 days)
          </p>
        </div>
        
        {/* Action Bar */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Filter Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filter === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-white/10 text-light/70 hover:bg-white/20'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filter === 'unread'
                    ? 'bg-primary text-white'
                    : 'bg-white/10 text-light/70 hover:bg-white/20'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>
            
            {/* Actions */}
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg font-medium transition-all"
                >
                  ✓ Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium transition-all"
                >
                  🗑️ Clear all
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Notifications List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-light/60">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">🔔</div>
            <h3 className="text-xl font-semibold text-light mb-2">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-light/60">
              {filter === 'unread' 
                ? 'You\'re all caught up!' 
                : 'You\'ll see notifications here when you receive them'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`
                  bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4
                  hover:bg-white/10 transition-all cursor-pointer group
                  ${!notification.read ? 'border-l-4 border-l-primary bg-primary/5' : ''}
                `}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0
                    ${!notification.read ? 'bg-primary/20' : 'bg-white/10'}
                  `}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-semibold ${!notification.read ? 'text-light' : 'text-light/70'}`}>
                          {notification.title}
                        </h4>
                        {/* Message count badge for chat notifications */}
                        {notification.type === 'chat' && notification.messageCount > 1 && (
                          <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 bg-primary rounded-full text-xs font-bold text-white">
                            {notification.messageCount}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-light/50 whitespace-nowrap">
                        {formatTimeAgo(notification.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-light/60 mb-2">
                      {notification.body}
                    </p>
                    
                    {/* Unread indicator */}
                    {!notification.read && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary">
                        <span className="w-2 h-2 bg-primary rounded-full"></span>
                        Unread
                      </span>
                    )}
                  </div>
                  
                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDeleteNotification(notification.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 rounded-lg transition-all text-red-400"
                    title="Delete notification"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

