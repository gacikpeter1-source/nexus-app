// src/pages/TeamAttendance.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getClub, getTeamEvents, getAllUsers } from '../firebase/firestore';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function TeamAttendance() {
  const { clubId, teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [club, setClub] = useState(null);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filteredEvents, setFilteredEvents] = useState([]);

  useEffect(() => {
    if (clubId && teamId) {
      loadData();
    }
  }, [clubId, teamId]);

  async function loadData() {
    try {
      setLoading(true);

      // Load club data
      const clubData = await getClub(clubId);
      setClub(clubData);

      // Find team
      const foundTeam = clubData.teams?.find(t => t.id === teamId);
      setTeam(foundTeam);

      // Load team events
      const teamEvents = await getTeamEvents(teamId);
      setEvents(teamEvents || []);

      // Load all users
      const users = await getAllUsers();
      setAllUsers(users);
    } catch (error) {
      console.error('Error loading attendance data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Apply date filter
  function handleApplyFilter() {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const filtered = events.filter(e => {
      const eventDate = new Date(e.date);
      if (start && eventDate < start) return false;
      if (end && eventDate > end) return false;
      return true;
    });

    setFilteredEvents(filtered);
    setSelectedEvent(null); // Reset selected event
  }

  // Get events for specific date
  function getEventsForDate(date) {
    const dateStr = new Date(date).toDateString();
    return filteredEvents.filter(e => new Date(e.date).toDateString() === dateStr);
  }

  // Calculate attendance statistics for selected event
  function getAttendanceStats() {
    if (!selectedEvent || !selectedEvent.responses) {
      return {
        attend: 0,
        decline: 0,
        declineWithMessage: 0,
        maybe: 0,
        maybeWithMessage: 0,
        totalUsers: 0,
      };
    }

    const responses = Object.values(selectedEvent.responses);
    const attend = responses.filter(r => r.status === 'attending').length;
    const decline = responses.filter(r => r.status === 'declined' && !r.message).length;
    const declineWithMessage = responses.filter(r => r.status === 'declined' && r.message).length;
    const maybe = responses.filter(r => r.status === 'maybe' && !r.message).length;
    const maybeWithMessage = responses.filter(r => r.status === 'maybe' && r.message).length;

    // Total users = team members
    const totalUsers = [
      ...(team?.members || []),
      ...(team?.trainers || []),
      ...(team?.assistants || []),
    ].filter((v, i, a) => a.indexOf(v) === i).length;

    return {
      attend,
      decline,
      declineWithMessage,
      maybe,
      maybeWithMessage,
      totalUsers,
    };
  }

  // Get user list with responses
  function getUserList() {
    if (!selectedEvent || !team) return [];

    const teamMemberIds = [
      ...(team.members || []),
      ...(team.trainers || []),
      ...(team.assistants || []),
    ].filter((v, i, a) => a.indexOf(v) === i);

    return teamMemberIds.map(userId => {
      const userData = allUsers.find(u => u.id === userId);
      const response = selectedEvent.responses?.[userId];

      return {
        id: userId,
        username: userData?.username || 'Unknown',
        email: userData?.email || '',
        eventResponse: response?.status || 'no-response',
        message: response?.message || '',
      };
    });
  }

  // Prepare timeline chart data
  function getTimelineChartData() {
    const sortedEvents = [...filteredEvents].sort((a, b) => new Date(a.date) - new Date(b.date));

    const labels = sortedEvents.map(e => 
      new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );

    const attendanceCounts = sortedEvents.map(e => {
      if (!e.responses) return 0;
      return Object.values(e.responses).filter(r => r.status === 'attending').length;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Attendance Count',
          data: attendanceCounts,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.2)',
          tension: 0.3,
        },
      ],
    };
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: 'rgb(229, 231, 235)',
          font: { size: 12 },
        },
      },
      title: {
        display: true,
        text: 'Attendance Over Time',
        color: 'rgb(229, 231, 235)',
        font: { size: 16, weight: 'bold' },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: 'rgb(156, 163, 175)' },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: 'rgb(156, 163, 175)', stepSize: 1 },
        beginAtZero: true,
      },
    },
  };

  const stats = getAttendanceStats();
  const userList = getUserList();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`/team/${clubId}/${teamId}`)}
          className="mb-4 text-light/60 hover:text-light flex items-center gap-2 transition-colors"
        >
          ← Back to Team
        </button>
        <h1 className="font-display text-4xl text-light mb-2">
          📊 Attendance Statistics
        </h1>
        <p className="text-light/60 text-lg">
          {club?.name} - {team?.name}
        </p>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-light mb-4">📅 Date Range</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-light/60 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 bg-dark border border-white/10 rounded-lg text-light focus:border-primary transition"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-light/60 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 bg-dark border border-white/10 rounded-lg text-light focus:border-primary transition"
            />
          </div>
          <button
            onClick={handleApplyFilter}
            className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition"
          >
            Apply Filter
          </button>
        </div>
      </div>

      {/* Event Selector */}
      {filteredEvents.length > 0 && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-light mb-4">🎯 Select Event</h2>
          <select
            value={selectedEvent?.id || ''}
            onChange={(e) => {
              const event = filteredEvents.find(ev => ev.id === e.target.value);
              setSelectedEvent(event);
            }}
            className="w-full px-4 py-2 bg-dark border border-white/10 rounded-lg text-light focus:border-primary transition"
          >
            <option value="">Choose an event...</option>
            {filteredEvents.map(event => (
              <option key={event.id} value={event.id}>
                {event.title} - {new Date(event.date).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Timeline Graph */}
      {filteredEvents.length > 0 && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
          <div className="h-[300px]">
            <Line data={getTimelineChartData()} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Statistics Table */}
      {selectedEvent && (
        <>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-light mb-4">📈 Attendance Summary</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-light">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-3 font-semibold">Definition</th>
                    <th className="text-center py-2 px-3 font-semibold">Event Response</th>
                    <th className="text-center py-2 px-3 font-semibold">Total Users</th>
                    <th className="text-center py-2 px-3 font-semibold">Percentage</th>
                    <th className="text-left py-2 px-3 font-semibold">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-2 px-3">✅ Attend</td>
                    <td className="text-center py-2 px-3">{stats.attend}</td>
                    <td className="text-center py-2 px-3">{stats.totalUsers}</td>
                    <td className="text-center py-2 px-3">
                      {stats.totalUsers > 0 ? ((stats.attend / stats.totalUsers) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-2 px-3 text-light/60">-</td>
                  </tr>
                  <tr className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-2 px-3">❌ Decline</td>
                    <td className="text-center py-2 px-3">{stats.decline}</td>
                    <td className="text-center py-2 px-3">{stats.totalUsers}</td>
                    <td className="text-center py-2 px-3">
                      {stats.totalUsers > 0 ? ((stats.decline / stats.totalUsers) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-2 px-3 text-light/60">-</td>
                  </tr>
                  <tr className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-2 px-3">❌ Decline with message</td>
                    <td className="text-center py-2 px-3">{stats.declineWithMessage}</td>
                    <td className="text-center py-2 px-3">{stats.totalUsers}</td>
                    <td className="text-center py-2 px-3">
                      {stats.totalUsers > 0 ? ((stats.declineWithMessage / stats.totalUsers) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-2 px-3 text-light/60">-</td>
                  </tr>
                  <tr className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-2 px-3">⚠️ Maybe</td>
                    <td className="text-center py-2 px-3">{stats.maybe}</td>
                    <td className="text-center py-2 px-3">{stats.totalUsers}</td>
                    <td className="text-center py-2 px-3">
                      {stats.totalUsers > 0 ? ((stats.maybe / stats.totalUsers) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-2 px-3 text-light/60">-</td>
                  </tr>
                  <tr className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-2 px-3">⚠️ Maybe with message</td>
                    <td className="text-center py-2 px-3">{stats.maybeWithMessage}</td>
                    <td className="text-center py-2 px-3">{stats.totalUsers}</td>
                    <td className="text-center py-2 px-3">
                      {stats.totalUsers > 0 ? ((stats.maybeWithMessage / stats.totalUsers) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-2 px-3 text-light/60">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* User List Table */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-light mb-4">👥 User Details</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-light">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-3 font-semibold w-48">User</th>
                    <th className="text-center py-2 px-3 font-semibold">Event Response</th>
                    <th className="text-left py-2 px-3 font-semibold">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {userList.map(u => (
                    <tr key={u.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="py-2 px-3">
                        <div className="font-medium">{u.username}</div>
                        <div className="text-xs text-light/50">{u.email}</div>
                      </td>
                      <td className="text-center py-2 px-3">
                        {u.eventResponse === 'attending' && <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs">✅ Attending</span>}
                        {u.eventResponse === 'declined' && <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs">❌ Declined</span>}
                        {u.eventResponse === 'maybe' && <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs">⚠️ Maybe</span>}
                        {u.eventResponse === 'no-response' && <span className="px-2 py-1 bg-white/10 text-light/60 rounded text-xs">- No Response</span>}
                      </td>
                      <td className="py-2 px-3 text-light/70 text-xs max-w-md truncate">
                        {u.message || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {filteredEvents.length === 0 && startDate && endDate && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-light mb-2">No Events Found</h3>
          <p className="text-light/60">No events in the selected date range.</p>
        </div>
      )}
    </div>
  );
}

