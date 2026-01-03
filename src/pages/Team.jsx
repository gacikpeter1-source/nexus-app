// src/pages/Team.jsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  getClub, 
  updateClub, 
  getAllUsers, 
  getClubEvents, 
  getTeamEvents,
  getClubOrderTemplates,
  getOrderResponses,
  createOrderResponse,
  getTeamAttendance,
  getTeamAttendanceStats,
  deleteAttendance
} from '../firebase/firestore';
import { getTeamChats, createChat } from '../firebase/chats';
import TeamMemberCards from '../components/TeamMemberCards';
import { updateTeamCardSettings, getUserStats } from '../firebase/firestore';
import { updateTeamMemberData } from '../firebase/firestore';

export default function Team() {
  const { clubId, teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
   
  const [activeTab, setActiveTab] = useState('overview');
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);
  const [events, setEvents] = useState([]);

  const [orders, setOrders] = useState([]);
  const [orderResponses, setOrderResponses] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderResponseModal, setShowOrderResponseModal] = useState(false);
  const [orderResponseForm, setOrderResponseForm] = useState({});
  const [respondingToOrder, setRespondingToOrder] = useState(false);  
  const [showOrdersDropdown, setShowOrdersDropdown] = useState(false);
  const [teamChats, setTeamChats] = useState([]);
  
  
  // Attendance state
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');
  const [attendanceFilterType, setAttendanceFilterType] = useState('all');
  const [loadingAttendance, setLoadingAttendance] = useState(false);

      // Return to one level up when clicking back to club
      const location = useLocation();
      useEffect(() => {
        if (location.state?.activeTab) {
          setActiveTab(location.state.activeTab);
        }
      }, [location]);

  // Load club and team from Firebase
  useEffect(() => {
    loadTeamData();
  }, [clubId, teamId]);

  async function loadTeamData() {
    try {
      setLoading(true);
      
      // Load club data
      const clubData = await getClub(clubId);
      if (clubData) {
        setClub(clubData);
      }
      


      // Load all users for name lookup
      const users = await getAllUsers();
      setAllUsers(users);

      // Load events for this team
      const teamEvents = await getTeamEvents(teamId);
      setEvents(teamEvents || []);



            // Load orders for this team (ADD THIS)
      if (clubData) {
        const clubOrders = await getClubOrderTemplates(clubData.id);
        // Filter orders for this team
        const teamOrders = clubOrders.filter(order => 
          !order.teams || 
          order.teams.length === 0 || 
          order.teams.includes(teamId)
        );
        setOrders(teamOrders);

        // Load responses for each order
        const allResponses = {};
        for (const order of teamOrders) {
          const responses = await getOrderResponses(order.id);
          allResponses[order.id] = responses;
        }
        setOrderResponses(allResponses);
      }

    } catch (error) {
      console.error('Error loading team:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleLeaveTeam = async () => {
    if (!team) return;
    
    // 🔒 MINIMUM TRAINER ENFORCEMENT: Prevent last trainer from leaving
    const isTrainer = (team.trainers || []).includes(user.id);
    const trainerCount = (team.trainers || []).length;
    
    if (isTrainer && trainerCount <= 1) {
      showToast(
        '❌ Cannot leave team: You are the last trainer. Please assign another trainer before leaving.',
        'error'
      );
      return;
    }
    
    if (!window.confirm(`Are you sure you want to leave ${team.name}?`)) return;
    
    try {
      const updatedMembers = (team.members || []).filter(id => id !== user.id);
      const updatedTrainers = (team.trainers || []).filter(id => id !== user.id);
      const updatedAssistants = (team.assistants || []).filter(id => id !== user.id);
      
      const updatedTeams = (club.teams || []).map(t => 
        t.id === teamId 
          ? { 
              ...t, 
              members: updatedMembers,
              trainers: updatedTrainers,
              assistants: updatedAssistants
            }
          : t
      );
      
      await updateClub(clubId, { teams: updatedTeams });
      showToast('✅ Left team successfully', 'success');
      navigate('/');
    } catch (error) {
      console.error('Error leaving team:', error);
      showToast('Failed to leave team', 'error');
    }
  };
async function handleSubmitOrderResponse(status) {
    if (status === 'accepted') {
      // Validate required fields
      const missingFields = selectedOrder.fields
        .filter(field => field.required && !orderResponseForm[field.id]?.trim())
        .map(field => field.label);
      
      if (missingFields.length > 0) {
        showToast(`Please fill required fields: ${missingFields.join(', ')}`, 'error');
        return;
      }
    }

    try {
      setRespondingToOrder(true);
      
      const responseData = {
        orderId: selectedOrder.id,
        userId: user.id,
        clubId: clubId,
        teamId: teamId,
        status: status,
        responses: status === 'accepted' ? orderResponseForm : {}
      };

      await createOrderResponse(responseData);
      showToast(status === 'accepted' ? 'Order accepted!' : 'Order declined', 'success');
      
      setShowOrderResponseModal(false);
      setSelectedOrder(null);
      setOrderResponseForm({});
      
      // Reload team data
      await loadTeamData();
    } catch (error) {
      console.error('Error submitting order response:', error);
      showToast('Failed to submit response', 'error');
    } finally {
      setRespondingToOrder(false);
    }
  }

  // Define team BEFORE using it in useEffect
  const team = useMemo(() => {
    if (!club || !club.teams) return null;
    const foundTeam = club.teams.find(t => t.id === teamId);
    if (foundTeam) {
      return { ...foundTeam, clubId: club.id, clubName: club.name };
    }
    return null;
  }, [club, teamId]);

// Load team chat
useEffect(() => {
  const loadTeamChats = async () => {
    if (!team) return;
    
    try {
      const chats = await getTeamChats(team.id);
      setTeamChats(chats || []);
    } catch (error) {
      console.error('Error loading team chats:', error);
      setTeamChats([]);
    }
  };

  loadTeamChats();
}, [team]);

// Load attendance when Attendance tab is active
useEffect(() => {
  const loadAttendance = async () => {
    if (activeTab !== 'attendance' || !team) return;
    
    try {
      setLoadingAttendance(true);
      const [records, stats] = await Promise.all([
        getTeamAttendance(team.id),
        getTeamAttendanceStats(team.id)
      ]);
      setAttendanceRecords(records);
      setAttendanceStats(stats);
    } catch (error) {
      console.error('Error loading attendance:', error);
      showToast('Failed to load attendance', 'error');
    } finally {
      setLoadingAttendance(false);
    }
  };

  loadAttendance();
}, [activeTab, team]);

// Function to create team chat
const handleCreateTeamChat = async () => {
  try {
    const chatId = await createChat({
      title: `${team.name} - Team Chat`,
      clubId: clubId,
      teamId: team.id,
      createdBy: user.id,
      members: [
        ...team.trainers,
        ...team.assistants,
        ...team.members
      ],
    });
    
    // Reload chats to show the new one
    const chats = await getTeamChats(team.id);
    setTeamChats(chats || []);
    
    // Navigate to the new chat
    navigate(`/chat/${chatId}`);
  } catch (error) {
    console.error('Error creating team chat:', error);
    alert('Failed to create team chat');
  }
};

// Function to create event-specific chat
const handleCreateEventChat = async (event) => {
  try {
    // Check if chat already exists for this event
    const existingChat = teamChats.find(chat => chat.eventId === event.id);
    if (existingChat) {
      navigate(`/chat/${existingChat.id}`);
      return;
    }

    const chatId = await createChat({
      title: `${event.title} - Event Chat`,
      clubId: clubId,
      teamId: team.id,
      eventId: event.id,
      createdBy: user.id,
      members: [
        ...team.trainers,
        ...team.assistants,
        ...team.members
      ],
    });
    
    // Reload chats to show the new one
    const chats = await getTeamChats(team.id);
    setTeamChats(chats || []);
    
    // Navigate to the new chat
    navigate(`/chat/${chatId}`);
  } catch (error) {
    console.error('Error creating event chat:', error);
    alert('Failed to create event chat');
  }
};

  // Attendance helper functions
  const filteredAttendanceRecords = useMemo(() => {
    let filtered = attendanceRecords;

    if (attendanceFilterType !== 'all') {
      filtered = filtered.filter(r => r.type === attendanceFilterType);
    }

    if (attendanceSearchQuery.trim()) {
      const lowerQuery = attendanceSearchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.date.includes(lowerQuery) ||
        r.type.toLowerCase().includes(lowerQuery) ||
        r.customType?.toLowerCase().includes(lowerQuery)
      );
    }

    return filtered;
  }, [attendanceRecords, attendanceFilterType, attendanceSearchQuery]);

  const handleViewAttendanceDetails = (record) => {
    setSelectedAttendance(record);
    setShowAttendanceModal(true);
  };

  const handleDeleteAttendance = async (recordId) => {
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

  const formatAttendanceDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getAttendanceTypeIcon = (type) => {
    switch (type) {
      case 'training': return '🏋️';
      case 'game': return '⚽';
      case 'tournament': return '🏆';
      default: return '📋';
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (showOrdersDropdown && !event.target.closest('.relative')) {
        setShowOrdersDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOrdersDropdown]);

  // Get upcoming events (next 5)
  const upcomingEvents = useMemo(() => {
    if (!team || !events) return [];
    
    const now = new Date();
    
    // Filter future events for this team
    // ✅ FIX: Compare date AND time, not just date
    const futureEvents = events.filter(event => {
      const eventDateTime = new Date(`${event.date}T${event.time || '00:00'}`);
      return eventDateTime >= now;
    });
    
    // Sort by datetime (soonest first) and take first 5
    return futureEvents
      .sort((a, b) => {
        const aDateTime = new Date(`${a.date}T${a.time || '00:00'}`);
        const bDateTime = new Date(`${b.date}T${b.time || '00:00'}`);
        return aDateTime - bDateTime;
      })
      .slice(0, 5);
  }, [team, events]);

  // Calculate statistics from events
  const statistics = useMemo(() => {
    if (!team || !events) return { trainings: 0, matches: 0, tournaments: 0, meetings: 0 };
    
    const stats = {
      trainings: 0,
      matches: 0,
      tournaments: 0,
      meetings: 0
    };

    events.forEach(event => {
      const type = event.type?.toLowerCase();
      if (type === 'training') stats.trainings++;
      else if (type === 'match' || type === 'game') stats.matches++;
      else if (type === 'tournament') stats.tournaments++;
      else if (type === 'meeting') stats.meetings++;
    });

    return stats;
  }, [team, events]);

  // Count pending orders for current user
    const pendingOrdersCount = useMemo(() => {
      if (!user || !orders.length) return 0;
      
      return orders.filter(order => {
        if (order.status !== 'active') return false;
        const userResponse = orderResponses[order.id]?.find(r => r.userId === user?.id);
        return !userResponse; // Pending if no response
      }).length;
    }, [orders, orderResponses, user]);

    const pendingOrders = useMemo(() => {
      if (!user || !orders.length) return [];
      
      return orders.filter(order => {
        if (order.status !== 'active') return false;
        const userResponse = orderResponses[order.id]?.find(r => r.userId === user?.id);
        return !userResponse;
      });
    }, [orders, orderResponses, user]);


  // Get team members with user details
  const members = useMemo(() => {
    if (!team || !allUsers) return [];
    const memberIds = team.members || [];
    // Filter out invalid/deleted users - only return members that actually exist
    return memberIds
      .map(id => allUsers.find(u => u.id === id))
      .filter(user => user !== undefined);
  }, [team, allUsers]);

  // Get trainers with user details
  const trainers = useMemo(() => {
    if (!team || !allUsers) return [];
    const trainerIds = team.trainers || [];
    // Filter out invalid/deleted users - only return trainers that actually exist
    return trainerIds
      .map(id => allUsers.find(u => u.id === id))
      .filter(user => user !== undefined);
  }, [team, allUsers]);

  // Get assistants with user details
  const assistants = useMemo(() => {
    if (!team || !allUsers) return [];
    const assistantIds = team.assistants || [];
    // Filter out invalid/deleted users - only return assistants that actually exist
    return assistantIds
      .map(id => allUsers.find(u => u.id === id))
      .filter(user => user !== undefined);
  }, [team, allUsers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-light/60">Loading team...</div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="text-6xl mb-4">❌</div>
        <h2 className="font-title text-2xl text-light mb-2">Team Not Found</h2>
        <p className="text-light/60 mb-6">This team doesn't exist or has been deleted.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 md:px-6 md:py-3 bg-primary hover:bg-primary/80 text-white rounded-lg text-sm md:text-base font-medium transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-0.5">
      {/* Header */}
      <div className="mb-2 md:mb-2">
        <button
          onClick={() => navigate('/', { state: { selectedClubId: clubId } })}
          className="mb-4 flex items-center gap-2 text-light/60 hover:text-light transition-colors"
        >
          Back to {club?.name || 'Club'}
        </button>
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-display text-5xl md:text-6xl text-light mb-2">
                {team.name}
              </h1>
              <p className="text-light/60 text-lg">{team.clubName}</p>
            </div>       
            
            {/* Compact Orders Badge */}
            {pendingOrdersCount > 0 && (
              <div className="relative">
                <button
                  onClick={() => {
                    if (pendingOrdersCount === 1) {
                      // If only one order, open it directly
                      setSelectedOrder(pendingOrders[0]);
                      setShowOrderResponseModal(true);
                      setOrderResponseForm({});
                    } else {
                      // If multiple, show dropdown
                      setShowOrdersDropdown(!showOrdersDropdown);
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 rounded-lg transition-all"
                >
                  <span className="text-base">📋</span>
                  <span className="text-xs font-medium text-orange-300">{pendingOrdersCount}</span>
                </button>

                {/* Dropdown for multiple orders */}
                {showOrdersDropdown && pendingOrdersCount > 1 && (
                  <div className="absolute top-full left-0 mt-2 bg-mid-dark border border-white/20 rounded-lg shadow-2xl overflow-hidden z-50 min-w-[280px]">
                    <div className="p-3 border-b border-white/10">
                      <p className="text-xs text-light/60 font-medium">Pending Orders</p>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {pendingOrders.map((order) => (
                        <button
                          key={order.id}
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowOrderResponseModal(true);
                            setOrderResponseForm({});
                            setShowOrdersDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-all border-b border-white/5 last:border-b-0"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-light truncate">{order.title}</p>
                              {order.description && (
                                <p className="text-xs text-light/50 truncate mt-0.5">{order.description}</p>
                              )}
                              <div className="flex gap-2 mt-1 text-xs text-light/40">
                                <span>📋 {order.fields.length} fields</span>
                                {order.deadline && (
                                  <span>⏰ {new Date(order.deadline).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-primary text-xs shrink-0">→</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Leave Team Button */}
          <button
            onClick={handleLeaveTeam}
            className="px-1 py-0.5 md:px-2 md:py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs md:text-sm font-medium transition-all flex items-center gap-1 md:gap-2"
          >
            <span>🚪</span>
            <span>Leave Team</span>
          </button>

        </div>
      </div>

      {/* Tabs - Horizontal Scrollable */}
      <div className="flex overflow-x-auto gap-1 mb-2 border-b border-white/10 pb-2 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}>
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-2 text-xs md:text-sm font-medium transition-all whitespace-nowrap rounded-t flex-shrink-0 ${
            activeTab === 'overview'
              ? 'text-primary border-b-2 border-primary bg-primary/10'
              : 'text-light/60 hover:text-light hover:bg-white/5'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-3 py-2 text-xs md:text-sm font-medium transition-all whitespace-nowrap rounded-t flex-shrink-0 ${
            activeTab === 'chat'
              ? 'text-primary border-b-2 border-primary bg-primary/10'
              : 'text-light/60 hover:text-light hover:bg-white/5'
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-3 py-2 text-xs md:text-sm font-medium transition-all whitespace-nowrap rounded-t flex-shrink-0 ${
            activeTab === 'attendance'
              ? 'text-primary border-b-2 border-primary bg-primary/10'
              : 'text-light/60 hover:text-light hover:bg-white/5'
          }`}
        >
          Attend
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`px-3 py-2 text-xs md:text-sm font-medium transition-all whitespace-nowrap rounded-t flex-shrink-0 ${
            activeTab === 'members'
              ? 'text-primary border-b-2 border-primary bg-primary/10'
              : 'text-light/60 hover:text-light hover:bg-white/5'
          }`}
        >
          <span className="hidden sm:inline">Members</span>
          <span className="inline sm:hidden">👥</span> ({members.length})
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-3 py-2 text-xs md:text-sm font-medium transition-all whitespace-nowrap rounded-t flex-shrink-0 ${
            activeTab === 'staff'
              ? 'text-primary border-b-2 border-primary bg-primary/10'
              : 'text-light/60 hover:text-light hover:bg-white/5'
          }`}
        >
          <span className="hidden sm:inline">Staff</span>
          <span className="inline sm:hidden">👨‍🏫</span> ({trainers.length + assistants.length})
        </button>
        <button
          onClick={() => setActiveTab('statistics')}
          className={`px-3 py-2 text-xs md:text-sm font-medium transition-all whitespace-nowrap rounded-t flex-shrink-0 ${
            activeTab === 'statistics'
              ? 'text-primary border-b-2 border-primary bg-primary/10'
              : 'text-light/60 hover:text-light hover:bg-white/5'
          }`}
        >
          Stats
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Upcoming Events */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 md:p-6">
              <h2 className="font-title text-base md:text-2xl text-light mb-3 md:mb-4">Upcoming Events</h2>
              
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-8 md:py-12">
                  <div className="text-2xl md:text-4xl mb-2">📅</div>
                  <p className="text-sm md:text-base text-light/60">No upcoming events</p>
                  <p className="text-light/40 text-xs md:text-sm mt-1">Events will appear here</p>
                </div>
              ) : (
                <div className="space-y-2 md:space-y-3">
                  {upcomingEvents.map((event, idx) => {
                    const userResponse = event.responses?.[user?.id];
                    const isAttending = userResponse?.status === 'attending';
                    
                    return (
                    <div
                      key={event.id || idx}
                      className={`bg-white/5 border rounded-lg p-3 md:p-4 hover:bg-white/10 transition-all group ${
                        isAttending 
                          ? 'border-green-500/50 bg-green-500/5 shadow-[0_0_10px_rgba(34,197,94,0.3)] hover:border-green-500/70' 
                          : 'border-white/10 hover:border-primary/50'
                      }`}
                    >
                      <div 
                        onClick={() => navigate(`/event/${event.id}`)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base md:text-xl flex-shrink-0">
                                {event.type === 'training' ? '🏋️' : 
                                 event.type === 'match' || event.type === 'game' ? '⚽' :
                                 event.type === 'tournament' ? '🏆' :
                                 event.type === 'meeting' ? '💼' : '📅'}
                              </span>
                              <h3 className="font-semibold text-sm md:text-base text-light group-hover:text-primary transition-colors truncate">
                                {event.title}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs md:text-sm text-light/60 capitalize">{event.type || 'Event'}</p>
                              {isAttending && (
                                <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded text-xs font-medium">
                                  ✓ Registered
                                </span>
                              )}
                            </div>
                            {event.location && (
                              <p className="text-xs text-light/50 mt-1 truncate">📍 {event.location}</p>
                            )}
                          </div>
                          <div className="text-right space-y-1 flex-shrink-0">
                            <div className="text-xs md:text-sm text-light/80 font-medium whitespace-nowrap">
                              {new Date(event.date).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </div>
                            {event.time && (
                              <div className="text-xs text-light/60">{event.time}</div>
                            )}
                            {/* Attendance Count */}
                            {(() => {
                              const attendingCount = event.responses 
                                ? Object.values(event.responses).filter(r => r.status === 'attending').length 
                                : 0;
                              const totalLimit = event.participantLimit || '∞';
                              const isFull = event.participantLimit && attendingCount >= event.participantLimit;
                              
                              return (
                                <div className={`inline-block px-1.5 md:px-2 py-0.5 rounded text-xs font-bold ${
                                  isFull 
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                }`}>
                                  {attendingCount}/{totalLimit}
                          </div>
                              );
                            })()}
                        </div>
                      </div>
                      </div>
                      
                      {/* Event Chat Button */}
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateEventChat(event);
                          }}
                          className="w-full px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 text-light text-xs rounded transition-all flex items-center justify-center gap-2"
                        >
                          {(() => {
                            const eventChat = teamChats.find(chat => chat.eventId === event.id);
                            return eventChat ? (
                              <>
                                <span>💬</span>
                                <span>Open Event Chat</span>
                              </>
                            ) : (
                              <>
                                <span>➕</span>
                                <span>Create Event Chat</span>
                              </>
                            );
                          })()}
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Stats - Enhanced with Orders */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg md:rounded-xl p-3 md:p-4 text-center">
                <div className="text-xl md:text-2xl mb-1">🏋️</div>
                <div className="text-lg md:text-xl font-bold text-light">{statistics.trainings}</div>
                <div className="text-[10px] md:text-xs text-light/60">Trainings</div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg md:rounded-xl p-3 md:p-4 text-center">
                <div className="text-xl md:text-2xl mb-1">⚽</div>
                <div className="text-lg md:text-xl font-bold text-light">{statistics.matches}</div>
                <div className="text-[10px] md:text-xs text-light/60">Matches</div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg md:rounded-xl p-3 md:p-4 text-center">
                <div className="text-xl md:text-2xl mb-1">🏆</div>
                <div className="text-lg md:text-xl font-bold text-light">{statistics.tournaments}</div>
                <div className="text-[10px] md:text-xs text-light/60">Tournaments</div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg md:rounded-xl p-3 md:p-4 text-center">
                <div className="text-xl md:text-2xl mb-1">📊</div>
                <div className="text-lg md:text-xl font-bold text-light">{statistics.meetings}</div>
                <div className="text-[10px] md:text-xs text-light/60">Events</div>
              </div>
              <div 
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg md:rounded-xl p-3 md:p-4 text-center cursor-pointer hover:bg-white/10 hover:border-primary/50 transition-all relative"
                onClick={() => {
                  const ordersSection = document.getElementById('orders-section');
                  if (ordersSection) {
                    ordersSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              >
                {orders.filter(order => {
                  const userResponse = orderResponses[order.id]?.find(r => r.userId === user?.id);
                  return !userResponse;
                }).length > 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold">
                      {orders.filter(order => {
                        const userResponse = orderResponses[order.id]?.find(r => r.userId === user?.id);
                        return !userResponse;
                      }).length}
                    </span>
                  </div>
                )}
                <div className="text-xl md:text-2xl mb-1">📋</div>
                <div className="text-lg md:text-xl font-bold text-light">{orders.length}</div>
                <div className="text-[10px] md:text-xs text-light/60">Orders</div>
              </div>
            </div>
            
            {/* Orders Section */}
            <div id="orders-section" className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 md:p-6">
              <h2 className="font-title text-base md:text-2xl text-light mb-3 md:mb-4">Team Orders</h2>
              
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-2xl md:text-4xl mb-2">📋</div>
                  <p className="text-light/60">No orders yet</p>
                  <p className="text-light/40 text-sm mt-1">Orders will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => {
                    const userResponse = orderResponses[order.id]?.find(r => r.userId === user?.id);
                    const isPending = !userResponse;
                    const isActive = order.status === 'active';

                    return (
                      <div
                        key={order.id}
                        className={`bg-white/5 border rounded-lg p-4 transition-all ${
                          isPending && isActive
                            ? 'border-orange-500/50 hover:border-orange-500 cursor-pointer'
                            : 'border-white/10 opacity-60'
                        }`}
                        onClick={() => {
                          if (isPending && isActive) {
                            setSelectedOrder(order);
                            setShowOrderResponseModal(true);
                            setOrderResponseForm({});
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-light">
                                {order.title}
                              </h3>
                              {isPending && isActive && (
                                <span className="px-2 py-0.5 text-xs bg-orange-500/20 text-orange-300 rounded-full">
                                  Action Required
                                </span>
                              )}
                              {!isActive && (
                                <span className="px-2 py-0.5 text-xs bg-gray-500/20 text-gray-400 rounded-full">
                                  Closed
                                </span>
                              )}
                            </div>
                            {order.description && (
                              <p className="text-sm text-light/60 mb-2 line-clamp-1">
                                {order.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-3 text-xs text-light/50">
                              <span>📋 {order.fields.length} fields</span>
                              {order.deadline && (
                                <span>⏰ Deadline: {new Date(order.deadline).toLocaleDateString()}</span>
                              )}
                              {userResponse && (
                                <>
                                  <span>
                                    {userResponse.status === 'accepted' ? '✓ Responded' : '✗ Declined'}
                                  </span>
                                  {userResponse.submittedAt && (
                                    <span>
                                      📅 {new Date(userResponse.submittedAt.seconds * 1000).toLocaleDateString()}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          {isPending && isActive && (
                            <div className="text-primary text-sm font-medium whitespace-nowrap">
                              Respond →
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {activeTab === 'members' && (
          <TeamMemberCards
            team={team}
            members={[...new Set([...team.trainers, ...team.assistants, ...team.members])]}
            allUsers={allUsers}
            currentUser={user}
            userSubscription={user.isSuperAdmin ? 'full' : (user.subscription || 'free')}
onUpdateTeamSettings={async (settings) => {
  console.log('🔧 Team.jsx updating settings:', settings);
  try {
    await updateTeamCardSettings(clubId, teamId, settings);
    console.log('💾 Settings saved to Firestore');
    
    await loadTeamData();
    console.log('🔄 Team data reloaded');
    
    showToast('Settings saved', 'success');
  } catch (error) {
    console.error('❌ Error in onUpdateTeamSettings:', error);
    showToast('Failed to save settings', 'error');
  }
}}
            onUpdateMemberData={async (memberId, memberData) => {          
              await updateTeamMemberData(clubId, teamId, memberId, memberData);
              await loadTeamData(); // Reload to show changes
              console.log('✅ Team.jsx - Data reloaded');
              showToast('Card updated successfully', 'success');
            }}
            onMessage={(member) => {console.log('Message:', member);}}
            onViewProfile={(member) => {navigate(`/profile/${member.id}`);}}
          />
        )}

        {activeTab === 'staff' && (
          <div className="space-y-4 md:space-y-6 animate-fade-in">
            {/* Trainers */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 md:p-6">
              <h2 className="font-title text-base md:text-2xl text-light mb-3 md:mb-4">Trainers</h2>
              
              {trainers.length === 0 ? (
                <div className="text-center py-6 md:py-8">
                  <div className="text-xl md:text-3xl mb-2">👨‍🏫</div>
                  <p className="text-sm md:text-base text-light/60">No trainers assigned</p>
                </div>
              ) : (
                <div className="space-y-2 md:space-y-3">
                  {trainers.map((trainer, idx) => (
                    <div
                      key={trainer.id || idx}
                      className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4 hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white text-lg md:text-2xl font-bold flex-shrink-0">
                          {trainer.username?.charAt(0).toUpperCase() || '👨‍🏫'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-light text-sm md:text-lg mb-1 md:mb-2 truncate">{trainer.username || 'Unknown Trainer'}</h3>
                          <div className="space-y-0.5 md:space-y-1 text-xs md:text-sm">
                            <div className="flex items-center gap-2 text-light/70 truncate">
                              <span>📧</span>
                              <span className="truncate">{trainer.email || 'No email'}</span>
                            </div>
                            {trainer.phone && (
                              <div className="flex items-center gap-2 text-light/70">
                                <span>📱</span>
                                <span>{trainer.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="px-2 md:px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-[10px] md:text-xs font-medium whitespace-nowrap flex-shrink-0">
                          Trainer
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assistants */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 md:p-6">
              <h2 className="font-title text-base md:text-2xl text-light mb-3 md:mb-4">Assistants</h2>
              
              {assistants.length === 0 ? (
                <div className="text-center py-6 md:py-8">
                  <div className="text-xl md:text-3xl mb-2">👨‍💼</div>
                  <p className="text-sm md:text-base text-light/60">No assistants assigned</p>
                </div>
              ) : (
                <div className="space-y-2 md:space-y-3">
                  {assistants.map((assistant, idx) => (
                    <div
                      key={assistant.id || idx}
                      className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4 hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-accent to-secondary flex items-center justify-center text-white text-lg md:text-2xl font-bold flex-shrink-0">
                          {assistant.username?.charAt(0).toUpperCase() || '👨‍💼'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-light text-sm md:text-lg mb-1 md:mb-2 truncate">{assistant.username || 'Unknown Assistant'}</h3>
                          <div className="space-y-0.5 md:space-y-1 text-xs md:text-sm">
                            <div className="flex items-center gap-2 text-light/70 truncate">
                              <span>📧</span>
                              <span className="truncate">{assistant.email || 'No email'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="px-2 md:px-3 py-1 bg-accent/20 text-accent rounded-full text-[10px] md:text-xs font-medium whitespace-nowrap flex-shrink-0">
                          Assistant
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'statistics' && (
          <div className="animate-fade-in">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 md:p-6">
              <h2 className="font-title text-base md:text-2xl text-light mb-4 md:mb-6">Team Statistics</h2>
              
              <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                {/* Events Breakdown */}
                <div className="space-y-3 md:space-y-4">
                  <h3 className="font-semibold text-sm md:text-base text-light/80">Events Breakdown</h3>
                  
                  <div className="space-y-2 md:space-y-3">
                    <button
                      onClick={() => {
                        // Check if user is trainer or assistant
                        const isTrainer = club.trainers?.includes(user?.id);
                        const team = club.teams?.find(t => t.id === teamId);
                        const isAssistant = team?.assistants?.includes(user?.id);
                        
                        if (isTrainer || isAssistant) {
                          navigate(`/team/${clubId}/${teamId}/statistics`);
                        } else {
                          showToast('Only trainers and assistants can view detailed statistics', 'error');
                        }
                      }}
                      className="w-full flex items-center justify-between p-2 md:p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-2 md:gap-3">
                        <span className="text-lg md:text-2xl">🏋️</span>
                        <span className="text-sm md:text-base text-light group-hover:text-primary transition">Trainings</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg md:text-2xl font-bold text-primary">{statistics.trainings}</span>
                        <span className="text-primary opacity-0 group-hover:opacity-100 transition">→</span>
                      </div>
                    </button>
                    
                    <div className="flex items-center justify-between p-2 md:p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-2 md:gap-3">
                        <span className="text-lg md:text-2xl">⚽</span>
                        <span className="text-sm md:text-base text-light">Matches</span>
                      </div>
                      <span className="text-lg md:text-2xl font-bold text-primary">{statistics.matches}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 md:p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-2 md:gap-3">
                        <span className="text-lg md:text-2xl">🏆</span>
                        <span className="text-sm md:text-base text-light">Tournaments</span>
                      </div>
                      <span className="text-lg md:text-2xl font-bold text-primary">{statistics.tournaments}</span>
                    </div>
                    
                    <button
                      onClick={() => {
                        // Check if user is trainer or assistant
                        const isTrainer = club.trainers?.includes(user?.id);
                        const team = club.teams?.find(t => t.id === teamId);
                        const isAssistant = team?.assistants?.includes(user?.id);
                        
                        if (isTrainer || isAssistant) {
                          navigate(`/team/${clubId}/${teamId}/attendance-stats`);
                        } else {
                          showToast('Only trainers and assistants can view attendance statistics', 'error');
                        }
                      }}
                      className="w-full flex items-center justify-between p-2 md:p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-2 md:gap-3">
                        <span className="text-lg md:text-2xl">📊</span>
                        <span className="text-sm md:text-base text-light group-hover:text-primary transition">Attendance</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg md:text-2xl font-bold text-primary">{statistics.meetings}</span>
                        <span className="text-primary opacity-0 group-hover:opacity-100 transition">→</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Team Composition */}
                <div className="space-y-3 md:space-y-4">
                  <h3 className="font-semibold text-sm md:text-base text-light/80">Team Composition</h3>
                  
                  <div className="space-y-2 md:space-y-3">
                    <div className="flex items-center justify-between p-2 md:p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-2 md:gap-3">
                        <span className="text-lg md:text-2xl">👥</span>
                        <span className="text-sm md:text-base text-light">Members</span>
                      </div>
                      <span className="text-lg md:text-2xl font-bold text-accent">{members.length}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 md:p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-2 md:gap-3">
                        <span className="text-lg md:text-2xl">👨‍🏫</span>
                        <span className="text-sm md:text-base text-light">Trainers</span>
                      </div>
                      <span className="text-lg md:text-2xl font-bold text-accent">{trainers.length}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 md:p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-2 md:gap-3">
                        <span className="text-lg md:text-2xl">👨‍💼</span>
                        <span className="text-sm md:text-base text-light">Assistants</span>
                      </div>
                      <span className="text-lg md:text-2xl font-bold text-accent">{assistants.length}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 md:p-3 bg-primary/10 rounded-lg border border-primary/30">
                      <div className="flex items-center gap-2 md:gap-3">
                        <span className="text-lg md:text-2xl">📊</span>
                        <span className="text-sm md:text-base text-light font-semibold">Total</span>
                      </div>
                      <span className="text-lg md:text-2xl font-bold text-primary">
                        {members.length + trainers.length + assistants.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-accent/10 border border-accent/30 rounded-lg">
                <p className="text-accent text-sm">
                  💡 Tip: Statistics will update automatically as you add events and activities
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h3 className="text-base md:text-xl font-bold text-light">💬 Team Chats</h3>
              <button
                onClick={handleCreateTeamChat}
                className="px-3 py-1.5 md:px-4 md:py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-medium text-xs md:text-sm flex items-center gap-2"
              >
                <span>➕</span>
                <span className="hidden sm:inline">Create Chat</span>
              </button>
            </div>
            
            {teamChats.length > 0 ? (
              <div className="space-y-3">
                {teamChats.map((chat) => {
                  // Find event if this chat is event-related
                  const relatedEvent = chat.eventId ? events.find(e => e.id === chat.eventId) : null;
                  
                  return (
                    <div
                      key={chat.id}
                      onClick={() => navigate(`/chat/${chat.id}`)}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 rounded-lg p-3 md:p-4 cursor-pointer transition-all group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Chat Title */}
                          <h4 className="font-semibold text-light text-sm md:text-base mb-1 group-hover:text-primary transition-colors truncate">
                            {chat.title}
                          </h4>
                          
                          {/* Event Info (if event-related) */}
                          {relatedEvent && (
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                                📅 {relatedEvent.title}
                              </span>
                              <span className="text-xs text-light/50">
                                {new Date(relatedEvent.date).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          
                          {/* Last Message */}
                          {chat.lastMessage && (
                            <p className="text-xs md:text-sm text-light/60 truncate">
                              {chat.lastMessage}
                            </p>
                          )}
                          
                          {/* Members Count & Last Activity */}
                          <div className="flex items-center gap-3 mt-2 text-xs text-light/50">
                            <span>👥 {chat.members?.length || 0} members</span>
                            {chat.lastMessageAt && (
                              <span>
                                · {new Date(chat.lastMessageAt.toDate()).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Arrow Icon */}
                        <div className="flex-shrink-0 text-light/40 group-hover:text-primary transition-colors">
                          <span className="text-xl">→</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 md:py-12">
                <div className="text-4xl md:text-6xl mb-3 md:mb-4">💬</div>
                <p className="text-sm md:text-base text-light/60 mb-4">
                  No team chats exist yet
                </p>
                <p className="text-xs md:text-sm text-light/40 mb-4">
                  Create a chat to start communicating with your team members
                </p>
                <button
                  onClick={handleCreateTeamChat}
                  className="px-4 md:px-6 py-2 md:py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-medium text-sm md:text-base"
                >
                  Create Team Chat
                </button>
              </div>
            )}
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
          <div>
            {/* Header with Take Attendance Button */}
            <div className="flex items-center justify-between gap-2 mb-4 md:mb-6">
              <h3 className="text-base md:text-2xl font-bold text-light">📋 Attendance</h3>
              {/* Only show button for Admin, ClubOwner, Trainer, or Assistant */}
              {(user?.isSuperAdmin || 
                club?.ownerId === user?.id || 
                team?.trainers?.includes(user?.id) || 
                team?.assistants?.includes(user?.id)) && (
              <button
                onClick={() => navigate(`/team/${clubId}/${teamId}/attendance`)}
                className="px-3 md:px-6 py-2 md:py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-medium text-xs md:text-base whitespace-nowrap"
              >
                + Take
              </button>
              )}
            </div>
            {/* Filters */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 md:p-6 mb-4 md:mb-6">
              <div className="grid md:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-sm font-medium text-light/80 mb-2">Filter by Type</label>
                  <select
                    value={attendanceFilterType}
                    onChange={(e) => setAttendanceFilterType(e.target.value)}
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
                    value={attendanceSearchQuery}
                    onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                    placeholder="Search by date or type..."
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                  />
                </div>
              </div>
            </div>

            {/* Attendance Records */}
            {loadingAttendance ? (
              <div className="text-center py-8 md:py-12">
                <div className="animate-spin rounded-full h-8 md:h-12 w-8 md:w-12 border-b-2 border-primary mx-auto mb-3 md:mb-4"></div>
                <p className="text-sm md:text-base text-light/60">Loading attendance...</p>
              </div>
            ) : filteredAttendanceRecords.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-8 md:p-12 text-center">
                <div className="text-3xl md:text-6xl mb-3 md:mb-4">📋</div>
                <h3 className="font-title text-lg md:text-2xl text-light mb-2">No Attendance Records</h3>
                <p className="text-sm md:text-base text-light/60 mb-3 md:mb-4">
                  {attendanceSearchQuery || attendanceFilterType !== 'all' 
                    ? 'No records match your filters'
                    : 'Start by taking attendance for your team'
                  }
                </p>
                {!attendanceSearchQuery && attendanceFilterType === 'all' && (
                  <button
                    onClick={() => navigate(`/team/${clubId}/${teamId}/attendance`)}
                    className="px-4 md:px-6 py-2 md:py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition text-sm md:text-base"
                  >
                    Take Attendance
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {filteredAttendanceRecords.map((record) => {
                  const displayType = record.type === 'custom' && record.customType 
                    ? record.customType 
                    : record.type;

                  return (
                    <div
                      key={record.id}
                      className="bg-white/5 border border-white/10 rounded-xl p-3 md:p-6 hover:bg-white/10 transition"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="flex items-start gap-2 md:gap-4 flex-1">
                          <div className="text-xl md:text-4xl flex-shrink-0">{getAttendanceTypeIcon(record.type)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 mb-2">
                              <h3 className="font-title text-sm md:text-xl text-light capitalize truncate">
                                {displayType}
                                {record.sessionName && (
                                  <span className="ml-2 text-xs md:text-base font-normal text-primary">
                                    • {record.sessionName}
                                  </span>
                                )}
                              </h3>
                              <span className="text-xs md:text-sm text-light/60">
                                {formatAttendanceDate(record.date)}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 md:gap-6 text-xs md:text-sm">
                              <div className="flex items-center gap-1 md:gap-2">
                                <span className="text-light/60">Total:</span>
                                <span className="font-semibold text-light">{record.statistics.total}</span>
                              </div>
                              <div className="flex items-center gap-1 md:gap-2">
                                <span className="text-green-400">✓</span>
                                <span className="font-semibold text-green-400">{record.statistics.present}</span>
                              </div>
                              <div className="flex items-center gap-1 md:gap-2">
                                <span className="text-red-400">✗</span>
                                <span className="font-semibold text-red-400">{record.statistics.absent}</span>
                              </div>
                              <div className="flex items-center gap-1 md:gap-2">
                                <span className="text-blue-400">Rate:</span>
                                <span className="font-semibold text-blue-400">{record.statistics.percentage}%</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleViewAttendanceDetails(record)}
                            className="px-3 md:px-4 py-1.5 md:py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs md:text-sm transition whitespace-nowrap"
                          >
                            View
                          </button>
                          {/* Only show Edit/Delete for Admin, ClubOwner, Trainer, or Assistant */}
                          {(user?.isSuperAdmin || 
                            club?.ownerId === user?.id || 
                            team?.trainers?.includes(user?.id) || 
                            team?.assistants?.includes(user?.id)) && (
                            <>
                          <button
                            onClick={() => navigate(`/team/${clubId}/${teamId}/attendance`)}
                            className="px-3 md:px-4 py-1.5 md:py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg text-xs md:text-sm transition whitespace-nowrap"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteAttendance(record.id)}
                            className="px-3 md:px-4 py-1.5 md:py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs md:text-sm transition whitespace-nowrap"
                          >
                            Delete
                          </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Details Modal */}
            {showAttendanceModal && selectedAttendance && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-mid-dark border border-white/20 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6 border-b border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-title text-2xl text-light capitalize">
                          {selectedAttendance.type === 'custom' && selectedAttendance.customType 
                            ? selectedAttendance.customType 
                            : selectedAttendance.type}
                          {selectedAttendance.sessionName && (
                            <span className="ml-2 text-lg font-normal text-primary">
                              • {selectedAttendance.sessionName}
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-light/60 mt-1">
                          {formatAttendanceDate(selectedAttendance.date)}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowAttendanceModal(false)}
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
                        <div className="text-2xl font-bold text-light">{selectedAttendance.statistics.total}</div>
                        <div className="text-xs text-light/60 mt-1">Total</div>
                      </div>
                      <div className="bg-green-500/20 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-400">{selectedAttendance.statistics.present}</div>
                        <div className="text-xs text-green-300 mt-1">Present</div>
                      </div>
                      <div className="bg-red-500/20 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-red-400">{selectedAttendance.statistics.absent}</div>
                        <div className="text-xs text-red-300 mt-1">Absent</div>
                      </div>
                      <div className="bg-blue-500/20 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-blue-400">{selectedAttendance.statistics.percentage}%</div>
                        <div className="text-xs text-blue-300 mt-1">Rate</div>
                      </div>
                    </div>

                    {/* Member List */}
                    <div className="space-y-3 mb-6">
                      <h4 className="font-semibold text-light mb-3">Member Attendance</h4>
                      {selectedAttendance.records.map((record) => {
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
                                  {record.customStatuses && Object.entries(record.customStatuses).some(([_, val]) => val) && (
                                    <div className="flex gap-2 mt-2">
                                      {Object.entries(record.customStatuses).map(([statusId, isActive]) => 
                                        isActive && (
                                          <span key={statusId} className="px-2 py-1 bg-white/10 rounded text-xs text-light/80 capitalize">
                                            {statusId.replace('_', ' ')}
                                          </span>
                                        )
                                      )}
                                    </div>
                                  )}
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

                    {/* Edit History */}
                    {selectedAttendance.editHistory && selectedAttendance.editHistory.length > 0 && (
                      <div className="border-t border-white/10 pt-6">
                        <h4 className="font-semibold text-light mb-3">📝 Edit History</h4>
                        <div className="space-y-2">
                          {selectedAttendance.editHistory.map((edit, index) => (
                            <div key={index} className="bg-white/5 rounded-lg p-3 text-sm">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="text-light/80">
                                    <span className="font-medium text-light">{edit.editedByName}</span>
                                    {' '}{edit.changes}
                  </div>
                                  {edit.reason && (
                                    <div className="text-light/60 text-xs mt-1">Reason: {edit.reason}</div>
                                  )}
                                </div>
                                <div className="text-xs text-light/50 whitespace-nowrap ml-4">
                                  {new Date(edit.editedAt).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}



      </div>
        {/* Order Response Modal */}
      {showOrderResponseModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-mid-dark border border-white/20 rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-title text-2xl text-light">{selectedOrder.title}</h3>
              <button
                onClick={() => {
                  setShowOrderResponseModal(false);
                  setSelectedOrder(null);
                  setOrderResponseForm({});
                }}
                className="text-light/60 hover:text-light transition-colors"
              >
                ✕
              </button>
            </div>

            {selectedOrder.description && (
              <p className="text-sm text-light/70 mb-6 pb-6 border-b border-white/10">
                {selectedOrder.description}
              </p>
            )}

            <div className="space-y-4 mb-6">
              {selectedOrder.fields.map(field => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-light/80 mb-2">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  
                  {field.type === 'text' && (
                    <input
                      type="text"
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      value={orderResponseForm[field.id] || ''}
                      onChange={(e) => setOrderResponseForm(f => ({ 
                        ...f, 
                        [field.id]: e.target.value 
                      }))}
                      required={field.required}
                    />
                  )}

                  {field.type === 'number' && (
                    <input
                      type="number"
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      value={orderResponseForm[field.id] || ''}
                      onChange={(e) => setOrderResponseForm(f => ({ 
                        ...f, 
                        [field.id]: e.target.value 
                      }))}
                      required={field.required}
                    />
                  )}

                  {field.type === 'dropdown' && (
                    <select
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      value={orderResponseForm[field.id] || ''}
                      onChange={(e) => setOrderResponseForm(f => ({ 
                        ...f, 
                        [field.id]: e.target.value 
                      }))}
                      required={field.required}
                    >
                      <option value="" className="bg-mid-dark">Select...</option>
                      {field.options?.map((opt, idx) => (
                        <option key={idx} value={opt} className="bg-mid-dark">
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.type === 'textarea' && (
                    <textarea
                      rows={3}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                      value={orderResponseForm[field.id] || ''}
                      onChange={(e) => setOrderResponseForm(f => ({ 
                        ...f, 
                        [field.id]: e.target.value 
                      }))}
                      required={field.required}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleSubmitOrderResponse('accepted')}
                className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-all disabled:opacity-50"
                disabled={respondingToOrder}
              >
                {respondingToOrder ? 'Submitting...' : '✓ Accept & Submit'}
              </button>
              <button
                onClick={() => handleSubmitOrderResponse('declined')}
                className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all disabled:opacity-50"
                disabled={respondingToOrder}
              >
                ✗ Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



