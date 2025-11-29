// src/pages/Team.jsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getClub } from '../firebase/firestore';

export default function Team() {
  const { clubId, teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load club and team from Firebase
  useEffect(() => {
    loadTeamData();
  }, [clubId, teamId]);

  async function loadTeamData() {
    try {
      setLoading(true);
      const clubData = await getClub(clubId);
      if (clubData) {
        setClub(clubData);
      }
    } catch (error) {
      console.error('Error loading team:', error);
    } finally {
      setLoading(false);
    }
  }

  const team = useMemo(() => {
    if (!club || !club.teams) return null;
    const foundTeam = club.teams.find(t => t.id === teamId);
    if (foundTeam) {
      return { ...foundTeam, clubId: club.id, clubName: club.name };
    }
    return null;
  }, [club, teamId]);

  // Get upcoming events (mock for now - TODO: integrate with events)
  const upcomingEvents = useMemo(() => {
    if (!team) return [];
    // TODO: Load events from Firebase
    return [];
  }, [team]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!team) return { trainings: 0, matches: 0, tournaments: 0, meetings: 0 };
    // TODO: Calculate from events
    return {
      trainings: 0,
      matches: 0,
      tournaments: 0,
      meetings: 0
    };
  }, [team]);

  // Get team members
  const members = useMemo(() => {
    if (!team) return [];
    return team.members || [];
  }, [team]);

  // Get trainers
  const trainers = useMemo(() => {
    if (!team) return [];
    return team.trainers || [];
  }, [team]);

  // Get assistants
  const assistants = useMemo(() => {
    if (!team) return [];
    return team.assistants || [];
  }, [team]);

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
          onClick={() => navigate('/dashboard')}
          className="mb-4 flex items-center gap-2 text-light/60 hover:text-light transition-colors"
        >
          <span>←</span>
          <span>Back to Dashboard</span>
        </button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-5xl md:text-6xl text-light mb-2">
              {team.name}
            </h1>
            <p className="text-light/60 text-lg">{team.clubName}</p>
          </div>
          
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <div className="text-sm text-light/60 mb-1">Team Members</div>
            <div className="text-3xl font-bold text-primary">{members.length}</div>
          </div>
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
                      className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-light">{event.title}</h3>
                          <p className="text-sm text-light/60">{event.type}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-light/80">{new Date(event.date).toLocaleDateString()}</div>
                          <div className="text-xs text-light/60">{event.time}</div>
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
              <h2 className="font-title text-2xl text-light mb-4">Team Members</h2>
              
              {members.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-2">👥</div>
                  <p className="text-light/60">No members yet</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {members.map((memberId, idx) => (
                    <div
                      key={memberId || idx}
                      className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-medium text-light">Member {idx + 1}</div>
                        <div className="text-sm text-light/60">ID: {memberId.substring(0, 8)}...</div>
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
                  {trainers.map((trainerId, idx) => (
                    <div
                      key={trainerId || idx}
                      className="bg-white/5 border border-white/10 rounded-lg p-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-2xl">
                          👨‍🏫
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-light mb-2">Trainer {idx + 1}</h3>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2 text-light/70">
                              <span>📧</span>
                              <span>trainer{idx + 1}@example.com</span>
                            </div>
                            <div className="flex items-center gap-2 text-light/70">
                              <span>📱</span>
                              <span>+1 (555) 000-{String(idx).padStart(4, '0')}</span>
                            </div>
                            <div className="text-xs text-light/50 mt-2">ID: {trainerId}</div>
                          </div>
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
                  {assistants.map((assistantId, idx) => (
                    <div
                      key={assistantId || idx}
                      className="bg-white/5 border border-white/10 rounded-lg p-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-secondary flex items-center justify-center text-white text-2xl">
                          👨‍💼
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-light mb-2">Assistant {idx + 1}</h3>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2 text-light/70">
                              <span>📧</span>
                              <span>assistant{idx + 1}@example.com</span>
                            </div>
                            <div className="flex items-center gap-2 text-light/70">
                              <span>📱</span>
                              <span>+1 (555) 100-{String(idx).padStart(4, '0')}</span>
                            </div>
                            <div className="text-xs text-light/50 mt-2">ID: {assistantId}</div>
                          </div>
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
