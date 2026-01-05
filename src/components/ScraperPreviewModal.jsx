// src/components/ScraperPreviewModal.jsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { scrapeLeagueSchedule } from '../utils/leagueScraper';

export default function ScraperPreviewModal({ config, onClose, onConfirmSync }) {
  const [loading, setLoading] = useState(true);
  const [scrapedGames, setScrapedGames] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadScrapedData();
  }, []);

  const loadScrapedData = async () => {
    try {
      setLoading(true);
      const games = await scrapeLeagueSchedule(config);
      console.log('[SCRAPER PREVIEW] Found games:', games);
      setScrapedGames(games);
    } catch (err) {
      console.error('[SCRAPER PREVIEW] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    onConfirmSync(scrapedGames);
  };

  const parseGameDate = (dateString) => {
    if (!dateString) return new Date();
    
    if (dateString.includes('.')) {
      // DD.MM.YYYY format - convert to proper Date
      const [day, month, year] = dateString.split('.');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      // YYYY-MM-DD format
      return new Date(dateString);
    }
  };

  const formatDate = (dateStr) => {
    const date = parseGameDate(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return createPortal(
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center" 
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
        <div className="bg-mid-dark border border-white/20 rounded-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin text-4xl mb-4">🔄</div>
            <div className="text-light/60">Fetching games from league website...</div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (error) {
    return createPortal(
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4" 
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
        <div className="bg-mid-dark border border-white/20 rounded-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="font-title text-xl text-light mb-2">Scraper Error</h3>
            <p className="text-light/60 mb-6">{error}</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg font-medium transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

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
      <div className="bg-mid-dark border border-white/20 rounded-xl max-w-5xl w-full my-8 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/10 sticky top-0 bg-mid-dark z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-title text-2xl text-light">Scraped Games Preview</h3>
              <p className="text-sm text-light/60 mt-1">
                Found <span className="text-primary font-semibold">{scrapedGames.length}</span> games from league website
              </p>
            </div>
            <button onClick={onClose} className="text-light/60 hover:text-light transition text-2xl">✕</button>
          </div>
        </div>

        {/* Games List */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {scrapedGames.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🤷</div>
              <p className="text-light/60">No games found on league website</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scrapedGames.map((game, index) => (
                <div 
                  key={game.externalId || index} 
                  className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Game Title */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg font-semibold text-light">
                          {game.homeTeam} vs {game.guestTeam}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          parseGameDate(game.date) >= new Date() 
                            ? 'bg-green-500/20 text-green-300' 
                            : 'bg-gray-500/20 text-gray-300'
                        }`}>
                          {parseGameDate(game.date) >= new Date() ? 'Upcoming' : 'Past'}
                        </span>
                      </div>

                      {/* Game Details */}
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-light/50">📅 Date:</span>
                          <span className="text-light">{formatDate(game.date)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-light/50">⏰ Time:</span>
                          <span className="text-light">{game.time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-light/50">📍 Location:</span>
                          <span className="text-light capitalize">{game.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-light/50">🏆 Type:</span>
                          <span className="text-light capitalize">{game.type}</span>
                        </div>
                        {game.result && (
                          <div className="flex items-center gap-2 col-span-2">
                            <span className="text-light/50">📊 Result:</span>
                            <span className="text-light font-semibold">{game.result}</span>
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      {game.notes && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <p className="text-xs text-light/60">{game.notes}</p>
                        </div>
                      )}

                      {/* External ID */}
                      <div className="mt-2 text-xs text-light/40">
                        ID: {game.externalId}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/10 sticky bottom-0 bg-mid-dark z-10">
          <div className="flex justify-between items-center gap-4">
            <div className="text-sm text-light/60">
              {scrapedGames.length > 0 && (
                <span>
                  These games will be compared with your existing schedule.
                  <br />
                  <span className="text-primary">New games will be added</span>, and <span className="text-blue-300">matching games will be updated</span>.
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
              {scrapedGames.length > 0 && (
                <button
                  onClick={handleConfirm}
                  className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-all"
                >
                  Sync {scrapedGames.length} Games
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

