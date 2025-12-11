// src/pages/AttendanceEntry.jsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  getClub, 
  getAllUsers,
  createAttendance,
  getAttendanceByDate,
  updateAttendance
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
            
            // Check if attendance exists for selected date
            const existingAttendance = await getAttendanceByDate(teamId, selectedDate);
            
            if (existingAttendance) {
              setExistingAttendanceId(existingAttendance.id);
              setEventType(existingAttendance.type);
              setCustomType(existingAttendance.customType || '');
              setAttendanceRecords(existingAttendance.records);
            } else {
              // Initialize new records
              setAttendanceRecords(
                teamMembers.map(member => ({
                  userId: member.id,
                  username: member.username || member.email,
                  email: member.email,
                  role: member.role,
                  present: false,
                  comment: ''
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

  const handleSave = async () => {
    if (eventType === 'custom' && !customType.trim()) {
      showToast('Please enter custom event type', 'error');
      return;
    }

    try {
      setSaving(true);

      const attendanceData = {
        teamId,
        clubId,
        date: selectedDate,
        type: eventType,
        customType: eventType === 'custom' ? customType.trim() : '',
        records: attendanceRecords,
        createdBy: user.id,
        statistics: {
          total: statistics.total,
          present: statistics.present,
          absent: statistics.absent,
          percentage: parseFloat(statistics.percentage)
        }
      };

      if (existingAttendanceId) {
        await updateAttendance(existingAttendanceId, attendanceData);
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
            onClick={() => navigate(`/team/${clubId}/${teamId}`)}
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
            >
              <option value="training">🏋️ Training</option>
              <option value="game">⚽ Game</option>
              <option value="tournament">🏆 Tournament</option>
              <option value="custom">✏️ Custom</option>
            </select>
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
                <th className="text-left px-6 py-3 text-sm font-medium text-light/80">Comment</th>
              </tr>
            </thead>
            <tbody>
              {absentRecords.length === 0 ? (
                <tr>
                  <td colSpan="3" className="text-center py-12 text-light/40">
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

      {/* Save Button */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-4 bg-primary hover:bg-primary-dark text-white rounded-lg font-semibold text-lg shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : existingAttendanceId ? 'Update Attendance' : 'Save Attendance'}
        </button>
      </div>
    </div>
  );
}
