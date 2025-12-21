// src/pages/Event.jsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getEvent, updateEventResponse, deleteEvent, getClub, getAllUsers } from '../firebase/firestore';
import { useIsAdmin } from '../hooks/usePermissions';
import { isClubOwner } from '../firebase/privileges';
import { ShowIf } from '../components/PermissionGuard';
import { isEventLocked, canChangeEventStatus, getLockTimeText } from '../utils/eventLockUtils';

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
  
  // Message modal state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageType, setMessageType] = useState(''); // 'maybe' or 'declined'
  const [responseMessage, setResponseMessage] = useState('');
  const [showDeclineMenu, setShowDeclineMenu] = useState(false);
  const [showMaybeMenu, setShowMaybeMenu] = useState(false);

  // Invite state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');

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

    async function handleRsvp(status, message = null) {
    if (!user || !event) return;

    try {
      setUpdatingRsvp(true);
      await updateEventResponse(eventId, user.id, status, message);
      
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

  function openMessageModal(type) {
    setMessageType(type);
    setResponseMessage('');
    setShowMessageModal(true);
  }

  async function handleSubmitWithMessage() {
    if (!responseMessage.trim()) {
      showToast('Please enter a message', 'error');
      return;
    }
    
    await handleRsvp(messageType, responseMessage);
    setShowMessageModal(false);
  }

// Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (!event.target.closest('.relative')) {
        setShowDeclineMenu(false);
        setShowMaybeMenu(false);
      }
    }

    if (showDeclineMenu || showMaybeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDeclineMenu, showMaybeMenu]);

  async function handleDelete() {
    if (!window.confirm(`Are you sure you want to delete "${event.title}"?`)) {
      return;
    }

    try {
      // Get affected users before deleting
    const affectedUsers = getAllMembers().map(m => m.id);

      await deleteEvent(eventId);

      // Send notification
    const { notifyEventDeleted } = await import('../utils/notifications');
    await notifyEventDeleted(event.title, affectedUsers);

      showToast('Event deleted successfully', 'success');
      navigate('/calendar');
    } catch (error) {
      console.error('Error deleting event:', error);
      showToast('Failed to delete event', 'error');
    }
  }

  // Get all members who should see this event
  function getAllMembers() {
    if (!event) return [];

    const memberIds = new Set();

    // Personal events - just the creator
    if (event.visibilityLevel === 'personal') {
      return [{ ...user, memberType: 'Member' }];
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

    // Add invited external users (with RSVP but not in team/club)
    if (event.responses) {
      Object.keys(event.responses).forEach(userId => {
        memberIds.add(userId);
      });
    }

    // Convert IDs to user objects with member type
    return Array.from(memberIds).map(id => {
      const userData = allUsers.find(u => u.id === id);
      const userObj = userData || { id, username: 'Unknown', email: 'N/A' };
      
      // Determine if external (invited but not in team/club)
      let memberType = 'Member';
      
      if (event.visibilityLevel === 'team' && team) {
        const isInTeam = (team.members || []).includes(id) ||
                        (team.trainers || []).includes(id) ||
                        (team.assistants || []).includes(id);
        if (!isInTeam && event.responses?.[id]) {
          memberType = 'External';
        }
      } else if (event.visibilityLevel === 'club' && club) {
        const isInClub = (club.members || []).includes(id) ||
                        (club.trainers || []).includes(id) ||
                        (club.assistants || []).includes(id);
        const isInAnyTeam = (club.teams || []).some(t => 
          (t.members || []).includes(id) ||
          (t.trainers || []).includes(id) ||
          (t.assistants || []).includes(id)
        );
        if (!isInClub && !isInAnyTeam && event.responses?.[id]) {
          memberType = 'External';
        }
      }
      
      return { ...userObj, memberType };
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

  // 🔒 NEW PERMISSION SYSTEM: Check if user can manage this event
  const isUserAdmin = useIsAdmin();
  
  function canManageEvent() {
    if (!user || !event) return false;

    // Admin can manage everything
    if (isUserAdmin) return true;

    // Creator can manage their own
    if (event.createdBy === user.id) return true;

    // Check club roles for team/club events
    if (club) {
      const isTrainer = (club.trainers || []).includes(user.id);
      const isOwner = isClubOwner(user, club.id);
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
  async function inviteUser(invitedUser) {
    try {
      // Add user to event responses as "maybe" 
      // This makes the event visible in their calendar
      await updateEventResponse(eventId, invitedUser.id, 'maybe', null);
      
      showToast(`${invitedUser.username} can now see this event`, 'success');
      setInviteSearch('');
      
      // Reload event to show updated list
      await loadEventData();
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
          className="px-4 py-2 text-sm bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
        >
          Back to Calendar
        </button>
      </div>
    );
  }

  const userResponse = getUserResponse();
  const canEdit = canManageEvent();
  const allMembers = getAllMembers();

  // Check lock status
  const eventIsLocked = isEventLocked(event);
  const isTrainerOrAdmin = isUserAdmin || (club && (club.trainers || []).includes(user?.id));
  const statusChangeCheck = canChangeEventStatus(event, user, isTrainerOrAdmin);
  const canChangeStatus = statusChangeCheck.canChange;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/calendar')}
        className="mb-4 flex items-center gap-2 text-sm text-light/60 hover:text-light transition-colors"
      >
        <span>←</span>
        <span>Back to Calendar</span>
      </button>

      {/* Event Header */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
      
      {/* Lock Status Banner */}
      {eventIsLocked && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔒</span>
            <div className="flex-1">
              <p className="text-red-300 font-medium text-sm">
                Event is Locked
              </p>
              <p className="text-red-200/80 text-xs mt-1">
                {isTrainerOrAdmin 
                  ? 'Status changes are disabled for attendees. You can still manage as trainer.'
                  : 'Status changes are no longer allowed. Contact the organizer if needed.'}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* RSVP Buttons - Top Row */}
      {event.visibilityLevel !== 'personal' && user && (
        <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-white/10">
          <button 
            onClick={() => handleRsvp('attending')} 
            className={`flex-1 min-w-[100px] px-3 py-1.5 rounded-lg font-medium transition-all text-xs ${
              userResponse?.status === 'attending' 
                ? 'bg-green-600 text-white ring-2 ring-green-400' 
                : 'bg-green-500 text-white hover:bg-green-600'
            } ${!canChangeStatus && 'opacity-50 cursor-not-allowed'}`}
            disabled={updatingRsvp || !canChangeStatus}
            title={!canChangeStatus ? statusChangeCheck.reason : ''}
          >
            {userResponse?.status === 'attending' ? '✓ Attending' : 'Attend'}
          </button>
          
          {/* Decline Button with Dropdown */}
          <div className="relative flex-1 min-w-[100px]">
            <button 
              onClick={() => setShowDeclineMenu(!showDeclineMenu)}
              className={`w-full px-3 py-1.5 rounded-lg font-medium transition-all text-xs ${
                userResponse?.status === 'declined' 
                  ? 'bg-red-600 text-white ring-2 ring-red-400' 
                  : 'bg-red-500 text-white hover:bg-red-600'
              } ${!canChangeStatus && 'opacity-50 cursor-not-allowed'}`}
              disabled={updatingRsvp || !canChangeStatus}
              title={!canChangeStatus ? statusChangeCheck.reason : ''}
            >
              {userResponse?.status === 'declined' ? '✓ Declined' : 'Decline ▼'}
            </button>

            {/* Dropdown Menu */}
            {showDeclineMenu && (
              <div className="absolute top-full left-0 mt-1 bg-mid-dark border border-white/20 rounded-lg shadow-2xl overflow-hidden z-50 min-w-full">
                <button
                  onClick={() => {
                    handleRsvp('declined', null);
                    setShowDeclineMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-light hover:bg-white/10 transition-all"
                >
                  Decline
                </button>
                <button
                  onClick={() => {
                    openMessageModal('declined');
                    setShowDeclineMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-light hover:bg-white/10 transition-all border-t border-white/10"
                >
                  Decline with message
                </button>
              </div>
            )}
          </div>

{/* Maybe Button with Dropdown */}
          <div className="relative flex-1 min-w-[100px]">
            <button 
              onClick={() => setShowMaybeMenu(!showMaybeMenu)}
              className={`w-full px-3 py-1.5 rounded-lg font-medium transition-all text-xs ${
                userResponse?.status === 'maybe' 
                  ? 'bg-yellow-600 text-white ring-2 ring-yellow-400' 
                  : 'bg-yellow-500 text-white hover:bg-yellow-600'
              } ${!canChangeStatus && 'opacity-50 cursor-not-allowed'}`}
              disabled={updatingRsvp || !canChangeStatus}
              title={!canChangeStatus ? statusChangeCheck.reason : ''}
            >
              {userResponse?.status === 'maybe' ? '✓ Maybe' : 'Maybe ▼'}
            </button>

            {/* Dropdown Menu */}
            {showMaybeMenu && (
              <div className="absolute top-full left-0 mt-1 bg-mid-dark border border-white/20 rounded-lg shadow-2xl overflow-hidden z-50 min-w-full">
                <button
                  onClick={() => {
                    handleRsvp('maybe', null);
                    setShowMaybeMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-light hover:bg-white/10 transition-all"
                >
                  Maybe
                </button>
                <button
                  onClick={() => {
                    openMessageModal('maybe');
                    setShowMaybeMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-light hover:bg-white/10 transition-all border-t border-white/10"
                >
                  Maybe with message
                </button>
              </div>
            )}
          </div>
        </div>
      )}
        <div className="flex items-start justify-between gap-6 mb-4">
          <div className="flex-1">
            {/* 1. Event Title */}
            <h1 className="font-title text-4xl text-light mb-4">{event.title}</h1>
            
            {/* 2. Date and Time */}
            <div className="space-y-2 text-light/70 mb-4">
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
            </div>

            {/* 3. Club and Team */}
            {(team || club) && (
              <div className="space-y-1 text-sm text-light/70 mb-4">
                {team && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-light/50">Team:</span>
                    <Link 
                      to={`/team/${team.clubId}/${team.id}`}
                      className="text-primary hover:text-primary/80 font-medium truncate"
                    >
                      {team.name}
                    </Link>
                  </div>
                )}
                {club && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-light/50">Club:</span>
                    <span className="font-medium truncate">{club.name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Event Type and Visibility */}
            <div className="space-y-1 text-sm mb-4">
              <div className="flex items-center gap-2">
                <span className="font-medium text-light/50">Type:</span>
                <span className="inline-block px-3 py-1 text-xs rounded-full bg-primary/20 text-primary capitalize">
                  {event.type}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-light/50">Visibility:</span>
                {event.visibilityLevel === 'personal' && (
                  <span className="inline-block px-3 py-1 text-xs rounded-full bg-purple-500/20 text-purple-300">
                    👤 Personal
                  </span>
                )}
                {event.visibilityLevel === 'team' && (
                  <span className="inline-block px-3 py-1 text-xs rounded-full bg-blue-500/20 text-blue-300">
                    👥 Team
                  </span>
                )}
                {event.visibilityLevel === 'club' && (
                  <span className="inline-block px-3 py-1 text-xs rounded-full bg-orange-500/20 text-orange-300">
                    🏛️ Club
                  </span>
                )}
              </div>
            </div>

            {event.description && (
              <div className="mt-4 text-light/80 whitespace-pre-wrap">
                {event.description}
              </div>
            )}
          </div>     
        </div>

        {/* Edit/Delete/Invite Buttons - 🎨 NEW: Using ShowIf component */}
        <ShowIf condition={canEdit}>
          <div className="flex flex-wrap gap-2 pt-4 border-t border-white/10">
            {event.visibilityLevel !== 'personal' && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-3 py-1.5 text-xs bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
              >
                Invite
              </button>
            )}
            <Link
              to={`/edit-event/${eventId}`}
              className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all"
            >
              Edit
            </Link>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all"
            >
              Delete
            </button>
          </div>
        </ShowIf>
      </div>

      {/* Attendance Statistics */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 mb-6">
        <h2 className="font-title text-lg text-light mb-3">Attendance Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-400">
              {getResponseCount('attending')}
            </div>
            <div className="text-xs text-green-300 mt-1">✅ Attending</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-400">
              {getResponseCount('declined')}
            </div>
            <div className="text-xs text-red-300 mt-1">❌ Not Attending</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {getResponseCount('maybe')}
            </div>
            <div className="text-xs text-yellow-300 mt-1">⚠️ Maybe</div>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-400">
              {getResponseCount('waiting')}
            </div>
            <div className="text-xs text-orange-300 mt-1">⏳ Waiting</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-light">
              {allMembers.length - Object.keys(event.responses || {}).length}
            </div>
            <div className="text-xs text-light/60 mt-1">⏳ No Response</div>
          </div>
        </div>
      </div>

      {/* Tracking Button */}
      <div className="mb-6">
        <button
          onClick={() => setShowTracking(!showTracking)}
          className="px-4 py-2 text-sm bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
        >
          📊 {showTracking ? 'Hide' : 'View'} Attendance Tracking
        </button>
      </div>

      {/* Tracking View */}
      {showTracking && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 md:p-6 overflow-hidden">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
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
              filteredMembers.map((member, idx) => {
                const response = event.responses?.[member.id];
                
                // Calculate standby status if limit exists
                const isStandby = event.participantLimit && response?.status === 'attending' ? 
                  (() => {
                    const attendingList = Object.entries(event.responses || {})
                      .filter(([_, r]) => r.status === 'attending')
                      .sort((a, b) => {
                        const timeA = a[1].timestamp?.toMillis?.() || 0;
                        const timeB = b[1].timestamp?.toMillis?.() || 0;
                        return timeA - timeB;
                      });
                    const userIndex = attendingList.findIndex(([id]) => id === member.id);
                    return userIndex >= event.participantLimit;
                  })() : false;

                const canSeeMessage = canManageEvent();

                return (
                  <div
                    key={member.id}
                    className={`p-2 md:p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all ${
                      isStandby ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold shrink-0">
                          {member.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                          <span className="font-medium text-light text-sm md:text-base truncate">{member.username || 'Unknown'}</span>
                          {member.role && (
                            <span className="text-xs text-light/50">• {member.role}</span>
                          )}
                          {member.memberType === 'External' && (
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-medium">
                              External
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        {response ? (
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            response.status === 'attending' ? 'bg-green-500/20 text-green-300' :
                            response.status === 'waiting' ? 'bg-orange-500/20 text-orange-300' :
                            response.status === 'declined' ? 'bg-red-500/20 text-red-300' :
                            'bg-yellow-500/20 text-yellow-300'
                          }`}>
                            {response.status === 'attending' && '✅ Attending'}
                            {response.status === 'waiting' && (response.waitlistNotified ? '🔔 Notified' : '⏳ Waiting')}
                            {response.status === 'declined' && '❌ Not Attending'}
                            {response.status === 'maybe' && '⚠️ Maybe'}
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-light/50">
                            ⏳ No Response
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Show message if exists and user can see it */}
                    {canSeeMessage && response?.message && (
                      <div className="mt-2 pl-13 pr-3">
                        <div className="text-xs text-light/60 bg-white/5 border border-white/10 rounded px-3 py-2">
                          <span className="font-medium">Message:</span> {response.message}
                        </div>
                      </div>
                    )}
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

      {/* Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-mid-dark border border-white/10 rounded-xl p-6 max-w-md w-full">
            <h3 className="font-title text-2xl text-light mb-4">
              {messageType === 'maybe' ? 'Maybe - Add Message' : 'Decline - Add Message'}
            </h3>
            
            <p className="text-light/70 text-sm mb-4">
              Your message will be visible only to the event creator.
            </p>

            <textarea
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
              placeholder="e.g., Sickness, Away, Family event..."
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px]"
              maxLength={200}
            />
            <p className="text-xs text-light/50 mt-1">{responseMessage.length}/200 characters</p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMessageModal(false)}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/15 text-light rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitWithMessage}
                disabled={!responseMessage.trim()}
                className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition-all ${
                  messageType === 'maybe' 
                    ? 'bg-yellow-500 hover:bg-yellow-600' 
                    : 'bg-red-500 hover:bg-red-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
