// src/components/MemberCard.jsx
import { useState } from 'react';

export default function MemberCard({ 
  member, 
  teamStats = [], 
  cardSettings = {},
  onMessage,
  onViewProfile 
}) {
  const [imageError, setImageError] = useState(false);

  // Default card settings
  const {
    primaryColor = '#2563eb', // blue-600
    secondaryColor = '#1e40af', // blue-700
    accentColor = '#eab308', // yellow-500
    backgroundLayers = [], // Array of {type: 'image', url: '...'} or {type: 'badge', url: '...'}
    showBackgroundLayers = false
  } = cardSettings;

  // Get member details with fallbacks
  const {
    id,
    username = 'Player',
    email = '',
    profileImage,
    role = 'member',
    
    // User-defined fields
    jerseyNumber,
    position,
    handedness, // 'left' or 'right'
    age,
    phone,
    
    // Stats (calculated or stored)
    stats = {}
  } = member;

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
        {/* Background Layers (Full Subscription Only) */}
        {showBackgroundLayers && backgroundLayers.length > 0 && (
          <div className="absolute inset-0 opacity-10 overflow-hidden">
            {backgroundLayers.map((layer, idx) => (
              <div key={idx} className="absolute inset-0">
                {layer.type === 'image' && (
                  <img 
                    src={layer.url} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                )}
                {layer.type === 'badge' && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64">
                    <img 
                      src={layer.url} 
                      alt="" 
                      className="w-full h-full object-contain opacity-30"
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
          <div 
            className="absolute top-2 right-2 text-slate-900 font-bold text-xs px-2 py-1 rounded"
            style={{ backgroundColor: accentColor }}
          >
            {roleBadge.label}
          </div>
          <div className="text-white font-bold text-lg tracking-wider">TEAM MEMBER</div>
          <div className="text-white/80 text-sm">2024-2025 SEASON</div>
        </div>

        {/* Player Photo Section */}
        <div 
          className="relative p-6 pb-8"
          style={{ 
            background: `linear-gradient(to bottom, #334155, #1e293b)` 
          }}
        >
          {/* Jersey Number Background */}
          {jerseyNumber && (
            <div className="absolute top-0 right-0 text-[120px] font-black text-white/5 leading-none pr-4">
              {jerseyNumber}
            </div>
          )}
          
          {/* Player Photo */}
          <div className="relative z-10 mx-auto w-40 h-40 mb-4">
            {profileImage && !imageError ? (
              <img
                src={profileImage}
                alt={username}
                onError={() => setImageError(true)}
                className="w-full h-full rounded-full object-cover shadow-xl border-4"
                style={{ borderColor: accentColor }}
              />
            ) : (
              <div 
                className="w-full h-full rounded-full flex items-center justify-center text-6xl font-bold text-white shadow-xl border-4"
                style={{ 
                  background: `linear-gradient(to bottom right, ${primaryColor}, ${secondaryColor})`,
                  borderColor: accentColor
                }}
              >
                {getInitials()}
              </div>
            )}
            
            {/* Verified Badge */}
            <div className="absolute bottom-0 right-0 bg-green-500 rounded-full p-2 border-4 border-slate-800">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
              </svg>
            </div>
          </div>

          {/* Player Name & Number */}
          <div className="text-center relative z-10">
            <div className="text-3xl font-black text-white mb-1 tracking-tight uppercase">
              {username}
            </div>
            
            <div className="flex items-center justify-center gap-3" style={{ color: accentColor }}>
              {jerseyNumber && (
                <span className="text-5xl font-black">#{jerseyNumber}</span>
              )}
              {position && (
                <div className="text-left">
                  <div className="text-xs" style={{ color: `${secondaryColor}dd` }}>POSITION</div>
                  <div className="text-sm font-bold uppercase">{position}</div>
                  {handedness && (
                    <div className="text-xs text-white/60">
                      {handedness === 'left' ? '🏒 Left' : '🏒 Right'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Age */}
            {age && (
              <div className="text-sm text-white/60 mt-2">
                Age: {age}
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

          {/* Actions */}
          <div className="flex gap-2">
            {onMessage && (
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
            {onViewProfile && (
              <button 
                onClick={() => onViewProfile(member)}
                className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg text-sm font-semibold transition"
              >
                Profile
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
    </div>
  );
}
