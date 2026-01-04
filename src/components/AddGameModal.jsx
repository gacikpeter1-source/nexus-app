// src/components/AddGameModal.jsx
import { useState, useEffect } from 'react';
import { useSeasons } from '../contexts/SeasonContext';
import { autoAssignSeason } from '../firebase/firestore';

export default function AddGameModal({ 
  game = null, // If editing, pass existing game
  teamId,
  clubId,
  clubType = 'opponent', // 'opponent' or 'racing'
  userId,
  selectedSeason,
  onSave, 
  onClose 
}) {
  const isEditing = !!game;
  const isRacing = clubType === 'racing';
  const { seasons, loadSeasons, ensureDefaultSeason } = useSeasons();
  
  const [formData, setFormData] = useState({
    type: 'game',
    // For opponent type
    homeTeam: '',
    guestTeam: '',
    homeScore: '',
    guestScore: '',
    // For racing type
    placement: '',
    // Common fields
    date: '',
    time: '12:00',
    location: 'home',
    notes: '',
    seasonId: selectedSeason?.id || ''
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Load seasons when component mounts
  useEffect(() => {
    const initializeSeasons = async () => {
      if (clubId) {
        await loadSeasons(clubId);
        
        // If no seasons exist, create default season
        if (seasons.length === 0) {
          try {
            const defaultSeason = await ensureDefaultSeason(clubId);
            if (defaultSeason) {
              setFormData(prev => ({ ...prev, seasonId: defaultSeason.id }));
            }
          } catch (error) {
            console.error('Error creating default season:', error);
          }
        }
      }
    };
    
    initializeSeasons();
  }, [clubId]);

  // Pre-fill form if editing
  useEffect(() => {
    if (game) {
      setFormData({
        type: game.type || 'game',
        homeTeam: game.homeTeam || '',
        guestTeam: game.guestTeam || '',
        homeScore: game.homeScore || '',
        guestScore: game.guestScore || '',
        placement: game.placement || '',
        date: game.date || '',
        time: game.time || '12:00',
        location: game.location || 'home',
        notes: game.notes || '',
        seasonId: game.seasonId || selectedSeason?.id || ''
      });
    } else if (selectedSeason) {
      // Pre-select current season for new games
      setFormData(prev => ({ ...prev, seasonId: selectedSeason.id }));
    }
  }, [game, selectedSeason]);

  // Auto-select season when date changes
  useEffect(() => {
    if (formData.date && seasons.length > 0 && !isEditing) {
      const suggested = autoAssignSeason(formData.date, seasons);
      if (suggested && suggested.id !== formData.seasonId) {
        setFormData(prev => ({ ...prev, seasonId: suggested.id }));
      }
    }
  }, [formData.date, seasons, isEditing]);

  const gameTypes = [
    { value: 'game', label: 'Game' },
    { value: 'tournament', label: 'Tournament' },
    { value: 'testing', label: 'Testing' },
    { value: 'custom', label: 'Custom' }
  ];

  const locations = [
    { value: 'home', label: 'Home' },
    { value: 'away', label: 'Away' },
    { value: 'neutral', label: 'Neutral' },
    { value: 'n/a', label: 'N/A' }
  ];

  const placements = [
    { value: '1st', label: '🥇 1st Place' },
    { value: '2nd', label: '🥈 2nd Place' },
    { value: '3rd', label: '🥉 3rd Place' },
    { value: '4th', label: '4th Place' },
    { value: '5th', label: '5th Place' },
    { value: '6th', label: '6th Place' },
    { value: '7th', label: '7th Place' },
    { value: '8th', label: '8th Place' },
    { value: '9th', label: '9th Place' },
    { value: '10th', label: '10th Place' },
    { value: 'dnf', label: 'DNF (Did Not Finish)' },
    { value: 'dns', label: 'DNS (Did Not Start)' }
  ];

  // Generate 24-hour time options
  const timeOptions = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour = h.toString().padStart(2, '0');
      const minute = m.toString().padStart(2, '0');
      timeOptions.push(`${hour}:${minute}`);
    }
  }

  const validateForm = () => {
    const newErrors = {};

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    if (!formData.time) {
      newErrors.time = 'Time is required';
    }

    if (!formData.type) {
      newErrors.type = 'Type is required';
    }

    if (!formData.seasonId) {
      newErrors.seasonId = 'Season is required';
    }

    // Validate based on club type
    if (!isRacing) {
      // Opponent type validation
      if (!formData.homeTeam && !formData.guestTeam) {
        newErrors.teams = 'At least one team name is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const gameData = {
        type: formData.type,
        date: formData.date,
        time: formData.time,
        location: formData.location,
        notes: formData.notes.trim() || null,
        seasonId: formData.seasonId,
        teamId,
        clubId,
        createdBy: userId,
      };

      // Add type-specific fields
      if (isRacing) {
        gameData.placement = formData.placement || null;
        // Format result as placement text
        gameData.result = formData.placement || null;
      } else {
        gameData.homeTeam = formData.homeTeam.trim() || null;
        gameData.guestTeam = formData.guestTeam.trim() || null;
        gameData.homeScore = formData.homeScore.trim() || null;
        gameData.guestScore = formData.guestScore.trim() || null;
        
        // Format result as "Home [X] : [Y] Guest"
        if (formData.homeScore && formData.guestScore && (formData.homeTeam || formData.guestTeam)) {
          const home = formData.homeTeam.trim() || 'Home';
          const guest = formData.guestTeam.trim() || 'Guest';
          gameData.result = `${home} [${formData.homeScore}] : [${formData.guestScore}] ${guest}`;
        } else {
          gameData.result = null;
        }
      }

      await onSave(gameData);
      onClose();
    } catch (error) {
      console.error('Error saving game:', error);
      setErrors({ submit: 'Failed to save game. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-mid-dark border border-white/20 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-white/10 sticky top-0 bg-mid-dark z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-title text-2xl text-light">
                {isEditing ? '✏️ Edit Game' : '➕ Add Game'}
              </h3>
              <p className="text-sm text-light/60 mt-1">
                {isEditing ? 'Update game details' : `Add a new ${isRacing ? 'race' : 'game'} to the league schedule`}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={saving}
              className="text-light/60 hover:text-light transition text-2xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* General Error */}
          {errors.submit && (
            <div className="bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg p-4 text-sm">
              {errors.submit}
            </div>
          )}

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">
              Type <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className={`w-full bg-dark border ${
                errors.type ? 'border-red-500' : 'border-white/20'
              } rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all`}
              disabled={saving}
            >
              {gameTypes.map(type => (
                <option key={type.value} value={type.value} className="bg-dark text-light">
                  {type.label}
                </option>
              ))}
            </select>
            {errors.type && (
              <p className="text-red-400 text-sm mt-2">{errors.type}</p>
            )}
          </div>

          {/* Season */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">
              Season <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.seasonId}
              onChange={(e) => handleChange('seasonId', e.target.value)}
              className={`w-full bg-dark border ${
                errors.seasonId ? 'border-red-500' : 'border-white/20'
              } rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all`}
              disabled={saving || seasons.length === 0}
            >
              <option value="" className="bg-dark text-light">
                {seasons.length === 0 ? 'No seasons available' : 'Select season...'}
              </option>
              {seasons.map(season => (
                <option key={season.id} value={season.id} className="bg-dark text-light">
                  {season.displayName || season.name}
                  {season.status === 'active' && ' (Active)'}
                </option>
              ))}
            </select>
            {errors.seasonId && (
              <p className="text-red-400 text-sm mt-2">{errors.seasonId}</p>
            )}
            <p className="text-xs text-light/50 mt-2">
              {formData.date && seasons.length > 0
                ? 'Auto-selected based on game date. You can change it manually.'
                : 'Season will be auto-selected when you enter a date.'}
            </p>
          </div>

          {/* Conditional Fields Based on Club Type */}
          {isRacing ? (
            /* RACING TYPE: Placement */
            <div>
              <label className="block text-sm font-medium text-light/80 mb-2">
                Placement / Result
              </label>
              <select
                value={formData.placement}
                onChange={(e) => handleChange('placement', e.target.value)}
                className="w-full bg-dark border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                disabled={saving}
              >
                <option value="" className="bg-dark text-light">Select placement...</option>
                {placements.map(place => (
                  <option key={place.value} value={place.value} className="bg-dark text-light">
                    {place.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            /* OPPONENT TYPE: Home vs Guest */
            <>
              {/* Home Team & Guest Team */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-light/80 mb-2">
                    Home Team
                  </label>
                  <input
                    type="text"
                    value={formData.homeTeam}
                    onChange={(e) => handleChange('homeTeam', e.target.value)}
                    placeholder="e.g., Košice"
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder:text-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-light/80 mb-2">
                    Guest Team
                  </label>
                  <input
                    type="text"
                    value={formData.guestTeam}
                    onChange={(e) => handleChange('guestTeam', e.target.value)}
                    placeholder="e.g., Michalovce"
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder:text-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    disabled={saving}
                  />
                </div>
              </div>
              {errors.teams && (
                <p className="text-red-400 text-sm mt-2">{errors.teams}</p>
              )}

              {/* Score */}
              <div>
                <label className="block text-sm font-medium text-light/80 mb-2">
                  Score (Home : Guest)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={formData.homeScore}
                    onChange={(e) => handleChange('homeScore', e.target.value)}
                    placeholder="0"
                    className="w-20 bg-white/10 border border-white/20 rounded-lg px-3 py-3 text-light text-center placeholder:text-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    disabled={saving}
                  />
                  <span className="text-light/60 text-xl">:</span>
                  <input
                    type="text"
                    value={formData.guestScore}
                    onChange={(e) => handleChange('guestScore', e.target.value)}
                    placeholder="0"
                    className="w-20 bg-white/10 border border-white/20 rounded-lg px-3 py-3 text-light text-center placeholder:text-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    disabled={saving}
                  />
                </div>
                <p className="text-xs text-light/50 mt-2">
                  Example result: Košice [2] : [3] Michalovce
                </p>
              </div>
            </>
          )}

          {/* Date & Time Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-light/80 mb-2">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                className={`w-full bg-white/10 border ${
                  errors.date ? 'border-red-500' : 'border-white/20'
                } rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all`}
                disabled={saving}
              />
              {errors.date && (
                <p className="text-red-400 text-sm mt-2">{errors.date}</p>
              )}
            </div>

            {/* Time - 24H Dropdown */}
            <div>
              <label className="block text-sm font-medium text-light/80 mb-2">
                Time (24H) <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.time}
                onChange={(e) => handleChange('time', e.target.value)}
                className={`w-full bg-dark border ${
                  errors.time ? 'border-red-500' : 'border-white/20'
                } rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all`}
                disabled={saving}
              >
                {timeOptions.map(time => (
                  <option key={time} value={time} className="bg-dark text-light">
                    {time}
                  </option>
                ))}
              </select>
              {errors.time && (
                <p className="text-red-400 text-sm mt-2">{errors.time}</p>
              )}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">
              Location
            </label>
            <select
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              className="w-full bg-dark border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              disabled={saving}
            >
              {locations.map(loc => (
                <option key={loc.value} value={loc.value} className="bg-dark text-light">
                  {loc.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes or comments..."
              rows={3}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder:text-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              disabled={saving}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-white/10">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 btn-primary py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (isEditing ? 'Updating...' : 'Adding...') : (isEditing ? '💾 Update Game' : '➕ Add Game')}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
