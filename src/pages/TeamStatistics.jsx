// src/pages/TeamStatistics.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getClub, getEvent } from '../firebase/firestore';
import { getTeamFeedbackStats } from '../firebase/feedback';
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

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function TeamStatistics() {
  const { clubId, teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [club, setClub] = useState(null);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [feedbackStats, setFeedbackStats] = useState([]);
  const [eventsData, setEventsData] = useState([]);
  const [showRating, setShowRating] = useState(true);
  const [showEventCount, setShowEventCount] = useState(true);
  const [showAttendance, setShowAttendance] = useState(true);

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

      // Load feedback stats
      await loadFeedbackStats();
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadFeedbackStats() {
    try {
      // Parse date range
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      // Get feedback stats
      const stats = await getTeamFeedbackStats(teamId, start, end);

      // Load event details for each stat
      const eventsWithStats = await Promise.all(
        stats.map(async (stat) => {
          try {
            const event = await getEvent(stat.eventId);
            return {
              ...stat,
              event,
            };
          } catch (error) {
            console.error(`Error loading event ${stat.eventId}:`, error);
            return null;
          }
        })
      );

      // Filter out null and sort by date (newest first)
      const validEvents = eventsWithStats
        .filter(e => e && e.event)
        .sort((a, b) => new Date(b.event.date) - new Date(a.event.date));

      setEventsData(validEvents);
      setFeedbackStats(stats);
    } catch (error) {
      console.error('Error loading feedback stats:', error);
    }
  }

  // Handle date filter update
  function handleDateRangeChange() {
    loadFeedbackStats();
  }

  // Prepare chart data
  function getChartData() {
    // Sort events by date (oldest first for chart)
    const sortedEvents = [...eventsData].sort((a, b) => 
      new Date(a.event.date) - new Date(b.event.date)
    );

    const labels = sortedEvents.map(e => 
      new Date(e.event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );

    const datasets = [];

    // Rating dataset
    if (showRating) {
      datasets.push({
        label: 'Average Rating',
        data: sortedEvents.map(e => e.averageRating),
        borderColor: 'rgb(234, 179, 8)', // yellow-500
        backgroundColor: 'rgba(234, 179, 8, 0.2)',
        yAxisID: 'y',
        tension: 0.3,
      });
    }

    // Event count dataset (cumulative)
    if (showEventCount) {
      const cumulative = sortedEvents.map((_, idx) => idx + 1);
      datasets.push({
        label: 'Event Count',
        data: cumulative,
        borderColor: 'rgb(59, 130, 246)', // blue-500
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        yAxisID: 'y1',
        tension: 0.3,
      });
    }

    // Attendance dataset
    if (showAttendance) {
      datasets.push({
        label: 'Feedback Responses',
        data: sortedEvents.map(e => e.totalResponses),
        borderColor: 'rgb(34, 197, 94)', // green-500
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        yAxisID: 'y1',
        tension: 0.3,
      });
    }

    return { labels, datasets };
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: 'rgb(229, 231, 235)', // gray-200
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: 'Training Statistics Over Time',
        color: 'rgb(229, 231, 235)',
        font: {
          size: 16,
          weight: 'bold',
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: 'rgb(156, 163, 175)', // gray-400
        },
      },
      y: {
        type: 'linear',
        display: showRating,
        position: 'left',
        min: 0,
        max: 5,
        title: {
          display: showRating,
          text: 'Rating (⭐)',
          color: 'rgb(234, 179, 8)',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: 'rgb(156, 163, 175)',
        },
      },
      y1: {
        type: 'linear',
        display: showEventCount || showAttendance,
        position: 'right',
        title: {
          display: showEventCount || showAttendance,
          text: 'Count',
          color: 'rgb(59, 130, 246)',
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: 'rgb(156, 163, 175)',
        },
      },
    },
  };

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
          📊 Training Statistics
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
            onClick={handleDateRangeChange}
            className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition"
          >
            Apply Filter
          </button>
        </div>
      </div>

      {/* Chart Toggles */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-light mb-4">📈 Display Options</h2>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showRating}
              onChange={(e) => setShowRating(e.target.checked)}
              className="w-5 h-5 rounded border-white/20 bg-dark text-primary focus:ring-primary"
            />
            <span className="text-light">⭐ Average Rating</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showEventCount}
              onChange={(e) => setShowEventCount(e.target.checked)}
              className="w-5 h-5 rounded border-white/20 bg-dark text-primary focus:ring-primary"
            />
            <span className="text-light">📊 Event Count</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAttendance}
              onChange={(e) => setShowAttendance(e.target.checked)}
              className="w-5 h-5 rounded border-white/20 bg-dark text-primary focus:ring-primary"
            />
            <span className="text-light">👥 Feedback Responses</span>
          </label>
        </div>
      </div>

      {/* Timeline Graph */}
      {eventsData.length > 0 ? (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
          <div className="h-[400px]">
            <Line data={getChartData()} options={chartOptions} />
          </div>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-12 text-center mb-6">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-light mb-2">No Data Available</h3>
          <p className="text-light/60">No training feedback has been submitted yet for this period.</p>
        </div>
      )}

      {/* Trainings List */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-light mb-4">📋 Training History</h2>
        
        {eventsData.length === 0 ? (
          <p className="text-light/60 text-center py-8">No trainings with feedback yet.</p>
        ) : (
          <div className="space-y-3">
            {eventsData.map((item) => (
              <div
                key={item.eventId}
                onClick={() => navigate(`/event/${item.eventId}`)}
                className="bg-dark/50 border border-white/10 rounded-lg p-4 hover:bg-dark/70 transition cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                    <h3 className="font-semibold text-light group-hover:text-primary transition">
                      {item.event?.title || 'Training'}
                        </h3>
                    <p className="text-sm text-light/60 mt-1">
                      {new Date(item.event?.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                      {item.event?.startTime && ` at ${item.event.startTime}`}
                    </p>
                          </div>
                  <div className="flex items-center gap-4">
                    {/* Rating */}
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-400">
                        {item.averageRating}⭐
                            </div>
                      <div className="text-xs text-light/60">
                        {item.totalResponses} response{item.totalResponses !== 1 ? 's' : ''}
                      </div>
                    </div>
                    {/* Arrow */}
                    <span className="text-primary opacity-0 group-hover:opacity-100 transition">→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
