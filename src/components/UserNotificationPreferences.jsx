// src/components/UserNotificationPreferences.jsx
// Comprehensive user notification preferences management

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  toggleMasterSwitch,
  toggleChannel,
  toggleNotificationType,
  updateNotificationTypeChannel,
  updateQuietHours,
  muteClub,
  unmuteClub,
  muteTeam,
  unmuteTeam
} from '../firebase/userNotificationPreferences';
import { getUserClubs } from '../firebase/firestore';
import { useLanguage } from '../contexts/LanguageContext';

export default function UserNotificationPreferences() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { getCurrentPlan } = useSubscription();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState(null);
  const [userClubs, setUserClubs] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    events: true,
    waitlist: false,
    substitution: false,
    orders: false,
    chat: false,
    userMgmt: false,
    announcements: false
  });

  const currentPlan = getCurrentPlan();
  const isPremium = currentPlan !== 'free';
  const { t } = useLanguage();

  // Load preferences and user clubs
  useEffect(() => {
    loadPreferences();
    loadUserClubs();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const prefs = await getUserNotificationPreferences(user.id);
      setPreferences(prefs);
    } catch (error) {
      console.error(t('usernotifpref.errorLoadingPreferences'), error);
      showToast(t('usernotifpref.failedToLoadPreferences'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadUserClubs = async () => {
    if (!user) return;
    
    try {
      const clubs = await getUserClubs(user.id);
      setUserClubs(clubs);
    } catch (error) {
      console.error(t('usernotifpref.errorLoadingClubs'), error);
    }
  };

  const handleToggleMaster = async (enabled) => {
    try {
      await toggleMasterSwitch(user.id, enabled);
      setPreferences(prev => ({ ...prev, masterEnabled: enabled }));
      showToast(enabled ? `✅ ${t('usernotifpref.notificationsEnabled')}` : `🔕 ${t('usernotifpref.notificationsDisabled')}`, 'success');
    } catch (error) {
      showToast(t('usernotifpref.failedToUpdateSetting'), 'error');
    }
  };

  const handleToggleChannel = async (channel, enabled) => {
    // Check premium requirement for SMS/Call
    if ((channel === 'sms' || channel === 'call') && !isPremium) {
      showToast(t('usernotifpref.smsCallRequiresPremium'), 'error');
      return;
    }
    
    try {
      await toggleChannel(user.id, channel, enabled);
      setPreferences(prev => ({
        ...prev,
        channels: { ...prev.channels, [channel]: enabled }
      }));
      showToast(`${channel.toUpperCase()} ${enabled ? t('usernotifpref.enabled') : t('usernotifpref.disabled')}`, 'success');
    } catch (error) {
      showToast(t('usernotifpref.failedToUpdateChannel'), 'error');
    }
  };

  const handleToggleNotificationType = async (type, enabled) => {
    try {
      await toggleNotificationType(user.id, type, enabled);
      setPreferences(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          [type]: { ...prev.preferences[type], enabled }
        }
      }));
    } catch (error) {
      showToast(t('usernotifpref.failedToUpdatePreference'), 'error');
    }
  };

  const handleToggleTypeChannel = async (type, channel, enabled) => {
    try {
      await updateNotificationTypeChannel(user.id, type, channel, enabled);
      setPreferences(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          [type]: { ...prev.preferences[type], [channel]: enabled }
        }
      }));
    } catch (error) {
      showToast(t('usernotifpref.failedToUpdateChannel'), 'error');
    }
  };

  const handleUpdateQuietHours = async (config) => {
    try {
      setSaving(true);
      await updateQuietHours(user.id, config);
      setPreferences(prev => ({ ...prev, quietHours: config }));
      showToast(t('usernotifpref.quietHoursUpdated'), 'success');
    } catch (error) {
      showToast(t('usernotifpref.failedToUpdateQuietHours'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMuteClub = async (clubId, mute) => {
    try {
      if (mute) {
        await muteClub(user.id, clubId);
      } else {
        await unmuteClub(user.id, clubId);
      }
      setPreferences(prev => ({
        ...prev,
        mutedClubs: mute
          ? [...(prev.mutedClubs || []), clubId]
          : (prev.mutedClubs || []).filter(id => id !== clubId)
      }));
      showToast(mute ? t('usernotifpref.clubMuted') : t('usernotifpref.clubUnmuted'), 'success');
    } catch (error) {
      showToast(t('usernotifpref.failedToUpdateClubMuteStatus'), 'error');
    }
  };

  const handleMuteTeam = async (teamId, mute) => {
    try {
      if (mute) {
        await muteTeam(user.id, teamId);
      } else {
        await unmuteTeam(user.id, teamId);
      }
      setPreferences(prev => ({
        ...prev,
        mutedTeams: mute
          ? [...(prev.mutedTeams || []), teamId]
          : (prev.mutedTeams || []).filter(id => id !== teamId)
      }));
      showToast(mute ? t('usernotifpref.teamMuted') : t('usernotifpref.teamUnmuted'), 'success');
    } catch (error) {
      showToast(t('usernotifpref.failedToUpdateTeamMuteStatus'), 'error');
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // UI Components
  const ToggleSwitch = ({ enabled, onChange, disabled = false }) => (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300
        focus:outline-none focus:ring-2 focus:ring-primary/50
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

  const ChannelIcon = ({ channel, enabled }) => {
    const icons = {
      push: enabled ? '🔔' : '🔕',
      email: enabled ? '📧' : '📪',
      sms: enabled ? '📱' : '📵',
      call: enabled ? '📞' : '☎️'
    };
    return <span className="text-lg">{icons[channel]}</span>;
  };

  const NotificationTypeRow = ({ type, label, description, icon }) => {
    const typePref = preferences?.preferences?.[type] || {};
    const isEnabled = typePref.enabled !== false;

    return (
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        {/* Main Toggle */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-2xl">{icon}</span>
            <div>
              <div className="text-light font-medium">{label}</div>
              <div className="text-light/50 text-xs">{description}</div>
            </div>
          </div>
          <ToggleSwitch
            enabled={isEnabled}
            onChange={() => handleToggleNotificationType(type, !isEnabled)}
            disabled={!preferences?.masterEnabled}
          />
        </div>

        {/* Channel Toggles */}
        {isEnabled && preferences?.masterEnabled && (
          <div className="ml-11 flex gap-4 pt-2 border-t border-white/5">
            {['push', 'email', 'sms', 'call'].map(channel => {
              const channelEnabled = typePref[channel] !== false;
              const globalChannelEnabled = preferences?.channels?.[channel];
              const isPremiumChannel = channel === 'sms' || channel === 'call';
              const canUse = !isPremiumChannel || isPremium;

              return (
                <div key={channel} className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleTypeChannel(type, channel, !channelEnabled)}
                    disabled={!globalChannelEnabled || !canUse}
                    className={`
                      p-2 rounded-lg border transition-all
                      ${channelEnabled && globalChannelEnabled && canUse
                        ? 'bg-primary/20 border-primary/50'
                        : 'bg-white/5 border-white/10'}
                      ${!globalChannelEnabled || !canUse
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:border-primary cursor-pointer'}
                    `}
                    title={!canUse ? t('usernotifpref.premiumOnly') : !globalChannelEnabled ? `${channel} ${t('usernotifpref.disabledGlobally')}` : channel}
                  >
                    <ChannelIcon channel={channel} enabled={channelEnabled && canUse} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const CollapsibleSection = ({ id, title, icon, children }) => {
    const isExpanded = expandedSections[id];
    
    return (
      <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <span className="text-light font-semibold text-lg">{title}</span>
          </div>
          <span className="text-light/60 text-xl">{isExpanded ? '▼' : '▶'}</span>
        </button>
        
        {isExpanded && (
          <div className="p-4 pt-0 space-y-3">
            {children}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="text-light/60 text-center py-8">
        {t('usernotifpref.failedToLoadPreferencesRefresh')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Master Switch */}
      <div className="bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-primary/50 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-light mb-2">{t('usernotifpref.masterNotificationSwitch')}</h3>
            <p className="text-light/70">
              {preferences.masterEnabled
                ? `✅ ${t('usernotifpref.notificationsAreEnabled')}`
                : `🔕 ${t('usernotifpref.allNotificationsDisabled')}`}
            </p>
          </div>
          <ToggleSwitch
            enabled={preferences.masterEnabled}
            onChange={() => handleToggleMaster(!preferences.masterEnabled)}
          />
        </div>
      </div>

      {/* Global Channel Toggles */}
      {preferences.masterEnabled && (
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-bold text-light mb-4">{t('usernotifpref.notificationChannels')}</h3>
          <p className="text-light/60 text-sm mb-4">{t('usernotifpref.enableDisableChannels')}</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: 'push', label: t('usernotifpref.pushNotifications'), icon: '🔔', premium: false },
              { key: 'email', label: t('usernotifpref.email'), icon: '📧', premium: false },
              { key: 'sms', label: t('usernotifpref.sms'), icon: '📱', premium: true },
              { key: 'call', label: t('usernotifpref.voiceCall'), icon: '📞', premium: true }
            ].map(({ key, label, icon, premium }) => {
              const enabled = preferences.channels?.[key];
              const canUse = !premium || isPremium;
              
              return (
                <div
                  key={key}
                  className={`
                    p-4 rounded-lg border-2 transition-all
                    ${enabled && canUse
                      ? 'bg-primary/20 border-primary'
                      : 'bg-white/5 border-white/10'}
                    ${!canUse ? 'opacity-60' : ''}
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{icon}</span>
                    <ToggleSwitch
                      enabled={enabled}
                      onChange={() => handleToggleChannel(key, !enabled)}
                      disabled={!canUse}
                    />
                  </div>
                  <div className="text-light font-medium text-sm">{label}</div>
                  {premium && !isPremium && (
                    <div className="text-accent text-xs mt-1">{t('usernotifpref.premiumOnly')}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Notification Types */}
      {preferences.masterEnabled && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-light">{t('usernotifpref.notificationTypes')}</h3>
          <p className="text-light/60 text-sm">{t('usernotifpref.customizeNotifications')}</p>

          {/* Events */}
          <CollapsibleSection id="events" title={t('usernotifpref.eventNotifications')} icon="📅">
            <NotificationTypeRow
              type="eventCreated"
              label={t('usernotifpref.newEventCreated')}
              description={t('usernotifpref.newEventCreatedDesc')}
              icon="✨"
            />
            <NotificationTypeRow
              type="eventModified"
              label={t('usernotifpref.eventModified')}
              description={t('usernotifpref.eventModifiedDesc')}
              icon="📝"
            />
            <NotificationTypeRow
              type="eventDeleted"
              label={t('usernotifpref.eventDeleted')}
              description={t('usernotifpref.eventDeletedDesc')}
              icon="🗑️"
            />
            <NotificationTypeRow
              type="eventCancelled"
              label={t('usernotifpref.eventCancelled')}
              description={t('usernotifpref.eventCancelledDesc')}
              icon="❌"
            />
            <NotificationTypeRow
              type="eventReminder"
              label={t('usernotifpref.eventReminders')}
              description={t('usernotifpref.eventRemindersDesc')}
              icon="⏰"
            />
            <NotificationTypeRow
              type="lockPeriodStarted"
              label={t('usernotifpref.lockPeriodStarted')}
              description={t('usernotifpref.lockPeriodStartedDesc')}
              icon="🔒"
            />
          </CollapsibleSection>

          {/* Waitlist */}
          <CollapsibleSection id="waitlist" title={t('usernotifpref.waitlistNotifications')} icon="⏳">
            <NotificationTypeRow
              type="freeSpotAvailable"
              label={t('usernotifpref.freeSpotAvailable')}
              description={t('usernotifpref.freeSpotAvailableDesc')}
              icon="🎉"
            />
            <NotificationTypeRow
              type="waitlistPositionChange"
              label={t('usernotifpref.positionChange')}
              description={t('usernotifpref.positionChangeDesc')}
              icon="📈"
            />
          </CollapsibleSection>

          {/* Substitution */}
          <CollapsibleSection id="substitution" title={t('usernotifpref.substitutionNotifications')} icon="🔄">
            <NotificationTypeRow
              type="substitutionRequest"
              label={t('usernotifpref.substitutionRequest')}
              description={t('usernotifpref.substitutionRequestDesc')}
              icon="🤝"
            />
            <NotificationTypeRow
              type="substitutionCompleted"
              label={t('usernotifpref.substitutionConfirmed')}
              description={t('usernotifpref.substitutionConfirmedDesc')}
              icon="✅"
            />
          </CollapsibleSection>

          {/* Orders */}
          <CollapsibleSection id="orders" title={t('usernotifpref.orderNotifications')} icon="🛒">
            <NotificationTypeRow
              type="orderCreated"
              label={t('usernotifpref.newOrderAvailable')}
              description={t('usernotifpref.newOrderAvailableDesc')}
              icon="📦"
            />
            <NotificationTypeRow
              type="orderDeadline"
              label={t('usernotifpref.orderDeadlineReminder')}
              description={t('usernotifpref.orderDeadlineReminderDesc')}
              icon="⏰"
            />
          </CollapsibleSection>

          {/* Chat */}
          <CollapsibleSection id="chat" title={t('usernotifpref.chatNotifications')} icon="💬">
            <NotificationTypeRow
              type="newChatMessage"
              label={t('usernotifpref.newChatMessage')}
              description={t('usernotifpref.newChatMessageDesc')}
              icon="💬"
            />
          </CollapsibleSection>

          {/* User Management */}
          <CollapsibleSection id="userMgmt" title={t('usernotifpref.userManagement')} icon="👥">
            <NotificationTypeRow
              type="userAdded"
              label={t('usernotifpref.addedToClubTeam')}
              description={t('usernotifpref.addedToClubTeamDesc')}
              icon="➕"
            />
            <NotificationTypeRow
              type="userRemoved"
              label={t('usernotifpref.removedFromClubTeam')}
              description={t('usernotifpref.removedFromClubTeamDesc')}
              icon="➖"
            />
            <NotificationTypeRow
              type="roleChanged"
              label={t('usernotifpref.roleChanged')}
              description={t('usernotifpref.roleChangedDesc')}
              icon="⭐"
            />
          </CollapsibleSection>

          {/* Announcements */}
          <CollapsibleSection id="announcements" title={t('usernotifpref.announcements')} icon="📢">
            <NotificationTypeRow
              type="clubAnnouncement"
              label={t('usernotifpref.clubAnnouncements')}
              description={t('usernotifpref.clubAnnouncementsDesc')}
              icon="🏛️"
            />
            <NotificationTypeRow
              type="teamAnnouncement"
              label={t('usernotifpref.teamAnnouncements')}
              description={t('usernotifpref.teamAnnouncementsDesc')}
              icon="👥"
            />
          </CollapsibleSection>
        </div>
      )}

      {/* Quiet Hours */}
      {preferences.masterEnabled && (
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-light">{t('usernotifpref.quietHours')}</h3>
              <p className="text-light/60 text-sm">{t('usernotifpref.quietHoursDesc')}</p>
            </div>
            <ToggleSwitch
              enabled={preferences.quietHours?.enabled}
              onChange={() => handleUpdateQuietHours({
                ...preferences.quietHours,
                enabled: !preferences.quietHours?.enabled
              })}
            />
          </div>

          {preferences.quietHours?.enabled && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-light/80 text-sm mb-2">{t('usernotifpref.startTime')}</label>
                  <input
                    type="time"
                    value={preferences.quietHours?.startTime || '22:00'}
                    onChange={(e) => handleUpdateQuietHours({
                      ...preferences.quietHours,
                      startTime: e.target.value
                    })}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light"
                  />
                </div>
                <div>
                  <label className="block text-light/80 text-sm mb-2">{t('usernotifpref.endTime')}</label>
                  <input
                    type="time"
                    value={preferences.quietHours?.endTime || '07:00'}
                    onChange={(e) => handleUpdateQuietHours({
                      ...preferences.quietHours,
                      endTime: e.target.value
                    })}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light"
                  />
                </div>
              </div>
              
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-blue-400 text-sm">
                  {`ℹ️ ${t('usernotifpref.criticalNotificationsNote')}`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mute Clubs/Teams */}
      {preferences.masterEnabled && userClubs.length > 0 && (
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-bold text-light mb-4">{t('usernotifpref.muteClubsTeams')}</h3>
          <p className="text-light/60 text-sm mb-4">{t('usernotifpref.muteClubsTeamsDesc')}</p>

          <div className="space-y-3">
            {userClubs.map(club => {
              const isClubMuted = preferences.mutedClubs?.includes(club.id);
              
              return (
                <div key={club.id} className="space-y-2">
                  {/* Club Toggle */}
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🏛️</span>
                      <span className="text-light font-medium">{club.name}</span>
                    </div>
                    <ToggleSwitch
                      enabled={!isClubMuted}
                      onChange={() => handleMuteClub(club.id, !isClubMuted)}
                    />
                  </div>

                  {/* Teams within club */}
                  {!isClubMuted && club.teams && club.teams.length > 0 && (
                    <div className="ml-8 space-y-2">
                      {club.teams.map(team => {
                        const isTeamMuted = preferences.mutedTeams?.includes(team.id);
                        
                        return (
                          <div key={team.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/10">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">👥</span>
                              <span className="text-light/80 text-sm">{team.name}</span>
                            </div>
                            <ToggleSwitch
                              enabled={!isTeamMuted}
                              onChange={() => handleMuteTeam(team.id, !isTeamMuted)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-blue-400 font-semibold mb-2 flex items-center gap-2">
          <span>ℹ️</span>
          <span>{t('usernotifpref.howNotificationPreferencesWork')}</span>
        </h4>
        <ul className="text-light/70 text-sm space-y-1.5">
          <li>• <strong>{t('usernotifpref.masterSwitch')}</strong> {t('usernotifpref.masterSwitchDesc')}</li>
          <li>• <strong>{t('usernotifpref.channels')}</strong> {t('usernotifpref.channelsDesc')}</li>
          <li>• <strong>{t('usernotifpref.perTypeSettings')}</strong> {t('usernotifpref.perTypeSettingsDesc')}</li>
          <li>• <strong>{t('usernotifpref.yourPreferencesOverride')}</strong> {t('usernotifpref.yourPreferencesOverrideDesc')}</li>
          <li>• <strong>{t('usernotifpref.quietHoursNote')}</strong> {t('usernotifpref.quietHoursNoteDesc')}</li>
          <li>• <strong>{t('usernotifpref.mutedClubsTeams')}</strong> {t('usernotifpref.mutedClubsTeamsDesc')}</li>
        </ul>
      </div>
    </div>
  );
}
