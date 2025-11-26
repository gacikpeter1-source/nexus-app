// src/pages/Calendar.jsx
import { useQuery } from "@tanstack/react-query";
import { getEvents, getTeams, getCurrentUser } from "../api/localApi";
import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { useLanguage } from '../contexts/LanguageContext';


export default function Calendar() {
  // ✅ CORRECT LOCATION: Add translation hook at component level (FIRST!)
  const { t } = useLanguage();
  
  // data hooks (must be second)
  const { data: events = [], isLoading: loadingEvents, error: eventsError } = useQuery({
    queryKey: ["events"],
    queryFn: getEvents,
    });

  const { data: teams = [], isLoading: loadingTeams, error: teamsError } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      // Get current user first
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
      if (!currentUser) return [];
      
      const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
      const allTeams = [];
      // ❌ REMOVED: const { t } = useLanguage(); ← This was in WRONG location!
      
      clubs.forEach(club => {
        // Check user's role in this club
        const isTrainer = (club.trainers || []).includes(currentUser.id);
        const isAssistant = (club.assistants || []).includes(currentUser.id);
        const isSuperTrainer = club.superTrainer === currentUser.id;
        const isAdmin = currentUser.role === 'admin';
        
        const clubTeams = club.teams || [];
        
        // If trainer, assistant, supertrainer, or admin -> see ALL teams in club
        if (isTrainer || isAssistant || isSuperTrainer || isAdmin) {
          clubTeams.forEach(team => {
            allTeams.push({
              ...team,
              clubId: club.id,
              clubName: club.name
            });
          });
        } else {
          // Regular member -> only see teams they're specifically in
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
    queryKey: ["currentUser"],
    queryFn: getCurrentUser,
  });

  // UI state
  const [mode, setMode] = useState("table"); // "table" | "timeline" | "month"
  const [teamFilter, setTeamFilter] = useState(""); // "" = all
  // month state for month view: store year and month (0-based)
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null); // 'YYYY-MM-DD' selected in month view

  // ---------- NEW: multi-level filter state (kept in addition to original teamFilter)
  // We kept `teamFilter` so none of your original lines were removed.
  const [filterType, setFilterType] = useState("all"); // "all" | "club" | "team" | "athlete"
  const [filterValue, setFilterValue] = useState("");

  // ---------- recurrence helpers ----------
  const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  const addMonths = (date, months) => {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    // handle month rollover
    if (d.getDate() < day) d.setDate(0);
    return d;
  };

  function expandRecurrence(ev) {
    if (!ev.recurrence) return [ev];
    const out = [];
    const start = new Date(ev.date);
    if (isNaN(start.getTime())) return [ev];

    const occurrences = Number(ev.occurrences || 0);
    const hasOcc = occurrences > 0;
    const hasEnd = !!ev.endDate;
    const endDate = hasEnd ? new Date(ev.endDate) : null;

    out.push(ev);

    let i = 1;
    const MAX = 1000;
    while (i <= MAX) {
      if (hasOcc && i + 1 > occurrences) break;
      let next;
      if (ev.recurrence === "daily") next = addDays(start, i);
      else if (ev.recurrence === "weekly") next = addDays(start, i * 7);
      else if (ev.recurrence === "monthly") next = addMonths(start, i);
      else break;

      if (hasEnd && endDate && next > endDate) break;

      out.push({
        ...ev,
        id: `${ev.id}-r${i}`,
        date: next.toISOString().slice(0, 10),
        _isRecurringInstance: true,
        _originalId: ev.id,
        occurrenceIndex: i + 1,
      });

      if (hasOcc && i + 1 >= occurrences) break;
      i += 1;
    }
    return out;
  }

  // ---------- visible events (three-level visibility: personal, team, club) ----------
  const visibleEvents = useMemo(() => {
    const expanded = events.flatMap((e) => expandRecurrence(e));
    if (!user) return [];


    // Get all clubs from localStorage
    const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
    
    const filtered = expanded.filter((event) => {
      // Personal events - only creator sees
      if (event.visibilityLevel === 'personal') {
        const canSee = event.createdBy === user.id;
        console.log(`${canSee ? '✅' : '❌'} Personal event "${event.title}" - Created by: ${event.createdBy}`);
        return canSee;
      }
      
      // Team events - team members see
      if (event.visibilityLevel === 'team') {
        if (!event.teamId || !event.clubId) {
          return false;
        }
        
        const club = clubs.find(c => c.id === event.clubId);
        if (!club) {
          return false;
        }
        
        // Check if user has access to this club
        const isTrainer = (club.trainers || []).includes(user.id);
        const isAssistant = (club.assistants || []).includes(user.id);
        const isMember = (club.members || []).includes(user.id);
        const isAdmin = user.role === 'admin';
        
        if (!isTrainer && !isAssistant && !isMember && !isAdmin) {
          return false;
        }
        
        // Check if in the specific team
        const team = (club.teams || []).find(t => t.id === event.teamId);
        if (!team) {
          return false;
        }
        
        const inTeam = (team.members || []).includes(user.id);
        const canSee = inTeam || isTrainer || isAssistant || isAdmin;
        console.log(`${canSee ? '✅' : '❌'} Team event "${event.title}" (${team.name}) - inTeam: ${inTeam}, isTrainer: ${isTrainer}`);
        return canSee;
      }
      
      // Club events - all club members see
      if (event.visibilityLevel === 'club') {
        if (!event.clubId) {
          return false;
        }
        
        const club = clubs.find(c => c.id === event.clubId);
        if (!club) {
          return false;
        }
        
        const canSee = (club.members || []).includes(user.id) ||
                      (club.trainers || []).includes(user.id) ||
                      (club.assistants || []).includes(user.id) ||
                      club.superTrainer === user.id ||
                      user.role === 'admin';
        
        console.log(`${canSee ? '✅' : '❌'} Club event "${event.title}" (${club.name}) - Club-wide event`);
        return canSee;
      }
      
      // Legacy events without visibilityLevel - treat as team events
      const tid = event.team ?? event.teamId ?? event.teamID;
      if (!tid) return false;
      
      // Find which club this team belongs to
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
  }, [events, user]);

  // ---------- helper to return events filtered by team filter ("" = all) ----------
  const eventsFilteredByTeam = useMemo(() => {
    if (!teamFilter) return visibleEvents;
    return visibleEvents.filter((ev) => {
      // Club events should ALWAYS be visible regardless of team filter
      if (ev.visibilityLevel === 'club') {
        return true;
      }
      
      // Personal events should be visible if they're the user's own
      if (ev.visibilityLevel === 'personal') {
        return ev.createdBy === user?.id;
      }
      
      // Team events - filter by selected team
      const tid = ev.team ?? ev.teamId ?? ev.teamID;
      const matches = String(tid) === String(teamFilter);
      console.log(`${matches ? '✅' : '❌'} Team event "${ev.title}" - Team filter: ${matches ? 'matches' : 'no match'}`);
      return matches;
    });
  }, [visibleEvents, teamFilter, user]);

  // ---------- NEW: build options for multi-level filter (clubs, teams, athletes)
  const filterOptions = useMemo(() => {
    if (!user) return { clubs: [], teams: [], athletes: [] };
    
    // Build clubs list from user's accessible teams only
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

    // Teams are already filtered by user access in the query
    const availableTeams = teams;

    const athletes = (user && user.athletes) ? user.athletes : [];

    return {
      clubs: clubsList,
      teams: availableTeams,
      athletes
    };
  }, [teams, user]);


  // ---------- NEW: events filtered by the selected filter (filterType/filterValue)
  const eventsFilteredByUserChoice = useMemo(() => {
    // If no special filter, use team-filtered events (keeps backward compatibility)
    if ((!filterType || filterType === "all") && !teamFilter) return visibleEvents;

    // Start from visibleEvents (events the user is allowed to see)
    let base = visibleEvents;

    // If old `teamFilter` is set (backwards compat), apply it first
    if (teamFilter) {
      base = base.filter(ev => {
        const tid = ev.team ?? ev.teamId ?? ev.teamID;
        return String(tid) === String(teamFilter);
      });
    }

    if (!filterType || filterType === "all" || !filterValue) return base;

    if (filterType === "club") {
      return base.filter(ev => String(ev.clubId) === String(filterValue));
    } else if (filterType === "team") {
      return base.filter(ev => {
        const tid = ev.team ?? ev.teamId ?? ev.teamID;
        return String(tid) === String(filterValue);
      });
    } else if (filterType === "athlete") {
      return base.filter(ev => String(ev.athleteId || ev.playerId || ev.ownerId) === String(filterValue));
    }
    return base;
  }, [visibleEvents, filterType, filterValue, teamFilter]);

  // ---------- grouping and sorting for list/table/timeline ----------
  const grouped = useMemo(() => {
    return eventsFilteredByUserChoice.reduce((acc, ev) => {
      const dateKey = ev.date || "unknown";
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(ev);
      return acc;
    }, {});
  }, [eventsFilteredByUserChoice]);

  const sortedDates = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => {
      if (a === "unknown") return 1;
      if (b === "unknown") return -1;
      return new Date(a) - new Date(b);
    });
  }, [grouped]);

  // ---------- month view helpers ----------
  const startOfMonth = (y, m) => new Date(y, m, 1);
  const endOfMonth = (y, m) => new Date(y, m + 1, 0);
  const daysInMonth = (y, m) => endOfMonth(y, m).getDate();

  // returns 'YYYY-MM-DD'
  const toKey = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // build month grid: array of weeks, each week is 7 cells (some null)
  const monthGrid = useMemo(() => {
    const first = startOfMonth(viewYear, viewMonth);
    const totalDays = daysInMonth(viewYear, viewMonth);

    // convert JS day (0=Sun) -> Monday-first index (0=Mon..6=Sun)
    const jsFirstDay = first.getDay(); // 0..6 (Sun..Sat)
    const firstWeekday = jsFirstDay === 0 ? 6 : jsFirstDay - 1; // 0..6 where 0=Mon

    const cells = [];
    // pad before (Monday-first)
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(viewYear, viewMonth, d));
    // pad after to fill final week
    while (cells.length % 7 !== 0) cells.push(null);

    // group into weeks
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [viewYear, viewMonth]);

  // events keyed by date for quick lookup (use eventsFilteredByTeam so month obeys team filter)
  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of eventsFilteredByUserChoice) {
      const k = ev.date || "unknown";
      if (!map[k]) map[k] = [];
      map[k].push(ev);
    }
    return map;
  }, [eventsFilteredByUserChoice]);

  // ---------- early returns ----------
  if (eventsError || teamsError) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-4">{t('calendar.title')}</h1>
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-700 font-semibold">{t('common.error')}</p>
        </div>
      </div>
    );
  }

  if (loadingEvents || loadingTeams) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-4">{t('calendar.title')}</h1>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  const teamName = (id) => {
    if (!id) return "Unknown";
    if (!teams || teams.length === 0) return id;
    const team = teams.find(t => String(t.id) === String(id));
    if (!team) return id;
    return team.displayName || team.name || id;
  };

  // ---------- type color helper (literal mapping so Tailwind keeps classes) ----------
  const TYPE_CLASSES = {
    training: "bg-green-100 text-green-700",
    game: "bg-yellow-100 text-yellow-700",
    match: "bg-orange-100 text-orange-700",
    meeting: "bg-purple-100 text-purple-700",
    tournament: "bg-blue-100 text-blue-700",
    default: "bg-gray-100 text-gray-700",
  };

  const typeColor = (type) => {
    if (!type) return TYPE_CLASSES.default;
    const key = String(type).toLowerCase();
    return TYPE_CLASSES[key] || TYPE_CLASSES.default;
  };

  // ---------- UI handlers for month navigation ----------
  const prevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDay(null);
  };
  const nextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDay(null);
  };

  // ---------- render ----------
  return (
    <div className="p-6">
      {/* Hidden palette to keep Tailwind classes (safe) */}
      <div className="sr-only" aria-hidden="true">
        <span className="bg-green-100 text-green-700" />
        <span className="bg-yellow-100 text-yellow-700" />
        <span className="bg-orange-100 text-orange-700" />
        <span className="bg-purple-100 text-purple-700" />
        <span className="bg-blue-100 text-blue-700" />
        <span className="bg-gray-100 text-gray-700" />
      </div>

      {/* header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">{t('calendar.title')}</h1>

          <div className="inline-flex rounded-md shadow-sm" role="group" aria-label="View mode">
            <button
              type="button"
              onClick={() => setMode("table")}
              className={`px-3 py-1 text-sm rounded-l-md border ${mode === "table" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200"}`}
            >
              {t('common.table')}
            </button>
            <button
              type="button"
              onClick={() => setMode("timeline")}
              className={`px-3 py-1 text-sm border ${mode === "timeline" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200"}`}
            >
              {t('calendar.timeline')}
            </button>
            <button
              type="button"
              onClick={() => setMode("month")}
              className={`px-3 py-1 text-sm rounded-r-md border ${mode === "month" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200"}`}
            >
              {t('calendar.monthView')}
            </button>
          </div>
        </div>

        {/* right side controls: team filter + create */}
        <div className="ml-auto flex items-center gap-3">
          {/* Multi-level filter UI (keeps original team filter functionality too) */}
          <div className="flex items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setFilterValue(""); }}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="all">{t('common.all')}</option>
              <option value="club">Club</option>
              <option value="team">Team</option>
              {user?.role === "parent" && <option value="athlete">Athlete</option>}
            </select>

            {filterType === "all" && (
              // show original "teamFilter" select for backwards compatibility
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="border rounded px-3 py-1 text-sm"
                aria-label="Filter by team"
              >
                <option value="">{t('nav.teams')}</option>
                {/* only list teams that belong to clubs current user belongs to (if user.clubIds exists) */}
                {teams
                  .filter(t => {
                    if (!t) return false;
                    if (!user?.clubIds || user.clubIds.length === 0) return true; // if no clubIds info, show all
                    return String(t.clubId) ? user.clubIds.map(String).includes(String(t.clubId)) : false;
                  })
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            )}

            {filterType !== "all" && (
              // dynamic second select for club/team/athlete when chosen
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="">{filterType === "club" ? "Select club" : filterType === "team" ? "Select team" : "Select athlete"}</option>

                {filterType === "club" && filterOptions.clubs.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.id}</option>
                ))}

                {filterType === "team" && filterOptions.teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name || t.id}</option>
                ))}

                {filterType === "athlete" && (filterOptions.athletes || []).map(a => (
                  <option key={a.id} value={a.id}>{a.name || a.id}</option>
                ))}
              </select>
            )}
          </div>

            <Link
              to="/events/new"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium"
            >
              {t('calendar.createEvent')}
            </Link>
        </div>
      </div>

      {mode === "table" && (
        <div className="bg-white shadow rounded overflow-x-auto p-4">
          <table className="w-full text-sm">
            <thead className="border-b font-medium">
              <tr>
                <th className="py-2 text-left">{t('event.date')}</th>
                <th className="text-left">{t('event.time')}</th>
                <th className="text-left">{t('event.type')}</th>
                <th className="text-left">Title</th>
                <th className="text-left">{t('event.location')}</th>
                <th className="text-left">Team</th>
              </tr>
            </thead>
            <tbody>
              {sortedDates.flatMap((date) =>
                grouped[date].map((ev) => (
                  <tr key={ev.id} className="border-b hover:bg-gray-50">
                    <td className="py-2">{new Date(ev.date).toDateString()}</td>
                    <td>{ev.time || ""}</td>
                    <td>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${typeColor(ev.type)}`}>
                        {(ev.type || "event").toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <Link to={`/events/${ev.id}`} className="text-blue-600 hover:underline">
                        {ev.title}
                      </Link>
                    </td>
                    <td>{ev.location}</td>
                    <td>{teamName(ev.team ?? ev.teamId)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {mode === "timeline" && (
        <div className="space-y-6">
          {sortedDates.map((date) => {
            const items = grouped[date];
            const pretty = date === "unknown" ? "Unknown date" : new Date(date).toDateString();

            return (
              <section key={date}>
                <h2 className="text-xl font-semibold text-gray-700 mb-3">{pretty}</h2>

                <div className="space-y-3">
                  {items.map((ev) => (
                    <article
                      key={ev.id}
                      className="border rounded-lg bg-white shadow p-4 hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${typeColor(ev.type)}`}>
                              {(ev.type || "event").toUpperCase()}
                            </span>

                            <Link to={`/events/${ev.id}`} className="font-semibold text-gray-900 hover:underline">
                              {ev.title}
                            </Link>

                            <span className="text-gray-500">— {ev.location}</span>

                            {ev._isRecurringInstance && <span className="ml-2 text-xs text-gray-500">(recurring)</span>}
                          </div>

                          <p className="text-sm text-gray-600">{ev.time || ""}</p>
                        </div>

                        <div className="text-right text-sm">
                          <div className="text-gray-600">Team</div>
                          <div className="text-blue-600 font-medium">{teamName(ev.team ?? ev.teamId)}</div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* MONTH GRID */}
      {mode === "month" && (
        <div>
          <div className="flex items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="px-3 py-1 border rounded">◀</button>
              <div className="font-semibold">
                {new Date(viewYear, viewMonth, 1).toLocaleString(undefined, { month: "long", year: "numeric" })}
              </div>
              <button onClick={nextMonth} className="px-3 py-1 border rounded">▶</button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={viewMonth}
                onChange={(e) => { setViewMonth(Number(e.target.value)); setSelectedDay(null); }}
                className="border rounded px-2 py-1 text-sm"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={i}>
                    {new Date(0, i).toLocaleString(undefined, { month: "long" })}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => { setViewYear(Number(e.target.value)); setSelectedDay(null); }}
                className="border rounded px-2 py-1 text-sm"
              >
                {Array.from({ length: 7 }).map((_, i) => {
                  const y = today.getFullYear() - 3 + i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-sm">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
              <div key={d} className="text-xs font-semibold text-center py-1">{d}</div>
            ))}

            {monthGrid.map((week, wi) =>
              week.map((cell, ci) => {
                if (!cell) {
                  return <div key={`${wi}-${ci}`} className="h-20 border rounded p-2 bg-gray-50" />;
                }
                const key = toKey(cell);
                const evs = eventsByDate[key] || [];
                const isToday = key === toKey(new Date());

                return (
                  <div
                    key={key}
                    className={`h-36 border rounded p-2 flex flex-col justify-between ${isToday ? "ring-2 ring-blue-200" : "bg-white"}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="text-sm font-medium">{cell.getDate()}</div>
                      {evs.length > 0 && (
                        <div className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {evs.length}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 overflow-auto">
                      {evs.slice(0, 3).map((ev) => (
                        <Link
                          key={ev.id}
                          to={`/events/${ev.id}`}
                          className="block text-xs p-1 rounded hover:bg-gray-50"
                        >
                          <span className={`px-1 rounded text-xs ${typeColor(ev.type)}`}>{(ev.type||"").toUpperCase()}</span>
                          <span className="ml-1 text-gray-800">{ev.title}</span>
                        </Link>
                      ))}

                      {evs.length > 3 && (
                        <button
                          onClick={() => setSelectedDay(key)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          +{evs.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected day modal-like area below calendar */}
          {selectedDay && (
            <div className="mt-4 bg-white border rounded shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{new Date(selectedDay).toDateString()}</h3>
                  <div className="text-xs text-gray-500">{(eventsByDate[selectedDay] || []).length} {t('team.events')}</div>
                </div>
                <button onClick={() => setSelectedDay(null)} className="text-sm text-gray-600">{t('common.close')}</button>
              </div>

              <div className="space-y-3">
                {(eventsByDate[selectedDay] || []).map((ev) => (
                  <Link key={ev.id} to={`/events/${ev.id}`} className="block border rounded p-3 hover:shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{ev.title}</div>
                        <div className="text-xs text-gray-500">{ev.time || ""} — {teamName(ev.team ?? ev.teamId)}</div>
                      </div>
                      <div className="text-xs">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${typeColor(ev.type)}`}>
                          {(ev.type || "event").toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
