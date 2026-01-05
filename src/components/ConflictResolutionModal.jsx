// src/components/ConflictResolutionModal.jsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../contexts/ToastContext';
import { updateLeagueGame } from '../firebase/firestore';

export default function ConflictResolutionModal({ conflicts, onClose, onResolve }) {
  const { showToast } = useToast();
  const [resolving, setResolving] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!conflicts || conflicts.length === 0) return null;

  const current = conflicts[currentIndex];

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatLocation = (location) => {
    const map = { home: '🏠 Home', away: '✈️ Away', neutral: '🌍 Neutral', 'n/a': 'N/A' };
    return map[location] || location;
  };

  const handleKeepManual = async () => {
    try {
      setResolving(true);
      // Mark game as 'both' to show it's been reviewed
      await updateLeagueGame(current.existing.id, {
        source: 'both',
        scrapedId: current.scraped.externalId
      });
      moveToNext();
    } catch (error) {
      console.error('Error resolving conflict:', error);
      showToast('Failed to resolve conflict', 'error');
    } finally {
      setResolving(false);
    }
  };

  const handleUseScraped = async () => {
    try {
      setResolving(true);
      // Update with scraped data
      await updateLeagueGame(current.existing.id, {
        ...current.scraped,
        source: 'scraped',
        scrapedId: current.scraped.externalId,
        lastSyncedAt: new Date().toISOString()
      });
      moveToNext();
    } catch (error) {
      console.error('Error resolving conflict:', error);
      showToast('Failed to resolve conflict', 'error');
    } finally {
      setResolving(false);
    }
  };

  const handleMerge = async (field, value) => {
    try {
      setResolving(true);
      const updates = { [field]: value, source: 'both', scrapedId: current.scraped.externalId };
      await updateLeagueGame(current.existing.id, updates);
      
      // Remove this conflict from list and move to next
      const updatedConflicts = [...conflicts];
      current.conflicts = current.conflicts.filter(c => c.field !== field);
      
      if (current.conflicts.length === 0) {
        moveToNext();
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);
      showToast('Failed to resolve conflict', 'error');
    } finally {
      setResolving(false);
    }
  };

  const moveToNext = () => {
    if (currentIndex < conflicts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      showToast('All conflicts resolved!', 'success');
      onResolve();
      onClose();
    }
  };

  const skipConflict = () => {
    moveToNext();
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 overflow-y-auto" 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div className="bg-dark border border-white/20 rounded-xl max-w-4xl w-full my-8 shadow-2xl relative">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-title text-2xl text-light">Resolve Data Conflicts</h3>
              <p className="text-sm text-light/60 mt-1">
                Conflict {currentIndex + 1} of {conflicts.length} - Choose which data to keep
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-light/60 hover:text-light transition-colors text-2xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Match Confidence Badge */}
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              current.confidence === 'high' ? 'bg-green-500/20 text-green-300' :
              current.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
              'bg-red-500/20 text-red-300'
            }`}>
              {current.confidence.toUpperCase()} Confidence Match
            </span>
          </div>

          {/* Game Preview */}
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <h4 className="font-semibold text-light mb-2">Game Details</h4>
            <div className="text-sm text-light/70">
              {current.existing.homeTeam || 'Home'} vs {current.existing.guestTeam || 'Guest'}
            </div>
          </div>

          {/* Conflicts */}
          <div className="space-y-4">
            <h4 className="font-semibold text-light">Conflicting Fields:</h4>
            
            {current.conflicts.map((conflict, idx) => (
              <div key={idx} className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="font-medium text-light mb-3 capitalize">{conflict.field}</div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Manual Version */}
                  <button
                    onClick={() => handleMerge(conflict.field, conflict.existing)}
                    disabled={resolving}
                    className="p-4 bg-green-500/10 hover:bg-green-500/20 border-2 border-green-500/30 hover:border-green-500 rounded-lg transition-all text-left disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-green-300">✏️ YOUR DATA (Manual)</span>
                      <span className="text-xs text-green-300">Keep This</span>
                    </div>
                    <div className="text-light font-medium">
                      {conflict.field === 'date' ? formatDate(conflict.existing) :
                       conflict.field === 'location' ? formatLocation(conflict.existing) :
                       conflict.existing || 'Not set'}
                    </div>
                  </button>

                  {/* Scraped Version */}
                  <button
                    onClick={() => handleMerge(conflict.field, conflict.scraped)}
                    disabled={resolving}
                    className="p-4 bg-blue-500/10 hover:bg-blue-500/20 border-2 border-blue-500/30 hover:border-blue-500 rounded-lg transition-all text-left disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-blue-300">🌐 LEAGUE DATA (Scraped)</span>
                      <span className="text-xs text-blue-300">Use This</span>
                    </div>
                    <div className="text-light font-medium">
                      {conflict.field === 'date' ? formatDate(conflict.scraped) :
                       conflict.field === 'location' ? formatLocation(conflict.scraped) :
                       conflict.scraped || 'Not set'}
                    </div>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <h4 className="font-semibold text-light mb-3">Quick Actions</h4>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleKeepManual}
                disabled={resolving}
                className="flex-1 px-4 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg font-medium transition-all disabled:opacity-50"
              >
                ✏️ Keep All Manual Data
              </button>
              <button
                onClick={handleUseScraped}
                disabled={resolving}
                className="flex-1 px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg font-medium transition-all disabled:opacity-50"
              >
                🌐 Use All Scraped Data
              </button>
              <button
                onClick={skipConflict}
                disabled={resolving}
                className="px-4 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg font-medium transition-all disabled:opacity-50"
              >
                Skip →
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex justify-between items-center">
          <div className="text-sm text-light/60">
            {conflicts.length - currentIndex - 1} conflict(s) remaining
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg font-medium transition-all"
          >
            Close (Resolve Later)
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

