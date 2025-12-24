// src/pages/AttendanceEntry.jsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  getClub, 
  getAllUsers,
  createAttendance,
  getAttendanceByDate,
  updateAttendance,
  getTeamEvents
} from '../firebase/firestore';

export default function AttendanceEntry() {
  const { clubId, teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [club, setClub] = useState(null);
  const [team, setTeam] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventType, setEventType] = useState('training');
  const [customType, setCustomType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [existingAttendanceId, setExistingAttendanceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState(''); // 'saving', 'saved', 'error'
  const saveTimeoutRef = useRef(null);
  const initialLoadRef = useRef(true);
  
  // Event linking state
  const [dayEvents, setDayEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Session management for multiple attendance per day
  const [sessionName, setSessionName] = useState('');
  const [existingSessionsForDate, setExistingSessionsForDate] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [showNewSessionOption, setShowNewSessionOption] = useState(true);

  // Default custom attendance statuses
  const defaultCustomStatuses = [
    { id: 'late', label: 'Late', color: '#FFA500' },
    { id: 'excused', label: 'Excused', color: '#3B82F6' },
    { id: 'injured', label: 'Injured', color: '#EF4444' },
    { id: 'sick', label: 'Sick', color: '#F59E0B' },
    { id: 'early_departure', label: 'Early Departure', color: '#8B5CF6' }
  ];

  // Get custom statuses from team settings or use defaults
  const customStatuses = team?.customAttendanceStatuses || defaultCustomStatuses;

  // Load club and team data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [clubData, usersData] = await Promise.all([
          getClub(clubId),
          getAllUsers()
        ]);

        if (clubData) {
          setClub(clubData);
          const foundTeam = clubData.teams?.find(t => t.id === teamId);
          if (foundTeam) {
            setTeam({ ...foundTeam, clubId: clubData.id, clubName: clubData.name });
            
            // Initialize attendance records for team members
            const teamMemberIds = [
              ...(foundTeam.trainers || []),
              ...(foundTeam.assistants || []),
              ...(foundTeam.members || [])
            ];

            const teamMembers = usersData.filter(u => teamMemberIds.includes(u.id));
            
            // Check if attendance exists for selected date (now returns array)
            const existingSessions = await getAttendanceByDate(teamId, selectedDate);
            setExistingSessionsForDate(existingSessions);
            
            // If there are existing sessions but no specific one selected, show new session option
            if (existingSessions.length > 0 && !selectedSessionId) {
              setShowNewSessionOption(true);
              // Initialize new records for new session
              setAttendanceRecords(
                teamMembers.map(member => ({
                  userId: member.id,
                  username: member.username || member.email,
                  email: member.email,
                  role: member.role,
                  present: false,
                  comment: '',
                  customStatuses: {}
                }))
              );
            } else if (selectedSessionId) {
              // Load specific session
              const session = existingSessions.find(s => s.id === selectedSessionId);
              if (session) {
                setExistingAttendanceId(session.id);
                setEventType(session.type);
                setCustomType(session.customType || '');
                setSessionName(session.sessionName || '');
                setAttendanceRecords(session.records);
                setShowNewSessionOption(false);
              }
            } else {
              // No existing sessions, initialize new records
              setAttendanceRecords(
                teamMembers.map(member => ({
                  userId: member.id,
                  username: member.username || member.email,
                  email: member.email,
                  role: member.role,
                  present: false,
                  comment: '',
                  customStatuses: {}
                }))
              );
            }
          }
        }

        setAllUsers(usersData);
      } catch (error) {
        console.error('Error loading data:', error);
        showToast('Failed to load data', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [clubId, teamId, selectedDate]);

  // Load events for selected date
  useEffect(() => {
    const loadDayEvents = async () => {
      if (!team || !selectedDate) return;
      
      try {
        setLoadingEvents(true);
        const allTeamEvents = await getTeamEvents(team.id);
        
        // Filter events for selected date
        const eventsOnDate = allTeamEvents.filter(event => {
          const eventDate = new Date(event.date).toISOString().split('T')[0];
          return eventDate === selectedDate;
        });
        
        setDayEvents(eventsOnDate);
        
        // Auto-select if only one event
        if (eventsOnDate.length === 1) {
          handleEventSelect(eventsOnDate[0]);
        } else if (eventsOnDate.length === 0) {
          setSelectedEvent(null);
        }
      } catch (error) {
        console.error('Error loading events:', error);
      } finally {
        setLoadingEvents(false);
      }
    };

    loadDayEvents();
  }, [team, selectedDate]);

  // Handle event selection and pre-fill from responses
  const handleEventSelect = (event) => {
    setSelectedEvent(event);
    setEventType(event.type || 'training');
    
    // Pre-fill attendance based on event responses
    if (event.responses) {
      setAttendanceRecords(prev => {
        return prev.map(record => {
          const response = event.responses[record.userId];
          if (response) {
            // Auto-check users who confirmed
            if (response.status === 'confirmed') {
              return { ...record, present: true };
            }
            // Add response status as comment
            const statusText = {
              'confirmed': 'Said Yes',
              'declined': 'Said No',
              'tentative': 'Said Maybe'
            }[response.status] || '';
            
            return { 
              ...record, 
              comment: record.comment || statusText 
            };
          }
          return record;
        });
      });
    }
  };

  // Filter records by search
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return attendanceRecords;
    
    const lowerQuery = searchQuery.toLowerCase();
    return attendanceRecords.filter(record => 
      record.username.toLowerCase().includes(lowerQuery) ||
      record.email.toLowerCase().includes(lowerQuery) ||
      record.userId.toLowerCase().includes(lowerQuery)
    );
  }, [attendanceRecords, searchQuery]);

  // Separate present and absent
  const presentRecords = useMemo(() => 
    filteredRecords.filter(r => r.present),
    [filteredRecords]
  );

  const absentRecords = useMemo(() => 
    filteredRecords.filter(r => !r.present),
    [filteredRecords]
  );

  // Calculate statistics
  const statistics = useMemo(() => {
    const total = attendanceRecords.length;
    const present = attendanceRecords.filter(r => r.present).length;
    const absent = total - present;
    const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : 0;

    return { total, present, absent, percentage };
  }, [attendanceRecords]);

  const handleTogglePresence = (userId) => {
    setAttendanceRecords(prev => 
      prev.map(record => 
        record.userId === userId 
          ? { ...record, present: !record.present }
          : record
      )
    );
  };

  const handleCommentChange = (userId, comment) => {
    setAttendanceRecords(prev => 
      prev.map(record => 
        record.userId === userId 
          ? { ...record, comment }
          : record
      )
    );
  };

  const handleCustomStatusToggle = (userId, statusId) => {
    setAttendanceRecords(prev => 
      prev.map(record => 
        record.userId === userId 
          ? { 
              ...record, 
              customStatuses: {
                ...record.customStatuses,
                [statusId]: !record.customStatuses?.[statusId]
              }
            }
          : record
      )
    );
  };

  // Auto-save function with debouncing
  const performAutoSave = useCallback(async () => {
    if (eventType === 'custom' && !customType.trim()) {
      return; // Skip auto-save if custom type is empty
    }

    try {
      setAutoSaveStatus('saving');

      // Calculate cross-check statistics if event is selected
      let crossCheck = null;
      if (selectedEvent && selectedEvent.responses) {
        const responses = selectedEvent.responses;
        const confirmed = Object.keys(responses).filter(uid => responses[uid].status === 'confirmed');
        const declined = Object.keys(responses).filter(uid => responses[uid].status === 'declined');
        const tentative = Object.keys(responses).filter(uid => responses[uid].status === 'tentative');
        
        const present = attendanceRecords.filter(r => r.present).map(r => r.userId);
        const absent = attendanceRecords.filter(r => !r.present).map(r => r.userId);
        
        crossCheck = {
          saidYesCame: confirmed.filter(uid => present.includes(uid)).length,
          saidYesDidntCome: confirmed.filter(uid => absent.includes(uid)).length,
          saidNoCame: declined.filter(uid => present.includes(uid)).length,
          saidNoDidntCome: declined.filter(uid => absent.includes(uid)).length,
          saidMaybeCame: tentative.filter(uid => present.includes(uid)).length,
          saidMaybeDidntCome: tentative.filter(uid => absent.includes(uid)).length,
          noResponseCame: present.filter(uid => !responses[uid]).length,
          noResponseDidntCome: absent.filter(uid => !responses[uid]).length
        };
      }

      const total = attendanceRecords.length;
      const present = attendanceRecords.filter(r => r.present).length;
      const absent = total - present;
      const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : 0;

      const attendanceData = {
        teamId,
        clubId,
        date: selectedDate,
        type: eventType,
        customType: eventType === 'custom' ? customType.trim() : '',
        sessionName: sessionName.trim() || `Session ${existingSessionsForDate.length + 1}`,
        eventId: selectedEvent?.id || null,
        eventTitle: selectedEvent?.title || null,
        records: attendanceRecords,
        createdBy: user.id,
        statistics: {
          total,
          present,
          absent,
          percentage: parseFloat(percentage)
        },
        crossCheck: crossCheck
      };

      if (existingAttendanceId) {
        // Add edit history entry when updating
        const editHistoryEntry = {
          editedBy: user.id,
          editedByName: user.username || user.email,
          editedAt: new Date().toISOString(),
          changes: 'Attendance updated',
          reason: null // Auto-save doesn't have reason
        };
        
        await updateAttendance(existingAttendanceId, {
          ...attendanceData,
          editHistory: [...(attendanceData.editHistory || []), editHistoryEntry]
        });
      } else {
        const newId = await createAttendance(attendanceData);
        setExistingAttendanceId(newId);
      }
      
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus(''), 2000);
    } catch (error) {
      console.error('Error auto-saving attendance:', error);
      setAutoSaveStatus('error');
      setTimeout(() => setAutoSaveStatus(''), 3000);
    }
  }, [attendanceRecords, selectedDate, eventType, customType, selectedEvent, teamId, clubId, user, existingAttendanceId]);

  // Debounced auto-save trigger
  const triggerAutoSave = useCallback(() => {
    // Skip auto-save on initial load
    if (initialLoadRef.current) {
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for 2 seconds
    saveTimeoutRef.current = setTimeout(() => {
      performAutoSave();
    }, 2000);
  }, [performAutoSave]);

  // Trigger auto-save when attendance records change
  useEffect(() => {
    if (!initialLoadRef.current) {
      triggerAutoSave();
    }
  }, [attendanceRecords, triggerAutoSave]);

  // Mark initial load as complete after first data load
  useEffect(() => {
    if (!loading && attendanceRecords.length > 0) {
      // Wait a bit before enabling auto-save
      setTimeout(() => {
        initialLoadRef.current = false;
      }, 1000);
    }
  }, [loading, attendanceRecords]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleSave = async () => {
    if (eventType === 'custom' && !customType.trim()) {
      showToast('Please enter custom event type', 'error');
      return;
    }

    // Validate session name if multiple sessions exist for this date
    if (existingSessionsForDate.length > 0 && !sessionName.trim() && !selectedSessionId) {
      showToast('Please enter a session name to differentiate from existing sessions', 'error');
      return;
    }

    try {
      setSaving(true);

      // Calculate cross-check statistics if event is selected
      let crossCheck = null;
      if (selectedEvent && selectedEvent.responses) {
        const responses = selectedEvent.responses;
        const confirmed = Object.keys(responses).filter(uid => responses[uid].status === 'confirmed');
        const declined = Object.keys(responses).filter(uid => responses[uid].status === 'declined');
        const tentative = Object.keys(responses).filter(uid => responses[uid].status === 'tentative');
        
        const present = attendanceRecords.filter(r => r.present).map(r => r.userId);
        const absent = attendanceRecords.filter(r => !r.present).map(r => r.userId);
        
        crossCheck = {
          saidYesCame: confirmed.filter(uid => present.includes(uid)).length,
          saidYesDidntCome: confirmed.filter(uid => absent.includes(uid)).length,
          saidNoCame: declined.filter(uid => present.includes(uid)).length,
          saidNoDidntCome: declined.filter(uid => absent.includes(uid)).length,
          saidMaybeCame: tentative.filter(uid => present.includes(uid)).length,
          saidMaybeDidntCome: tentative.filter(uid => absent.includes(uid)).length,
          noResponseCame: present.filter(uid => !responses[uid]).length,
          noResponseDidntCome: absent.filter(uid => !responses[uid]).length
        };
      }

      const attendanceData = {
        teamId,
        clubId,
        date: selectedDate,
        type: eventType,
        customType: eventType === 'custom' ? customType.trim() : '',
        sessionName: sessionName.trim() || `Session ${existingSessionsForDate.length + 1}`,
        eventId: selectedEvent?.id || null,
        eventTitle: selectedEvent?.title || null,
        records: attendanceRecords,
        createdBy: user.id,
        statistics: {
          total: statistics.total,
          present: statistics.present,
          absent: statistics.absent,
          percentage: parseFloat(statistics.percentage)
        },
        crossCheck: crossCheck
      };

      if (existingAttendanceId) {
        // Add edit history entry when manually saving
        const editHistoryEntry = {
          editedBy: user.id,
          editedByName: user.username || user.email,
          editedAt: new Date().toISOString(),
          changes: 'Manual attendance update',
          reason: null // Could add a modal for reason in future
        };
        
        await updateAttendance(existingAttendanceId, {
          ...attendanceData,
          editHistory: [...(attendanceData.editHistory || []), editHistoryEntry]
        });
        showToast('Attendance updated successfully', 'success');
      } else {
        const newId = await createAttendance(attendanceData);
        setExistingAttendanceId(newId);
        showToast('Attendance saved successfully', 'success');
      }
    } catch (error) {
      console.error('Error saving attendance:', error);
      showToast('Failed to save attendance', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    setExistingAttendanceId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-light/60">Loading attendance...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="font-title text-2xl text-light mb-2">Team Not Found</h2>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate(`/team/${clubId}/${teamId}`, { state: { activeTab: 'attendance' } })}
            className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-light transition"
          >
            ←
          </button>
          <div>
            <h1 className="font-display text-4xl text-light mb-1">
              📋 <span className="text-primary">ATTENDANCE</span>
            </h1>
            <p className="text-light/60">
              {team.name} • {team.clubName}
            </p>
          </div>
        </div>

        {/* Statistics Bar */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="text-sm text-light/60 mb-1">Total Members</div>
            <div className="text-3xl font-bold text-light">{statistics.total}</div>
          </div>
          <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
            <div className="text-sm text-green-300 mb-1">Present</div>
            <div className="text-3xl font-bold text-green-400">{statistics.present}</div>
          </div>
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
            <div className="text-sm text-red-300 mb-1">Absent</div>
            <div className="text-3xl font-bold text-red-400">{statistics.absent}</div>
          </div>
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
            <div className="text-sm text-blue-300 mb-1">Attendance Rate</div>
            <div className="text-3xl font-bold text-blue-400">{statistics.percentage}%</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
        {/* Session Selector - For multiple attendance on same day */}
        {existingSessionsForDate.length > 0 && (
          <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <label className="block text-sm font-medium text-light/80 mb-2">
              📋 Multiple Sessions Found for This Date
            </label>
            <div className="grid grid-cols-1 gap-2">
              {/* Option to create new session */}
              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition">
                <input
                  type="radio"
                  name="session"
                  checked={showNewSessionOption && !selectedSessionId}
                  onChange={() => {
                    setSelectedSessionId(null);
                    setShowNewSessionOption(true);
                    setExistingAttendanceId(null);
                    setSessionName('');
                    // Reset to new empty records
                    const teamMemberIds = [
                      ...(team.trainers || []),
                      ...(team.assistants || []),
                      ...(team.members || [])
                    ];
                    const teamMembers = allUsers.filter(u => teamMemberIds.includes(u.id));
                    setAttendanceRecords(
                      teamMembers.map(member => ({
                        userId: member.id,
                        username: member.username || member.email,
                        email: member.email,
                        role: member.role,
                        present: false,
                        comment: '',
                        customStatuses: {}
                      }))
                    );
                  }}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="font-medium text-green-400">➕ Create New Session</div>
                  <div className="text-xs text-light/60">Start a new attendance record for this date</div>
                </div>
              </label>

              {/* Existing sessions */}
              {existingSessionsForDate.map((session, index) => (
                <label
                  key={session.id}
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition"
                >
                  <input
                    type="radio"
                    name="session"
                    checked={selectedSessionId === session.id}
                    onChange={() => {
                      setSelectedSessionId(session.id);
                      setShowNewSessionOption(false);
                      setExistingAttendanceId(session.id);
                      setEventType(session.type);
                      setCustomType(session.customType || '');
                      setSessionName(session.sessionName || `Session ${index + 1}`);
                      setAttendanceRecords(session.records);
                    }}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-light">
                      {session.sessionName || `Session ${index + 1}`}
                      <span className="ml-2 text-xs text-light/60 capitalize">({session.type})</span>
                    </div>
                    <div className="text-xs text-light/60">
                      {session.statistics.present}/{session.statistics.total} present ({session.statistics.percentage}%)
                      {session.eventTitle && ` • ${session.eventTitle}`}
                    </div>
                  </div>
                  <div className="text-xs text-light/50">
                    {selectedSessionId === session.id ? '✏️ Editing' : '👁️ View'}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Session Name Input */}
        {(!selectedSessionId || showNewSessionOption) && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-light/80 mb-2">
              Session Name {existingSessionsForDate.length > 0 && <span className="text-red-400">*</span>}
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder={`e.g., "Morning Practice", "Evening Game", or leave empty for "Session ${existingSessionsForDate.length + 1}"`}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            />
            <p className="text-xs text-light/50 mt-1">
              {existingSessionsForDate.length > 0 
                ? '⚠️ Multiple sessions exist for this date. Give this session a unique name.'
                : 'Optional: Give this session a name (e.g., "Morning Practice")'}
            </p>
          </div>
        )}

        {/* Event Selector - NEW */}
        {dayEvents.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-light/80 mb-2">
              Select Event ({dayEvents.length} event{dayEvents.length > 1 ? 's' : ''} on this day)
            </label>
            <select
              value={selectedEvent?.id || ''}
              onChange={(e) => {
                const event = dayEvents.find(ev => ev.id === e.target.value);
                handleEventSelect(event);
              }}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            >
              <option value="">No event (manual entry)</option>
              {dayEvents.map(event => {
                const time = event.time || '';
                const responseCount = event.responses ? Object.keys(event.responses).length : 0;
                
                // Determine if event is in the past
                const eventDateTime = new Date(`${event.date}T${event.time || '00:00'}`);
                const now = new Date();
                const isPast = eventDateTime < now;
                
                return (
                  <option key={event.id} value={event.id}>
                    {isPast ? '📅 (Past) ' : ''}{event.title} {time && `- ${time}`} ({responseCount} responses)
                  </option>
                );
              })}
            </select>
            {selectedEvent && selectedEvent.responses && (
              <div className="mt-2 flex gap-4 text-sm">
                <span className="text-green-400">
                  ✓ {Object.values(selectedEvent.responses).filter(r => r.status === 'confirmed').length} Yes
                </span>
                <span className="text-yellow-400">
                  ? {Object.values(selectedEvent.responses).filter(r => r.status === 'tentative').length} Maybe
                </span>
                <span className="text-red-400">
                  ✗ {Object.values(selectedEvent.responses).filter(r => r.status === 'declined').length} No
                </span>
              </div>
            )}
          </div>
        )}
        
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          {/* Date Selector */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            />
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">Event Type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              disabled={!!selectedEvent}
            >
              <option value="training">🏋️ Training</option>
              <option value="game">⚽ Game</option>
              <option value="tournament">🏆 Tournament</option>
              <option value="custom">✏️ Custom</option>
            </select>
            {selectedEvent && (
              <p className="text-xs text-light/50 mt-1">Auto-filled from event</p>
            )}
          </div>

          {/* Custom Type */}
          {eventType === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-light/80 mb-2">Custom Type</label>
              <input
                type="text"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Enter event type..."
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search by name, email, or ID..."
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 pl-10 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
          />
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-light/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Attendance Table - Absent Users */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-6">
        <div className="bg-white/5 px-6 py-3 border-b border-white/10">
          <h3 className="font-semibold text-light">
            Absent ({absentRecords.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-6 py-3 text-sm font-medium text-light/80">User</th>
                <th className="text-center px-6 py-3 text-sm font-medium text-light/80">Present</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-light/80">Status</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-light/80">Comment</th>
              </tr>
            </thead>
            <tbody>
              {absentRecords.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-12 text-light/40">
                    {searchQuery ? 'No users found' : 'All members are present! 🎉'}
                  </td>
                </tr>
              ) : (
                absentRecords.map((record) => (
                  <tr key={record.userId} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white">
                          {record.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-light">{record.username}</div>
                          <div className="text-xs text-light/50">{record.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={record.present}
                        onChange={() => handleTogglePresence(record.userId)}
                        className="w-5 h-5 text-primary bg-white/10 border-white/20 rounded focus:ring-primary focus:ring-2"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {customStatuses.map(status => (
                          <button
                            key={status.id}
                            onClick={() => handleCustomStatusToggle(record.userId, status.id)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                              record.customStatuses?.[status.id]
                                ? 'text-white'
                                : 'bg-white/10 text-light/60 hover:bg-white/20'
                            }`}
                            style={{
                              backgroundColor: record.customStatuses?.[status.id] ? status.color : undefined
                            }}
                          >
                            {record.customStatuses?.[status.id] ? '✓ ' : ''}{status.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={record.comment}
                        onChange={(e) => handleCommentChange(record.userId, e.target.value)}
                        placeholder="Reason for absence..."
                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-light placeholder-light/30 focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Present Users - Grayed Out */}
      {presentRecords.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden opacity-60">
          <div className="bg-green-500/20 px-6 py-3 border-b border-white/10">
            <h3 className="font-semibold text-green-300">
              ✓ Present ({presentRecords.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody>
                {presentRecords.map((record) => (
                  <tr key={record.userId} className="border-b border-white/5">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center font-bold text-white">
                          {record.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-light">{record.username}</div>
                          <div className="text-xs text-light/50">{record.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={record.present}
                        onChange={() => handleTogglePresence(record.userId)}
                        className="w-5 h-5 text-green-500 bg-white/10 border-white/20 rounded focus:ring-green-500 focus:ring-2"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {customStatuses.map(status => (
                          <button
                            key={status.id}
                            onClick={() => handleCustomStatusToggle(record.userId, status.id)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                              record.customStatuses?.[status.id]
                                ? 'text-white'
                                : 'bg-white/10 text-light/60 hover:bg-white/20'
                            }`}
                            style={{
                              backgroundColor: record.customStatuses?.[status.id] ? status.color : undefined
                            }}
                          >
                            {record.customStatuses?.[status.id] ? '✓ ' : ''}{status.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {record.comment && (
                        <span className="text-sm text-light/60">{record.comment}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Auto-Save Status & Manual Save Button */}
      <div className="fixed bottom-6 right-6 flex items-center gap-4">
        {/* Auto-Save Status Indicator */}
        {autoSaveStatus && (
          <div className={`px-4 py-2 rounded-lg text-sm font-medium shadow-lg ${
            autoSaveStatus === 'saving' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
            autoSaveStatus === 'saved' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
            'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {autoSaveStatus === 'saving' && '💾 Auto-saving...'}
            {autoSaveStatus === 'saved' && '✓ Auto-saved'}
            {autoSaveStatus === 'error' && '⚠ Auto-save failed'}
          </div>
        )}
        
        {/* Manual Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-4 bg-primary hover:bg-primary-dark text-white rounded-lg font-semibold text-lg shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : existingAttendanceId ? 'Save Now' : 'Save Attendance'}
        </button>
      </div>
    </div>
  );
}
