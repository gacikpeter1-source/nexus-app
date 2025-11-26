// src/pages/Event.jsx
import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEvent, getCurrentUser, deleteEvent } from "../api/localApi";

const LS_KEY = (id) => `eventResponses:${id}`;

export default function EventPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: event, isLoading, error } = useQuery({
    queryKey: ["event", id],
    queryFn: () => getEvent(id),
  });

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUser,
  });

  // Get team name from clubs (not from old team data)
  const teamId = event?.team || event?.teamId || event?.teamID;
  const team = React.useMemo(() => {
    if (!teamId) return null;
    const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
    for (const club of clubs) {
      const foundTeam = (club.teams || []).find(t => String(t.id) === String(teamId));
      if (foundTeam) {
        return {
          ...foundTeam,
          clubId: club.id,
          clubName: club.name
        };
      }
    }
    return null;
  }, [teamId]);

  // local RSVP state persisted to localStorage
  const [responses, setResponses] = useState({});
  const [showTracking, setShowTracking] = useState(false);
  const [trackingFilter, setTrackingFilter] = useState('all'); // 'all' | 'confirmed' | 'declined' | 'backup' | 'noresponse'

  useEffect(() => {
    if (!event) return;
    const raw = localStorage.getItem(LS_KEY(event.id));
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        console.log('📥 Loaded responses for event:', event.id, parsed);
        setResponses(parsed);
      } catch {
        setResponses({});
      }
    } else {
      setResponses(event.responses || {});
    }
  }, [event]);

  function saveResponses(obj) {
    console.log('💾 Saving responses:', obj);
    setResponses(obj);
    try {
      localStorage.setItem(LS_KEY(event.id), JSON.stringify(obj));
      console.log('✅ Saved to localStorage:', LS_KEY(event.id));
    } catch (e) {
      console.warn("Could not save RSVP:", e);
    }
  }

  function handleRsvp(userId, status) {
    if (!userId) {
      console.error('❌ No user ID provided');
      return;
    }
    
    console.log('🎯 RSVP clicked:', { userId, status });
    const now = new Date().toISOString();
    const updated = {
      ...responses,
      [userId]: { status, timestamp: now },
    };
    console.log('📝 Updated responses:', updated);
    saveResponses(updated);
  }

  // Get all members for this event (for tracking)
  function getAllMembers() {
    if (!event || !user) return [];
    
    const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
    const allUsers = [];

    // Personal events - just the creator
    if (event.visibilityLevel === 'personal') {
      return [{ id: user.id, name: user.name || user.email, email: user.email }];
    }

    // Team events - get team members
    if (event.visibilityLevel === 'team' && event.clubId && event.teamId) {
      const club = clubs.find(c => c.id === event.clubId);
      if (club) {
        const team = (club.teams || []).find(t => t.id === event.teamId);
        if (team && team.members) {
          // Get user details for each member ID
          const usersData = JSON.parse(localStorage.getItem('users') || '[]');
          team.members.forEach(memberId => {
            const memberData = usersData.find(u => u.id === memberId);
            if (memberData) {
              allUsers.push({
                id: memberData.id,
                name: memberData.name || memberData.email,
                email: memberData.email
              });
            }
          });
        }
      }
    }

    // Club events - get all members from all teams
    if (event.visibilityLevel === 'club' && event.clubId) {
      const club = clubs.find(c => c.id === event.clubId);
      if (club) {
        const usersData = JSON.parse(localStorage.getItem('users') || '[]');
        const memberIds = new Set();
        
        // Collect all unique member IDs from all teams
        (club.teams || []).forEach(team => {
          (team.members || []).forEach(memberId => {
            memberIds.add(memberId);
          });
        });

        // Get user details
        memberIds.forEach(memberId => {
          const memberData = usersData.find(u => u.id === memberId);
          if (memberData) {
            allUsers.push({
              id: memberData.id,
              name: memberData.name || memberData.email,
              email: memberData.email
            });
          }
        });
      }
    }

    return allUsers;
  }

  // Get total member count
  function getTotalMembers() {
    return getAllMembers().length;
  }

  // Get only responses from actual members (filter out non-members)
  function getMemberResponses() {
    const members = getAllMembers();
    const memberIds = new Set(members.map(m => m.id));
    
    // Filter responses to only include actual members
    const filtered = {};
    Object.entries(responses || {}).forEach(([userId, response]) => {
      if (memberIds.has(userId)) {
        filtered[userId] = response;
      } else {
        console.log('⚠️ Ignoring response from non-member:', userId);
      }
    });
    
    return filtered;
  }

  // Get count of responses by status (only from members)
  function getResponseCount(status) {
    const memberResponses = getMemberResponses();
    return Object.values(memberResponses).filter(r => r.status === status).length;
  }

  // Filter members based on tracking filter
  function getFilteredMembers() {
    const allMembers = getAllMembers();
    
    if (trackingFilter === 'all') {
      return allMembers;
    }
    
    if (trackingFilter === 'noresponse') {
      return allMembers.filter(member => !responses?.[member.id]);
    }
    
    // Filter by response status (confirmed, declined, backup)
    return allMembers.filter(member => {
      const response = responses?.[member.id];
      return response && response.status === trackingFilter;
    });
  }

  // Check if user can view tracking (trainers, assistants, supertrainers)
  function canViewTracking() {
    if (!user || !event) return false;

    // Admin can view everything
    if (user.role === 'admin') return true;

    // Personal events - only creator can track
    if (event.visibilityLevel === 'personal') {
      return event.createdBy === user.id;
    }

    // Team/Club events - trainers, assistants, supertrainers can track
    if (event.clubId) {
      const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
      const club = clubs.find(c => c.id === event.clubId);
      if (!club) return false;

      const isTrainer = (club.trainers || []).includes(user.id);
      const isAssistant = (club.assistants || []).includes(user.id);
      const isSuperTrainer = club.superTrainer === user.id;

      return isTrainer || isAssistant || isSuperTrainer;
    }

    return false;
  }

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      navigate("/calendar");
    },
  });

  // Check if user can edit/delete this event
  function canManageEvent() {
    if (!user || !event) return false;

    // Admin can manage everything
    if (user.role === 'admin') return true;

    // Personal events - only creator can manage
    if (event.visibilityLevel === 'personal') {
      return event.createdBy === user.id;
    }

    // Team events - creator, trainers, assistants, or supertrainer of that club
    if (event.visibilityLevel === 'team') {
      // Creator can edit their own
      if (event.createdBy === user.id) return true;

      // Load clubs to check roles
      const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
      const club = clubs.find(c => c.id === event.clubId);
      if (!club) return false;

      const isTrainer = (club.trainers || []).includes(user.id);
      const isAssistant = (club.assistants || []).includes(user.id);
      const isSuperTrainer = club.superTrainer === user.id;

      return isTrainer || isAssistant || isSuperTrainer;
    }

    // Club events - only supertrainer of that club or admin
    if (event.visibilityLevel === 'club') {
      const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
      const club = clubs.find(c => c.id === event.clubId);
      if (!club) return false;

      return club.superTrainer === user.id;
    }

    return false;
  }

  const canEdit = canManageEvent();

  // Handle delete with confirmation
  function handleDelete() {
    if (!window.confirm(`Are you sure you want to delete "${event.title}"?`)) {
      return;
    }
    deleteMutation.mutate();
  }

  if (isLoading) return <div className="p-6">Loading event...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error.message}</div>;
  if (!event) return <div className="p-6">Event not found.</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-4">
        <Link to="/calendar" className="text-blue-600 hover:underline">
          ← Back to Calendar
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{event.title}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {event.date} {event.time ? `• ${event.time}` : ""}
            </p>
            <p className="text-sm text-gray-600">{event.location}</p>

            {/* Event visibility badge */}
            {event.visibilityLevel && (
              <div className="mt-2">
                {event.visibilityLevel === 'personal' && (
                  <span className="inline-block px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                    👤 Personal Event
                  </span>
                )}
                {event.visibilityLevel === 'team' && (
                  <span className="inline-block px-2 py-1 text-xs rounded bg-green-100 text-green-800">
                    👥 Team Event
                  </span>
                )}
                {event.visibilityLevel === 'club' && (
                  <span className="inline-block px-2 py-1 text-xs rounded bg-orange-100 text-orange-800">
                    🏛️ Club Event
                  </span>
                )}
              </div>
            )}

            {event.description && (
              <div className="mt-4 text-gray-700 whitespace-pre-wrap">
                {event.description}
              </div>
            )}

            {event.notes && (
              <div className="mt-3 text-sm text-gray-600">
                <strong>Notes:</strong> {event.notes}
              </div>
            )}
          </div>

          <div className="text-right ml-4">
            {teamId && (
              <>
                <div className="text-xs text-gray-500">Team</div>
                <div className="text-blue-600 font-medium">
                  {team ? <Link to={`/teams/${team.id}`}>{team.name}</Link> : teamId}
                </div>
              </>
            )}
            {event.visibilityLevel === 'club' && event.clubId && (
              <>
                <div className="text-xs text-gray-500 mt-2">Club</div>
                <div className="text-orange-600 font-medium">
                  {(() => {
                    const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
                    const club = clubs.find(c => c.id === event.clubId);
                    return club ? club.name : event.clubId;
                  })()}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Edit/Delete buttons */}
        {canEdit && (
          <div className="mb-6 pb-6 border-b flex gap-2">
            <Link
              to={`/events/${id}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
            >
              ✏️ Edit Event
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium disabled:bg-gray-400"
            >
              🗑️ {deleteMutation.isPending ? "Deleting..." : "Delete Event"}
            </button>
          </div>
        )}

        {/* RSVP Statistics */}
        <div className="mb-6 pb-6 border-b">
          <h3 className="font-semibold mb-3">Attendance Statistics</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">
                {getResponseCount('confirmed')}
              </div>
              <div className="text-xs text-green-600 font-medium">✅ Yes</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-700">
                {getResponseCount('declined')}
              </div>
              <div className="text-xs text-red-600 font-medium">❌ No</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-700">
                {getResponseCount('backup')}
              </div>
              <div className="text-xs text-yellow-600 font-medium">⚠️ Maybe</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-700">
                {(() => {
                  // Calculate no response count (only members)
                  const memberResponses = getMemberResponses();
                  const respondedCount = Object.keys(memberResponses).length;
                  const totalMembers = getTotalMembers();
                  return Math.max(0, totalMembers - respondedCount);
                })()}
              </div>
              <div className="text-xs text-gray-600 font-medium">⏳ No Response</div>
            </div>
          </div>
        </div>

        {/* Tracking Button - Available for all users who can see the event */}
        <div className="mb-6 pb-6 border-b">
          <button
            onClick={() => setShowTracking(!showTracking)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium"
          >
            📊 {showTracking ? 'Hide Tracking' : 'View Tracking'}
          </button>
        </div>

        {/* Tracking View - Detailed list of all members with filters */}
        {showTracking && (
          <div className="mb-6 pb-6 border-b">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Attendance Tracking</h3>
              
              {/* Filter Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Filter:</label>
                <select
                  value={trackingFilter}
                  onChange={(e) => setTrackingFilter(e.target.value)}
                  className="border rounded px-3 py-1 text-sm bg-white"
                >
                  <option value="all">All Members ({getAllMembers().length})</option>
                  <option value="confirmed">✅ Attending ({getResponseCount('confirmed')})</option>
                  <option value="declined">❌ Not Attending ({getResponseCount('declined')})</option>
                  <option value="backup">⚠️ Maybe ({getResponseCount('backup')})</option>
                  <option value="noresponse">⏳ No Response ({getTotalMembers() - Object.keys(getMemberResponses()).length})</option>
                </select>
              </div>
            </div>
            
            {/* Summary */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <strong>Total Members:</strong> {getTotalMembers()} | 
                <strong className="ml-2">Responded:</strong> {Object.keys(getMemberResponses()).length} | 
                <strong className="ml-2">Not Responded:</strong> {getTotalMembers() - Object.keys(getMemberResponses()).length}
                {trackingFilter !== 'all' && (
                  <span className="ml-2">
                    | <strong>Filtered:</strong> {getFilteredMembers().length}
                  </span>
                )}
              </p>
            </div>

            {/* Member List */}
            <div className="space-y-2">
              {getFilteredMembers().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No members match this filter</p>
                </div>
              ) : (
                getFilteredMembers().map(member => {
                  const response = responses?.[member.id];
                  return (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-xs text-gray-500">{member.email}</div>
                        </div>
                      </div>
                      <div>
                        {response ? (
                          <div className="flex items-center gap-2">
                            {response.status === 'confirmed' && (
                              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                ✅ Attending
                              </span>
                            )}
                            {response.status === 'declined' && (
                              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                                ❌ Not Attending
                              </span>
                            )}
                            {response.status === 'backup' && (
                              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                                ⚠️ Maybe
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {new Date(response.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        ) : (
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
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

        <div className="mt-6">
          <h3 className="font-semibold mb-2">RSVP</h3>
          
          {/* Show current user's response if exists */}
          {user && responses?.[user.id] && (
            <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
              <span className="text-blue-800">
                Your response: <strong>
                  {responses[user.id].status === 'confirmed' && '✅ Attending'}
                  {responses[user.id].status === 'declined' && '❌ Not Attending'}
                  {responses[user.id].status === 'backup' && '⚠️ Maybe'}
                </strong>
              </span>
            </div>
          )}
          
          <div className="flex gap-2">
            <button 
              onClick={() => handleRsvp(user?.id, "confirmed")} 
              className={`px-3 py-2 rounded font-medium ${
                responses?.[user?.id]?.status === 'confirmed' 
                  ? 'bg-green-700 text-white' 
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
              disabled={!user}
            >
              Yes {responses?.[user?.id]?.status === 'confirmed' && '✓'}
            </button>
            <button 
              onClick={() => handleRsvp(user?.id, "declined")} 
              className={`px-3 py-2 rounded font-medium ${
                responses?.[user?.id]?.status === 'declined' 
                  ? 'bg-red-700 text-white' 
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
              disabled={!user}
            >
              No {responses?.[user?.id]?.status === 'declined' && '✓'}
            </button>
            <button 
              onClick={() => handleRsvp(user?.id, "backup")} 
              className={`px-3 py-2 rounded font-medium ${
                responses?.[user?.id]?.status === 'backup' 
                  ? 'bg-yellow-600 text-white' 
                  : 'bg-yellow-500 text-white hover:bg-yellow-600'
              }`}
              disabled={!user}
            >
              Maybe {responses?.[user?.id]?.status === 'backup' && '✓'}
            </button>
          </div>

          <div className="mt-4">
            <h4 className="font-medium">Responses</h4>
            <ul className="mt-2 space-y-1">
              {Object.entries(responses || {}).length === 0 && <li className="text-sm text-gray-500">No responses yet.</li>}
              {Object.entries(responses || {}).map(([uid, r]) => {
                // Get user name from users data
                const usersData = JSON.parse(localStorage.getItem('users') || '[]');
                const userData = usersData.find(u => u.id === uid);
                const displayName = userData ? (userData.name || userData.email) : uid;
                
                return (
                  <li key={uid} className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium">{displayName}</div>
                      <div className="text-xs text-gray-500">{r.status} • {new Date(r.timestamp).toLocaleString()}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
