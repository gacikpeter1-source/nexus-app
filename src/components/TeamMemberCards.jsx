// src/components/TeamMemberCards.jsx
import { useState } from 'react';
import MemberCard from './MemberCard';

export default function TeamMemberCards({ 
  team, 
  members = [], 
  allUsers = [],
  userSubscription = 'free', // 'free', 'user', 'club', 'full'
  onUpdateTeamSettings,
  onMessage,
  onViewProfile
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [cardSettings, setCardSettings] = useState(team.cardSettings || {
    primaryColor: '#2563eb',
    secondaryColor: '#1e40af',
    accentColor: '#eab308',
    backgroundLayers: [],
    showBackgroundLayers: false
  });
  
  const [teamStats, setTeamStats] = useState(team.customStats || [
    { key: 'games', label: 'Games' },
    { key: 'attendance', label: 'Attend%' },
    { key: 'years', label: 'Years' }
  ]);

  const [editingStats, setEditingStats] = useState(false);
  const [newStat, setNewStat] = useState({ key: '', label: '' });

  // Combine member data with user data
  const enrichedMembers = members.map(memberId => {
    const userData = allUsers.find(u => u.id === memberId);
    if (!userData) return null;

    // Calculate stats (example - you can customize)
    const memberStats = {
      games: userData.stats?.gamesPlayed || 0,
      attendance: userData.stats?.attendanceRate || 0,
      years: userData.stats?.yearsInTeam || 0,
      // Add more stats as needed
      goals: userData.stats?.goals || 0,
      assists: userData.stats?.assists || 0,
      points: userData.stats?.points || 0
    };

    return {
      ...userData,
      stats: memberStats
    };
  }).filter(Boolean);

  // Check customization permissions
  const canCustomizeColors = userSubscription === 'club' || userSubscription === 'full';
  const canCustomizeLayers = userSubscription === 'full';

  // Save settings
  const handleSaveSettings = async () => {
    try {
      await onUpdateTeamSettings({
        cardSettings,
        customStats: teamStats
      });
      setShowSettings(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    }
  };

  // Add custom stat
  const handleAddStat = () => {
    if (!newStat.key || !newStat.label) return;
    if (teamStats.length >= 6) {
      alert('Maximum 6 statistics allowed');
      return;
    }
    setTeamStats([...teamStats, newStat]);
    setNewStat({ key: '', label: '' });
  };

  // Remove stat
  const handleRemoveStat = (index) => {
    setTeamStats(teamStats.filter((_, idx) => idx !== index));
  };

  return (
    <div>
      {/* Header with Settings Button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold text-light">Team Members</h3>
          <p className="text-light/60 text-sm mt-1">
            {enrichedMembers.length} member{enrichedMembers.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Customize Cards
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
          <h4 className="text-xl font-bold text-light mb-4">Card Customization</h4>

          {/* Subscription Notice */}
          {userSubscription === 'free' || userSubscription === 'user' ? (
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
              <p className="text-yellow-200 text-sm">
                ⚠️ Card customization requires Club or Full subscription
              </p>
            </div>
          ) : null}

          {/* Color Customization - Club & Full */}
          {canCustomizeColors && (
            <div className="mb-6">
              <h5 className="font-semibold text-light mb-3">Colors</h5>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-light/80 mb-2">Primary Color</label>
                  <input
                    type="color"
                    value={cardSettings.primaryColor}
                    onChange={(e) => setCardSettings({...cardSettings, primaryColor: e.target.value})}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm text-light/80 mb-2">Secondary Color</label>
                  <input
                    type="color"
                    value={cardSettings.secondaryColor}
                    onChange={(e) => setCardSettings({...cardSettings, secondaryColor: e.target.value})}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm text-light/80 mb-2">Accent Color</label>
                  <input
                    type="color"
                    value={cardSettings.accentColor}
                    onChange={(e) => setCardSettings({...cardSettings, accentColor: e.target.value})}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Background Layers - Full Only */}
          {canCustomizeLayers && (
            <div className="mb-6">
              <h5 className="font-semibold text-light mb-3">Background Layers (2-3 max)</h5>
              <div className="space-y-3">
                {cardSettings.backgroundLayers.map((layer, idx) => (
                  <div key={idx} className="flex gap-3 items-center bg-white/5 p-3 rounded">
                    <select
                      value={layer.type}
                      onChange={(e) => {
                        const newLayers = [...cardSettings.backgroundLayers];
                        newLayers[idx].type = e.target.value;
                        setCardSettings({...cardSettings, backgroundLayers: newLayers});
                      }}
                      className="bg-white/10 border border-white/20 rounded px-3 py-2 text-light"
                    >
                      <option value="image">Full Background</option>
                      <option value="badge">Badge/Logo</option>
                    </select>
                    <input
                      type="text"
                      value={layer.url}
                      onChange={(e) => {
                        const newLayers = [...cardSettings.backgroundLayers];
                        newLayers[idx].url = e.target.value;
                        setCardSettings({...cardSettings, backgroundLayers: newLayers});
                      }}
                      placeholder="Image URL"
                      className="flex-1 bg-white/10 border border-white/20 rounded px-3 py-2 text-light"
                    />
                    <button
                      onClick={() => {
                        const newLayers = cardSettings.backgroundLayers.filter((_, i) => i !== idx);
                        setCardSettings({...cardSettings, backgroundLayers: newLayers});
                      }}
                      className="px-3 py-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                
                {cardSettings.backgroundLayers.length < 3 && (
                  <button
                    onClick={() => {
                      setCardSettings({
                        ...cardSettings,
                        backgroundLayers: [...cardSettings.backgroundLayers, { type: 'badge', url: '' }]
                      });
                    }}
                    className="w-full py-2 bg-white/10 hover:bg-white/20 text-light rounded transition"
                  >
                    + Add Layer
                  </button>
                )}
              </div>
              
              <label className="flex items-center gap-2 mt-3 text-light/80">
                <input
                  type="checkbox"
                  checked={cardSettings.showBackgroundLayers}
                  onChange={(e) => setCardSettings({...cardSettings, showBackgroundLayers: e.target.checked})}
                  className="rounded"
                />
                Show background layers on cards
              </label>
            </div>
          )}

          {/* Custom Statistics */}
          <div className="mb-6">
            <h5 className="font-semibold text-light mb-3">Custom Statistics (max 6)</h5>
            
            {!editingStats ? (
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {teamStats.map((stat, idx) => (
                    <div key={idx} className="bg-blue-500/20 px-3 py-1 rounded-full text-sm text-blue-300 flex items-center gap-2">
                      {stat.label}
                      <button
                        onClick={() => handleRemoveStat(idx)}
                        className="text-red-400 hover:text-red-300"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setEditingStats(true)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-light rounded transition"
                >
                  Edit Statistics
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newStat.key}
                    onChange={(e) => setNewStat({...newStat, key: e.target.value})}
                    placeholder="Stat key (e.g., goals)"
                    className="flex-1 bg-white/10 border border-white/20 rounded px-3 py-2 text-light"
                  />
                  <input
                    type="text"
                    value={newStat.label}
                    onChange={(e) => setNewStat({...newStat, label: e.target.value})}
                    placeholder="Display label (e.g., Goals)"
                    className="flex-1 bg-white/10 border border-white/20 rounded px-3 py-2 text-light"
                  />
                  <button
                    onClick={handleAddStat}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded transition"
                  >
                    Add
                  </button>
                </div>
                <button
                  onClick={() => setEditingStats(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-light rounded transition"
                >
                  Done
                </button>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex gap-3">
            <button
              onClick={handleSaveSettings}
              className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-semibold"
            >
              Save Settings
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Member Cards Grid */}
      {enrichedMembers.length === 0 ? (
        <div className="text-center py-12 text-light/60">
          No members in this team yet
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {enrichedMembers.map(member => (
            <MemberCard
              key={member.id}
              member={member}
              teamStats={teamStats}
              cardSettings={cardSettings}
              onMessage={onMessage}
              onViewProfile={onViewProfile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
