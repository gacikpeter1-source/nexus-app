// src/pages/AttendanceHistory.jsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  getClub,
  getAllUsers,
  getTeamAttendance,
  getTeamAttendanceStats,
  deleteAttendance
} from '../firebase/firestore';

export default function AttendanceHistory() {
  const { clubId, teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [club, setClub] = useState(null);
  const [team, setTeam] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [clubData, usersData, attendanceData, statsData] = await Promise.all([
          getClub(clubId),
          getAllUsers(),
          getTeamAttendance(teamId),
          getTeamAttendanceStats(teamId)
        ]);

        if (clubData) {
          setClub(clubData);
          const foundTeam = clubData.teams?.find(t => t.id === teamId);
          if (foundTeam) {
            setTeam({ ...foundTeam, clubId: clubData.id, clubName: clubData.name });
          }
        }

        setAllUsers(usersData);
        setAttendanceRecords(attendanceData);
        setStats(statsData);
      } catch (error) {
        console.error('Error loading data:', error);
        showToast('Failed to load attendance history', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [clubId, teamId]);

  const filteredRecords = useMemo(() => {
    let filtered = attendanceRecords;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(r => r.type === filterType);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.date.includes(lowerQuery) ||
        r.type.toLowerCase().includes(lowerQuery) ||
        r.customType?.toLowerCase().includes(lowerQuery)
      );
    }

    return filtered;
  }, [attendanceRecords, filterType, searchQuery]);

  const handleViewDetails = (record) => {
    setSelectedRecord(record);
    setShowDetailsModal(true);
  };

  const handleDelete = async (recordId) => {
    if (!confirm('Delete this attendance record? This cannot be undone.')) return;

    try {
      await deleteAttendance(recordId);
      setAttendanceRecords(prev => prev.filter(r => r.id !== recordId));
      showToast('Attendance record deleted', 'success');
    } catch (error) {
      console.error('Error deleting attendance:', error);
      showToast('Failed to delete attendance record', 'error');
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'training': return '🏋️';
      case 'game': return '⚽';
      case 'tournament': return '🏆';
      default: return '📋';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-light/60">Loading attendance history...</p>
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/team/${clubId}/${teamId}/statistics`)}
              className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-light transition"
            >
              ←
            </button>
            <div>
              <h1 className="font-display text-4xl text-light mb-1">
                📊 <span className="text-primary">ATTENDANCE HISTORY</span>
              </h1>
              <p className="text-light/60">
                {team.name} • {team.clubName}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate(`/team/${clubId}/${teamId}/attendance`)}
            className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition"
          >
            + Take Attendance
          </button>
        </div>

        {/* Overall Statistics */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-sm text-light/60 mb-1">Total Sessions</div>
              <div className="text-3xl font-bold text-light">{stats.totalSessions}</div>
            </div>
            <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
              <div className="text-sm text-green-300 mb-1">Total Present</div>
              <div className="text-3xl font-bold text-green-400">{stats.totalPresent}</div>
            </div>
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
              <div className="text-sm text-red-300 mb-1">Total Absent</div>
              <div className="text-3xl font-bold text-red-400">{stats.totalAbsent}</div>
            </div>
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
              <div className="text-sm text-blue-300 mb-1">Avg Attendance</div>
              <div className="text-3xl font-bold text-blue-400">{stats.averageAttendance}%</div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">Filter by Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            >
              <option value="all">All Types</option>
              <option value="training">🏋️ Training</option>
              <option value="game">⚽ Game</option>
              <option value="tournament">🏆 Tournament</option>
              <option value="custom">✏️ Custom</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by date or type..."
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            />
          </div>
        </div>
      </div>

      {/* Attendance Records */}
      <div className="space-y-4">
        {filteredRecords.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="font-title text-2xl text-light mb-2">No Attendance Records</h3>
            <p className="text-light/60 mb-4">
              {searchQuery || filterType !== 'all' 
                ? 'No records match your filters'
                : 'Start by taking attendance for your team'
              }
            </p>
            {!searchQuery && filterType === 'all' && (
              <button
                onClick={() => navigate(`/team/${clubId}/${teamId}/attendance`)}
                className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition"
              >
                Take Attendance
              </button>
            )}
          </div>
        ) : (
          filteredRecords.map((record) => {
            const displayType = record.type === 'custom' && record.customType 
              ? record.customType 
              : record.type;

            return (
              <div
                key={record.id}
                className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="text-4xl">{getTypeIcon(record.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-title text-xl text-light capitalize">
                          {displayType}
                        </h3>
                        <span className="text-sm text-light/60">
                          {formatDate(record.date)}
                        </span>
                      </div>

                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-light/60">Total:</span>
                          <span className="font-semibold text-light">{record.statistics.total}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-green-400">✓ Present:</span>
                          <span className="font-semibold text-green-400">{record.statistics.present}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-red-400">✗ Absent:</span>
                          <span className="font-semibold text-red-400">{record.statistics.absent}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-blue-400">Rate:</span>
                          <span className="font-semibold text-blue-400">{record.statistics.percentage}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewDetails(record)}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => navigate(`/team/${clubId}/${teamId}/attendance`)}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg text-sm transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-mid-dark border border-white/20 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-title text-2xl text-light capitalize">
                    {selectedRecord.type === 'custom' && selectedRecord.customType 
                      ? selectedRecord.customType 
                      : selectedRecord.type}
                  </h3>
                  <p className="text-sm text-light/60 mt-1">
                    {formatDate(selectedRecord.date)}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-light/60 hover:text-light transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Statistics */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white/5 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-light">{selectedRecord.statistics.total}</div>
                  <div className="text-xs text-light/60 mt-1">Total</div>
                </div>
                <div className="bg-green-500/20 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{selectedRecord.statistics.present}</div>
                  <div className="text-xs text-green-300 mt-1">Present</div>
                </div>
                <div className="bg-red-500/20 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-400">{selectedRecord.statistics.absent}</div>
                  <div className="text-xs text-red-300 mt-1">Absent</div>
                </div>
                <div className="bg-blue-500/20 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">{selectedRecord.statistics.percentage}%</div>
                  <div className="text-xs text-blue-300 mt-1">Rate</div>
                </div>
              </div>

              {/* Member List */}
              <div className="space-y-3">
                <h4 className="font-semibold text-light mb-3">Member Attendance</h4>
                {selectedRecord.records.map((record) => {
                  const userInfo = allUsers.find(u => u.id === record.userId);
                  return (
                    <div
                      key={record.userId}
                      className={`p-4 rounded-lg border ${
                        record.present 
                          ? 'bg-green-500/10 border-green-500/30' 
                          : 'bg-red-500/10 border-red-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                            record.present ? 'bg-green-500' : 'bg-red-500'
                          }`}>
                            {record.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-light">{record.username}</div>
                            <div className="text-xs text-light/50">{record.email}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold ${record.present ? 'text-green-400' : 'text-red-400'}`}>
                            {record.present ? '✓ Present' : '✗ Absent'}
                          </div>
                          {record.comment && (
                            <div className="text-xs text-light/60 mt-1">{record.comment}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
