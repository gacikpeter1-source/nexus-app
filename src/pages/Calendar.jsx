// src/pages/Calendar.jsx
import { useQuery } from '@tanstack/react-query';
import { getEvents, getTeams, getCurrentUser } from '../api/localApi';
import { Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export default function Calendar() {
  const { t } = useLanguage();
  
  // Data hooks
  const { data: events = [], isLoading: loadingEvents, error: eventsError } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents,
  });

  const { data: teams = [], isLoading: loadingTeams, error: teamsError } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
      if (!currentUser) return [];
      
      const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
      const allTeams = [];
      
      clubs.forEach(club => {
        const isTrainer = (club.trainers || []).includes(currentUser.id);
        const isAssistant = (club.assistants || []).includes(currentUser.id);
        const isSuperTrainer = club.superTrainer === currentUser.id;
        const isAdmin = currentUser.role === 'admin';
        
        const clubTeams = club.teams || [];
        
        if (isTrainer || isAssistant || isSuperTrainer || isAdmin) {
          clubTeams.forEach(team => {
            allTeams.push({
              ...team,
              clubId: club.id,
              clubName: club.name
            });
          });
        } else {
          clubTeams.forEach(team => {
            const isTeamMember = (team.members || []).includes(currentUser.id);
            if (isTeamMember) {
              allTeams.push({
                ...team,
                clubId: club.id,
                clubName: club.name
              });
            }
          });
        }
      });
      
      return allTeams;
    },
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  // UI state
  const [mode, setMode] = useState('month'); // "table" | "timeline" | "month"
  const [teamFilter, setTeamFilter] = useState('');
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  // Filter state
  const [filterType, setFilterType] = useState('all');
  const [filterValue, setFilterValue] = useState('');

  // Recurrence helpers
  const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  const addMonths = (date, months) => {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() < day) d.setDate(0);
    return d;
  };

  // Expand recurring events
  const expandedEvents = useMemo(() => {
    const expanded = [];
    const endDate = new Date(viewYear + 2, 11, 31);
    
    for (const event of events) {
      if (!event.recurrence || event.recurrence === 'none') {
        expanded.push(event);
      } else {
        const start = new Date(event.date);
        let current = new Date(start);
        
        while (current <= endDate) {
          expanded.push({
            ...event,
            date: current.toISOString().split('T')[0],
            id: `${event.id}-${current.toISOString().split('T')[0]}`
          });
          
          if (event.recurrence === 'daily') current = addDays(current, 1);
          else if (event.recurrence === 'weekly') current = addDays(current, 7);
          else if (event.recurrence === 'monthly') current = addMonths(current, 1);
          else break;
        }
      }
    }
    
    return expanded;
  }, [events, viewYear]);

  // Filter visible events
  const visibleEvents = useMemo(() => {
    if (!user) return [];
    
    const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
    
    const filtered = expandedEvents.filter((event) => {
      if (event.visibilityLevel === 'personal') {
        return event.createdBy === user.id;
      }
      
      if (event.visibilityLevel === 'club') {
        const clubId = event.clubId;
        const club = clubs.find(c => String(c.id) === String(clubId));
        if (!club) return false;
        
        const canSee = (club.members || []).includes(user.id) ||
                      (club.trainers || []).includes(user.id) ||
                      (club.assistants || []).includes(user.id) ||
                      club.superTrainer === user.id ||
                      user.role === 'admin';
        
        return canSee;
      }
      
      const tid = event.team ?? event.teamId ?? event.teamID;
      if (!tid) return false;
      
      let teamClub = null;
      let foundTeam = null;
      
      for (const club of clubs) {
        const team = (club.teams || []).find(t => String(t.id) === String(tid));
        if (team) {
          teamClub = club;
          foundTeam = team;
          break;
        }
      }
      
      if (!teamClub || !foundTeam) return false;
      
      const isTrainer = (teamClub.trainers || []).includes(user.id);
      const isAssistant = (teamClub.assistants || []).includes(user.id);
      const isMember = (foundTeam.members || []).includes(user.id);
      const isAdmin = user.role === 'admin';
      
      return isMember || isTrainer || isAssistant || isAdmin;
    });

    return filtered;
  }, [expandedEvents, user]);

  // Build filter options
  const filterOptions = useMemo(() => {
    if (!user) return { clubs: [], teams: [], athletes: [] };
    
    const clubsMap = {};
    teams.forEach(t => {
      if (t && t.clubId) {
        clubsMap[t.clubId] = clubsMap[t.clubId] || { 
          id: t.clubId, 
          name: t.clubName || t.club || `Club ${t.clubId}` 
        };
      }
    });

    const clubsList = Object.values(clubsMap);
    const availableTeams = teams;
    const athletes = (user && user.athletes) ? user.athletes : [];

    return {
      clubs: clubsList,
      teams: availableTeams,
      athletes
    };
  }, [teams, user]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    let filtered = visibleEvents;

    if (filterType === 'club' && filterValue) {
      filtered = filtered.filter(ev => String(ev.clubId) === String(filterValue));
    } else if (filterType === 'team' && filterValue) {
      filtered = filtered.filter(ev => {
        const tid = ev.team ?? ev.teamId ?? ev.teamID;
        return String(tid) === String(filterValue);
      });
    } else if (filterType === 'athlete' && filterValue) {
      filtered = filtered.filter(ev => {
        return ev.athleteId === filterValue || (ev.athletes || []).includes(filterValue);
      });
    }

    return filtered;
  }, [visibleEvents, filterType, filterValue]);

  // Month view helpers
  const buildMonthGrid = (year, month) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const grid = [];
    let week = [];
    
    const monday = startDay === 0 ? 6 : startDay - 1;
    for (let i = 0; i < monday; i++) {
      week.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      week.push(new Date(year, month, day));
      if (week.length === 7) {
        grid.push(week);
        week = [];
      }
    }
    
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      grid.push(week);
    }
    
    return grid;
  };

  const monthGrid = buildMonthGrid(viewYear, viewMonth);

  const toKey = (date) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of filteredEvents) {
      const key = ev.date;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [filteredEvents]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
    setSelectedDay(null);
  };

  const typeColor = (type) => {
    const colors = {
      training: 'bg-blue-500/20 text-blue-400',
      match: 'bg-red-500/20 text-red-400',
      meeting: 'bg-purple-500/20 text-purple-400',
      event: 'bg-green-500/20 text-green-400'
    };
    return colors[type] || 'bg-gray-500/20 text-gray-400';
  };

  if (loadingEvents || loadingTeams) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-light/60">{t('common.loading')}...</div>
      </div>
    );
  }

  if (eventsError || teamsError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">Error loading calendar</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="font-display text-6xl md:text-7xl text-light mb-2 tracking-wider">
          <span className="text-primary">CALENDAR</span>
        </h1>
        <p className="text-light/60 text-lg">
          {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
        </p>
      </div>

      {/* Controls Bar */}
      <div className="mb-6 space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Buttons */}
          <div className="flex gap-2 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setMode('table')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'table'
                  ? 'bg-primary text-white'
                  : 'text-light/60 hover:text-light hover:bg-white/5'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setMode('timeline')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'timeline'
                  ? 'bg-primary text-white'
                  : 'text-light/60 hover:text-light hover:bg-white/5'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setMode('month')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'month'
                  ? 'bg-primary text-white'
                  : 'text-light/60 hover:text-light hover:bg-white/5'
              }`}
            >
              Month View
            </button>
          </div>

          {/* Filters */}
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setFilterValue(''); }}
            className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          >
            <option value="all" className="bg-mid-dark">{t('common.all')}</option>
            <option value="club" className="bg-mid-dark">Club</option>
            <option value="team" className="bg-mid-dark">Team</option>
            {user?.role === 'parent' && <option value="athlete" className="bg-mid-dark">Athlete</option>}
          </select>

          {filterType !== 'all' && (
            <select
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="" className="bg-mid-dark">
                {filterType === 'club' ? 'Select club' : filterType === 'team' ? 'Select team' : 'Select athlete'}
              </option>

              {filterType === 'club' && filterOptions.clubs.map(c => (
                <option key={c.id} value={c.id} className="bg-mid-dark">{c.name || c.id}</option>
              ))}

              {filterType === 'team' && filterOptions.teams.map(t => (
                <option key={t.id} value={t.id} className="bg-mid-dark">{t.name || t.id}</option>
              ))}

              {filterType === 'athlete' && (filterOptions.athletes || []).map(a => (
                <option key={a.id} value={a.id} className="bg-mid-dark">{a.name || a.id}</option>
              ))}
            </select>
          )}

          <div className="flex-1"></div>

          <Link
            to="/events/new"
            className="btn-primary flex items-center gap-2"
          >
            <span>+</span>
            <span>{t('calendar.createEvent') || 'Create Event'}</span>
          </Link>
        </div>
      </div>

      {/* Month View */}
      {mode === 'month' && (
        <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={prevMonth}
                className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-light transition-all"
              >
                ◀
              </button>
              <div className="font-title text-2xl text-light">
                {new Date(viewYear, viewMonth, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })}
              </div>
              <button
                onClick={nextMonth}
                className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-light transition-all"
              >
                ▶
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={viewMonth}
                onChange={(e) => { setViewMonth(Number(e.target.value)); setSelectedDay(null); }}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-light focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={i} className="bg-mid-dark">
                    {new Date(0, i).toLocaleString(undefined, { month: 'long' })}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => { setViewYear(Number(e.target.value)); setSelectedDay(null); }}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-light focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {Array.from({ length: 7 }).map((_, i) => {
                  const y = today.getFullYear() - 3 + i;
                  return <option key={y} value={y} className="bg-mid-dark">{y}</option>;
                })}
              </select>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
                <div key={d} className="text-center font-semibold text-light/60 text-sm py-2">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {monthGrid.map((week, wi) =>
                week.map((cell, ci) => {
                  if (!cell) {
                    return (
                      <div
                        key={`${wi}-${ci}`}
                        className="aspect-square rounded-lg bg-white/5"
                      />
                    );
                  }
                  
                  const key = toKey(cell);
                  const evs = eventsByDate[key] || [];
                  const isToday = key === toKey(new Date());
                  const isSelected = key === selectedDay;

                  return (
                    <div
                      key={key}
                      onClick={() => evs.length > 0 && setSelectedDay(key)}
                      className={`aspect-square rounded-lg p-2 flex flex-col cursor-pointer transition-all ${
                        isToday
                          ? 'bg-primary/20 border-2 border-primary'
                          : isSelected
                          ? 'bg-accent/20 border-2 border-accent'
                          : 'bg-white/5 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className={`text-sm font-medium ${isToday ? 'text-primary' : 'text-light'}`}>
                          {cell.getDate()}
                        </div>
                        {evs.length > 0 && (
                          <div className="text-xs px-1.5 py-0.5 rounded-full bg-primary/30 text-primary font-semibold">
                            {evs.length}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 overflow-hidden space-y-1">
                        {evs.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-light/80 truncate hover:bg-white/20"
                            title={ev.title}
                          >
                            {ev.title}
                          </div>
                        ))}
                        {evs.length > 2 && (
                          <div className="text-xs text-accent">
                            +{evs.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Selected Day Details */}
          {selectedDay && (
            <div className="mt-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-title text-2xl text-light mb-1">
                    {new Date(selectedDay).toDateString()}
                  </h3>
                  <div className="text-sm text-light/60">
                    {(eventsByDate[selectedDay] || []).length} {t('team.events') || 'events'}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-light/60 hover:text-light transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                {(eventsByDate[selectedDay] || []).map((ev) => (
                  <Link
                    key={ev.id}
                    to={`/events/${ev.id}`}
                    className="block p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-1 rounded ${typeColor(ev.type)}`}>
                            {(ev.type || '').toUpperCase()}
                          </span>
                          {ev.time && (
                            <span className="text-sm text-light/60">{ev.time}</span>
                          )}
                        </div>
                        <h4 className="font-medium text-light group-hover:text-primary transition-colors">
                          {ev.title}
                        </h4>
                        {ev.description && (
                          <p className="text-sm text-light/60 mt-1 line-clamp-2">
                            {ev.description}
                          </p>
                        )}
                      </div>
                      <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        →
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table View */}
      {mode === 'table' && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-4 text-light/60 font-semibold">Date</th>
                <th className="text-left p-4 text-light/60 font-semibold">Time</th>
                <th className="text-left p-4 text-light/60 font-semibold">Event</th>
                <th className="text-left p-4 text-light/60 font-semibold">Type</th>
                <th className="text-left p-4 text-light/60 font-semibold">Team</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-light/40">
                    No events found
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => (
                  <tr
                    key={ev.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                  >
                    <td className="p-4 text-light">
                      {new Date(ev.date).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-light/80">{ev.time || '-'}</td>
                    <td className="p-4">
                      <Link
                        to={`/events/${ev.id}`}
                        className="text-light hover:text-primary transition-colors font-medium"
                      >
                        {ev.title}
                      </Link>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded ${typeColor(ev.type)}`}>
                        {(ev.type || '').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-light/60">
                      {teams.find(t => t.id === ev.team)?.name || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Timeline View */}
      {mode === 'timeline' && (
        <div className="space-y-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          {filteredEvents.length === 0 ? (
            <div className="text-center p-8 text-light/40">No events found</div>
          ) : (
            filteredEvents.map((ev) => (
              <Link
                key={ev.id}
                to={`/events/${ev.id}`}
                className="block p-6 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 backdrop-blur-sm transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="text-center min-w-[80px]">
                    <div className="text-2xl font-bold text-primary">
                      {new Date(ev.date).getDate()}
                    </div>
                    <div className="text-sm text-light/60">
                      {new Date(ev.date).toLocaleString(undefined, { month: 'short' })}
                    </div>
                    {ev.time && (
                      <div className="text-xs text-light/40 mt-1">{ev.time}</div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-1 rounded ${typeColor(ev.type)}`}>
                        {(ev.type || '').toUpperCase()}
                      </span>
                    </div>
                    <h3 className="font-title text-xl text-light group-hover:text-primary transition-colors mb-1">
                      {ev.title}
                    </h3>
                    {ev.description && (
                      <p className="text-sm text-light/60 line-clamp-2">{ev.description}</p>
                    )}
                  </div>

                  <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
