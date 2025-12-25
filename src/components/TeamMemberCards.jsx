// src/components/TeamMemberCards.jsx - FINAL with Badges & Image Uploads
import { useState, useEffect  } from 'react';
import MemberCard from './MemberCard';
import EditMemberCardModal from './EditMemberCardModal';
import TeamFieldsManager from './TeamFieldsManager';
import BadgeConfigurationModal from './BadgeConfigurationModal';
import { handleImageUpload } from '../utils/imageUpload';
import ImageCropModal from './ImageCropModal';

export default function TeamMemberCards({ 
  team, 
  members = [], 
  allUsers = [],
  currentUser,
  userSubscription = 'free',
  onUpdateTeamSettings,
  onUpdateMemberData,
  onMessage,
  onViewProfile
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [cardSettings, setCardSettings] = useState(team.cardSettings || {
    primaryColor: '#2563eb',
    secondaryColor: '#1e40af',
    accentColor: '#eab308',
    backgroundLayers: [],
    showBackgroundLayers: false,
    jerseyBackgroundImage: null
  });
// Sync cardSettings when team data updates
  useEffect(() => {
    if (team.cardSettings) {
      console.log('🔄 Team cardSettings loaded:', {
        hasJerseyBg: !!team.cardSettings.jerseyBackgroundImage,
        bgSize: team.cardSettings.jerseyBackgroundImage?.length
      });
      setCardSettings(team.cardSettings);
    }
  }, [team.cardSettings]);


  const [teamStats, setTeamStats] = useState(team.customStats || [
    { key: 'games', label: 'Games' },
    { key: 'attendance', label: 'Attend%' },
    { key: 'years', label: 'Years' }
  ]);

  const [editingStats, setEditingStats] = useState(false);
  const [newStat, setNewStat] = useState({ key: '', label: '' });
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [showFieldsManager, setShowFieldsManager] = useState(false);
  const [showBadgeConfig, setShowBadgeConfig] = useState(false);
  
  // Image upload states
  const [uploadingJerseyBg, setUploadingJerseyBg] = useState(false);
  const [uploadingLayer, setUploadingLayer] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [cropCallback, setCropCallback] = useState(null);

  const isAdmin = currentUser?.isSuperAdmin || currentUser?.role === 'admin';
  const isTrainer = team.trainers?.includes(currentUser?.id);
  const isAssistant = team.assistants?.includes(currentUser?.id);
  const canEditCards = isAdmin || isTrainer || isAssistant;
  const customFields = Array.isArray(team.customFields) ? team.customFields : [];

  const enrichedMembers = members.map(memberId => {
    const userData = allUsers.find(u => u.id === memberId);
    if (!userData) return null;

    const teamMemberData = team.memberData?.[memberId] || {};

    const memberStats = {
      games: userData.stats?.gamesPlayed || 0,
      attendance: userData.stats?.attendanceRate || 0,
      years: userData.stats?.yearsInTeam || 0,
      goals: userData.stats?.goals || 0,
      assists: userData.stats?.assists || 0,
      points: userData.stats?.points || 0
    };

    return {
    ...userData,
    stats: memberStats,
    teamMemberData,
    canEdit: isAdmin || isTrainer || isAssistant || memberId === currentUser?.id
    };
  }).filter(Boolean);

  // Trainers and Assistants can always customize, OR users with Club/Full subscription
  const canCustomizeColors = canEditCards || userSubscription === 'club' || userSubscription === 'full';
  const canCustomizeLayers = canEditCards || userSubscription === 'full';

  // Handle jersey background image upload
const handleJerseyBgUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    setUploadingJerseyBg(true);
    
    // Convert to data URL for cropper
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result);
      setCropCallback(() => async (croppedBase64) => {
        setCardSettings({
          ...cardSettings,
          jerseyBackgroundImage: croppedBase64
        });
        setShowCropModal(false);
        setCropImageSrc(null);
        setUploadingJerseyBg(false);
      });
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  } catch (error) {
    alert(error.message);
    setUploadingJerseyBg(false);
  }
};

