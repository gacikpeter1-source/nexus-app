// src/pages/Event.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getEvent, updateEventResponse, deleteEvent, getClub, getAllUsers } from '../firebase/firestore';

export default function EventPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState(null);
  const [team, setTeam] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [showTracking, setShowTracking] = useState(false);
  const [trackingFilter, setTrackingFilter] = useState('all');
  const [updatingRsvp, setUpdatingRsvp] = useState(false);
  
  // Invite state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [invitedUsers, setInvitedUsers] = useState([]);

  useEffect(() => {
    loadEventData();
  }, [eventId]);

  async function loadEventData() {
    try {
      setLoading(true);

      // Load event
      const eventData = await getEvent(eventId);
      if (!eventData) {
        setEvent(null);
        return;
      }
      setEvent(eventData);

      // Load users for name lookup
      const users = await getAllUsers();
      setAllUsers(users);

      // Load club if event has clubId
      if (eventData.clubId) {
        const clubData = await getClub(eventData.clubId);
        setClub(clubData);

        // Find team within club if teamId exists
        if (eventData.teamId && clubData) {
          const foundTeam = (clubData.teams || []).find(t => t.id === eventData.teamId);
          if (foundTeam) {
            setTeam({
              ...foundTeam,
              clubId: clubData.id,
              clubName: clubData.name
            });
          }
        }
      }

    } catch (error) {
      console.error('Error loading event:', error);
      showToast('Failed to load event', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRsvp(status) {
    if (!user || !event) return;

    try {
      setUpdatingRsvp(true);
      await updateEventResponse(eventId, user.id, status);
      
      // Reload event to get updated responses
      await loadEventData();
      
      const statusText = status === 'attending' ? 'attending' : 
                        status === 'declined' ? 'not attending' : 'maybe';
      showToast(`Response updated: ${statusText}`, 'success');
    } catch (error) {
      console.error('Error updating RSVP:', error);
      showToast('Failed to update response', 'error');
    } finally {
      setUpdatingRsvp(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Are you sure you want to delete "${event.title}"?`)) {
      return;
    }

    try {
      await deleteEvent(eventId);
      showToast('Event deleted successfully', 'success');
      navigate('/calendar');
    } catch (error) {
      console.error('Error deleting event:', error);
      showToast('Failed to delete event', 'error');
    }
  }

  // Get all members who should see this event
  function getAllMembers() {
    if (!event || !club) return [];

    const memberIds = new Set();

    // Personal events - just the creator
    if (event.visibilityLevel === 'personal') {
      return [user];
    }

    // Team events - get team members
    if (event.visibilityLevel === 'team' && team) {
      (team.members || []).forEach(id => memberIds.add(id));
      (team.trainers || []).forEach(id => memberIds.add(id));
      (team.assistants || []).forEach(id => memberIds.add(id));
    }

    // Club events - get all members from all teams
    if (event.visibilityLevel === 'club' && club) {
      (club.trainers || []).forEach(id => memberIds.add(id));
      (club.assistants || []).forEach(id => memberIds.add(id));
      (club.members || []).forEach(id => memberIds.add(id));
      
      // Also add members from all teams
      (club.teams || []).forEach(t => {
        (t.members || []).forEach(id => memberIds.add(id));
        (t.trainers || []).forEach(id => memberIds.add(id));
        (t.assistants || []).forEach(id => memberIds.add(id));
      });
    }

    // Convert IDs to user objects
    return Array.from(memberIds).map(id => {
      const userData = allUsers.find(u => u.id === id);
      return userData || { id, username: 'Unknown', email: 'N/A' };
    });
  }

  function getResponseCount(status) {
    if (!event || !event.responses) return 0;
    return Object.values(event.responses).filter(r => r.status === status).length;
  }

  function getUserResponse() {
    if (!event || !user || !event.responses) return null;
    return event.responses[user.id];
  }

  function canManageEvent() {
    if (!user || !event) return false;

    // Admin can manage everything
    if (user.role === 'admin' || user.isSuperAdmin) return true;

    // Creator can manage their own
    if (event.createdBy === user.id) return true;

    // Check club roles for team/club events
    if (club) {
      const isTrainer = (club.trainers || []).includes(user.id);
      const isOwner = club.createdBy === user.id;
      return isTrainer || isOwner;
    }

    return false;
  }

  const filteredMembers = getAllMembers().filter(member => {
    const response = event?.responses?.[member.id];
    
    if (trackingFilter === 'all') return true;
    if (trackingFilter === 'attending') return response?.status === 'attending';
    if (trackingFilter === 'declined') return response?.status === 'declined';
    if (trackingFilter === 'maybe') return response?.status === 'maybe';
    if (trackingFilter === 'noresponse') return !response;
    
    return true;
  });

  // Search results for invite
  const searchResults = useMemo(() => {
    if (inviteSearch.length < 2) return [];
    
    const search = inviteSearch.toLowerCase();
    const existingMemberIds = getAllMembers().map(m => m.id);
    
    return allUsers
      .filter(u => 
        (u.username?.toLowerCase().includes(search) ||
         u.email?.toLowerCase().includes(search)) &&
        !existingMemberIds.includes(u.id) // Exclude existing members
      )
      .slice(0, 10); // Limit to 10 results
  }, [inviteSearch, allUsers, event]);

  // Send email invite
  async function sendEmailInvite() {
    const email = inviteSearch.trim();
    
    if (!email.includes('@')) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    // Check if already invited
    if (invitedUsers.includes(email)) {
      showToast('Already invited this email', 'info');
      return;
    }

    try {
      // TODO: Implement actual email sending via Firebase Functions
      // For now, just track locally
      setInvitedUsers([...invitedUsers, email]);
      showToast(`Invitation sent to ${email}`, 'success');
      setInviteSearch('');
    } catch (error) {
      console.error('Error sending invite:', error);
      showToast('Failed to send invitation', 'error');
    }
  }

  // Invite existing user
  async function inviteUser(user) {
    if (invitedUsers.includes(user.email)) {
      showToast('Already invited this user', 'info');
      return;
    }

    try {
      // TODO: Create notification in Firebase or send email
      setInvitedUsers([...invitedUsers, user.email]);
      showToast(`Invitation sent to ${user.username}`, 'success');
      setInviteSearch('');
    } catch (error) {
      console.error('Error inviting user:', error);
      showToast('Failed to send invitation', 'error');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-light/60">Loading event...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="text-6xl mb-4">❌</div>
        <h2 className="font-title text-2xl text-light mb-2">Event Not Found</h2>
        <p className="text-light/60 mb-6">This event doesn't exist or has been deleted.</p>
        <button
          onClick={() => navigate('/calendar')}
          className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
        >
          Back to Calendar
        </button>
      </div>
    );
  }

  const userResponse = getUserResponse();
  const canEdit = canManageEvent();
  const allMembers = getAllMembers();

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/calendar')}
        className="mb-4 flex items-center gap-2 text-light/60 hover:text-light transition-colors"
      >
        <span>←</span>
        <span>Back to Calendar</span>
      </button>

      {/* Event Header */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="font-title text-4xl text-light mb-2">{event.title}</h1>
            
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="inline-block px-3 py-1 text-sm rounded-full bg-primary/20 text-primary capitalize">
                {event.type || 'event'}
              </span>
              {event.visibilityLevel === 'personal' && (
                <span className="inline-block px-3 py-1 text-sm rounded-full bg-blue-500/20 text-blue-300">
                  👤 Personal
                </span>
              )}
              {event.visibilityLevel === 'team' && (
                <span className="inline-block px-3 py-1 text-sm rounded-full bg-green-500/20 text-green-300">
                  👥 Team Event
                </span>
              )}
              {event.visibilityLevel === 'club' && (
                <span className="inline-block px-3 py-1 text-sm rounded-full bg-orange-500/20 text-orange-300">
                  🏛️ Club Event
                </span>
              )}
            </div>

            <div className="space-y-2 text-light/70">
              <div className="flex items-center gap-2">
                <span>📅</span>
                <span>{new Date(event.date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              </div>
              {event.time && (
                <div className="flex items-center gap-2">
                  <span>🕐</span>
                  <span>{event.time}</span>
                </div>
              )}
              {event.location && (
                <div className="flex items-center gap-2">
                  <span>📍</span>
                  <span>{event.location}</span>
                </div>
              )}
              {team && (
                <div className="flex items-center gap-2">
                  <span>👥</span>
                  <Link 
                    to={`/team/${team.clubId}/${team.id}`}
                    className="text-primary hover:text-primary/80"
                  >
                    {team.name}
                  </Link>
                </div>
              )}
              {club && event.visibilityLevel === 'club' && (
                <div className="flex items-center gap-2">
                  <span>🏛️</span>
                  <span>{club.name}</span>
                </div>
              )}
            </div>

            {event.description && (
              <div className="mt-4 text-light/80 whitespace-pre-wrap">
                {event.description}
              </div>
            )}
          </div>
        </div>

        {/* Edit/Delete Buttons */}
        {canEdit && (
          <div className="flex gap-2 pt-4 border-t border-white/10">
            <Link
              to={`/edit-event/${eventId}`}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all"
            >
              ✏️ Edit Event
            </Link>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all"
            >
              🗑️ Delete Event
            </button>
          </div>
        )}
      </div>

      {/* RSVP Buttons (for non-personal events) */}
      {event.visibilityLevel !== 'personal' && user && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="font-title text-2xl text-light mb-4">Your Response</h2>
          
          {userResponse && (
            <div className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-lg">
              <span className="text-light">
                Current: <strong className="text-primary">
                  {userResponse.status === 'attending' && '✅ Attending'}
                  {userResponse.status === 'declined' && '❌ Not Attending'}
                  {userResponse.status === 'maybe' && '⚠️ Maybe'}
                </strong>
              </span>
            </div>
          )}
          
          <div className="flex gap-3">
            <button 
              onClick={() => handleRsvp('attending')} 
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                userResponse?.status === 'attending' 
                  ? 'bg-green-600 text-white ring-2 ring-green-400' 
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
              disabled={updatingRsvp}
            >
              ✅ I will attend
            </button>
            <button 
              onClick={() => handleRsvp('declined')} 
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                userResponse?.status === 'declined' 
                  ? 'bg-red-600 text-white ring-2 ring-red-400' 
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
              disabled={updatingRsvp}
            >
              ❌ Decline
            </button>
            <button 
              onClick={() => handleRsvp('maybe')} 
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                userResponse?.status === 'maybe' 
                  ? 'bg-yellow-600 text-white ring-2 ring-yellow-400' 
                  : 'bg-yellow-500 text-white hover:bg-yellow-600'
              }`}
              disabled={updatingRsvp}
            >
              ⚠️ Maybe
            </button>
          </div>
        </div>
      )}

      {/* Invite Section - Only for managers */}
      {event.visibilityLevel !== 'personal' && canEdit && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-title text-2xl text-light">Invite Participants</h2>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all inline-flex items-center gap-2"
            >
              ➕ Invite
            </button>
          </div>
          
          {invitedUsers.length > 0 && (
            <div>
              <p className="text-sm text-light/60 mb-2">Invited ({invitedUsers.length}):</p>
              <div className="flex flex-wrap gap-2">
                {invitedUsers.map((email, idx) => (
                  <span 
                    key={idx}
                    className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm font-medium"
                  >
                    ✉️ {email}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {invitedUsers.length === 0 && (
            <p className="text-light/60 text-sm">
              Click "Invite" to send event invitations to users or email addresses.
            </p>
          )}
        </div>
      )}

      {/* Attendance Statistics */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
        <h2 className="font-title text-2xl text-light mb-4">Attendance Statistics</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-400">
              {getResponseCount('attending')}
            </div>
            <div className="text-sm text-green-300 mt-1">✅ Attending</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-red-400">
              {getResponseCount('declined')}
            </div>
            <div className="text-sm text-red-300 mt-1">❌ Not Attending</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-yellow-400">
              {getResponseCount('maybe')}
            </div>
            <div className="text-sm text-yellow-300 mt-1">⚠️ Maybe</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-light">
              {allMembers.length - Object.keys(event.responses || {}).length}
            </div>
            <div className="text-sm text-light/60 mt-1">⏳ No Response</div>
          </div>
        </div>
      </div>

      {/* Tracking Button */}
      <div className="mb-6">
        <button
          onClick={() => setShowTracking(!showTracking)}
          className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
        >
          📊 {showTracking ? 'Hide' : 'View'} Attendance Tracking
        </button>
      </div>

      {/* Tracking View */}
      {showTracking && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-title text-xl text-light">Attendance Tracking</h3>
            
            <select
              value={trackingFilter}
              onChange={(e) => setTrackingFilter(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="all" className="bg-mid-dark">All ({allMembers.length})</option>
              <option value="attending" className="bg-mid-dark">✅ Attending ({getResponseCount('attending')})</option>
              <option value="declined" className="bg-mid-dark">❌ Not Attending ({getResponseCount('declined')})</option>
              <option value="maybe" className="bg-mid-dark">⚠️ Maybe ({getResponseCount('maybe')})</option>
              <option value="noresponse" className="bg-mid-dark">⏳ No Response ({allMembers.length - Object.keys(event.responses || {}).length})</option>
            </select>
          </div>

          <div className="space-y-2">
            {filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-light/60">
                No members in this filter
              </div>
            ) : (
              filteredMembers.map(member => {
                const response = event.responses?.[member.id];
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                        {member.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="font-medium text-light">{member.username || 'Unknown'}</div>
                        <div className="text-sm text-light/60">{member.email}</div>
                      </div>
                    </div>
                    <div>
                      {response ? (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          response.status === 'attending' ? 'bg-green-500/20 text-green-300' :
                          response.status === 'declined' ? 'bg-red-500/20 text-red-300' :
                          'bg-yellow-500/20 text-yellow-300'
                        }`}>
                          {response.status === 'attending' && '✅ Attending'}
                          {response.status === 'declined' && '❌ Not Attending'}
                          {response.status === 'maybe' && '⚠️ Maybe'}
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/5 text-light/50">
                          ⏳ No Response
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-mid-dark border border-white/20 rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-title text-2xl text-light">Invite to Event</h3>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteSearch('');
                }}
                className="text-light/60 hover:text-light transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-light/80 mb-2">
                Search by name or email
              </label>
              <input
                type="text"
                placeholder="Type to search users..."
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                autoFocus
              />
            </div>

            {/* Search Results - Existing Users */}
            {searchResults.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-light/60 mb-2 uppercase tracking-wide">Existing Users:</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.map(user => (
                    <div
                      key={user.id}
                      onClick={() => inviteUser(user)}
                      className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-primary/50 cursor-pointer transition-all group"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                        {user.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-light group-hover:text-primary transition-colors">
                          {user.username}
                        </div>
                        <div className="text-xs text-light/60">{user.email}</div>
                      </div>
                      <button className="px-3 py-1 bg-primary/20 text-primary group-hover:bg-primary group-hover:text-white rounded-full text-xs font-medium transition-all">
                        Invite
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Results Message */}
            {inviteSearch.length >= 2 && searchResults.length === 0 && !inviteSearch.includes('@') && (
              <div className="mb-4 p-4 bg-white/5 border border-white/10 rounded-lg text-center">
                <p className="text-light/60 text-sm">No users found matching "{inviteSearch}"</p>
              </div>
            )}

            {/* Email Invite Section */}
            <div className="border-t border-white/10 pt-4">
              <p className="text-sm text-light/60 mb-3">
                Or invite by email address:
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={inviteSearch}
                  onChange={(e) => setInviteSearch(e.target.value)}
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && inviteSearch.includes('@')) {
                      sendEmailInvite();
                    }
                  }}
                />
                <button
                  onClick={sendEmailInvite}
                  disabled={!inviteSearch.includes('@')}
                  className="px-4 py-2 bg-primary hover:bg-primary/80 disabled:bg-white/10 disabled:text-light/40 text-white rounded-lg font-medium transition-all"
                >
                  Send Invite
                </button>
              </div>
              <p className="text-xs text-light/50 mt-2">
                💡 Enter an email address to send an invitation
              </p>
            </div>

            {/* Already Invited List */}
            {invitedUsers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-light/60 mb-2 uppercase tracking-wide">
                  Already Invited ({invitedUsers.length}):
                </p>
                <div className="flex flex-wrap gap-2">
                  {invitedUsers.map((email, idx) => (
                    <span 
                      key={idx}
                      className="px-2 py-1 bg-green-500/20 text-green-300 rounded-full text-xs font-medium"
                    >
                      ✓ {email}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={() => {
                setShowInviteModal(false);
                setInviteSearch('');
              }}
              className="w-full mt-4 px-4 py-3 bg-white/10 text-light rounded-lg hover:bg-white/15 font-medium transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



