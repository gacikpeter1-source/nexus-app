// src/components/EventDetailModal.jsx
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getEvent, updateEventResponse, getClub, getAllUsers } from '../firebase/firestore';
import { isEventLocked, canChangeEventStatus, getLockTimeText } from '../utils/eventLockUtils';
import { useIsAdmin } from '../hooks/usePermissions';
import { isClubOwner } from '../firebase/privileges';

export default function EventDetailModal({ eventId, onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const isUserAdmin = useIsAdmin();

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

  useEffect(() => {
    if (eventId) {
      loadEventData();
    }
  }, [eventId]);

  async function loadEventData() {
    try {
      setLoading(true);

      // Load event
      const eventData = await getEvent(eventId);
      if (!eventData) {
        setEvent(null);
        showToast('Event not found', 'error');
        onClose();
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

  // Handle RSVP
  async function handleRsvp(newStatus, message = null) {
    if (updatingRsvp || !event || !user) return;

    // Check if status change is allowed
    const isTrainerOrAdmin = isUserAdmin || (club && (club.trainers || []).includes(user?.id));
    const statusCheck = canChangeEventStatus(event, user, isTrainerOrAdmin, newStatus);
    
    if (!statusCheck.canChange) {
      showToast(statusCheck.reason, 'error');
      return;
    }

    try {
      setUpdatingRsvp(true);
      await updateEventResponse(eventId, user.id, newStatus, message);
      await loadEventData();
      showToast(`Response updated: ${newStatus}`, 'success');
      setShowMessageModal(false);
      setResponseMessage('');
      setShowDeclineMenu(false);
      setShowMaybeMenu(false);
    } catch (error) {
      console.error('Error updating RSVP:', error);
      showToast('Failed to update response', 'error');
    } finally {
      setUpdatingRsvp(false);
    }
  }

  // Open message modal for maybe/declined
  function openMessageModal(type) {
    setMessageType(type);
    setResponseMessage('');
    setShowDeclineMenu(false);
    setShowMaybeMenu(false);
    setShowMessageModal(true);
  }

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Get user name
  const getUserName = (userId) => {
    const u = allUsers.find(user => user.id === userId);
    return u ? (u.username || u.email) : 'Unknown';
  };

  // Get response counts (using correct status names)
  const getResponseCounts = () => {
    if (!event || !event.responses) return { attending: 0, declined: 0, maybe: 0, pending: 0 };
    
    const responses = Object.values(event.responses);
    return {
      attending: responses.filter(r => r.status === 'attending').length,
      declined: responses.filter(r => r.status === 'declined').length,
      maybe: responses.filter(r => r.status === 'maybe').length,
      pending: responses.filter(r => r.status === 'pending').length
    };
  };

  // Get filtered tracking list
  const getFilteredTracking = () => {
    if (!event || !event.responses) return [];
    
    const entries = Object.entries(event.responses).map(([userId, response]) => ({
      userId,
      ...response
    }));

    if (trackingFilter === 'all') return entries;
    return entries.filter(entry => entry.status === trackingFilter);
  };

  function getUserResponse() {
    if (!event || !user || !event.responses) return null;
    return event.responses[user.id];
  }

  function canManageEvent() {
    if (!user || !event) return false;
    if (isUserAdmin) return true;
    if (event.createdBy === user.id) return true;
    if (club) {
      const isTrainer = (club.trainers || []).includes(user.id);
      const isOwner = isClubOwner(user, club.id);
      return isTrainer || isOwner;
    }
    return false;
  }

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
        <div className="bg-dark border border-white/20 rounded-xl p-8 max-w-md w-full mx-4">
          <div className="text-center text-light/60">Loading event...</div>
        </div>
      </div>,
      document.body
    );
  }

  if (!event) {
    return null;
  }

  const userResponse = getUserResponse();
  const canEdit = canManageEvent();
  const eventIsLocked = isEventLocked(event);
  const isTrainerOrAdmin = isUserAdmin || (club && (club.trainers || []).includes(user?.id));
  
  const canAttend = canChangeEventStatus(event, user, isTrainerOrAdmin, 'attending').canChange;
  const canDecline = canChangeEventStatus(event, user, isTrainerOrAdmin, 'declined').canChange;
  const canMaybe = canChangeEventStatus(event, user, isTrainerOrAdmin, 'maybe').canChange;
  
  const responseCounts = getResponseCounts();

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
      <div className="relative bg-dark border border-white/20 rounded-xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Content Wrapper */}
        <div className="p-6">
          {/* Close Button - Top Right */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-light/60 hover:text-light transition-colors text-2xl leading-none z-10 bg-dark/90 border border-white/20 rounded-full w-10 h-10 flex items-center justify-center hover:bg-dark shadow-lg"
          >
            ✕
          </button>
          {/* Event Header Card */}
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

            {/* RSVP Buttons */}
            {event.visibilityLevel !== 'personal' && user && (
              <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-white/10">
                <button 
                  onClick={() => handleRsvp('attending')} 
                  className={`flex-1 min-w-[100px] px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                    userResponse?.status === 'attending' 
                      ? 'bg-green-600 text-white ring-2 ring-green-400' 
                      : 'bg-green-500 text-white hover:bg-green-600'
                  } ${!canAttend && 'opacity-50 cursor-not-allowed'}`}
                  disabled={updatingRsvp || !canAttend}
                >
                  {userResponse?.status === 'attending' ? '✓ Attending' : 'Attend'}
                </button>
                
                {/* Decline Button with Dropdown */}
                <div className="relative flex-1 min-w-[100px]">
                  <button 
                    onClick={() => setShowDeclineMenu(!showDeclineMenu)}
                    className={`w-full px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                      userResponse?.status === 'declined' 
                        ? 'bg-red-600 text-white ring-2 ring-red-400' 
                        : 'bg-red-500 text-white hover:bg-red-600'
                    } ${!canDecline && 'opacity-50 cursor-not-allowed'}`}
                    disabled={updatingRsvp || !canDecline}
                  >
                    {userResponse?.status === 'declined' ? '✓ Declined' : 'Decline ▼'}
                  </button>

                  {showDeclineMenu && canDecline && (
                    <div className="absolute top-full left-0 mt-1 bg-mid-dark border border-white/20 rounded-lg shadow-2xl overflow-hidden z-[999999] min-w-full">
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
                    className={`w-full px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                      userResponse?.status === 'maybe' 
                        ? 'bg-yellow-600 text-white ring-2 ring-yellow-400' 
                        : 'bg-yellow-500 text-white hover:bg-yellow-600'
                    } ${!canMaybe && 'opacity-50 cursor-not-allowed'}`}
                    disabled={updatingRsvp || !canMaybe}
                  >
                    {userResponse?.status === 'maybe' ? '✓ Maybe' : 'Maybe ▼'}
                  </button>

                  {showMaybeMenu && canMaybe && (
                    <div className="absolute top-full left-0 mt-1 bg-mid-dark border border-white/20 rounded-lg shadow-2xl overflow-hidden z-[999999] min-w-full">
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

            {/* Event Title and Details */}
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <h1 className="font-title text-3xl md:text-4xl text-light mb-4">{event.title}</h1>
                
                {/* Date and Time */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-light/70 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📅</span>
                    <span>{formatDate(event.date)}</span>
                  </div>
                  {event.time && (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🕐</span>
                      <span>{event.time}</span>
                    </div>
                  )}
                  {event.location && (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📍</span>
                      <span>{event.location}</span>
                    </div>
                  )}
                </div>

                {/* Type Badge */}
                <div className="flex flex-wrap gap-2">
                  <span className="inline-block px-3 py-1 bg-primary/20 text-primary text-xs rounded-full font-medium capitalize">
                    {event.type || 'Event'}
                  </span>
                  {event.isLeagueGame && (
                    <span className="inline-block px-3 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full font-medium">
                      🏆 League Game
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {event.description && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <h3 className="text-sm font-semibold text-light/80 mb-2">Description</h3>
                <p className="text-light/70 text-sm whitespace-pre-wrap">{event.description}</p>
              </div>
            )}
          </div>

          {/* Attendance Statistics */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-title text-xl text-light">Attendance</h2>
              <button
                onClick={() => setShowTracking(!showTracking)}
                className="text-sm text-primary hover:underline"
              >
                {showTracking ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-green-500/10 rounded-lg p-4 text-center border border-green-500/20">
                <div className="text-3xl font-bold text-green-400">{responseCounts.attending}</div>
                <div className="text-xs text-green-300 mt-1">Attending</div>
              </div>
              <div className="bg-red-500/10 rounded-lg p-4 text-center border border-red-500/20">
                <div className="text-3xl font-bold text-red-400">{responseCounts.declined}</div>
                <div className="text-xs text-red-300 mt-1">Declined</div>
              </div>
              <div className="bg-yellow-500/10 rounded-lg p-4 text-center border border-yellow-500/20">
                <div className="text-3xl font-bold text-yellow-400">{responseCounts.maybe}</div>
                <div className="text-xs text-yellow-300 mt-1">Maybe</div>
              </div>
              <div className="bg-gray-500/10 rounded-lg p-4 text-center border border-gray-500/20">
                <div className="text-3xl font-bold text-gray-400">{responseCounts.pending}</div>
                <div className="text-xs text-gray-300 mt-1">Pending</div>
              </div>
            </div>

            {/* Detailed Tracking */}
            {showTracking && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex flex-wrap gap-2 mb-4">
                  {['all', 'attending', 'declined', 'maybe', 'pending'].map(filter => (
                    <button
                      key={filter}
                      onClick={() => setTrackingFilter(filter)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                        trackingFilter === filter
                          ? 'bg-primary text-white'
                          : 'bg-white/10 text-light/60 hover:bg-white/20'
                      }`}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {getFilteredTracking().map(entry => (
                    <div key={entry.userId} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded hover:bg-white/10 transition">
                      <span className="text-light text-sm font-medium">{getUserName(entry.userId)}</span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          entry.status === 'attending' ? 'bg-green-500/20 text-green-300' :
                          entry.status === 'declined' ? 'bg-red-500/20 text-red-300' :
                          entry.status === 'maybe' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-gray-500/20 text-gray-300'
                        }`}>
                          {entry.status}
                        </span>
                        {entry.message && (
                          <span className="text-xs text-light/60" title={entry.message}>💬</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {getFilteredTracking().length === 0 && (
                    <div className="text-center py-4 text-light/40 text-sm">
                      No {trackingFilter === 'all' ? '' : trackingFilter} responses
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* View Full Event Button */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                navigate(`/event/${eventId}`);
                onClose();
              }}
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-all"
            >
              View Full Event Details →
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg font-medium transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Message Modal */}
      {showMessageModal && (
        <div 
          className="fixed inset-0 z-[999999] flex items-center justify-center" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div className="bg-mid-dark border border-white/20 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="font-semibold text-light mb-4">
              {messageType === 'maybe' ? 'Maybe - Add Message' : 'Decline - Add Message'}
            </h3>
            <textarea
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
              placeholder="Optional message..."
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              rows={4}
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleRsvp(messageType, responseMessage)}
                disabled={updatingRsvp}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-all disabled:opacity-50"
              >
                {updatingRsvp ? 'Submitting...' : 'Submit'}
              </button>
              <button
                onClick={() => setShowMessageModal(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
