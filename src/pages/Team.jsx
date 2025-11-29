// src/pages/Team.jsx
import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Team() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('events'); // events, trainers, members

  // Load team data from localStorage
  const team = useMemo(() => {
    
    try {
      const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
      
      for (const club of clubs) {
        if (!Array.isArray(club.teams)) {
          continue;
        }
        club.teams.forEach(t => {
        });
        
        const foundTeam = club.teams.find(t => t.id === id);
        if (foundTeam) {
          return { ...foundTeam, clubId: club.id, clubName: club.name };
        }
      }
      return null;
    } catch (e) {
      console.error('  ❌ Error loading team:', e);
      return null;
    }
  }, [id]);

  // Load users data
  const users = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('users') || '[]');
    } catch {
      return [];
    }
  }, []);

  // Load events
  const allEvents = useMemo(() => {
    try {
      // Events are stored in 'sportsapp:localEvents', not 'events'
      const events = JSON.parse(localStorage.getItem('sportsapp:localEvents') || '[]');
      events.forEach(e => {
      });
      return events;
    } catch (e) {
      console.error('  ❌ Error loading events:', e);
      return [];
    }
  }, []);

  // Get team events (next 5 days or closest 5)
  const upcomingEvents = useMemo(() => {
    if (!team) return [];
    
    
    // Filter events for this team
    // An event belongs to this team if:
    // 1. teamId matches team.id, OR
    // 2. visibilityLevel is 'team' and teamId matches, OR
    // 3. visibilityLevel is 'club' and clubId matches (show club events too)
    const teamEvents = allEvents.filter(e => {
      const matchesTeamId = e.teamId === team.id;
      const matchesClubId = e.visibilityLevel === 'club' && e.clubId === team.clubId;
      const isMatch = matchesTeamId || matchesClubId;
      
      if (isMatch) {
        /* Matching logic completed */
      }
      
      return isMatch;
    });
    
    
    const now = new Date();
    const fiveDaysLater = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    // Events in next 5 days
    const next5Days = teamEvents.filter(e => {
      const eventDate = new Date(e.date);
      const isInRange = eventDate >= now && eventDate <= fiveDaysLater;
      return isInRange;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));


    // If we have events in next 5 days, return them
    if (next5Days.length > 0) {
      return next5Days.slice(0, 5);
    }

    // Otherwise, return 5 closest future events
    const futureEvents = teamEvents
      .filter(e => {
        const isFuture = new Date(e.date) >= now;
        return isFuture;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);

    
    return futureEvents;
  }, [team, allEvents]);

  // Get trainers
  const trainers = useMemo(() => {
    if (!team) return [];
    const trainerIds = team.trainers || [];
    return users.filter(u => trainerIds.includes(u.id));
  }, [team, users]);

  // Get members
  const members = useMemo(() => {
    if (!team) return [];
    const memberIds = team.members || [];
    return users.filter(u => memberIds.includes(u.id));
  }, [team, users]);

  // Check if user is member of this team
  const isUserMember = useMemo(() => {
    if (!team || !user) return false;
    const memberIds = team.members || [];
    return memberIds.includes(user.id);
  }, [team, user]);

  // Leave Team function
  const handleLeaveTeam = () => {
    if (!window.confirm(`Are you sure you want to leave ${team.name}? You will no longer have access to team events and information.`)) {
      return;
    }

    try {
      // Load clubs
      const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
      const clubIndex = clubs.findIndex(c => c.id === team.clubId);
      
      if (clubIndex === -1) {
        alert('Club not found');
        return;
      }

      // Find and update team
      const club = clubs[clubIndex];
      const teamIndex = (club.teams || []).findIndex(t => t.id === team.id);
      
      if (teamIndex === -1) {
        alert('Team not found');
        return;
      }

      // Remove user from team members
      club.teams[teamIndex].members = (club.teams[teamIndex].members || []).filter(id => id !== user.id);
      
      // Save updated clubs
      localStorage.setItem('clubs', JSON.stringify(clubs));
      
      alert(`You have left ${team.name}`);
      navigate('/clubs');
    } catch (error) {
      console.error('Error leaving team:', error);
      alert('Failed to leave team. Please try again.');
    }
  };

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="font-title text-2xl text-light mb-2">Team Not Found</h2>
          <p className="text-light/60 mb-6">The team you&apos;re looking for doesn&apos;t exist.</p>
          <button
            onClick={() => navigate('/clubs')}
            className="btn-primary"
          >
            ← Back to Clubs
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventIcon = (type) => {
    switch(type?.toLowerCase()) {
      case 'training': return '🏋️';
      case 'game': return '⚽';
      case 'match': return '🏆';
      case 'tournament': return '🥇';
      default: return '📅';
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/clubs')}
              className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-light transition-all"
            >
              ←
            </button>
            <div>
              <h1 className="font-display text-5xl md:text-6xl text-light tracking-wider">
                {team.name}
              </h1>
              <p className="text-light/60 text-lg">
                {team.clubName} • {team.sport || 'Sport'}
              </p>
            </div>
          </div>
          
          {/* Leave Team Button */}
          {isUserMember && (
            <button
              onClick={handleLeaveTeam}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 rounded-lg transition-all border border-red-600/30 hover:border-red-600/50 flex items-center gap-2"
            >
              <span>🚪</span>
              <span className="font-medium">Leave Team</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="flex gap-2 border-b border-white/20">
          <button
            onClick={() => setActiveTab('events')}
            className={`px-6 py-3 font-title text-lg transition-all ${
              activeTab === 'events'
                ? 'text-primary border-b-2 border-primary'
                : 'text-light/60 hover:text-light'
            }`}
          >
            📅 Events
          </button>
          <button
            onClick={() => setActiveTab('trainers')}
            className={`px-6 py-3 font-title text-lg transition-all ${
              activeTab === 'trainers'
                ? 'text-primary border-b-2 border-primary'
                : 'text-light/60 hover:text-light'
            }`}
          >
            👔 Trainers
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-6 py-3 font-title text-lg transition-all ${
              activeTab === 'members'
                ? 'text-primary border-b-2 border-primary'
                : 'text-light/60 hover:text-light'
            }`}
          >
            👥 Members
          </button>
          <button
            onClick={() => navigate(`/teams/${id}/statistics`)}
            className="ml-auto px-6 py-3 font-title text-lg bg-gradient-to-r from-primary to-accent text-dark rounded-lg hover:shadow-lg transition-all"
          >
            📊 Statistics
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        {/* Events Tab */}
        {activeTab === 'events' && (
          <div>
            <h2 className="font-title text-2xl text-light mb-4 flex items-center gap-3">
              <span className="w-1 h-6 bg-primary rounded"></span>
              Upcoming Events
            </h2>
            {upcomingEvents.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-white/20 bg-white/5 backdrop-blur-sm p-12 text-center">
                <div className="text-6xl mb-4">📅</div>
                <h3 className="font-title text-2xl text-light mb-2">No Upcoming Events</h3>
                <p className="text-light/60">No events scheduled in the next 5 days.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {upcomingEvents.map((event, idx) => (
                  <div
                    key={event.id}
                    onClick={() => navigate(`/events/${event.id}`)}
                    className="group cursor-pointer bg-white/5 backdrop-blur-sm border border-white/10 p-5 rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all duration-300 card-hover"
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-4xl">{getEventIcon(event.type)}</div>
                        <div>
                          <h3 className="font-title text-xl text-light group-hover:text-primary transition-colors">
                            {event.title}
                          </h3>
                          <p className="text-sm text-light/60">
                            {event.type || 'Event'} • {formatDate(event.date)}
                          </p>
                          {event.location && (
                            <p className="text-xs text-light/40 mt-1">📍 {event.location}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-primary opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                        →
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Trainers Tab */}
        {activeTab === 'trainers' && (
          <div>
            <h2 className="font-title text-2xl text-light mb-4 flex items-center gap-3">
              <span className="w-1 h-6 bg-primary rounded"></span>
              Trainers ({trainers.length})
            </h2>
            {trainers.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-white/20 bg-white/5 backdrop-blur-sm p-12 text-center">
                <div className="text-6xl mb-4">👔</div>
                <h3 className="font-title text-2xl text-light mb-2">No Trainers</h3>
                <p className="text-light/60">No trainers assigned to this team yet.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {trainers.map((trainer, idx) => (
                  <div
                    key={trainer.id}
                    className="bg-white/5 backdrop-blur-sm border border-white/10 p-5 rounded-xl hover:bg-white/10 transition-all duration-300"
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold text-dark">
                        {trainer.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-title text-xl text-light">{trainer.username || 'Unknown'}</h3>
                        <div className="flex flex-col gap-1 mt-2">
                          <p className="text-sm text-light/60">
                            📧 {trainer.email || 'No email'}
                          </p>
                          <p className="text-sm text-light/60">
                            📱 {trainer.phone || 'No phone'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div>
            <h2 className="font-title text-2xl text-light mb-4 flex items-center gap-3">
              <span className="w-1 h-6 bg-primary rounded"></span>
              Members ({members.length})
            </h2>
            {members.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-white/20 bg-white/5 backdrop-blur-sm p-12 text-center">
                <div className="text-6xl mb-4">👥</div>
                <h3 className="font-title text-2xl text-light mb-2">No Members</h3>
                <p className="text-light/60">No members in this team yet.</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {members.map((member, idx) => (
                  <div
                    key={member.id}
                    className="bg-white/5 backdrop-blur-sm border border-white/10 p-4 rounded-xl hover:bg-white/10 transition-all duration-300"
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center text-xl font-bold text-dark">
                        {member.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <h3 className="font-title text-lg text-light">{member.username || 'Unknown'}</h3>
                        <p className="text-xs text-light/50">{member.role || 'user'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
