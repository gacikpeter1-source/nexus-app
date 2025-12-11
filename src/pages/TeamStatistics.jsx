// src/pages/TeamStatistics.jsx
import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function TeamStatistics() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [filterType, setFilterType] = useState('all'); // all, training, game, match, tournament
  const [filterDate, setFilterDate] = useState('all'); // all, week, month, year, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Load team data
  const team = useMemo(() => {
    try {
      const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
      for (const club of clubs) {
        if (!Array.isArray(club.teams)) continue;
        const foundTeam = club.teams.find(t => t.id === id);
        if (foundTeam) {
          return { ...foundTeam, clubId: club.id, clubName: club.name };
        }
      }
      return null;
    } catch {
      return null;
    }
  }, [id]);

  // Load all events
  const allEvents = useMemo(() => {
    try {
      // Events are stored in 'sportsapp:localEvents', not 'events'
      return JSON.parse(localStorage.getItem('sportsapp:localEvents') || '[]');
    } catch {
      return [];
    }
  }, []);

  // Load users
  const users = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('users') || '[]');
    } catch {
      return [];
    }
  }, []);

  // Get team events
  const teamEvents = useMemo(() => {
    if (!team) return [];
    return allEvents.filter(e => e.teamId === team.id);
  }, [team, allEvents]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    let events = [...teamEvents];

    // Filter by type
    if (filterType !== 'all') {
      events = events.filter(e => e.type?.toLowerCase() === filterType);
    }

    // Filter by date
    const now = new Date();
    if (filterDate === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      events = events.filter(e => new Date(e.date) >= weekAgo && new Date(e.date) <= now);
    } else if (filterDate === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      events = events.filter(e => new Date(e.date) >= monthAgo && new Date(e.date) <= now);
    } else if (filterDate === 'year') {
      const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      events = events.filter(e => new Date(e.date) >= yearAgo && new Date(e.date) <= now);
    } else if (filterDate === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      events = events.filter(e => {
        const eventDate = new Date(e.date);
        return eventDate >= start && eventDate <= end;
      });
    }

    // Sort by date (newest first)
    return events.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [teamEvents, filterType, filterDate, customStartDate, customEndDate]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredEvents.length;
    const byType = {};
    
    filteredEvents.forEach(event => {
      const type = event.type?.toLowerCase() || 'other';
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      total,
      training: byType.training || 0,
      game: byType.game || 0,
      match: byType.match || 0,
      tournament: byType.tournament || 0,
      other: byType.other || 0
    };
  }, [filteredEvents]);

  // Get attendance for an event
  const getAttendance = (event) => {
    try {
      const responses = JSON.parse(localStorage.getItem(`event_responses_${event.id}`) || '{}');
      const attended = Object.entries(responses).filter(([_, r]) => r.status === 'confirmed');
      return attended.length;
    } catch {
      return 0;
    }
  };

  // Get attendance details for an event
  const getAttendanceDetails = (event) => {
    try {
      const responses = JSON.parse(localStorage.getItem(`event_responses_${event.id}`) || '{}');
      const attended = [];
      
      Object.entries(responses).forEach(([userId, response]) => {
        if (response.status === 'confirmed') {
          const user = users.find(u => u.id === userId);
          if (user) {
            attended.push(user.username || 'Unknown');
          }
        }
      });
      
      return attended;
    } catch {
      return [];
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
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

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="font-title text-2xl text-light mb-2">Team Not Found</h2>
          <button
            onClick={() => navigate('/clubs')}
            className="btn-primary mt-4"
          >
            ← Back to Clubs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate(`/teams/${id}`)}
            className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-light transition-all"
          >
            ←
          </button>
          <div>
            <h1 className="font-display text-5xl md:text-6xl text-light tracking-wider">
              📊 STATISTICS
            </h1>
            <p className="text-light/60 text-lg">
              {team.name} • {team.clubName}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        {[
          { label: 'Total', value: stats.total, icon: '📊', color: 'from-primary to-accent' },
          { label: 'Trainings', value: stats.training, icon: '🏋️', color: 'from-blue-500 to-blue-600' },
          { label: 'Games', value: stats.game, icon: '⚽', color: 'from-green-500 to-green-600' },
          { label: 'Matches', value: stats.match, icon: '🏆', color: 'from-yellow-500 to-yellow-600' },
          { label: 'Tournaments', value: stats.tournament, icon: '🥇', color: 'from-purple-500 to-purple-600' }
        ].map((stat, idx) => (
          <div
            key={stat.label}
            className={`bg-gradient-to-br ${stat.color} rounded-xl p-5 text-dark`}
            style={{ animationDelay: `${idx * 0.05}s` }}
          >
            <div className="text-3xl mb-2">{stat.icon}</div>
            <div className="font-title text-4xl mb-1">{stat.value}</div>
            <div className="text-xs uppercase tracking-wider opacity-80">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Attendance Button */}
      <div className="mb-8 animate-fade-in" style={{ animationDelay: '0.15s' }}>
        <button
          onClick={() => navigate(`/team/${id.split('/')[0]}/${id.split('/')[1]}/attendance/history`)}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl p-6 transition-all shadow-lg hover:shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div className="text-left">
              <div className="text-2xl font-bold mb-1">📋 View Attendance Records</div>
              <div className="text-sm opacity-90">Track team member attendance and statistics</div>
            </div>
            <div className="text-4xl">→</div>
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <h2 className="font-title text-xl text-light mb-4">Filters</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-light/80 mb-2">Event Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="all" className="bg-mid-dark">All Types</option>
                <option value="training" className="bg-mid-dark">🏋️ Training</option>
                <option value="game" className="bg-mid-dark">⚽ Game</option>
                <option value="match" className="bg-mid-dark">🏆 Match</option>
                <option value="tournament" className="bg-mid-dark">🥇 Tournament</option>
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-sm font-medium text-light/80 mb-2">Time Period</label>
              <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="all" className="bg-mid-dark">All Time</option>
                <option value="week" className="bg-mid-dark">Last 7 Days</option>
                <option value="month" className="bg-mid-dark">Last 30 Days</option>
                <option value="year" className="bg-mid-dark">Last Year</option>
                <option value="custom" className="bg-mid-dark">Custom Range</option>
              </select>
            </div>

            {/* Custom Date Range */}
            {filterDate === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-light/80 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-light/80 mb-2">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <h2 className="font-title text-2xl text-light mb-4 flex items-center gap-3">
          <span className="w-1 h-6 bg-primary rounded"></span>
          Events ({filteredEvents.length})
        </h2>

        {filteredEvents.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-white/20 bg-white/5 backdrop-blur-sm p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="font-title text-2xl text-light mb-2">No Events Found</h3>
            <p className="text-light/60">Try adjusting your filters to see more events.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredEvents.map((event, idx) => {
              const attendees = getAttendanceDetails(event);
              const attendanceCount = attendees.length;

              return (
                <div
                  key={event.id}
                  onClick={() => navigate(`/events/${event.id}`)}
                  className="group cursor-pointer bg-white/5 backdrop-blur-sm border border-white/10 p-5 rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all duration-300"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="text-4xl">{getEventIcon(event.type)}</div>
                      <div className="flex-1">
                        <h3 className="font-title text-xl text-light group-hover:text-primary transition-colors">
                          {event.title}
                        </h3>
                        <p className="text-sm text-light/60 mb-2">
                          {event.type || 'Event'} • {formatDate(event.date)}
                        </p>
                        {event.location && (
                          <p className="text-xs text-light/40 mb-3">📍 {event.location}</p>
                        )}

                        {/* Attendance */}
                        <div className="mt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-light">
                              👥 Attendance: {attendanceCount} {attendanceCount === 1 ? 'person' : 'people'}
                            </span>
                          </div>
                          {attendees.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {attendees.map((name, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-1 bg-primary/20 text-primary text-xs rounded-full"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-primary opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                      →
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
