// src/components/LeagueScheduleTab.jsx
import { useState, useEffect, useMemo } from 'react';
import { 
  getTeamLeagueGames, 
  createLeagueGame, 
  updateLeagueGame, 
  deleteLeagueGame,
  createEvent,
  deleteEvent
} from '../firebase/firestore';
import { useSeasons } from '../contexts/SeasonContext';
import AddGameModal from './AddGameModal';
import SeasonSelector from './SeasonSelector';

export default function LeagueScheduleTab({ team, club, user }) {
  const { selectedSeason } = useSeasons();
  
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'upcoming', 'played'
  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [editingGame, setEditingGame] = useState(null);

  // Permission check: Can user edit schedule?
  const canEdit = useMemo(() => {
    if (!user || !team || !club) return false;
    
    return (
      user.isSuperAdmin ||
      club.ownerId === user.id ||
      team.trainers?.includes(user.id) ||
      team.assistants?.includes(user.id)
    );
  }, [user, team, club]);

  // Load games
  useEffect(() => {
    loadGames();
  }, [team?.id]);

  const loadGames = async () => {
    if (!team?.id) return;
    
    try {
      setLoading(true);
      const fetchedGames = await getTeamLeagueGames(team.id);
      setGames(fetchedGames);
    } catch (error) {
      console.error('Error loading league games:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter games based on filter state and selected season
  const filteredGames = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filtered = games;

    // Filter by season (if one is selected)
    if (selectedSeason) {
      filtered = filtered.filter(game => game.seasonId === selectedSeason.id);
    }

    // Filter by status
    if (filter === 'upcoming') {
      filtered = filtered.filter(game => new Date(game.date) >= today);
    } else if (filter === 'played') {
      filtered = filtered.filter(game => new Date(game.date) < today);
    }

    return filtered;
  }, [games, filter, selectedSeason]);

  // Handle save (create or update)
  const handleSaveGame = async (gameData) => {
    try {
      if (editingGame) {
        // Update existing game
        await updateLeagueGame(editingGame.id, gameData);
      } else {
        // Create new game
        const gameId = await createLeagueGame(gameData);
        
        // Automatically create calendar event for the game
        try {
          // Build event title based on game type
          let eventTitle = '';
          if (gameData.result) {
            // If result already exists, use it
            eventTitle = gameData.result;
          } else if (gameData.homeTeam || gameData.guestTeam) {
            // Opponent type: "Home vs Guest"
            eventTitle = `${gameData.homeTeam || 'Home'} vs ${gameData.guestTeam || 'Guest'}`;
          } else if (gameData.placement) {
            // Racing type: "Race"
            eventTitle = `Race`;
          } else {
            eventTitle = gameData.type ? `${gameData.type.charAt(0).toUpperCase() + gameData.type.slice(1)}` : 'Game';
          }
          
          // Get all team members (trainers + assistants + members)
          const teamMembers = [
            ...(team.trainers || []),
            ...(team.assistants || []),
            ...(team.members || [])
          ];
          
          // Remove duplicates
          const uniqueMembers = [...new Set(teamMembers)];
          
          // Initialize responses object for all invited users
          const initialResponses = {};
          uniqueMembers.forEach(userId => {
            initialResponses[userId] = {
              status: 'pending',
              message: null,
              timestamp: null
            };
          });
          
          // Create event data
          const eventData = {
            title: eventTitle,
            type: gameData.type || 'game',
            date: gameData.date,
            time: gameData.time,
            location: gameData.location === 'home' ? 'Home' : 
                     gameData.location === 'away' ? 'Away' : 
                     gameData.location === 'neutral' ? 'Neutral' : '',
            description: gameData.notes || `League ${gameData.type || 'game'}`,
            clubId: gameData.clubId,
            teamId: gameData.teamId,
            createdBy: gameData.createdBy,
            invitedUsers: uniqueMembers,
            responses: initialResponses,
            visibility: 'team', // Team members only (for UI display)
            visibilityLevel: 'team', // For Firestore rules
            participantLimit: null, // No participant limit
            lockPeriod: 0, // No lock period
            reminderTime: 24, // 24 hours in advance
            reminderEnabled: true,
            isLeagueGame: true // Mark this as a league-generated event
          };
          
          // Create the event
          const createdEvent = await createEvent(eventData);
          console.log('✅ Calendar event created automatically for game');
          
          // Link the event to the game
          if (createdEvent && createdEvent.id && gameId) {
            await updateLeagueGame(gameId, { eventId: createdEvent.id });
            console.log('✅ Game linked to calendar event');
          }
        } catch (eventError) {
          console.error('⚠️ Failed to create calendar event for game:', eventError);
          // Don't throw - game was created successfully, event creation is bonus
        }
      }
      
      // Reload games
      await loadGames();
      setShowAddGameModal(false);
      setEditingGame(null);
    } catch (error) {
      console.error('Error saving game:', error);
      throw error; // Let modal handle error display
    }
  };

  // Handle delete
  const handleDeleteGame = async (gameId) => {
    if (!window.confirm('Are you sure you want to delete this game? This will also delete the associated calendar event.')) {
      return;
    }

    try {
      // Find the game to get its eventId
      const game = games.find(g => g.id === gameId);
      
      // Delete the game
      await deleteLeagueGame(gameId);
      
      // If game had an associated event, delete it too
      if (game && game.eventId) {
        try {
          await deleteEvent(game.eventId);
          console.log('✅ Associated calendar event deleted');
        } catch (eventError) {
          console.error('⚠️ Failed to delete associated calendar event:', eventError);
          // Don't throw - game was deleted successfully
        }
      }
      
      await loadGames();
    } catch (error) {
      console.error('Error deleting game:', error);
      alert('Failed to delete game. Please try again.');
    }
  };

  // Handle edit
  const handleEditGame = (game) => {
    setEditingGame(game);
    setShowAddGameModal(true);
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Format location for display
  const formatLocation = (location) => {
    const locationMap = {
      'home': '🏠 Home',
      'away': '✈️ Away',
      'neutral': '🌍 Neutral',
      'n/a': 'N/A'
    };
    return locationMap[location] || location;
  };

  // Determine if game is upcoming
  const isUpcoming = (dateString) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(dateString) >= today;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-light/60 text-lg">Loading schedule...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Season Selector */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
        <SeasonSelector clubId={club?.id} teamId={team?.id} />
      </div>

      {/* Header with Add Button and Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl md:text-2xl font-semibold text-light">League Schedule</h3>
          <p className="text-sm text-light/60 mt-1">
            {filteredGames.length} {filter === 'all' ? 'total' : filter} game{filteredGames.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Filters */}
          <div className="flex bg-white/5 rounded-lg p-1 gap-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded transition-all ${
                filter === 'all'
                  ? 'bg-primary text-dark'
                  : 'text-light/60 hover:text-light'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('upcoming')}
              className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded transition-all ${
                filter === 'upcoming'
                  ? 'bg-primary text-dark'
                  : 'text-light/60 hover:text-light'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setFilter('played')}
              className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded transition-all ${
                filter === 'played'
                  ? 'bg-primary text-dark'
                  : 'text-light/60 hover:text-light'
              }`}
            >
              Played
            </button>
          </div>

          {/* Add Button (Only for editors) */}
          {canEdit && (
            <button
              onClick={() => {
                setEditingGame(null);
                setShowAddGameModal(true);
              }}
              className="btn-primary px-4 py-2 text-sm font-semibold whitespace-nowrap"
            >
              ➕ Add Game
            </button>
          )}
        </div>
      </div>

      {/* Schedule Table */}
      {filteredGames.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8 text-center">
          <p className="text-light/60 text-lg">
            {filter === 'all' 
              ? 'No games scheduled yet' 
              : `No ${filter} games`}
          </p>
          {canEdit && filter === 'all' && (
            <button
              onClick={() => setShowAddGameModal(true)}
              className="mt-4 btn-primary px-6 py-2"
            >
              ➕ Add First Game
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-light">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 font-semibold">Time</th>
                  <th className="text-left py-3 px-4 font-semibold">Type</th>
                  <th className="text-left py-3 px-4 font-semibold">Match / Result</th>
                  <th className="text-left py-3 px-4 font-semibold">Location</th>
                  {canEdit && <th className="text-right py-3 px-4 font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredGames.map((game, index) => (
                  <tr 
                    key={game.id}
                    className={`border-b border-white/10 hover:bg-white/5 transition-colors ${
                      isUpcoming(game.date) ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {isUpcoming(game.date) && (
                          <span className="w-2 h-2 rounded-full bg-primary"></span>
                        )}
                        <span className="font-medium">{formatDate(game.date)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">{game.time}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-white/10 rounded text-xs capitalize">
                        {game.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {game.result ? (
                        <span className="font-medium text-primary">{game.result}</span>
                      ) : game.placement ? (
                        <span className="text-sm">{game.placement}</span>
                      ) : game.homeTeam || game.guestTeam ? (
                        <span className="text-sm">
                          {game.homeTeam || 'Home'} vs {game.guestTeam || 'Guest'}
                        </span>
                      ) : (
                        <span className="text-light/40">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{formatLocation(game.location)}</td>
                    {canEdit && (
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditGame(game)}
                            className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded transition-colors text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteGame(game.id)}
                            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded transition-colors text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-white/10">
            {filteredGames.map((game) => (
              <div 
                key={game.id} 
                className={`p-4 ${isUpcoming(game.date) ? 'bg-primary/5' : ''}`}
              >
                {/* Date & Time */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isUpcoming(game.date) && (
                      <span className="w-2 h-2 rounded-full bg-primary"></span>
                    )}
                    <span className="font-semibold text-light">{formatDate(game.date)}</span>
                  </div>
                  <span className="text-sm text-light/60">{game.time}</span>
                </div>

                {/* Type & Location */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-white/10 rounded text-xs capitalize">
                    {game.type}
                  </span>
                  <span className="text-xs text-light/60">{formatLocation(game.location)}</span>
                </div>

                {/* Match / Result Info */}
                {game.result ? (
                  <p className="text-sm mb-3">
                    <span className="font-medium text-primary">{game.result}</span>
                  </p>
                ) : game.placement ? (
                  <p className="text-sm text-light mb-2">
                    <span className="text-light/60">Placement: </span>
                    <span className="font-medium">{game.placement}</span>
                  </p>
                ) : (game.homeTeam || game.guestTeam) && (
                  <p className="text-sm text-light mb-2">
                    <span className="font-medium">{game.homeTeam || 'Home'}</span>
                    <span className="text-light/60"> vs </span>
                    <span className="font-medium">{game.guestTeam || 'Guest'}</span>
                  </p>
                )}

                {/* Actions */}
                {canEdit && (
                  <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                    <button
                      onClick={() => handleEditGame(game)}
                      className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded transition-colors text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteGame(game.id)}
                      className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded transition-colors text-sm"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Game Modal */}
      {showAddGameModal && (
        <AddGameModal
          game={editingGame}
          teamId={team.id}
          clubId={club.id}
          clubType={club.type || 'opponent'} // 'opponent' or 'racing'
          userId={user.id}
          selectedSeason={selectedSeason}
          onSave={handleSaveGame}
          onClose={() => {
            setShowAddGameModal(false);
            setEditingGame(null);
          }}
        />
      )}
    </div>
  );
}

