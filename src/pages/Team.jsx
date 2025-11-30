// src/pages/Team.jsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getClub, updateClub, getAllUsers, getClubEvents, getTeamEvents } from '../firebase/firestore';
import { useToast } from '../contexts/ToastContext';

export default function Team() {
  const { clubId, teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);
  const [events, setEvents] = useState([]);

  // Load club and team from Firebase
  useEffect(() => {
    loadTeamData();
  }, [clubId, teamId]);

  async function loadTeamData() {
    try {
      setLoading(true);
      
      // Load club data
      const clubData = await getClub(clubId);
      if (clubData) {
        setClub(clubData);
      }

      // Load all users for name lookup
      const users = await getAllUsers();
      setAllUsers(users);

      // Load events for this team
      const teamEvents = await getTeamEvents(teamId);
      setEvents(teamEvents || []);

    } catch (error) {
      console.error('Error loading team:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleLeaveTeam = async () => {
    if (!team) return;
    
    if (!window.confirm(`Are you sure you want to leave ${team.name}?`)) return;
    
    try {
      const updatedMembers = (team.members || []).filter(id => id !== user.id);
      const updatedTrainers = (team.trainers || []).filter(id => id !== user.id);
      const updatedAssistants = (team.assistants || []).filter(id => id !== user.id);
      
      const updatedTeams = (club.teams || []).map(t => 
        t.id === teamId 
          ? { 
              ...t, 
              members: updatedMembers,
              trainers: updatedTrainers,
              assistants: updatedAssistants
            }
          : t
      );
      
      await updateClub(clubId, { teams: updatedTeams });
      showToast('Left team successfully', 'success');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error leaving team:', error);
      showToast('Failed to leave team', 'error');
    }
  };

  const team = useMemo(() => {
    if (!club || !club.teams) return null;
    const foundTeam = club.teams.find(t => t.id === teamId);
    if (foundTeam) {
      return { ...foundTeam, clubId: club.id, clubName: club.name };
    }
    return null;
  }, [club, teamId]);

  // Get upcoming events (next 5)
  const upcomingEvents = useMemo(() => {
    if (!team || !events) return [];
    
    const now = new Date();
    
    // Filter future events for this team
    const futureEvents = events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= now;
    });
    
    // Sort by date (soonest first) and take first 5
    return futureEvents
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
  }, [team, events]);

  // Calculate statistics from events
  const statistics = useMemo(() => {
    if (!team || !events) return { trainings: 0, matches: 0, tournaments: 0, meetings: 0 };
    
    const stats = {
      trainings: 0,
      matches: 0,
      tournaments: 0,
      meetings: 0
    };

    events.forEach(event => {
      const type = event.type?.toLowerCase();
      if (type === 'training') stats.trainings++;
      else if (type === 'match' || type === 'game') stats.matches++;
      else if (type === 'tournament') stats.tournaments++;
      else if (type === 'meeting') stats.meetings++;
    });

    return stats;
  }, [team, events]);

  // Get team members with user details
  const members = useMemo(() => {
    if (!team || !allUsers) return [];
    const memberIds = team.members || [];
    return memberIds.map(id => {
      const user = allUsers.find(u => u.id === id);
      return user || { id, username: 'Unknown', email: 'N/A' };
    });
  }, [team, allUsers]);

  // Get trainers with user details
  const trainers = useMemo(() => {
    if (!team || !allUsers) return [];
    const trainerIds = team.trainers || [];
    return trainerIds.map(id => {
      const user = allUsers.find(u => u.id === id);
      return user || { id, username: 'Unknown', email: 'N/A' };
    });
  }, [team, allUsers]);

  // Get assistants with user details
  const assistants = useMemo(() => {
    if (!team || !allUsers) return [];
    const assistantIds = team.assistants || [];
    return assistantIds.map(id => {
      const user = allUsers.find(u => u.id === id);
      return user || { id, username: 'Unknown', email: 'N/A' };
    });
  }, [team, allUsers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-light/60">Loading team...</div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="text-6xl mb-4">❌</div>
        <h2 className="font-title text-2xl text-light mb-2">Team Not Found</h2>
        <p className="text-light/60 mb-6">This team doesn't exist or has been deleted.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-light/60 hover:text-light transition-colors"
        >
          <span>←</span>
          <span>Back</span>
        </button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-5xl md:text-6xl text-light mb-2">
              {team.name}
            </h1>
            <p className="text-light/60 text-lg">{team.clubName}</p>
          </div>
          
          {/* Leave Team Button */}
          <button
            onClick={handleLeaveTeam}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-all flex items-center gap-2"
          >
            <span>🚪</span>
            <span>Leave Team</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/10">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-3 font-medium transition-all ${
            activeTab === 'overview'
              ? 'text-primary border-b-2 border-primary'
              : 'text-light/60 hover:text-light'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`px-6 py-3 font-medium transition-all ${
            activeTab === 'members'
              ? 'text-primary border-b-2 border-primary'
              : 'text-light/60 hover:text-light'
          }`}
        >
          Members ({members.length})
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-6 py-3 font-medium transition-all ${
            activeTab === 'staff'
              ? 'text-primary border-b-2 border-primary'
              : 'text-light/60 hover:text-light'
          }`}
        >
          Trainers & Staff ({trainers.length + assistants.length})
        </button>
        <button
          onClick={() => setActiveTab('statistics')}
          className={`px-6 py-3 font-medium transition-all ${
            activeTab === 'statistics'
              ? 'text-primary border-b-2 border-primary'
              : 'text-light/60 hover:text-light'
          }`}
        >
          Statistics
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Upcoming Events */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <h2 className="font-title text-2xl text-light mb-4">Upcoming Events</h2>
              
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-2">📅</div>
                  <p className="text-light/60">No upcoming events</p>
                  <p className="text-light/40 text-sm mt-1">Events will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event, idx) => (
                    <div
                      key={event.id || idx}
                      onClick={() => navigate(`/event/${event.id}`)}
                      className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 hover:border-primary/50 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">
                              {event.type === 'training' ? '🏋️' : 
                               event.type === 'match' || event.type === 'game' ? '⚽' :
                               event.type === 'tournament' ? '🏆' :
                               event.type === 'meeting' ? '💼' : '📅'}
                            </span>
                            <h3 className="font-semibold text-light group-hover:text-primary transition-colors">
                              {event.title}
                            </h3>
                          </div>
                          <p className="text-sm text-light/60 capitalize">{event.type || 'Event'}</p>
                          {event.location && (
                            <p className="text-xs text-light/50 mt-1">📍 {event.location}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-light/80 font-medium">
                            {new Date(event.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </div>
                          {event.time && (
                            <div className="text-xs text-light/60">{event.time}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <div className="text-3xl mb-2">🏋️</div>
                <div className="text-2xl font-bold text-light">{statistics.trainings}</div>
                <div className="text-sm text-light/60">Trainings</div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <div className="text-3xl mb-2">⚽</div>
                <div className="text-2xl font-bold text-light">{statistics.matches}</div>
                <div className="text-sm text-light/60">Matches</div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <div className="text-3xl mb-2">🏆</div>
                <div className="text-2xl font-bold text-light">{statistics.tournaments}</div>
                <div className="text-sm text-light/60">Tournaments</div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <div className="text-3xl mb-2">💼</div>
                <div className="text-2xl font-bold text-light">{statistics.meetings}</div>
                <div className="text-sm text-light/60">Meetings</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="animate-fade-in">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <h2 className="font-title text-2xl text-light mb-4">Team Members ({members.length})</h2>
              
              {members.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-2">👥</div>
                  <p className="text-light/60">No members yet</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {members.map((member, idx) => (
                    <div
                      key={member.id || idx}
                      className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center gap-4 hover:bg-white/10 transition-all"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg">
                        {member.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-light text-lg">{member.username || 'Unknown User'}</div>
                        <div className="text-sm text-light/60">{member.email || 'No email'}</div>
                      </div>
                      <div className="px-3 py-1 bg-white/10 rounded-full text-xs text-light/70">
                        Member
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="space-y-6 animate-fade-in">
            {/* Trainers */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <h2 className="font-title text-2xl text-light mb-4">Trainers</h2>
              
              {trainers.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-3xl mb-2">👨‍🏫</div>
                  <p className="text-light/60">No trainers assigned</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {trainers.map((trainer, idx) => (
                    <div
                      key={trainer.id || idx}
                      className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white text-2xl font-bold">
                          {trainer.username?.charAt(0).toUpperCase() || '👨‍🏫'}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-light text-lg mb-2">{trainer.username || 'Unknown Trainer'}</h3>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2 text-light/70">
                              <span>📧</span>
                              <span>{trainer.email || 'No email'}</span>
                            </div>
                            {trainer.phone && (
                              <div className="flex items-center gap-2 text-light/70">
                                <span>📱</span>
                                <span>{trainer.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs font-medium">
                          Trainer
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assistants */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <h2 className="font-title text-2xl text-light mb-4">Assistants</h2>
              
              {assistants.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-3xl mb-2">👨‍💼</div>
                  <p className="text-light/60">No assistants assigned</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assistants.map((assistant, idx) => (
                    <div
                      key={assistant.id || idx}
                      className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-secondary flex items-center justify-center text-white text-2xl font-bold">
                          {assistant.username?.charAt(0).toUpperCase() || '👨‍💼'}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-light text-lg mb-2">{assistant.username || 'Unknown Assistant'}</h3>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2 text-light/70">
                              <span>📧</span>
                              <span>{assistant.email || 'No email'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="px-3 py-1 bg-accent/20 text-accent rounded-full text-xs font-medium">
                          Assistant
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'statistics' && (
          <div className="animate-fade-in">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <h2 className="font-title text-2xl text-light mb-6">Team Statistics</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* Events Breakdown */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-light/80">Events Breakdown</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🏋️</span>
                        <span className="text-light">Trainings</span>
                      </div>
                      <span className="text-2xl font-bold text-primary">{statistics.trainings}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">⚽</span>
                        <span className="text-light">Matches</span>
                      </div>
                      <span className="text-2xl font-bold text-primary">{statistics.matches}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🏆</span>
                        <span className="text-light">Tournaments</span>
                      </div>
                      <span className="text-2xl font-bold text-primary">{statistics.tournaments}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">💼</span>
                        <span className="text-light">Meetings</span>
                      </div>
                      <span className="text-2xl font-bold text-primary">{statistics.meetings}</span>
                    </div>
                  </div>
                </div>

                {/* Team Composition */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-light/80">Team Composition</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">👥</span>
                        <span className="text-light">Members</span>
                      </div>
                      <span className="text-2xl font-bold text-accent">{members.length}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">👨‍🏫</span>
                        <span className="text-light">Trainers</span>
                      </div>
                      <span className="text-2xl font-bold text-accent">{trainers.length}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">👨‍💼</span>
                        <span className="text-light">Assistants</span>
                      </div>
                      <span className="text-2xl font-bold text-accent">{assistants.length}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/30">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📊</span>
                        <span className="text-light font-semibold">Total</span>
                      </div>
                      <span className="text-2xl font-bold text-primary">
                        {members.length + trainers.length + assistants.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-accent/10 border border-accent/30 rounded-lg">
                <p className="text-accent text-sm">
                  💡 Tip: Statistics will update automatically as you add events and activities
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

