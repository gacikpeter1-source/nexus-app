// src/pages/Calendar.jsx
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getUserEvents, getUserClubs } from '../firebase/firestore';
import { getEventRating } from '../firebase/feedback';
import WeekView from '../components/calendar/WeekView';
import DayView from '../components/calendar/DayView';
import FilterModal from '../components/calendar/FilterModal';

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
  const [viewMode, setViewMode] = useState('list'); // list | month | week
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [eventRatings, setEventRatings] = useState({}); // { eventId: { averageRating, totalResponses } }

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
      const userClubs = await getUserClubs(user.id);
      setClubs(userClubs);

      // Load ratings for past training events
      await loadEventRatings(userEvents || []);

    } catch (error) {
      console.error('Error loading calendar:', error);
      showToast('Failed to load calendar', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadEventRatings(events) {
    const ratings = {};
    const now = new Date();

    // Only load ratings for past training events
    const pastTrainings = events.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate < now && e.type === 'training';
    });

    // Load ratings in parallel
    await Promise.all(
      pastTrainings.map(async (event) => {
        try {
          const rating = await getEventRating(event.id);
          if (rating.totalResponses > 0) {
            ratings[event.id] = rating;
          }
        } catch (error) {
          console.error(`Error loading rating for event ${event.id}:`, error);
        }
      })
    );

    setEventRatings(ratings);
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
  // ✅ FIX: Compare date AND time, not just date
  const upcomingEvents = filteredEvents.filter(e => {
    const eventDateTime = new Date(`${e.date}T${e.time || '00:00'}`);
    return eventDateTime >= new Date();
  });
  const pastEvents = filteredEvents.filter(e => {
    const eventDateTime = new Date(`${e.date}T${e.time || '00:00'}`);
    return eventDateTime < new Date();
  });

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

  // Calculate active filter count
  function getActiveFilterCount() {
    let count = 0;
    if (userFilter !== 'all') count++;
    if (clubFilter !== 'all') count++;
    if (teamFilter !== 'all') count++;
    if (typeFilter !== 'all') count++;
    return count;
  }

  // Handle applying filters from modal
  function handleApplyFilters(newFilters) {
    setUserFilter(newFilters.userFilter);
    setClubFilter(newFilters.clubFilter);
    setTeamFilter(newFilters.teamFilter);
    setTypeFilter(newFilters.typeFilter);
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
    <div className="p-0.5">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-title text-2xl md:text-4xl lg:text-5xl text-light">📅 Calendar</h1>
          <Link
            to="/new-event"
            className="px-3 py-2 md:px-6 md:py-3 bg-primary hover:bg-primary/80 text-white rounded-lg text-sm md:text-base font-medium transition-all"
          >
            + New Event
          </Link>
        </div>
      </div>

      {/* Compact View & Filter Bar */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                  viewMode === 'list' 
                    ? 'bg-primary text-white' 
                    : 'bg-white/10 text-light hover:bg-white/15'
                }`}
              >
                📋 List
              </button>
              <button
                onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                  viewMode === 'month' 
                    ? 'bg-primary text-white' 
                    : 'bg-white/10 text-light hover:bg-white/15'
                }`}
              >
                📅 Month
              </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                viewMode === 'week' 
                  ? 'bg-primary text-white' 
                  : 'bg-white/10 text-light hover:bg-white/15'
              }`}
            >
              📆 Week
            </button>
          </div>

          {/* Filter Button with Badge */}
          <button
            onClick={() => setIsFilterModalOpen(true)}
            className="relative px-4 py-2 bg-white/10 hover:bg-white/15 text-light rounded-lg font-medium transition-all text-sm flex items-center gap-2"
          >
            🔍 Filters
            {getActiveFilterCount() > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center font-bold">
                {getActiveFilterCount()}
              </span>
            )}
          </button>

          {/* Active Filter Chips */}
          {getActiveFilterCount() > 0 && (
            <div className="flex flex-wrap gap-2 ml-auto">
              {userFilter !== 'all' && (
                <div className="flex items-center gap-1 px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-medium">
                  {userFilter === 'mine' ? 'My Events' : userFilter}
                  <button
                    onClick={() => setUserFilter('all')}
                    className="hover:text-white transition-colors"
            >
                    ×
                  </button>
                </div>
              )}
              {clubFilter !== 'all' && (
                <div className="flex items-center gap-1 px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-medium">
                  {clubs.find(c => c.id === clubFilter)?.name || 'Club'}
                  <button
                    onClick={() => {
                      setClubFilter('all');
                      setTeamFilter('all');
                    }}
                    className="hover:text-white transition-colors"
                  >
                    ×
                  </button>
          </div>
              )}
              {teamFilter !== 'all' && (
                <div className="flex items-center gap-1 px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-medium">
                  {teams.find(t => t.id === teamFilter)?.name || 'Team'}
                  <button
                    onClick={() => setTeamFilter('all')}
                    className="hover:text-white transition-colors"
                  >
                    ×
                  </button>
          </div>
              )}
              {typeFilter !== 'all' && (
                <div className="flex items-center gap-1 px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-medium capitalize">
                  {typeFilter}
                  <button
                    onClick={() => setTypeFilter('all')}
                    className="hover:text-white transition-colors"
                  >
                    ×
                  </button>
        </div>
              )}
          </div>
          )}
        </div>
      </div>

      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={{
          userFilter,
          clubFilter,
          teamFilter,
          typeFilter
        }}
        clubs={clubs}
        teams={teams}
        onApply={handleApplyFilters}
      />

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
                <div className="text-4xl md:text-6xl mb-4">📅</div>
                <h3 className="font-title text-2xl text-light mb-2">No Upcoming Events</h3>
                <p className="text-light/60">Create your first event to get started!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map(event => {
                  // Check if current user declined or attending this event
                  const userResponse = event.responses?.[user?.id];
                  const isDeclined = userResponse?.status === 'declined';
                  const isAttending = userResponse?.status === 'attending';
                  
                  const attendingCount = event.responses 
                    ? Object.values(event.responses).filter(r => r.status === 'attending').length 
                    : 0;
                  const totalLimit = event.participantLimit || '∞';
                  
                  return (
                    <Link
                      key={event.id}
                      to={`/event/${event.id}`}
                      className={`group flex items-center gap-2 p-2 rounded-lg transition-all mb-2 ${
                        isDeclined ? 'opacity-50 bg-gray-800 hover:bg-gray-750' : 
                        isAttending ? 'bg-green-500/10 hover:bg-green-500/20' : 
                        'bg-gray-800 hover:bg-gray-750'
                      }`}
                    >
                      {/* Type Badge */}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                        event.type === 'training' ? 'bg-blue-500/20 text-blue-300' :
                        event.type === 'game' ? 'bg-green-500/20 text-green-300' :
                        event.type === 'tournament' ? 'bg-purple-500/20 text-purple-300' :
                        'bg-gray-500/20 text-gray-300'
                      }`}>
                        {event.type?.charAt(0).toUpperCase() || 'E'}
                      </span>
                      
                      {/* Separator */}
                      <span className="text-gray-600">|</span>
                      
                      {/* Date + Time */}
                      <span className="text-xs text-gray-400 shrink-0">
                        {(() => {
                          const date = new Date(event.date);
                          const month = date.getMonth() + 1;
                          const day = date.getDate();
                          return `${month}/${day}`;
                        })()} {event.time || ''}
                      </span>
                      
                      {/* Separator */}
                      <span className="text-gray-600">|</span>
                      
                      {/* Title */}
                      <span className={`text-sm font-semibold truncate flex-1 min-w-0 ${
                        isDeclined ? 'text-white/50 line-through' : 'text-white'
                      }`}>
                        {event.title}
                      </span>
                      
                      {/* Location (hidden on mobile) */}
                      {event.location && (
                        <>
                          <span className="hidden md:inline text-gray-600">|</span>
                          <span className="hidden md:inline text-xs text-gray-500 truncate max-w-[150px]">
                            📍 {event.location}
                          </span>
                        </>
                      )}
                      
                      {/* Separator */}
                      <span className="text-gray-600 shrink-0">|</span>
                      
                      {/* Attendance Badge */}
                      <span className="text-xs text-gray-400 shrink-0">
                        {attendingCount}/{totalLimit}
                      </span>
                      
                      {/* Registered Badge */}
                      {isAttending && (
                        <span className="text-green-400 text-sm shrink-0">✓</span>
                      )}
                    </Link>
                  );
                })}
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
              
              <div className="space-y-2">
                {pastEvents.slice(0, 10).map(event => {
                  const userResponse = event.responses?.[user?.id];
                  const isDeclined = userResponse?.status === 'declined';
                  const isAttending = userResponse?.status === 'attending';
                  
                  const attendingCount = event.responses 
                    ? Object.values(event.responses).filter(r => r.status === 'attending').length 
                    : 0;
                  const totalLimit = event.participantLimit || '∞';
                  
                  return (
                    <Link
                      key={event.id}
                      to={`/event/${event.id}`}
                      className={`group flex items-center gap-2 p-2 rounded-lg transition-all mb-2 ${
                        isDeclined ? 'opacity-40 bg-gray-800 hover:bg-gray-750' : 
                        'opacity-60 hover:opacity-100 bg-gray-800 hover:bg-gray-750'
                      }`}
                    >
                      {/* Type Badge */}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 opacity-60 ${
                        event.type === 'training' ? 'bg-blue-500/20 text-blue-300' :
                        event.type === 'game' ? 'bg-green-500/20 text-green-300' :
                        event.type === 'tournament' ? 'bg-purple-500/20 text-purple-300' :
                        'bg-gray-500/20 text-gray-300'
                      }`}>
                        {event.type?.charAt(0).toUpperCase() || 'E'}
                      </span>
                      
                      {/* Separator */}
                      <span className="text-gray-600">|</span>
                      
                      {/* Date + Time */}
                      <span className="text-xs text-gray-500 shrink-0">
                        {(() => {
                          const date = new Date(event.date);
                          const month = date.getMonth() + 1;
                          const day = date.getDate();
                          return `${month}/${day}`;
                        })()} {event.time || ''}
                      </span>
                      
                      {/* Separator */}
                      <span className="text-gray-600">|</span>
                      
                      {/* Title */}
                      <span className={`text-sm font-semibold truncate flex-1 min-w-0 ${
                        isDeclined ? 'text-white/40 line-through' : 'text-white/60'
                      }`}>
                        {event.title}
                      </span>
                      
                      {/* Location (hidden on mobile) */}
                      {event.location && (
                        <>
                          <span className="hidden md:inline text-gray-600">|</span>
                          <span className="hidden md:inline text-xs text-gray-500 truncate max-w-[150px]">
                            📍 {event.location}
                          </span>
                        </>
                      )}
                      
                      {/* Separator */}
                      <span className="text-gray-600 shrink-0">|</span>
                      
                      {/* Rating Badge (for trainings) */}
                      {eventRatings[event.id] && (
                        <>
                          <span className="text-xs text-yellow-400 shrink-0">
                            {eventRatings[event.id].averageRating}⭐
                          </span>
                          <span className="text-gray-600 shrink-0">|</span>
                        </>
                      )}
                      
                      {/* Attendance Badge */}
                      <span className="text-xs text-gray-500 shrink-0">
                        {attendingCount}/{totalLimit}
                      </span>
                      
                      {/* Registered Badge */}
                      {isAttending && (
                        <span className="text-green-400/60 text-sm shrink-0">✓</span>
                      )}
                    </Link>
                  );
                })}
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
          <div className="grid grid-cols-7 gap-1 md:gap-2">
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
                    {dayEvents.slice(0, 2).map(event => {
                      const userResponse = event.responses?.[user?.id];
                      const isAttending = userResponse?.status === 'attending';
                      
                      const attendingCount = event.responses 
                        ? Object.values(event.responses).filter(r => r.status === 'attending').length 
                        : 0;
                      const totalLimit = event.participantLimit || '∞';
                      const isFull = event.participantLimit && attendingCount >= event.participantLimit;
                      
                      return (
                      <Link
                        key={event.id}
                        to={`/event/${event.id}`}
                          className={`block text-xs px-1 py-0.5 rounded truncate transition-all ${
                            isAttending 
                              ? 'bg-green-500/30 text-green-200 border border-green-500/50 hover:bg-green-500/50' 
                              : 'bg-primary/30 text-light hover:bg-primary/50'
                          }`}
                          title={`${isAttending ? '✓ ' : ''}${event.title} (${attendingCount}/${totalLimit})`}
                      >
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">
                              {isAttending && '✓ '}{getEventIcon(event.type)} {event.title}
                            </span>
                            <span className={`shrink-0 font-bold ${isFull ? 'text-red-300' : ''}`}>
                              {attendingCount}/{totalLimit}
                            </span>
                          </div>
                      </Link>
                      );
                    })}
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

      {/* Week/Day View - Responsive */}
      {viewMode === 'week' && (
        <>
          {/* Desktop: Week View (≥1024px) */}
          <div className="hidden lg:block">
            <WeekView events={filteredEvents} user={user} />
          </div>
          
          {/* Mobile/Tablet: Day View (<1024px) */}
          <div className="block lg:hidden">
            <DayView events={filteredEvents} user={user} />
          </div>
        </>
      )}
    </div>
  );
}
