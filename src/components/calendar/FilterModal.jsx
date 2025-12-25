// src/components/calendar/FilterModal.jsx
import { useState, useEffect } from 'react';

export default function FilterModal({ 
  isOpen, 
  onClose, 
  filters,
  clubs,
  teams,
  onApply
}) {
  // Temporary filter state (only applied when clicking "Apply")
  const [tempFilters, setTempFilters] = useState({
    userFilter: 'all',
    clubFilter: 'all',
    teamFilter: 'all',
    typeFilter: 'all'
  });

  // Initialize temp filters from current filters when modal opens
  useEffect(() => {
    if (isOpen) {
      setTempFilters(filters);
    }
  }, [isOpen, filters]);

  // Handle applying filters
  const handleApply = () => {
    onApply(tempFilters);
    onClose();
  };

  // Handle clearing all filters
  const handleClearAll = () => {
    const clearedFilters = {
      userFilter: 'all',
      clubFilter: 'all',
      teamFilter: 'all',
      typeFilter: 'all'
    };
    setTempFilters(clearedFilters);
  };

  // Check if any filters are active
  const hasActiveFilters = () => {
    return (
      tempFilters.userFilter !== 'all' ||
      tempFilters.clubFilter !== 'all' ||
      tempFilters.teamFilter !== 'all' ||
      tempFilters.typeFilter !== 'all'
    );
  };

  // Handle ESC key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-mid-dark border border-white/20 shadow-2xl transition-all animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="font-title text-2xl text-light">
              🔍 Filter Events
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-light/60 hover:text-light transition-all"
            >
              ✕
            </button>
          </div>

                {/* Filter Options */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                  {/* Show Filter */}
                  <div>
                    <label className="block text-sm font-medium text-light/80 mb-2">
                      Show
                    </label>
                    <select
                      value={tempFilters.userFilter}
                      onChange={(e) => setTempFilters({ ...tempFilters, userFilter: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    >
                      <option value="all" className="bg-mid-dark">All Events</option>
                      <option value="mine" className="bg-mid-dark">My Events Only</option>
                    </select>
                  </div>

                  {/* Club Filter */}
                  <div>
                    <label className="block text-sm font-medium text-light/80 mb-2">
                      Club
                      {tempFilters.clubFilter !== 'all' && (
                        <span className="ml-2 text-xs text-primary">
                          (1 selected)
                        </span>
                      )}
                    </label>
                    <select
                      value={tempFilters.clubFilter}
                      onChange={(e) => {
                        setTempFilters({
                          ...tempFilters,
                          clubFilter: e.target.value,
                          teamFilter: 'all' // Reset team when club changes
                        });
                      }}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
                    <label className="block text-sm font-medium text-light/80 mb-2">
                      Team
                      {tempFilters.teamFilter !== 'all' && (
                        <span className="ml-2 text-xs text-primary">
                          (1 selected)
                        </span>
                      )}
                    </label>
                    <select
                      value={tempFilters.teamFilter}
                      onChange={(e) => setTempFilters({ ...tempFilters, teamFilter: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={tempFilters.clubFilter === 'all' && teams.length === 0}
                    >
                      <option value="all" className="bg-mid-dark">
                        {tempFilters.clubFilter === 'all' ? 'All Teams' : 'All Teams in Club'}
                      </option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id} className="bg-mid-dark">
                          {tempFilters.clubFilter === 'all' ? t.displayName : t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Event Type Filter */}
                  <div>
                    <label className="block text-sm font-medium text-light/80 mb-2">
                      Event Type
                      {tempFilters.typeFilter !== 'all' && (
                        <span className="ml-2 text-xs text-primary">
                          (1 selected)
                        </span>
                      )}
                    </label>
                    <select
                      value={tempFilters.typeFilter}
                      onChange={(e) => setTempFilters({ ...tempFilters, typeFilter: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    >
                      <option value="all" className="bg-mid-dark">All Types</option>
                      <option value="training" className="bg-mid-dark">🏋️ Training</option>
                      <option value="game" className="bg-mid-dark">⚽ Game</option>
                      <option value="match" className="bg-mid-dark">⚽ Match</option>
                      <option value="tournament" className="bg-mid-dark">🏆 Tournament</option>
                      <option value="meeting" className="bg-mid-dark">💼 Meeting</option>
                      <option value="social" className="bg-mid-dark">🎉 Social</option>
                    </select>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between gap-3 p-6 border-t border-white/10 bg-white/5">
                  <button
                    onClick={handleClearAll}
                    disabled={!hasActiveFilters()}
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed text-light rounded-lg font-medium transition-all"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={handleApply}
                    className="flex-1 px-6 py-2.5 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white rounded-lg font-medium transition-all"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          </div>
  );
}

