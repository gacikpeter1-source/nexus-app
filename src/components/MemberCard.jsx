// src/components/MemberCard.jsx - FULLY ENHANCED - FIXED
import { useState } from 'react';
import SlidingStatsPanel from './SlidingStatsPanel';

export default function MemberCard({ 
  member, 
  team = {},
  teamStats = [], 
  cardSettings = {},
  badgeSettings = {},
  statsTemplate = {},
  teamMemberData = {},
  customFields = [],
  currentUserId,
  canEdit = false,
  onEdit,
  onMessage,
  onViewProfile 
}) {
  const [imageError, setImageError] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [showDetailed, setShowDetailed] = useState(false); // Card flip state

  // Default card settings
  const {
    primaryColor = '#2563eb',
    secondaryColor = '#1e40af',
    accentColor = '#eab308',
    backgroundLayers = [],
    showBackgroundLayers = false,
    jerseyBackgroundImage = null
  } = cardSettings;

  // Get member details with team-specific overrides
  const {
    id,
    username = 'Player',
    email = '',
    profileImage,
    role = 'member',
    stats = {}
  } = member;

  // Team-specific data
  const jerseyNumber = teamMemberData.jerseyNumber || member.jerseyNumber;
  const position = teamMemberData.post || teamMemberData.position || member.position;
  const handedness = teamMemberData.handednes || teamMemberData.handedness || member.handedness;
  const age = teamMemberData.age || member.age;
  const phone = teamMemberData.phone || member.phone;
  const teamProfileImage = teamMemberData.profileImage;
  const useMainProfile = teamMemberData.useMainProfile !== false;

  // Split custom fields by view mode
  const basicFields = (customFields || []).filter(f => !f.viewMode || f.viewMode === 'basic');
  const detailedFields = (customFields || []).filter(f => f.viewMode === 'detailed');

  // Determine which image to use
  const displayImage = teamProfileImage || (useMainProfile ? profileImage : null);

  // Calculate badges
  const calculateBadges = () => {
    if (!badgeSettings || !badgeSettings.enabled || !badgeSettings.rules) return [];

    const earnedBadges = [];
    
    badgeSettings.rules.forEach(rule => {
      const statValue = parseFloat(stats[rule.criteria.stat]) || 0;
      const ruleValue = parseFloat(rule.criteria.value);
      
      let qualifies = false;
      switch (rule.criteria.operator) {
        case 'gte':
          qualifies = statValue >= ruleValue;
          break;
        case 'lte':
          qualifies = statValue <= ruleValue;
          break;
        case 'eq':
          qualifies = statValue === ruleValue;
          break;
      }
      
      if (qualifies) {
        earnedBadges.push(rule);
      }
    });

    // Sort by tier (highest first)
    const tierOrder = ['platinum', 'gold', 'silver', 'bronze', 'iron'];
    earnedBadges.sort((a, b) => 
      tierOrder.indexOf(a.badge) - tierOrder.indexOf(b.badge)
    );

    return earnedBadges;
  };

  const badges = calculateBadges();

  // Badge icon and color
  const getBadgeDisplay = (badgeType) => {
    const badgeMap = {
      iron: { icon: '⚪', color: '#71717a', name: 'Iron' },
      bronze: { icon: '🥉', color: '#cd7f32', name: 'Bronze' },
      silver: { icon: '🥈', color: '#c0c0c0', name: 'Silver' },
      gold: { icon: '🥇', color: '#ffd700', name: 'Gold' },
      platinum: { icon: '💎', color: '#e5e4e2', name: 'Platinum' }
    };
    return badgeMap[badgeType] || badgeMap.bronze;
  };

  // Role display
  const getRoleBadge = () => {
    const roleMap = {
      trainer: { label: 'TRAINER', color: 'bg-yellow-500' },
      assistant: { label: 'ASSISTANT', color: 'bg-orange-500' },
      member: { label: 'PLAYER', color: 'bg-blue-500' }
    };
    return roleMap[role] || roleMap.member;
  };

  const roleBadge = getRoleBadge();

  // Get initials for avatar
  const getInitials = () => {
    return username
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Format stat value
  const formatStatValue = (value) => {
    if (typeof value === 'number') {
      return value % 1 === 0 ? value : value.toFixed(1);
    }
    return value || '0';
  };

  return (
    <div className="relative group">
      {/* Card Container - Modern Sports Card Style */}
      <div 
        onClick={() => setShowDetailed(!showDetailed)}
        className={`relative bg-white rounded-lg shadow-2xl overflow-hidden cursor-pointer transform hover:scale-105 transition-all duration-300 ${
          showDetailed ? 'ring-4 ring-blue-500' : ''
        }`}
        style={{ aspectRatio: '2.5/3.5' }}
      >
        {/* Diagonal Stripes Decoration */}
        <div className="absolute top-0 left-0 w-24 h-24 overflow-hidden pointer-events-none">
          <div 
            className="absolute -top-12 -left-12 w-32 h-32 transform rotate-45"
            style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor} 33%, ${secondaryColor} 33%, ${secondaryColor} 66%, ${accentColor} 66%, ${accentColor} 100%)` }}
          />
        </div>
        <div className="absolute bottom-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
          <div 
            className="absolute -bottom-12 -right-12 w-32 h-32 transform rotate-45"
            style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor} 33%, ${secondaryColor} 33%, ${secondaryColor} 66%, ${primaryColor} 66%, ${primaryColor} 100%)` }}
          />
        </div>

        {/* Corner Dots Pattern */}
        <div className="absolute top-2 right-2 flex flex-col gap-0.5 pointer-events-none z-10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-0.5">
              {[...Array(3)].map((_, j) => (
                <div 
                  key={j} 
                  className="w-1 h-1 rounded-full" 
                  style={{ backgroundColor: primaryColor }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Team Logo Watermark */}
        {jerseyBackgroundImage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[5] p-4">
            <img 
              src={jerseyBackgroundImage} 
              alt="Team logo" 
              className="w-full h-full object-contain filter grayscale opacity-20"
            />
          </div>
        )}

        {/* FRONT VIEW */}
        {!showDetailed ? (
          <div className="relative h-full flex flex-col z-10">
            {/* Large Player Photo */}
            <div className="relative bg-gradient-to-br from-slate-100 to-slate-200 border-6 border-white m-2" style={{ height: '60%' }}>
              {displayImage && !imageError ? (
                <img
                  src={displayImage}
                  alt={username}
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-400">
                  <div 
                    className="text-9xl font-black"
                    style={{ color: primaryColor }}
                  >
                    {getInitials()}
                  </div>
                </div>
              )}
              
              {/* Jersey Number Overlay */}
              {jerseyNumber && (
                <div 
                  className="absolute bottom-2 right-2 px-3 py-1 font-black text-2xl text-white shadow-lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  #{jerseyNumber}
                </div>
              )}

              {/* Badges Top Right */}
              {badges.length > 0 && (
                <div className="absolute top-2 right-2 flex gap-1">
                  {badges.slice(0, 2).map((badge, idx) => {
                    const badgeDisplay = getBadgeDisplay(badge.badge);
                    return (
                      <div 
                        key={idx}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-lg border-2 border-white shadow-lg"
                        style={{ backgroundColor: badgeDisplay.color }}
                        title={badge.name}
                      >
                        {badgeDisplay.icon}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Player Info Section */}
            <div className="relative px-4 pb-4 bg-white">
              <div className="text-center mb-2">
                <h2 
                  className="text-2xl md:text-3xl font-black uppercase tracking-tight"
                  style={{ color: primaryColor }}
                >
                  {username}
                </h2>
                <p className="text-sm font-bold text-gray-600 uppercase tracking-wider">
                  {position || 'Player'}
                </p>
              </div>

              <div 
                className="text-center py-2 font-bold text-lg uppercase tracking-widest text-white"
                style={{ backgroundColor: secondaryColor }}
              >
                {team?.name || 'Team Name'}
              </div>

              {/* Tap to View Details Hint */}
              <div className="text-center mt-2 text-xs text-gray-400">
                💡 Tap card for details
              </div>
            </div>
          </div>
        ) : (
          <div className="relative h-full flex flex-col p-4 bg-white">
            {/* BACK VIEW */}
            
            {/* Team Logo Watermark - Back View */}
            {jerseyBackgroundImage && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[5] p-4">
                <img 
                  src={jerseyBackgroundImage} 
                  alt="Team logo" 
                  className="w-full h-full object-contain filter grayscale opacity-15"
                />
              </div>
            )}
            
            {/* Top Section: Photo + Name */}
            <div className="relative z-10 flex gap-3 items-start mb-3">
              {/* Small Photo */}
              <div className="w-16 h-16 flex-shrink-0 bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-white shadow-lg">
                {displayImage && !imageError ? (
                  <img
                    src={displayImage}
                    alt={username}
                    onError={() => setImageError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-400">
                    <div 
                      className="text-4xl font-black"
                      style={{ color: primaryColor }}
                    >
                      {getInitials()}
                    </div>
                  </div>
                )}
              </div>

              {/* Player Name & Position */}
              <div className="flex-1">
                <h2 
                  className="text-lg font-black uppercase mb-0.5"
                  style={{ color: primaryColor }}
                >
                  {username}
                </h2>
                <p className="text-xs font-bold text-gray-600 uppercase mb-1">
                  {position || 'Player'}
                </p>
                {jerseyNumber && (
                  <div 
                    className="inline-block px-1.5 py-0.5 font-black text-white text-xs"
                    style={{ backgroundColor: primaryColor }}
                  >
                    #{jerseyNumber}
                  </div>
                )}
              </div>
            </div>

            {/* Team Name Banner */}
            <div 
              className="text-center py-1.5 text-white font-bold uppercase text-sm mb-2"
              style={{ backgroundColor: secondaryColor }}
            >
              {team?.clubName || team?.name || 'Team'}
            </div>

            {/* All Fields as List */}
            <div className="flex-1 mb-2 space-y-1 overflow-y-auto max-h-72">
              {/* Basic Fields */}
              {basicFields.map((field) => {
                const value = teamMemberData[field.key] || '-';
                return (
                  <div 
                    key={field.key}
                    className="flex justify-between items-center py-1 px-2 border-l-3"
                    style={{ 
                      borderColor: primaryColor,
                      backgroundColor: '#f8fafc'
                    }}
                  >
                    <span className="text-[11px] font-bold text-gray-600 uppercase">
                      {field.label}
                    </span>
                    <span className="text-xs font-black" style={{ color: primaryColor }}>
                      {value}
                    </span>
                  </div>
                );
              })}

              {/* Detailed Fields */}
              {detailedFields.map((field) => {
                const value = teamMemberData[field.key];
                if (!value) return null;
                return (
                  <div 
                    key={field.key}
                    className="flex justify-between items-center py-1 px-2 border-l-3"
                    style={{ 
                      borderColor: primaryColor,
                      backgroundColor: '#f8fafc'
                    }}
                  >
                    <span className="text-[11px] font-bold text-gray-600 uppercase">
                      {field.label}
                    </span>
                    <span className="text-xs font-black" style={{ color: primaryColor }}>
                      {value}
                    </span>
                  </div>
                );
              })}

              {/* Stats as List Items */}
              {teamStats.map((stat) => {
                const value = formatStatValue(stats[stat.key]);
                return (
                  <div 
                    key={stat.key}
                    className="flex justify-between items-center py-1 px-2 border-l-3"
                    style={{ 
                      borderColor: accentColor,
                      backgroundColor: `${accentColor}10`
                    }}
                  >
                    <span className="text-[11px] font-bold text-gray-600 uppercase">
                      {stat.label}
                    </span>
                    <span className="text-xs font-black" style={{ color: accentColor }}>
                      {value}
                    </span>
                  </div>
                );
              })}

              {/* Attendance from member data */}
              {member.stats?.attendance !== undefined && (
                <div 
                  className="flex justify-between items-center py-1 px-2 border-l-3"
                  style={{ 
                    borderColor: accentColor,
                    backgroundColor: `${accentColor}10`
                  }}
                >
                  <span className="text-[11px] font-bold text-gray-600 uppercase">
                    Attendance
                  </span>
                  <span className="text-xs font-black" style={{ color: accentColor }}>
                    {member.stats.attendance}%
                  </span>
                </div>
              )}

              {/* Badges/Behaviour */}
              {badges.length > 0 && (
                <div 
                  className="flex justify-between items-center py-1 px-2 border-l-3"
                  style={{ 
                    borderColor: primaryColor,
                    backgroundColor: '#f8fafc'
                  }}
                >
                  <span className="text-[11px] font-bold text-gray-600 uppercase">
                    Badges
                  </span>
                  <div className="flex gap-1">
                    {badges.slice(0, 3).map((badge, idx) => {
                      const badgeDisplay = getBadgeDisplay(badge.badge);
                      return (
                        <div 
                          key={idx}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-white"
                          style={{ backgroundColor: badgeDisplay.color }}
                          title={badge.name}
                        >
                          {badgeDisplay.icon}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>


            {/* Footer */}
            <div className="text-center text-[10px] text-gray-400 font-medium mt-auto">
              Powered by Nexus International
            </div>
          </div>
        )}

        {/* Action Buttons - Floating at bottom */}
        {canEdit && onEdit && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onEdit(member);
            }}
            className="absolute bottom-2 right-2 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg z-20 hover:scale-110 transition-transform"
            style={{ backgroundColor: primaryColor }}
            title="Edit Card"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}

        {/* Stats Panel Button */}
        {statsTemplate?.enabled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowStatsPanel(true);
            }}
            className="absolute bottom-2 left-2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center z-20 hover:scale-110 transition-transform"
            style={{ color: primaryColor }}
            title="View Stats"
          >
            <span className="text-xl font-bold">→</span>
          </button>
        )}
      </div>

      {/* Sliding Stats Panel */}
      {showStatsPanel && (
        <SlidingStatsPanel
          member={member}
          statsTemplate={statsTemplate}
          teamMemberData={teamMemberData}
          onClose={() => setShowStatsPanel(false)}
        />
      )}

    </div>
  );
}
