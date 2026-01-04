// src/contexts/SeasonContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import {
  getClubSeasons,
  createSeason,
  updateSeason,
  deleteSeason,
  getActiveSeason,
  getOrCreateDefaultSeason
} from '../firebase/firestore';

const SeasonContext = createContext();

export const useSeasons = () => {
  const context = useContext(SeasonContext);
  if (!context) {
    throw new Error('useSeasons must be used within a SeasonProvider');
  }
  return context;
};

export function SeasonProvider({ children }) {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [activeSeason, setActiveSeason] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentClubId, setCurrentClubId] = useState(null);

  // Load seasons for a club
  const loadSeasons = async (clubId) => {
    if (!clubId) {
      setSeasons([]);
      setSelectedSeason(null);
      setActiveSeason(null);
      return;
    }

    try {
      setLoading(true);
      setCurrentClubId(clubId);

      // Get all seasons for club
      const clubSeasons = await getClubSeasons(clubId);
      setSeasons(clubSeasons);

      // Get active season
      const active = clubSeasons.find(s => s.status === 'active');
      setActiveSeason(active || null);

      // Auto-select active season or most recent
      if (!selectedSeason || selectedSeason.clubId !== clubId) {
        setSelectedSeason(active || clubSeasons[0] || null);
      }
    } catch (error) {
      console.error('Error loading seasons:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create new season
  const handleCreateSeason = async (seasonData) => {
    try {
      const newSeason = await createSeason(seasonData);
      setSeasons(prev => [newSeason, ...prev]);
      return newSeason;
    } catch (error) {
      console.error('Error creating season:', error);
      throw error;
    }
  };

  // Update existing season
  const handleUpdateSeason = async (seasonId, updates) => {
    try {
      await updateSeason(seasonId, updates);
      setSeasons(prev =>
        prev.map(s => (s.id === seasonId ? { ...s, ...updates } : s))
      );

      // Update selected/active season if needed
      if (selectedSeason?.id === seasonId) {
        setSelectedSeason(prev => ({ ...prev, ...updates }));
      }
      if (activeSeason?.id === seasonId) {
        setActiveSeason(prev => ({ ...prev, ...updates }));
      }

      // Reload to ensure consistency
      if (currentClubId) {
        await loadSeasons(currentClubId);
      }
    } catch (error) {
      console.error('Error updating season:', error);
      throw error;
    }
  };

  // Delete season
  const handleDeleteSeason = async (seasonId) => {
    try {
      await deleteSeason(seasonId);
      setSeasons(prev => prev.filter(s => s.id !== seasonId));

      // Clear selection if deleted season was selected
      if (selectedSeason?.id === seasonId) {
        const remaining = seasons.filter(s => s.id !== seasonId);
        setSelectedSeason(remaining[0] || null);
      }
      if (activeSeason?.id === seasonId) {
        setActiveSeason(null);
      }
    } catch (error) {
      console.error('Error deleting season:', error);
      throw error;
    }
  };

  // Archive season (set status to 'archived')
  const handleArchiveSeason = async (seasonId) => {
    try {
      await handleUpdateSeason(seasonId, { status: 'archived' });
    } catch (error) {
      console.error('Error archiving season:', error);
      throw error;
    }
  };

  // Get or create default season
  const ensureDefaultSeason = async (clubId) => {
    try {
      const defaultSeason = await getOrCreateDefaultSeason(clubId);
      await loadSeasons(clubId);
      return defaultSeason;
    } catch (error) {
      console.error('Error ensuring default season:', error);
      throw error;
    }
  };

  const value = {
    seasons,
    selectedSeason,
    setSelectedSeason,
    activeSeason,
    loading,
    loadSeasons,
    createSeason: handleCreateSeason,
    updateSeason: handleUpdateSeason,
    deleteSeason: handleDeleteSeason,
    archiveSeason: handleArchiveSeason,
    ensureDefaultSeason
  };

  return (
    <SeasonContext.Provider value={value}>
      {children}
    </SeasonContext.Provider>
  );
}

