// src/components/NotificationsTab.jsx
// Notification settings management for Club Management view

import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import {
  getNotificationSettings,
  updateNotificationSettings,
  getDefaultNotificationSettings
} from '../firebase/notificationSettings';
import { useLanguage } from '../contexts/LanguageContext';

export default function NotificationsTab({ clubId, clubTeams, userRole }) {
  const { showToast } = useToast();
  const [selectedScope, setSelectedScope] = useState('club'); // 'club' or team ID
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { t } = useLanguage();
  // Notification settings state
  const [settings, setSettings] = useState(getDefaultNotificationSettings());

  // Load settings when scope changes
  useEffect(() => {
    loadSettings();
  }, [clubId, selectedScope]);

  const loadSettings = async () => {
    if (!clubId) return;
    
    setLoading(true);
    try {
      const teamId = selectedScope === 'club' ? null : selectedScope;
      const data = await getNotificationSettings(clubId, teamId);
      setSettings(data);
    } catch (error) {
      console.error('Error loading settings:', error);
      showToast('Failed to load notification settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const teamId = selectedScope === 'club' ? null : selectedScope;
      await updateNotificationSettings(clubId, teamId, settings);
      showToast('✅ ' + t('notifTab.settingsSaved'), t('notifTab.success'));
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (path, value) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      const parts = path.split('.');
      let current = newSettings;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      
      current[parts[parts.length - 1]] = value;
      return newSettings;
    });
  };

  const toggleSetting = (path) => {
    const parts = path.split('.');
    let current = settings;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        current = false;
        break;
      }
    }
    
    updateSetting(path, !current);
  };

  const ToggleSwitch = ({ enabled, onChange, disabled = false }) => (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300
        focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-dark
        ${enabled ? 'bg-green-500' : 'bg-white/30'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
      `}
    >
      <span
        className={`
          inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-300
          ${enabled ? 'translate-x-6' : 'translate-x-1'}
        `}
      />
    </button>
  );

  const SettingRow = ({ icon, label, settingPath, description }) => {
    const parts = settingPath.split('.');
    let isEnabled = settings;
    for (const part of parts) {
      if (isEnabled && typeof isEnabled === 'object' && part in isEnabled) {
        isEnabled = isEnabled[part];
      } else {
        isEnabled = false;
        break;
      }
    }

    return (
      <div className="flex items-center justify-between py-3 border-b border-white/5">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-xl">{icon}</span>
          <div>
            <div className="text-light font-medium text-sm">{label}</div>
            {description && (
              <div className="text-light/50 text-xs mt-0.5">{description}</div>
            )}
          </div>
        </div>
        <ToggleSwitch
          enabled={isEnabled}
          onChange={() => toggleSetting(settingPath)}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scope Selector */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <label className="block text-light text-sm font-medium mb-2">
        {t('notifTab.configureNotificationsFor')}
        </label>
        <select
          value={selectedScope}
          onChange={(e) => setSelectedScope(e.target.value)}
          className="w-full px-4 py-2 bg-dark border border-white/20 text-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="club">📋 {t('notifTab.entireClubDefault')}</option>
          {clubTeams.map(team => (
            <option key={team.id} value={team.id}>
              👥 {team.name}
            </option>
          ))}
        </select>
        <p className="text-light/50 text-xs mt-2">
          {selectedScope === 'club' 
            ? 'These settings apply to all teams unless overridden at team level'
            : 'These settings override club defaults for this team'}
        </p>
      </div>

      {/* Push Notifications Section */}
      <div className="bg-white/5 rounded-lg p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div>
              <h3 className="text-light font-bold text-lg">{t('notifTab.pushNotifications')}</h3>
              <p className="text-light/60 text-sm">{t('notifTab.sendToMobileDevices')}</p>
            </div>
          </div>
          <ToggleSwitch
            enabled={settings.push?.enabled || false}
            onChange={() => toggleSetting('push.enabled')}
          />
        </div>

        {settings.push?.enabled && (
          <div className="mt-4 pl-11 space-y-1">
            <h4 className="text-light/80 text-sm font-semibold mb-2">{t('notifTab.events')}</h4>
            <SettingRow
              icon="📅"
              label={t('notifTab.newEventsCreated')}
              settingPath="push.events.created"
              description="Notify when new events are created"
            />
            <SettingRow
              icon="📝"
              label={t('notifTab.eventsUpdated')}
              settingPath="push.events.updated"
              description="Notify when events are modified"
            />
            <SettingRow
              icon="❌"
              label={t('notifTab.eventsDeleted')}
              settingPath="push.events.deleted"
              description="Notify when events are cancelled"
            />

            <h4 className="text-light/80 text-sm font-semibold mb-2 mt-4">Orders</h4>
            <SettingRow
              icon="🛒"
              label={t('notifTab.newOrdersCreatedEmail')}
              settingPath="push.orders.created"
              description="Notify when new orders are available"
            />
            <SettingRow
              icon="⏰"
              label={t('notifTab.orderDeadlinesEmail')}
              settingPath="push.orders.deadline"
              description="Remind about upcoming order deadlines"
            />
          </div>
        )}
      </div>

      {/* Email Notifications Section */}
      <div className="bg-white/5 rounded-lg p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📧</span>
            <div>
              <h3 className="text-light font-bold text-lg">{t('notifTab.emailNotifications')}</h3>
              <p className="text-light/60 text-sm">{t('notifTab.sendViaEmail')}</p>
            </div>
          </div>
          <ToggleSwitch
            enabled={settings.email?.enabled || false}
            onChange={() => toggleSetting('email.enabled')}
          />
        </div>

        {settings.email?.enabled && (
          <div className="mt-4 pl-11 space-y-1">
            <h4 className="text-light/80 text-sm font-semibold mb-2">{t('notifTab.events')}</h4>
            <SettingRow
              icon="📅"
              label={t('notifTab.newEventsCreated')}
              settingPath="email.events.created"
              description="Send email when new events are created"
            />
            <SettingRow
              icon="📝"
              label={t('notifTab.eventsUpdated')}
              settingPath="email.events.updated"
              description="Send email when events are modified"
            />
            <SettingRow
              icon="❌"
              label={t('notifTab.eventsDeleted')}
              settingPath="email.events.deleted"
              description="Send email when events are cancelled"
            />

            <h4 className="text-light/80 text-sm font-semibold mb-2 mt-4">Orders</h4>
            <SettingRow
              icon="🛒"
              label={t('notifTab.newOrdersCreated')}
              settingPath="email.orders.created"
              description="Send email when new orders are available"
            />
            <SettingRow
              icon="⏰"
              label={t('notifTab.orderDeadlinesEmail')} 
              settingPath="email.orders.deadline"
              description="Send email reminders about deadlines"
            />
          </div>
        )}
      </div>

      {/* Action Required Section */}
      <div className="bg-white/5 rounded-lg p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h3 className="text-light font-bold text-lg">{t('notifTab.actionRequiredNotifications')}</h3>
              <p className="text-light/60 text-sm">{t('notifTab.persistentNotifications')}</p>
            </div>
          </div>
          <ToggleSwitch
            enabled={settings.actionRequired?.enabled || false}
            onChange={() => toggleSetting('actionRequired.enabled')}
          />
        </div>

        {settings.actionRequired?.enabled && (
          <div className="mt-4 pl-11">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-light/80 text-sm mb-2">
                <strong>{t('notifTab.actionRequiredDesc')}</strong>
              </p>
              <ul className="text-light/60 text-sm space-y-1.5 list-disc list-inside">
                <li>{t('notifTab.stayVisibleUntilResponse')}</li>
                <li>{t('notifTab.includeActionButtons')}</li>
                <li>{t('notifTab.perfectFor')}</li>
                <li>{t('notifTab.autoExpireAfterDeadline')}</li>
              </ul>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-light/70 text-sm font-medium">{t('notifTab.sendFor')}</p>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="action-event-attendance"
                  checked={settings.actionRequired?.types?.includes('event_attendance') || false}
                  onChange={(e) => {
                    const types = settings.actionRequired?.types || [];
                    const newTypes = e.target.checked
                      ? [...types, 'event_attendance']
                      : types.filter(t => t !== 'event_attendance');
                    updateSetting('actionRequired.types', newTypes);
                  }}
                  className="w-4 h-4 rounded bg-dark border-white/20 text-primary focus:ring-2 focus:ring-primary"
                />
                <label htmlFor="action-event-attendance" className="text-light/70 text-sm cursor-pointer">
                  📅 {t('notifTab.eventAttendanceConfirmations')}
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="action-order-response"
                  checked={settings.actionRequired?.types?.includes('order_response') || false}
                  onChange={(e) => {
                    const types = settings.actionRequired?.types || [];
                    const newTypes = e.target.checked
                      ? [...types, 'order_response']
                      : types.filter(t => t !== 'order_response');
                    updateSetting('actionRequired.types', newTypes);
                  }}
                  className="w-4 h-4 rounded bg-dark border-white/20 text-primary focus:ring-2 focus:ring-primary"
                />
                <label htmlFor="action-order-response" className="text-light/70 text-sm cursor-pointer">
                  🛒 {t('notifTab.orderResponseRequests')}
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-primary to-accent text-white font-semibold rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : '💾 Save Settings'}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-blue-400 font-semibold mb-2 flex items-center gap-2">
          <span>ℹ️</span>
          <span>{t('notifTab.howItWorks')}</span>
        </h4>
        <ul className="text-light/70 text-sm space-y-1.5">
          <li>• <strong>Club Settings:</strong> {t('notifTab.applyToAllTeams')}</li>
          <li>• <strong>Team Settings:</strong> {t('notifTab.overrideClubSettings')}</li>
          <li>• <strong>Push & Email:</strong> {t('notifTab.canBeConfiguredIndependently')}</li>
          <li>• <strong>Users control:</strong> {t('notifTab.usersCanDisable')}</li>
          <li>• <strong>Action Required:</strong> {t('notifTab.createsInteractiveNotifications')}</li>
        </ul>
      </div>
    </div>
  );
}
