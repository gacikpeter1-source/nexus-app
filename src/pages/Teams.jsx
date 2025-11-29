// src/pages/Teams.jsx
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTeams } from '../api/localApi';
import { Link } from 'react-router-dom';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Teams page with enhanced filtering:
 * - Filter by Club
 * - Filter by Team
 * - Filter by Athlete/Child (for parents)
 */

export default function Teams() {
  const { user } = useAuth();
  const { t } = useLanguage();
  
  // Filter state
  const [filterType, setFilterType] = useState('all'); // "all" | "club" | "team" | "athlete"
  const [filterValue, setFilterValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['teams'],
    queryFn: getTeams
  });

  // normalize returned shape: data could be object map or array
  const staticTeamsArr = useMemo(() => {
    const d = Array.isArray(data) ? data : (data ? Object.values(data) : []);
    return (d || []).map(t => ({
      id: t.id || t._id || t.teamId || Math.random().toString(36).slice(2,8),
      name: t.name || t.title || 'Unnamed Team',
      sport: t.sport || t.category || t.type || '',
      trainers: Array.isArray(t.trainers) ? t.trainers : (t.trainer ? [t.trainer] : []),
      assistants: Array.isArray(t.assistants) ? t.assistants : (t.assistant ? [t.assistant] : []),
      members: Array.isArray(t.members) ? t.members : (t.member ? [t.member] : []),
      clubId: t.clubId || null,
      clubName: t.clubName || null,
    }));
  }, [data]);

  // load teams nested under clubs in localStorage
  const localClubTeams = useMemo(() => {
    try {
      const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
      if (!Array.isArray(clubs)) return [];
      const teams = [];
      for (const c of clubs) {
        if (!Array.isArray(c.teams)) continue;
        for (const t of c.teams) {
          teams.push({
            id: t.id || t._id || Math.random().toString(36).slice(2,8),
            name: t.name || t.title || 'Unnamed Team',
            sport: t.sport || t.category || t.type || '',
            trainers: Array.isArray(t.trainers) ? t.trainers : (t.trainer ? [t.trainer] : []),
            assistants: Array.isArray(t.assistants) ? t.assistants : (t.assistant ? [t.assistant] : []),
            members: Array.isArray(t.members) ? t.members : (t.member ? [t.member] : []),
            clubId: c.id || null,
            clubName: c.name || null
          });
        }
      }
      return teams;
    } catch (e) {
      console.warn('Failed to read clubs from localStorage', e);
      return [];
    }
  }, []);

  // merge both sources, dedupe by id
  const mergedTeams = useMemo(() => {
    const map = new Map();
    for (const t of staticTeamsArr) {
      map.set(t.id, t);
    }
    for (const t of localClubTeams) {
      map.set(t.id, t);
    }
    return Array.from(map.values());
  }, [staticTeamsArr, localClubTeams]);

  // Filter teams by user access
  const userTeams = useMemo(() => {
    if (!user) return [];
    
    const isAdmin = user.role === ROLES.ADMIN || user.isSuperAdmin;
    
    return mergedTeams.filter(t => {
      if (isAdmin) return true;
      const trainers = Array.isArray(t.trainers) ? t.trainers : [];
      const assistants = Array.isArray(t.assistants) ? t.assistants : [];
      const members = Array.isArray(t.members) ? t.members : [];
      return trainers.includes(user.id) || assistants.includes(user.id) || members.includes(user.id);
    });
  }, [mergedTeams, user]);

  // Build filter options
  const filterOptions = useMemo(() => {
    if (!user) return { clubs: [], teams: [], athletes: [] };
    
    // Build clubs list
    const clubsMap = {};
    userTeams.forEach(t => {
      if (t && t.clubId) {
        clubsMap[t.clubId] = clubsMap[t.clubId] || { 
          id: t.clubId, 
          name: t.clubName || `Club ${t.clubId}` 
        };
      }
    });
    const clubsList = Object.values(clubsMap);

    // Teams are already filtered by user access
    const teamsList = userTeams;

    // Athletes/children (for parents)
    const athletes = (user && user.athletes) ? user.athletes : [];

    return {
      clubs: clubsList,
      teams: teamsList,
      athletes
    };
  }, [userTeams, user]);

  // Apply filters
  const filteredTeams = useMemo(() => {
    let filtered = userTeams;

    // Apply type filter
    if (filterType === 'club' && filterValue) {
      filtered = filtered.filter(t => String(t.clubId) === String(filterValue));
    } else if (filterType === 'team' && filterValue) {
      filtered = filtered.filter(t => String(t.id) === String(filterValue));
    } else if (filterType === 'athlete' && filterValue) {
      // Filter teams that have this athlete as member
      filtered = filtered.filter(t => 
        (t.members || []).includes(filterValue)
      );
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        (t.sport || '').toLowerCase().includes(query) ||
        (t.clubName || '').toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [userTeams, filterType, filterValue, searchQuery]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-light/60">{t('common.loading')}...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">Error: {error.message}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen p-6">
        <h1 className="font-display text-4xl text-light mb-4">{t('nav.myTeams')}</h1>
        <p className="text-light/60">Please sign in to see your teams.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="font-display text-6xl md:text-7xl text-light mb-2 tracking-wider">
          MY <span className="text-primary">TEAMS</span>
        </h1>
        <p className="text-light/60 text-lg">
          {filteredTeams.length} {filteredTeams.length === 1 ? 'team' : 'teams'}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        {/* Filter Type Selection */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setFilterValue(''); }}
            className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          >
            <option value="all" className="bg-mid-dark">{t('common.all')}</option>
            <option value="club" className="bg-mid-dark">Filter by Club</option>
            <option value="team" className="bg-mid-dark">Filter by Team</option>
            {user?.role === 'parent' && (
              <option value="athlete" className="bg-mid-dark">Filter by Child/Athlete</option>
            )}
          </select>

          {/* Dynamic filter value selection */}
          {filterType !== 'all' && (
            <select
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="" className="bg-mid-dark">
                {filterType === 'club' ? 'Select Club' : 
                 filterType === 'team' ? 'Select Team' : 
                 'Select Athlete'}
              </option>

              {filterType === 'club' && filterOptions.clubs.map(c => (
                <option key={c.id} value={c.id} className="bg-mid-dark">
                  {c.name}
                </option>
              ))}

              {filterType === 'team' && filterOptions.teams.map(t => (
                <option key={t.id} value={t.id} className="bg-mid-dark">
                  {t.name} {t.clubName ? `(${t.clubName})` : ''}
                </option>
              ))}

              {filterType === 'athlete' && (filterOptions.athletes || []).map(a => (
                <option key={a.id} value={a.id} className="bg-mid-dark">
                  {a.name}
                </option>
              ))}
            </select>
          )}

          {/* Search input */}
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px] bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Active filters display */}
        {(filterType !== 'all' || searchQuery) && (
          <div className="flex items-center gap-2 text-sm text-light/60">
            <span>Active filters:</span>
            {filterType !== 'all' && filterValue && (
              <span className="px-2 py-1 bg-primary/20 text-primary rounded">
                {filterType === 'club' ? filterOptions.clubs.find(c => c.id === filterValue)?.name :
                 filterType === 'team' ? filterOptions.teams.find(t => t.id === filterValue)?.name :
                 filterOptions.athletes?.find(a => a.id === filterValue)?.name}
              </span>
            )}
            {searchQuery && (
              <span className="px-2 py-1 bg-accent/20 text-accent rounded">
                Search: "{searchQuery}"
              </span>
            )}
            <button
              onClick={() => { setFilterType('all'); setFilterValue(''); setSearchQuery(''); }}
              className="text-primary hover:text-primary/80 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Teams List */}
      <section className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        {filteredTeams.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 backdrop-blur-sm p-8 text-center max-w-2xl mx-auto">
            <div className="text-4xl mb-3">⚽</div>
            <h3 className="font-title text-xl text-light/80 mb-2">
              {userTeams.length === 0 ? 'No Teams Yet' : 'No Teams Found'}
            </h3>
            <p className="text-light/50 text-sm mb-4">
              {userTeams.length === 0 
                ? 'Join a club or request to join a team to see it here.'
                : 'Try adjusting your filters or search query.'}
            </p>
            {(filterType !== 'all' || searchQuery) && (
              <button
                onClick={() => { setFilterType('all'); setFilterValue(''); setSearchQuery(''); }}
                className="btn-secondary"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTeams.map((team) => {
              const totalMembers = (team.trainers || []).length + 
                                 (team.assistants || []).length + 
                                 (team.members || []).length;
              
              return (
                <Link
                  key={team.id}
                  to={`/teams/${team.id}`}
                  className="group relative cursor-pointer bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all duration-300 card-hover overflow-hidden"
                >
                  {/* Shine effect on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  </div>

                  <div className="relative z-10">
                    {/* Team Icon */}
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center text-3xl mb-4">
                      {team.sport === 'Football' ? '⚽' :
                       team.sport === 'Basketball' ? '🏀' :
                       team.sport === 'Volleyball' ? '🏐' :
                       team.sport === 'Swimming' ? '🏊' :
                       '🏆'}
                    </div>

                    <h3 className="font-title text-2xl text-light group-hover:text-primary transition-colors mb-1">
                      {team.name}
                    </h3>
                    
                    {team.sport && (
                      <p className="text-sm text-light/60 mb-2">{team.sport}</p>
                    )}

                    {team.clubName && (
                      <p className="text-xs text-light/40 mb-4">{team.clubName}</p>
                    )}

                    {/* Stats */}
                    <div className="flex gap-6 mt-4">
                      <div>
                        <div className="text-2xl font-bold text-primary">
                          {(team.trainers || []).length}
                        </div>
                        <div className="text-xs text-light/50 uppercase tracking-wider">
                          {t('team.trainers')}
                        </div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-accent">
                          {totalMembers}
                        </div>
                        <div className="text-xs text-light/50 uppercase tracking-wider">
                          {t('team.members')}
                        </div>
                      </div>
                    </div>

                    {/* Arrow indicator */}
                    <div className="absolute bottom-6 right-6 text-primary opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                      →
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
