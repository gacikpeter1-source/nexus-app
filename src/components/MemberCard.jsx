// src/components/MemberCard.jsx - FULLY ENHANCED - FIXED
import { useState } from 'react';
import SlidingStatsPanel from './SlidingStatsPanel';

export default function MemberCard({ 
  member, 
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

console.log('🔍 customFields type check:', {
  customFields: customFields,
  type: typeof customFields,
  isArray: Array.isArray(customFields)
});

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
      {/* Card Container with Shine Effect */}
      <div 
        className="relative rounded-2xl shadow-2xl border-4 overflow-hidden transform hover:scale-105 transition duration-300"
        style={{ 
          borderColor: `${accentColor}80`,
          background: `linear-gradient(to bottom right, #1e293b, #0f172a)`
        }}
      >
        {/* Background Layers */}
        {showBackgroundLayers && backgroundLayers.length > 0 && (
          <div className="absolute inset-0 opacity-80 overflow-hidden">
            {backgroundLayers.map((layer, idx) => (
              <div key={idx} className="absolute inset-0">
                {layer.type === 'image' && layer.data && (
                  <img 
                    src={layer.data} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                )}
                {layer.type === 'badge' && layer.data && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64">
                    <img 
                      src={layer.data} 
                      alt="" 
                      className="w-full h-full object-contain opacity-80"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Shine Effect Overlay */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
        </div>

        {/* Top Banner */}
        <div 
          className="relative p-4 text-center"
          style={{ 
            background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor}, ${primaryColor})` 
          }}
        >
          {/* Stats Panel Button - Top Left */}
            {statsTemplate?.enabled && (
              <button
                onClick={() => setShowStatsPanel(true)}
                className="absolute top-2 left-2 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white font-bold transition"
                title="View detailed stats"
              >
                →
              </button>
            )}

          {/* Badges - Top Right */}
          {badges.length > 0 && (
            <div className="absolute top-2 right-2 flex gap-1">
              {badges.slice(0, 3).map((badge, idx) => {
                const badgeDisplay = getBadgeDisplay(badge.badge);
                return (
                  <div 
                    key={idx}
                    className="relative group/badge"
                    title={`${badge.name} - ${badgeDisplay.name}`}
                  >
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-lg border-2 border-white/30"
                      style={{ backgroundColor: `${badgeDisplay.color}30` }}
                    >
                      {badgeDisplay.icon}
                    </div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover/badge:opacity-100 transition-opacity pointer-events-none">
                      {badge.name}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="text-white font-bold text-lg tracking-wider">{username}</div>
          <div className="text-white/80 text-sm">2024-2025 SEASON</div>
        </div>

        {/* Player Photo Section */}
        <div 
          className="relative p-6 pb-8"
          style={{ 
            background: `linear-gradient(to bottom, #334155, #1e293b)` 
          }}
        >
          {/* Photo Section Background (Layer 3) */}
          {(jerseyNumber || jerseyBackgroundImage) && (
            <div className="absolute top-0 right-0 w-full h-full overflow-hidden">
              {jerseyBackgroundImage ? (
                <div className="absolute top-0 right-0 w-full h-full opacity-80">
                  <img 
                    src={jerseyBackgroundImage} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="absolute top-0 right-0 text-[120px] font-black text-white/5 leading-none pr-4">
                  {jerseyNumber}
                </div>
              )}
            </div>
          )}
          
          {/* LAYOUT: Left (Custom Fields) + Right (Photo) */}
          <div className="flex gap-3 items-start relative z-10">
            {/* LEFT SIDE - Custom Fields */}
            <div className="flex-1 space-y-1.5 text-xs max-h-40 overflow-y-auto pr-1">
              {(customFields || [])
                .map((field) => {
                  const value = teamMemberData[field.key] || '-';  // ← Show '-' if empty
                  
                  return (
                    <div key={field.key} className="flex items-center justify-between bg-slate-700/80 rounded px-2 py-1.5">
                      <span className="text-slate-200 font-medium">{field.label}:</span>
                      <span className="text-white font-bold">{value}</span>
                    </div>
                  );
                })
              }
            </div>

            {/* RIGHT SIDE - Player Photo */}
            <div className="flex-shrink-0 relative">
              <div className="w-32 h-32">
                {displayImage && !imageError ? (
                  <img
                    src={displayImage}
                    alt={username}
                    onError={() => setImageError(true)}
                    className="w-full h-full rounded-full object-cover shadow-xl border-4"
                    style={{ borderColor: accentColor }}
                  />
                ) : (
                  <div 
                    className="w-full h-full rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-xl border-4"
                    style={{ 
                      background: `linear-gradient(to bottom right, ${primaryColor}, ${secondaryColor})`,
                      borderColor: accentColor
                    }}
                  >
                    {getInitials()}
                  </div>
                )}
                
                {/* Star Badge */}
                {badges.length > 0 && (
                  <div 
                    className="absolute -bottom-2 -right-2 rounded-full p-2 border-4 border-slate-800 shadow-lg"
                    style={{ backgroundColor: getBadgeDisplay(badges[0].badge).color }}
                  >
                    <span className="text-2xl">⭐</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Position & Jersey Number - Below Photo */}
          <div className="text-center relative z-10 mt-3">
          {jerseyNumber && (
            <div className="flex items-center justify-center" style={{ color: accentColor }}>
              <span className="text-4xl font-black">#{jerseyNumber}</span>
            </div>
          )}
        </div>
        </div>

        {/* Stats Section */}
        <div className="relative bg-slate-900/50 backdrop-blur p-4 border-t-2" style={{ borderColor: `${accentColor}50` }}>
          {/* Team-Defined Stats */}
          {teamStats.length > 0 ? (
            <div className={`grid ${teamStats.length <= 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-3 mb-4`}>
              {teamStats.slice(0, 6).map((stat, idx) => (
                <div key={idx} className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
                  <div className="text-2xl font-bold" style={{ color: accentColor }}>
                    {formatStatValue(stats[stat.key])}
                  </div>
                  <div className="text-xs text-slate-400 uppercase">{stat.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-500 text-sm mb-4 py-2">
              No statistics configured
            </div>
          )}

          {/* Contact Info */}
          <div className="space-y-2 text-sm mb-4">
            {email && (
              <div className="flex items-center gap-2 text-slate-300 truncate">
                <svg className="w-4 h-4 flex-shrink-0" style={{ color: primaryColor }} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                </svg>
                <span className="truncate">{email}</span>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-2 text-slate-300">
                <svg className="w-4 h-4 flex-shrink-0 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                </svg>
                <span>{phone}</span>
              </div>
            )}
          </div>

          {/* Custom Fields Display */}
            {customFields && customFields.length > 0 && (
              <div className="mb-4 space-y-2">
                {customFields
                  .filter(field => field.key !== 'position' && field.key !== 'post' && field.key !== 'handedness')
                  .map((field) => {
                    const value = teamMemberData[field.key];
                    if (!value) return null;
                    
                    return (
                      <div key={field.key} className="flex items-center justify-between text-sm bg-slate-800/30 rounded px-3 py-2">
                        <span className="text-slate-400">{field.label}:</span>
                        <span className="text-light font-medium">{value}</span>
                      </div>
                    );
                  })
                }
              </div>
            )}

          {/* Actions */}
          <div className="flex gap-2">
            {canEdit && onEdit && (
              <button 
                onClick={() => onEdit(member)}
                className="flex-1 text-white py-2 px-3 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Card
              </button>
            )}
            {onMessage && !canEdit && (
              <button 
                onClick={() => onMessage(member)}
                className="flex-1 text-white py-2 px-3 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                </svg>
                Message
              </button>
            )}
          </div>
        </div>

        {/* Bottom Stripe */}
        <div 
          className="h-2"
          style={{ 
            background: `linear-gradient(to right, ${accentColor}, ${accentColor}cc, ${accentColor})` 
          }}
        ></div>
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