// Handle background layer image upload
const handleLayerImageUpload = async (e, idx) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    setUploadingLayer(idx);
    
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result);
      setCropCallback(() => async (croppedBase64) => {
        const newLayers = [...cardSettings.backgroundLayers];
        newLayers[idx].data = croppedBase64;
        setCardSettings({
          ...cardSettings,
          backgroundLayers: newLayers
        });
        setShowCropModal(false);
        setCropImageSrc(null);
        setUploadingLayer(null);
      });
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  } catch (error) {
    alert(error.message);
    setUploadingLayer(null);
  }
};

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

  const handleAddStat = () => {
    if (!newStat.key || !newStat.label) return;
    if (teamStats.length >= 6) {
      alert('Maximum 6 statistics allowed');
      return;
    }
    setTeamStats([...teamStats, newStat]);
    setNewStat({ key: '', label: '' });
  };

  const handleRemoveStat = (index) => {
    setTeamStats(teamStats.filter((_, idx) => idx !== index));
  };

  const handleEditMember = (member) => {
    setEditingMember(member);
    setShowEditModal(true);
  };

  const handleSaveMemberData = async (memberId, memberData) => {
    try {
      await onUpdateMemberData(memberId, memberData);
      setShowEditModal(false);
      setEditingMember(null);
    } catch (error) {
      console.error('Error saving member data:', error);
      throw error;
    }
  };

  const canEditMemberCard = (memberId) => {
    return memberId === currentUser?.id || canEditCards;
  };

  return (
    <div>
      {/* Header with Buttons */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h3 className="text-2xl font-bold text-light">Team Members</h3>
          <p className="text-light/60 text-sm mt-1">
            {enrichedMembers.length} member{enrichedMembers.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex gap-2">
          {canEditCards && (
            <>
              <button
                onClick={() => setShowBadgeConfig(true)}
                className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-300 rounded-lg transition flex items-center gap-2"
              >
                <span className="text-lg">🌟</span>
                Configure Badges
              </button>
              <button
                onClick={() => setShowFieldsManager(true)}
                className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-300 rounded-lg transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Configure Fields
              </button>
            </>
          )}
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
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
          <div className="mb-6">
            <h4 className="text-2xl font-bold text-light mb-2">🎨 Card Customization</h4>
            <p className="text-sm text-light/60">
              Customize the appearance of all team member cards. Changes apply to the entire team.
            </p>
          </div>

          {!canCustomizeColors && (
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 mb-6">
              <p className="text-yellow-200 text-sm font-semibold">
                ⚠️ Card customization requires Club or Full subscription
              </p>
              <p className="text-yellow-200/80 text-xs mt-1">
                Upgrade to customize team colors and add your team logo
              </p>
            </div>
          )}

          {/* Team Colors */}
          {canCustomizeColors && (
            <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <h5 className="font-bold text-light mb-2 flex items-center gap-2">
                🎨 Team Colors
              </h5>
              <p className="text-xs text-light/60 mb-4">
                These colors are used for: diagonal stripes, player names, team banner, and info grid borders
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-light/80 mb-2">
                    Primary Color
                  </label>
                  <input
                    type="color"
                    value={cardSettings.primaryColor}
                    onChange={(e) => setCardSettings({...cardSettings, primaryColor: e.target.value})}
                    className="w-full h-12 rounded cursor-pointer border-2 border-white/20"
                  />
                  <p className="text-xs text-light/50 mt-1">Player name, borders</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-light/80 mb-2">
                    Secondary Color
                  </label>
                  <input
                    type="color"
                    value={cardSettings.secondaryColor}
                    onChange={(e) => setCardSettings({...cardSettings, secondaryColor: e.target.value})}
                    className="w-full h-12 rounded cursor-pointer border-2 border-white/20"
                  />
                  <p className="text-xs text-light/50 mt-1">Team banner, stripes</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-light/80 mb-2">
                    Accent Color
                  </label>
                  <input
                    type="color"
                    value={cardSettings.accentColor}
                    onChange={(e) => setCardSettings({...cardSettings, accentColor: e.target.value})}
                    className="w-full h-12 rounded cursor-pointer border-2 border-white/20"
                  />
                  <p className="text-xs text-light/50 mt-1">Stats, highlights</p>
                </div>
              </div>
            </div>
          )}

          {/* Team Logo / Background */}
          {canCustomizeColors && (
            <div className="mb-6 bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <h5 className="font-bold text-light mb-2 flex items-center gap-2">
                🏒 Team Logo / Background (Optional)
              </h5>
              <p className="text-xs text-light/60 mb-3">
                Upload your team logo or a background image. This appears as a subtle background on player cards.
              </p>
              <div className="flex items-start gap-4">
                {cardSettings.jerseyBackgroundImage && (
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden border-4 border-white shadow-lg">
                    <img 
                      src={cardSettings.jerseyBackgroundImage} 
                      alt="Team logo/background" 
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => setCardSettings({...cardSettings, jerseyBackgroundImage: null})}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div className="flex-1">
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleJerseyBgUpload}
                      className="hidden"
                    />
                    <div className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg cursor-pointer inline-flex items-center gap-2 font-semibold transition-all">
                      {uploadingJerseyBg ? '⏳ Uploading...' : '📤 Upload Team Logo'}
                    </div>
                  </label>
                  <p className="text-xs text-light/50 mt-2">
                    ✨ Recommended: Square logo (500x500px or larger), PNG with transparent background
                  </p>
                  <p className="text-xs text-light/50 mt-1">
                    💡 This will appear as a subtle watermark on the cards
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Background Layers */}
          {canCustomizeLayers && (
            <div className="mb-6">
              <h5 className="font-semibold text-light mb-3">Card Background Layers</h5>
              <p className="text-sm text-light/60 mb-3">Layer 1: Behind entire card | Layer 2: Behind stats section</p>
              <div className="space-y-3">
                {cardSettings.backgroundLayers.map((layer, idx) => (
                  <div key={idx} className="bg-white/5 p-4 rounded-lg space-y-3">
                    <div className="flex gap-3 items-center">
                      <select
                        value={layer.type}
                        onChange={(e) => {
                          const newLayers = [...cardSettings.backgroundLayers];
                          newLayers[idx].type = e.target.value;
                          setCardSettings({...cardSettings, backgroundLayers: newLayers});
                        }}
                        className="bg-white/10 border border-white/20 rounded px-3 py-2 text-light"
                      >
                        <option value="image">Layer {idx + 1} - Full Background</option>
                        <option value="badge">Layer {idx + 1} - Logo/Badge</option>
                      </select>
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
                    
                    {layer.data && (
                      <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-white/20">
                        <img 
                          src={layer.data} 
                          alt="Layer" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleLayerImageUpload(e, idx)}
                        className="hidden"
                      />
                      <div className="px-4 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg cursor-pointer inline-flex items-center gap-2 text-sm">
                        {uploadingLayer === idx ? '⏳ Uploading...' : '📤 Upload Image'}
                      </div>
                    </label>
                  </div>
                ))}
                
                {cardSettings.backgroundLayers.length < 3 && (
                  <button
                    onClick={() => {
                      setCardSettings({
                        ...cardSettings,
                        backgroundLayers: [...cardSettings.backgroundLayers, { type: 'badge', data: '' }]
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

          {/* Card Preview */}
          {canCustomizeColors && (
            <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <h5 className="font-bold text-light mb-2 flex items-center gap-2">
                👁️ Color Preview
              </h5>
              <div className="flex gap-2 items-center">
                <div 
                  className="w-20 h-20 rounded-lg shadow-lg border-4 border-white"
                  style={{ background: `linear-gradient(135deg, ${cardSettings.primaryColor}, ${cardSettings.secondaryColor})` }}
                />
                <div className="flex-1">
                  <div 
                    className="px-4 py-2 rounded font-bold text-white mb-2"
                    style={{ backgroundColor: cardSettings.primaryColor }}
                  >
                    Player Name
                  </div>
                  <div 
                    className="px-4 py-2 rounded font-bold text-white text-sm"
                    style={{ backgroundColor: cardSettings.secondaryColor }}
                  >
                    Team Banner
                  </div>
                </div>
                <div className="text-center">
                  <div 
                    className="text-3xl font-black mb-1"
                    style={{ color: cardSettings.accentColor }}
                  >
                    25
                  </div>
                  <div className="text-xs text-light/60">Stats</div>
                </div>
              </div>
            </div>
          )}

          {/* Custom Statistics */}
          <div className="mb-6">
            <h5 className="font-semibold text-light mb-3">📊 Custom Statistics (max 6)</h5>
            
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
              team={team}
              teamStats={teamStats}
              cardSettings={cardSettings}
              badgeSettings={team.badgeSettings}
              statsTemplate={team.statsTemplate}
              teamMemberData={member.teamMemberData}
              customFields={customFields}
              currentUserId={currentUser?.id}
              canEdit={member.canEdit || canEditCards}
              onEdit={handleEditMember}
              onMessage={onMessage}
              onViewProfile={onViewProfile}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showEditModal && editingMember && (
        <EditMemberCardModal
          member={editingMember}
          team={team}
          teamId={team.id}
          teamMemberData={editingMember.teamMemberData}
          onSave={handleSaveMemberData}
          onClose={() => {
            setShowEditModal(false);
            setEditingMember(null);
          }}
        />
      )}
      
{showFieldsManager && (
  <TeamFieldsManager
    team={team}
    onSave={async (settings) => {
      console.log('📥 TeamMemberCards received:', settings);
      await onUpdateTeamSettings(settings);
      console.log('✅ Saved to Firestore');
      setShowFieldsManager(false);
    }}
    onClose={() => setShowFieldsManager(false)}
  />
)}

      {showBadgeConfig && (
        <BadgeConfigurationModal
          team={team}
          onSave={async (badgeSettings) => {
            await onUpdateTeamSettings({ badgeSettings });
            setShowBadgeConfig(false);
          }}
          onClose={() => setShowBadgeConfig(false)}
        />
      )}

      {/* Image Crop Modal */}
      {showCropModal && cropImageSrc && (
        <ImageCropModal
          image={cropImageSrc}
          onComplete={cropCallback}
          onCancel={() => {
            setShowCropModal(false);
            setCropImageSrc(null);
            setUploadingJerseyBg(false);
            setUploadingLayer(null);
          }}
          title="Adjust Background Image"
          aspectRatio={null}
        />
      )}


    </div>
  );
}
