// src/components/ScraperConfigModal.jsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../contexts/ToastContext';
import { saveScraperConfig, getScraperConfig } from '../firebase/firestore';

export default function ScraperConfigModal({ clubId, team, onClose, onSave }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [config, setConfig] = useState({
    enabled: false,
    provider: 'custom', // 'custom', 'sportspress', 'leaguevine', etc.
    url: '',
    teamIdentifier: '',
    autoSync: false,
    syncFrequency: 'daily', // 'hourly', 'daily', 'weekly'
    lastSyncAt: null
  });

  useEffect(() => {
    loadConfig();
  }, [clubId, team?.id]);

  async function loadConfig() {
    if (!clubId || !team?.id) return;
    
    try {
      setLoading(true);
      const savedConfig = await getScraperConfig(clubId, team.id);
      if (savedConfig) {
        setConfig(savedConfig);
      }
    } catch (error) {
      console.error('Error loading scraper config:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (config.enabled && !config.url) {
      showToast('Please enter a league URL', 'error');
      return;
    }

    try {
      setSaving(true);
      await saveScraperConfig(clubId, team.id, config);
      showToast('Scraper configuration saved!', 'success');
      onSave?.();
      onClose();
    } catch (error) {
      console.error('Error saving config:', error);
      showToast('Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return createPortal(
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center" 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)'
        }}
      >
        <div className="bg-mid-dark border border-white/20 rounded-xl p-8 max-w-2xl w-full mx-4">
          <div className="text-center text-light/60">Loading configuration...</div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 overflow-y-auto" 
      style={{ 
        position: 'fixed', 
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div className="bg-mid-dark border border-white/20 rounded-xl max-w-2xl w-full my-8 relative">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-title text-2xl text-light">League Scraper Configuration</h3>
              <p className="text-sm text-light/60 mt-1">Auto-sync games from league website for {team?.name}</p>
            </div>
            <button
              onClick={onClose}
              className="text-light/60 hover:text-light transition-colors text-2xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Enable Scraper */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
            <div>
              <label className="font-medium text-light">Enable Auto-Sync</label>
              <p className="text-xs text-light/60 mt-1">Automatically fetch games from league website</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.enabled ? 'bg-primary' : 'bg-white/20'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">
              League Provider
            </label>
            <select
              value={config.provider}
              onChange={(e) => setConfig({ ...config, provider: e.target.value })}
              className="w-full bg-dark border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              disabled={!config.enabled}
            >
              <option value="custom">Custom URL</option>
              <option value="sportspress">SportsPress</option>
              <option value="teamsnap">TeamSnap</option>
              <option value="leaguevine">Leaguevine</option>
              <option value="sportninja">SportNinja</option>
            </select>
          </div>

          {/* League URL */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">
              League Schedule URL <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={config.url}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
              placeholder="https://example.com/league/schedule"
              className="w-full bg-dark border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              disabled={!config.enabled}
            />
            <p className="text-xs text-light/50 mt-1">
              Enter the public URL of your league's schedule page
            </p>
          </div>

          {/* Team Identifier */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">
              Team Identifier (Optional)
            </label>
            <input
              type="text"
              value={config.teamIdentifier}
              onChange={(e) => setConfig({ ...config, teamIdentifier: e.target.value })}
              placeholder="e.g., team-123, SKC Košice"
              className="w-full bg-dark border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              disabled={!config.enabled}
            />
            <p className="text-xs text-light/50 mt-1">
              Team name or ID as it appears on the league website
            </p>
          </div>

          {/* Auto Sync Settings */}
          <div className="space-y-4 p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-light">Automatic Sync</label>
                <p className="text-xs text-light/60 mt-1">Sync games automatically on a schedule</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, autoSync: !config.autoSync })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.autoSync ? 'bg-primary' : 'bg-white/20'
                } ${!config.enabled && 'opacity-50 cursor-not-allowed'}`}
                disabled={!config.enabled}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.autoSync ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {config.autoSync && (
              <div>
                <label className="block text-sm font-medium text-light/80 mb-2">
                  Sync Frequency
                </label>
                <select
                  value={config.syncFrequency}
                  onChange={(e) => setConfig({ ...config, syncFrequency: e.target.value })}
                  className="w-full bg-dark border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                  disabled={!config.enabled}
                >
                  <option value="hourly">Every Hour</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            )}

            {config.lastSyncAt && (
              <p className="text-xs text-light/50">
                Last synced: {new Date(config.lastSyncAt).toLocaleString()}
              </p>
            )}
          </div>

          {/* Info Banner */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <span className="text-2xl">ℹ️</span>
              <div>
                <p className="text-blue-300 text-sm font-medium">How it works</p>
                <ul className="text-blue-200/80 text-xs mt-2 space-y-1 list-disc list-inside">
                  <li>Scraped games appear with a "🌐 Scraped" badge</li>
                  <li>Manual games you create are always preserved</li>
                  <li>Conflicts are highlighted for manual review</li>
                  <li>You can override any scraped game data</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || (config.enabled && !config.url)}
            className="flex-1 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg font-medium transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

