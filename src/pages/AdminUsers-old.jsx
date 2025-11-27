// src/pages/AdminUsers.jsx - Enhanced Super Admin Panel
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function AdminUsers() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('users'); // users, clubs, teams, events
  const [loading, setLoading] = useState(false);

  // Data state
  const [users, setUsers] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [events, setEvents] = useState([]);

  // Filter state
  const [filters, setFilters] = useState({
    username: '',
    email: '',
    club: '',
    team: '',
    role: '',
    eventType: '',
  });

  // Modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [assignClubId, setAssignClubId] = useState('');
  const [assignTeamIds, setAssignTeamIds] = useState([]);

  // Role change modal state
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleChangeUser, setRoleChangeUser] = useState(null);
  const [newRole, setNewRole] = useState('');

  // Load data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = () => {
    try {
      const usersData = JSON.parse(localStorage.getItem('users') || '[]');
      const clubsData = JSON.parse(localStorage.getItem('clubs') || '[]');
      const eventsData = JSON.parse(localStorage.getItem('sportsapp:localEvents') || '[]');
      
      setUsers(usersData);
      setClubs(clubsData);
      setEvents(eventsData);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading data');
    }
  };

  // Get all teams from all clubs
  const allTeams = useMemo(() => {
    const teams = [];
    clubs.forEach(club => {
      (club.teams || []).forEach(team => {
        teams.push({
          ...team,
          clubId: club.id,
          clubName: club.name,
        });
      });
    });
    return teams;
  }, [clubs]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (filters.username && !u.username?.toLowerCase().includes(filters.username.toLowerCase())) {
        return false;
      }
      if (filters.email && !u.email?.toLowerCase().includes(filters.email.toLowerCase())) {
        return false;
      }
      if (filters.role && u.role !== filters.role) {
        return false;
      }
      if (filters.club) {
        const club = clubs.find(c => c.id === filters.club);
        if (!club) return false;
        const isInClub = 
          (club.members || []).includes(u.id) ||
          (club.trainers || []).includes(u.id) ||
          (club.assistants || []).includes(u.id) ||
          club.superTrainer === u.id;
        if (!isInClub) return false;
      }
      if (filters.team) {
        const team = allTeams.find(t => t.id === filters.team);
        if (!team) return false;
        const isInTeam = 
          (team.members || []).includes(u.id) ||
          (team.trainers || []).includes(u.id) ||
          (team.assistants || []).includes(u.id);
        if (!isInTeam) return false;
      }
      return true;
    });
  }, [users, filters, clubs, allTeams]);

  // Filtered clubs
  const filteredClubs = useMemo(() => {
    return clubs.filter(c => {
      if (filters.club && c.id !== filters.club) {
        return false;
      }
      return true;
    });
  }, [clubs, filters]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (filters.eventType && e.type?.toLowerCase() !== filters.eventType.toLowerCase()) {
        return false;
      }
      if (filters.club && e.clubId !== filters.club) {
        return false;
      }
      if (filters.team && e.teamId !== filters.team) {
        return false;
      }
      return true;
    });
  }, [events, filters]);

  // === USER ACTIONS ===

  const handleDeleteUser = (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      // Remove from users array
      const updatedUsers = users.filter(u => u.id !== userId);
      localStorage.setItem('users', JSON.stringify(updatedUsers));

      // Remove from all clubs and teams
      const updatedClubs = clubs.map(club => ({
        ...club,
        members: (club.members || []).filter(id => id !== userId),
        trainers: (club.trainers || []).filter(id => id !== userId),
        assistants: (club.assistants || []).filter(id => id !== userId),
        superTrainer: club.superTrainer === userId ? null : club.superTrainer,
        teams: (club.teams || []).map(team => ({
          ...team,
          members: (team.members || []).filter(id => id !== userId),
          trainers: (team.trainers || []).filter(id => id !== userId),
          assistants: (team.assistants || []).filter(id => id !== userId),
        }))
      }));
      localStorage.setItem('clubs', JSON.stringify(updatedClubs));

      loadAllData();
      alert('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error deleting user');
    }
  };

  const openAssignModal = (userId) => {
    const userObj = users.find(u => u.id === userId);
    if (!userObj) return;

    setSelectedUser(userObj);
    setAssignClubId('');
    setAssignTeamIds([]);
    setShowAssignModal(true);
  };

  const handleAssignToClubTeam = () => {
    if (!selectedUser || !assignClubId) {
      alert('Please select a club');
      return;
    }

    try {
      const updatedClubs = clubs.map(club => {
        if (club.id !== assignClubId) return club;

        // Add user to club members if not already
        const clubMembers = club.members || [];
        if (!clubMembers.includes(selectedUser.id)) {
          clubMembers.push(selectedUser.id);
        }

        // Update teams
        const updatedTeams = (club.teams || []).map(team => {
          if (assignTeamIds.includes(team.id)) {
            // Add user to team if not already
            const teamMembers = team.members || [];
            if (!teamMembers.includes(selectedUser.id)) {
              teamMembers.push(selectedUser.id);
            }
            return { ...team, members: teamMembers };
          }
          return team;
        });

        return { ...club, members: clubMembers, teams: updatedTeams };
      });

      localStorage.setItem('clubs', JSON.stringify(updatedClubs));
      loadAllData();
      setShowAssignModal(false);
      setSelectedUser(null);
      alert('User assigned successfully');
    } catch (error) {
      console.error('Error assigning user:', error);
      alert('Error assigning user');
    }
  };

  // === ROLE CHANGE ACTIONS ===

  const openRoleChangeModal = (userId) => {
    const userObj = users.find(u => u.id === userId);
    if (!userObj) return;

    setRoleChangeUser(userObj);
    setNewRole(userObj.role || 'user');
    setShowRoleModal(true);
  };

  const handleRoleChange = () => {
    if (!roleChangeUser || !newRole) {
      alert('Please select a role');
      return;
    }

    if (newRole === roleChangeUser.role) {
      alert('User already has this role');
      return;
    }

    try {
      // Update user role in users array
      const updatedUsers = users.map(u => {
        if (u.id === roleChangeUser.id) {
          return { ...u, role: newRole };
        }
        return u;
      });
      localStorage.setItem('users', JSON.stringify(updatedUsers));

      // Update currentUser if it's the same user
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
      if (currentUser && currentUser.id === roleChangeUser.id) {
        currentUser.role = newRole;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }

      loadAllData();
      setShowRoleModal(false);
      setRoleChangeUser(null);
      alert(`Role changed successfully to ${newRole}`);
    } catch (error) {
      console.error('Error changing role:', error);
      alert('Error changing role');
    }
  };

  // === CLUB ACTIONS ===

  const handleDeleteClub = (clubId) => {
    if (!window.confirm('Are you sure you want to delete this club? All teams and data will be permanently deleted.')) {
      return;
    }

    try {
      const updatedClubs = clubs.filter(c => c.id !== clubId);
      localStorage.setItem('clubs', JSON.stringify(updatedClubs));

      // Remove events associated with this club
      const updatedEvents = events.filter(e => e.clubId !== clubId);
      localStorage.setItem('sportsapp:localEvents', JSON.stringify(updatedEvents));

      loadAllData();
      alert('Club deleted successfully');
    } catch (error) {
      console.error('Error deleting club:', error);
      alert('Error deleting club');
    }
  };

  // === TEAM ACTIONS ===

  const handleDeleteTeam = (clubId, teamId) => {
    if (!window.confirm('Are you sure you want to delete this team? All team data will be permanently deleted.')) {
      return;
    }

    try {
      const updatedClubs = clubs.map(club => {
        if (club.id !== clubId) return club;
        return {
          ...club,
          teams: (club.teams || []).filter(t => t.id !== teamId)
        };
      });
      localStorage.setItem('clubs', JSON.stringify(updatedClubs));

      // Remove events associated with this team
      const updatedEvents = events.filter(e => e.teamId !== teamId);
      localStorage.setItem('sportsapp:localEvents', JSON.stringify(updatedEvents));

      loadAllData();
      alert('Team deleted successfully');
    } catch (error) {
      console.error('Error deleting team:', error);
      alert('Error deleting team');
    }
  };

  // === EVENT ACTIONS ===

  const handleDeleteEvent = (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) {
      return;
    }

    try {
      const updatedEvents = events.filter(e => e.id !== eventId);
      localStorage.setItem('sportsapp:localEvents', JSON.stringify(updatedEvents));
      loadAllData();
      alert('Event deleted successfully');
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Error deleting event');
    }
  };

  const getUserClubs = (userId) => {
    return clubs.filter(c => 
      (c.members || []).includes(userId) ||
      (c.trainers || []).includes(userId) ||
      (c.assistants || []).includes(userId) ||
      c.superTrainer === userId
    );
  };

  const getUserTeams = (userId) => {
    return allTeams.filter(t => 
      (t.members || []).includes(userId) ||
      (t.trainers || []).includes(userId) ||
      (t.assistants || []).includes(userId)
    );
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (user?.role !== ROLES.ADMIN) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="font-title text-2xl text-light mb-2">Access Denied</h2>
          <p className="text-light/60">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="font-display text-5xl md:text-6xl text-light tracking-wider">
          🛡️ ADMIN PANEL
        </h1>
        <p className="text-light/60 text-lg mt-2">
          Complete system management and control
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="flex gap-2 border-b border-white/20 overflow-x-auto">
          {[
            { id: 'users', label: '👥 Users', count: users.length },
            { id: 'clubs', label: '🏛️ Clubs', count: clubs.length },
            { id: 'teams', label: '⚽ Teams', count: allTeams.length },
            { id: 'events', label: '📅 Events', count: events.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-title text-lg transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-light/60 hover:text-light'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <h3 className="font-title text-lg text-light mb-3">🔍 Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <input
              type="text"
              placeholder="Username..."
              value={filters.username}
              onChange={(e) => setFilters(f => ({ ...f, username: e.target.value }))}
              className="bg-white/10 border border-white/20 rounded px-3 py-2 text-light text-sm"
            />
            <input
              type="text"
              placeholder="Email..."
              value={filters.email}
              onChange={(e) => setFilters(f => ({ ...f, email: e.target.value }))}
              className="bg-white/10 border border-white/20 rounded px-3 py-2 text-light text-sm"
            />
            <select
              value={filters.club}
              onChange={(e) => setFilters(f => ({ ...f, club: e.target.value, team: '' }))}
              className="bg-white/10 border border-white/20 rounded px-3 py-2 text-light text-sm"
            >
              <option value="">All Clubs</option>
              {clubs.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={filters.team}
              onChange={(e) => setFilters(f => ({ ...f, team: e.target.value }))}
              className="bg-white/10 border border-white/20 rounded px-3 py-2 text-light text-sm"
              disabled={!filters.club}
            >
              <option value="">All Teams</option>
              {allTeams
                .filter(t => !filters.club || t.clubId === filters.club)
                .map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>
            <select
              value={filters.role}
              onChange={(e) => setFilters(f => ({ ...f, role: e.target.value }))}
              className="bg-white/10 border border-white/20 rounded px-3 py-2 text-light text-sm"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="trainer">Trainer</option>
              <option value="assistant">Assistant</option>
              <option value="user">User</option>
            </select>
            <button
              onClick={() => setFilters({ username: '', email: '', club: '', team: '', role: '', eventType: '' })}
              className="bg-white/10 hover:bg-white/20 text-light rounded px-3 py-2 text-sm transition-all"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-title text-2xl text-light flex items-center gap-3">
                <span className="w-1 h-6 bg-primary rounded"></span>
                Users ({filteredUsers.length})
              </h2>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="p-3 text-left text-light/80 font-semibold text-sm">Username</th>
                      <th className="p-3 text-left text-light/80 font-semibold text-sm">Email</th>
                      <th className="p-3 text-left text-light/80 font-semibold text-sm">Role</th>
                      <th className="p-3 text-left text-light/80 font-semibold text-sm">Clubs</th>
                      <th className="p-3 text-left text-light/80 font-semibold text-sm">Teams</th>
                      <th className="p-3 text-left text-light/80 font-semibold text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u, idx) => {
                      const userClubs = getUserClubs(u.id);
                      const userTeams = getUserTeams(u.id);
                      
                      return (
                        <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="p-3 text-light">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold text-dark">
                                {(u.displayName || u.username || u.email).charAt(0).toUpperCase()}
                              </div>
                              <span>{u.displayName || u.username || 'No name'}</span>
                            </div>
                          </td>
                          <td className="p-3 text-light/80 text-sm">{u.email}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              u.role === 'admin' ? 'bg-red-600/20 text-red-400' :
                              u.role === 'trainer' ? 'bg-blue-600/20 text-blue-400' :
                              u.role === 'assistant' ? 'bg-green-600/20 text-green-400' :
                              'bg-gray-600/20 text-gray-400'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-3 text-light/80 text-sm">{userClubs.length}</td>
                          <td className="p-3 text-light/80 text-sm">{userTeams.length}</td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => openAssignModal(u.id)}
                                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs transition-all"
                              >
                                📋 Assign
                              </button>
                              <button
                                onClick={() => openRoleChangeModal(u.id)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-all"
                              >
                                🔄 Role
                              </button>
                              {u.id !== user.id && (
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-all"
                                >
                                  🗑️ Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CLUBS TAB */}
        {activeTab === 'clubs' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-title text-2xl text-light flex items-center gap-3">
                <span className="w-1 h-6 bg-primary rounded"></span>
                Clubs ({filteredClubs.length})
              </h2>
            </div>

            <div className="grid gap-4">
              {filteredClubs.map((club, idx) => (
                <div
                  key={club.id}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-all"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-title text-xl text-light mb-2">{club.name}</h3>
                      <div className="flex flex-wrap gap-3 text-sm text-light/60">
                        <span>🆔 {club.clubNumber}</span>
                        <span>👥 {(club.members || []).length} members</span>
                        <span>⚽ {(club.teams || []).length} teams</span>
                        <span>👨‍🏫 {(club.trainers || []).length} trainers</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteClub(club.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-all"
                    >
                      🗑️ Delete Club
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TEAMS TAB */}
        {activeTab === 'teams' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-title text-2xl text-light flex items-center gap-3">
                <span className="w-1 h-6 bg-primary rounded"></span>
                Teams ({allTeams.length})
              </h2>
            </div>

            <div className="grid gap-4">
              {allTeams.map((team, idx) => (
                <div
                  key={team.id}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-all"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-title text-xl text-light mb-2">{team.name}</h3>
                      <div className="flex flex-wrap gap-3 text-sm text-light/60">
                        <span>🏛️ {team.clubName}</span>
                        <span>⚽ {team.sport || 'Sport'}</span>
                        <span>👥 {(team.members || []).length} members</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTeam(team.clubId, team.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-all"
                    >
                      🗑️ Delete Team
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EVENTS TAB */}
        {activeTab === 'events' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-title text-2xl text-light flex items-center gap-3">
                <span className="w-1 h-6 bg-primary rounded"></span>
                Events ({filteredEvents.length})
              </h2>
            </div>

            <div className="grid gap-4">
              {filteredEvents.map((event, idx) => (
                <div
                  key={event.id}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-all"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-title text-xl text-light mb-2">{event.title}</h3>
                      <div className="flex flex-wrap gap-3 text-sm text-light/60">
                        <span>📅 {formatDate(event.date)}</span>
                        <span className="px-2 py-0.5 bg-primary/20 text-primary rounded">
                          {event.type || 'Event'}
                        </span>
                        {event.location && <span>📍 {event.location}</span>}
                        <span>👁️ {event.visibilityLevel || 'personal'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-all"
                    >
                      🗑️ Delete Event
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Assign User Modal */}
      {showAssignModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-mid-dark rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-light mb-4">
              📋 Assign User to Club/Team
            </h2>
            
            <div className="mb-4 p-3 bg-blue-600/20 border border-blue-600/30 rounded">
              <p className="text-light">
                <strong>User:</strong> {selectedUser.displayName || selectedUser.username || selectedUser.email}
              </p>
            </div>

            {/* Select Club */}
            <div className="mb-4">
              <label className="block text-light/80 mb-2 font-medium">Select Club *</label>
              <select
                value={assignClubId}
                onChange={(e) => {
                  setAssignClubId(e.target.value);
                  setAssignTeamIds([]);
                }}
                className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-light"
              >
                <option value="">-- Select Club --</option>
                {clubs.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Select Teams */}
            {assignClubId && (
              <div className="mb-4">
                <label className="block text-light/80 mb-2 font-medium">Select Teams (optional)</label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-white/5 rounded">
                  {(clubs.find(c => c.id === assignClubId)?.teams || []).map(team => (
                    <label
                      key={team.id}
                      className="flex items-center gap-2 p-2 hover:bg-white/10 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={assignTeamIds.includes(team.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignTeamIds([...assignTeamIds, team.id]);
                          } else {
                            setAssignTeamIds(assignTeamIds.filter(id => id !== team.id));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-light">{team.name} ({team.sport || 'Sport'})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleAssignToClubTeam}
                className="flex-1 px-4 py-3 bg-primary hover:bg-primary/80 text-dark rounded font-semibold transition-all"
                disabled={!assignClubId}
              >
                Assign User
              </button>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedUser(null);
                  setAssignClubId('');
                  setAssignTeamIds([]);
                }}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {showRoleModal && roleChangeUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-mid-dark rounded-xl shadow-2xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-light mb-4">
              🔄 Change User Role
            </h2>
            
            <div className="mb-4 p-3 bg-blue-600/20 border border-blue-600/30 rounded">
              <p className="text-light">
                <strong>User:</strong> {roleChangeUser.displayName || roleChangeUser.username || roleChangeUser.email}
              </p>
              <p className="text-light/60 text-sm mt-1">
                Current role: <span className={`font-semibold ${
                  roleChangeUser.role === 'admin' ? 'text-red-400' :
                  roleChangeUser.role === 'trainer' ? 'text-blue-400' :
                  roleChangeUser.role === 'assistant' ? 'text-green-400' :
                  'text-gray-400'
                }`}>{roleChangeUser.role}</span>
              </p>
            </div>

            {/* Role Selection */}
            <div className="mb-6">
              <label className="block text-light/80 mb-3 font-medium">Select New Role *</label>
              <div className="space-y-2">
                {[
                  { value: 'admin', label: 'Admin', icon: '🛡️', color: 'red', desc: 'Full system access' },
                  { value: 'trainer', label: 'Trainer', icon: '👨‍🏫', color: 'blue', desc: 'Can manage clubs and teams' },
                  { value: 'assistant', label: 'Assistant', icon: '🤝', color: 'green', desc: 'Limited management access' },
                  { value: 'user', label: 'User', icon: '👤', color: 'gray', desc: 'Basic member access' },
                ].map(role => (
                  <label
                    key={role.value}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border-2 ${
                      newRole === role.value
                        ? `bg-${role.color}-600/20 border-${role.color}-600/50`
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={role.value}
                      checked={newRole === role.value}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-2xl">{role.icon}</span>
                    <div className="flex-1">
                      <div className="text-light font-semibold">{role.label}</div>
                      <div className="text-light/60 text-xs">{role.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Warning for role changes */}
            {newRole !== roleChangeUser.role && (
              <div className="mb-4 p-3 bg-yellow-600/20 border border-yellow-600/30 rounded">
                <p className="text-yellow-400 text-sm">
                  ⚠️ <strong>Warning:</strong> Changing role from <strong>{roleChangeUser.role}</strong> to <strong>{newRole}</strong> will affect user permissions.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleRoleChange}
                className="flex-1 px-4 py-3 bg-primary hover:bg-primary/80 text-dark rounded font-semibold transition-all"
                disabled={newRole === roleChangeUser.role}
              >
                Change Role
              </button>
              <button
                onClick={() => {
                  setShowRoleModal(false);
                  setRoleChangeUser(null);
                  setNewRole('');
                }}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
