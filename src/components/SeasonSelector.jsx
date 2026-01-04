// src/components/SeasonSelector.jsx
import { useEffect } from 'react';
import { useSeasons } from '../contexts/SeasonContext';

export default function SeasonSelector({ clubId, teamId = null }) {
  const { seasons, selectedSeason, setSelectedSeason, loadSeasons, loading } = useSeasons();

  // Load seasons when clubId changes
  useEffect(() => {
    if (clubId) {
      loadSeasons(clubId);
    }
  }, [clubId]);

  // Persist selected season to localStorage (per team if teamId provided)
  useEffect(() => {
    if (selectedSeason && teamId) {
      localStorage.setItem(`selectedSeason_${teamId}`, selectedSeason.id);
    } else if (selectedSeason && clubId) {
      localStorage.setItem(`selectedSeason_${clubId}`, selectedSeason.id);
    }
  }, [selectedSeason, teamId, clubId]);

  // Restore selected season from localStorage on mount
  useEffect(() => {
    if (seasons.length > 0 && !selectedSeason) {
      const storageKey = teamId ? `selectedSeason_${teamId}` : `selectedSeason_${clubId}`;
      const savedSeasonId = localStorage.getItem(storageKey);
      
      if (savedSeasonId) {
        const savedSeason = seasons.find(s => s.id === savedSeasonId);
        if (savedSeason) {
          setSelectedSeason(savedSeason);
          return;
        }
      }
      
      // Default to active season or first season
      const activeSeason = seasons.find(s => s.status === 'active');
      setSelectedSeason(activeSeason || seasons[0]);
    }
  }, [seasons, selectedSeason, teamId, clubId]);

  const handleSeasonChange = (e) => {
    const seasonId = e.target.value;
    
    if (seasonId === 'all') {
      setSelectedSeason(null);
      return;
    }
    
    const season = seasons.find(s => s.id === seasonId);
    if (season) {
      setSelectedSeason(season);
    }
  };

  if (loading || seasons.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-light/80">Season:</label>
        <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-light/60 text-sm">
          {loading ? 'Loading...' : 'No seasons'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-light/80 whitespace-nowrap">Season:</label>
      <select
        value={selectedSeason?.id || 'all'}
        onChange={handleSeasonChange}
        className="bg-dark border border-white/20 rounded-lg px-4 py-2 text-light text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all min-w-[200px]"
      >
        <option value="all" className="bg-dark text-light">
          All Seasons
        </option>
        {seasons.map((season) => (
          <option key={season.id} value={season.id} className="bg-dark text-light">
            {season.displayName || season.name}
            {season.status === 'active' && ' (Active)'}
            {season.status === 'archived' && ' (Archived)'}
          </option>
        ))}
      </select>
    </div>
  );
}

