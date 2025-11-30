// src/pages/Calendar.jsx
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getUserEvents, getAllClubs } from '../firebase/firestore';

export default function Calendar() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clubFilter, setClubFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all'); // 'all' or 'mine'
  const [viewMode, setViewMode] = useState('list'); // list | month

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  useEffect(() => {
    if (user) {
      loadCalendarData();
    }
  }, [user]);

  async function loadCalendarData() {
    try {
      setLoading(true);

      // Load user's events
      const userEvents = await getUserEvents(user.id);
      setEvents(userEvents || []);

      // Load clubs for filter
      const allClubs = await getAllClubs();
      const userClubs = allClubs.filter(club =>
        (club.members || []).includes(user.id) ||
        (club.trainers || []).includes(user.id) ||
        (club.assistants || []).includes(user.id) ||
        club.createdBy === user.id
      );
      setClubs(userClubs);

    } catch (error) {
      console.error('Error loading calendar:', error);
      showToast('Failed to load calendar', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Get teams filtered by selected club
  const teams = useMemo(() => {
    const allTeams = [];
    const clubsToShow = clubFilter === 'all' ? clubs : clubs.filter(c => c.id === clubFilter);
    
    clubsToShow.forEach(club => {
      (club.teams || []).forEach(team => {
        allTeams.push({
          ...team,
          clubId: club.id,
          clubName: club.name,
          displayName: `${team.name} (${club.name})`
        });
      });
    });
    return allTeams;
  }, [clubs, clubFilter]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    // Filter by user (mine vs all)
    if (userFilter === 'mine') {
      filtered = filtered.filter(e => e.createdBy === user.id);
    }

    // Filter by club
    if (clubFilter !== 'all') {
      filtered = filtered.filter(e => e.clubId === clubFilter);
    }

    // Filter by team
    if (teamFilter !== 'all') {
      filtered = filtered.filter(e => e.teamId === teamFilter);
    }

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(e => e.type === typeFilter);
    }

    // Sort by date (soonest first)
    return filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [events, clubFilter, teamFilter, typeFilter, userFilter, user]);

  // Split into upcoming and past
  const upcomingEvents = filteredEvents.filter(e => new Date(e.date) >= new Date().setHours(0, 0, 0, 0));
  const pastEvents = filteredEvents.filter(e => new Date(e.date) < new Date().setHours(0, 0, 0, 0));

  // Get events for month view
  function getEventsForDay(year, month, day) {
    return filteredEvents.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate.getFullYear() === year &&
             eventDate.getMonth() === month &&
             eventDate.getDate() === day;
    });
  }

  // Calendar grid generation
  function generateCalendarDays() {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];

    // Empty cells before month starts
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  }

  function previousMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function getEventIcon(type) {
    switch(type) {
      case 'training': return '🏋️';
      case 'game':
      case 'match': return '⚽';
      case 'tournament': return '🏆';
      case 'meeting': return '💼';
      case 'social': return '🎉';
      default: return '📅';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-light/60">Loading calendar...</div>
      </div>
    );
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-title text-5xl text-light">📅 Calendar</h1>
          <Link
            to="/new-event"
            className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
          >
            + New Event
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
        <div className="grid md:grid-cols-4 gap-4">
          {/* View Mode */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-light/80 mb-2">View</label>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                  viewMode === 'list' 
                    ? 'bg-primary text-white' 
                    : 'bg-white/10 text-light hover:bg-white/15'
                }`}
              >
                📋 List
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                  viewMode === 'month' 
                    ? 'bg-primary text-white' 
                    : 'bg-white/10 text-light hover:bg-white/15'
                }`}
              >
                📅 Month
              </button>
            </div>
          </div>

          {/* User Filter */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">Show</label>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="all" className="bg-mid-dark">All Events</option>
              <option value="mine" className="bg-mid-dark">My Events Only</option>
            </select>
          </div>

          {/* Club Filter */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">Club</label>
            <select
              value={clubFilter}
              onChange={(e) => {
                setClubFilter(e.target.value);
                setTeamFilter('all'); // Reset team filter when club changes
              }}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="all" className="bg-mid-dark">All Clubs</option>
              {clubs.map(c => (
                <option key={c.id} value={c.id} className="bg-mid-dark">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Team Filter */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">Team</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              disabled={clubFilter === 'all' && teams.length === 0}
            >
              <option value="all" className="bg-mid-dark">
                {clubFilter === 'all' ? 'All Teams' : 'All Teams in Club'}
              </option>
              {teams.map(t => (
                <option key={t.id} value={t.id} className="bg-mid-dark">
                  {clubFilter === 'all' ? t.displayName : t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Second Row - Type Filter */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-light/80 mb-2">Type</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                typeFilter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-white/10 text-light hover:bg-white/15'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter('training')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                typeFilter === 'training'
                  ? 'bg-primary text-white'
                  : 'bg-white/10 text-light hover:bg-white/15'
              }`}
            >
              🏋️ Training
            </button>
            <button
              onClick={() => setTypeFilter('game')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                typeFilter === 'game'
                  ? 'bg-primary text-white'
                  : 'bg-white/10 text-light hover:bg-white/15'
              }`}
            >
              ⚽ Game
            </button>
            <button
              onClick={() => setTypeFilter('match')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                typeFilter === 'match'
                  ? 'bg-primary text-white'
                  : 'bg-white/10 text-light hover:bg-white/15'
              }`}
            >
              ⚽ Match
            </button>
            <button
              onClick={() => setTypeFilter('tournament')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                typeFilter === 'tournament'
                  ? 'bg-primary text-white'
                  : 'bg-white/10 text-light hover:bg-white/15'
              }`}
            >
              🏆 Tournament
            </button>
            <button
              onClick={() => setTypeFilter('meeting')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                typeFilter === 'meeting'
                  ? 'bg-primary text-white'
                  : 'bg-white/10 text-light hover:bg-white/15'
              }`}
            >
              💼 Meeting
            </button>
            <button
              onClick={() => setTypeFilter('social')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                typeFilter === 'social'
                  ? 'bg-primary text-white'
                  : 'bg-white/10 text-light hover:bg-white/15'
              }`}
            >
              🎉 Social
            </button>
          </div>
        </div>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-8">
          {/* Upcoming Events */}
          <div>
            <h2 className="font-title text-2xl text-light mb-4 flex items-center gap-3">
              <span className="w-1 h-6 bg-primary rounded"></span>
              Upcoming Events ({upcomingEvents.length})
            </h2>
            
            {upcomingEvents.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
                <div className="text-6xl mb-4">📅</div>
                <h3 className="font-title text-2xl text-light mb-2">No Upcoming Events</h3>
                <p className="text-light/60">Create your first event to get started!</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {upcomingEvents.map(event => (
                  <Link
                    key={event.id}
                    to={`/event/${event.id}`}
                    className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 hover:bg-white/10 hover:border-primary/50 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="text-4xl">{getEventIcon(event.type)}</div>
                        <div className="flex-1">
                          <h3 className="font-title text-xl text-light group-hover:text-primary transition-colors mb-1">
                            {event.title}
                          </h3>
                          <p className="text-sm text-light/60 capitalize mb-2">
                            {event.type || 'Event'}
                            {event.visibilityLevel === 'team' && ' • Team Event'}
                            {event.visibilityLevel === 'club' && ' • Club Event'}
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-light/70">
                            <span>📅 {new Date(event.date).toLocaleDateString()}</span>
                            {event.time && <span>🕐 {event.time}</span>}
                            {event.location && <span>📍 {event.location}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.responses && Object.keys(event.responses).length > 0 && (
                          <div className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs font-medium">
                            {Object.values(event.responses).filter(r => r.status === 'attending').length} attending
                          </div>
                        )}
                        <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <div>
              <h2 className="font-title text-2xl text-light mb-4 flex items-center gap-3">
                <span className="w-1 h-6 bg-light/30 rounded"></span>
                Past Events ({pastEvents.length})
              </h2>
              
              <div className="grid gap-4">
                {pastEvents.slice(0, 10).map(event => (
                  <Link
                    key={event.id}
                    to={`/event/${event.id}`}
                    className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-all opacity-60 hover:opacity-100"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="text-3xl">{getEventIcon(event.type)}</div>
                        <div className="flex-1">
                          <h3 className="font-medium text-light mb-1">{event.title}</h3>
                          <div className="flex gap-3 text-xs text-light/60">
                            <span>📅 {new Date(event.date).toLocaleDateString()}</span>
                            {event.responses && (
                              <span className="text-green-400">
                                ✅ {Object.values(event.responses).filter(r => r.status === 'attending').length} attended
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Month View */}
      {viewMode === 'month' && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={previousMonth}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-light rounded-lg transition-all"
            >
              ← Previous
            </button>
            <h2 className="font-title text-2xl text-light">
              {monthNames[viewMonth]} {viewYear}
            </h2>
            <button
              onClick={nextMonth}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-light rounded-lg transition-all"
            >
              Next →
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-medium text-light/60 py-2">
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {generateCalendarDays().map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="aspect-square" />;
              }

              const dayEvents = getEventsForDay(viewYear, viewMonth, day);
              const isToday = today.getDate() === day && 
                             today.getMonth() === viewMonth && 
                             today.getFullYear() === viewYear;

              return (
                <div
                  key={day}
                  className={`aspect-square border border-white/10 rounded-lg p-2 ${
                    isToday ? 'bg-primary/20 border-primary' : 'bg-white/5'
                  } hover:bg-white/10 transition-all cursor-pointer`}
                >
                  <div className={`text-sm font-medium mb-1 ${
                    isToday ? 'text-primary' : 'text-light'
                  }`}>
                    {day}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map(event => (
                      <Link
                        key={event.id}
                        to={`/event/${event.id}`}
                        className="block text-xs px-1 py-0.5 bg-primary/30 text-light rounded truncate hover:bg-primary/50 transition-all"
                        title={event.title}
                      >
                        {getEventIcon(event.type)} {event.title}
                      </Link>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-light/60 px-1">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

