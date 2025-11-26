// src/pages/ClubManagement.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function ClubManagement() {
  const { user, loading: authLoading, listClubsForUser } = useAuth();
  const { showToast } = useToast();

  const [clubs, setClubs] = useState([]);
  const [selectedClubId, setSelectedClubId] = useState('');
  const [clubMembers, setClubMembers] = useState([]);
  const [clubTeams, setClubTeams] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');
  const [loading, setLoading] = useState(true);

  // selection state (can be set by clicking row OR by using the searchable picker below)
  const [selectedMemberId, setSelectedMemberId] = useState('');

  // searchable picker state for removal
  const [removeSearch, setRemoveSearch] = useState('');
  const [removeMatches, setRemoveMatches] = useState([]);
  const [showRemoveDropdown, setShowRemoveDropdown] = useState(false);

  const [newTeamName, setNewTeamName] = useState('');

  // Team assignment modal state
  const [showTeamAssignModal, setShowTeamAssignModal] = useState(false);
  const [userToAssign, setUserToAssign] = useState(null);
  const [selectedTeamsForAssignment, setSelectedTeamsForAssignment] = useState([]);

  const isClubManager = (club) => {
    if (!user || !club) return false;
    if (user.role === ROLES.ADMIN) return true;
    const trainers = club.trainers || [];
    const assistants = club.assistants || [];
    return trainers.includes(user.id) || assistants.includes(user.id);
  };

  const persistClubs = (arr) => {
    localStorage.setItem('clubs', JSON.stringify(arr));
    setClubs(arr);
  };

  const persistUsers = (arr) => {
    localStorage.setItem('users', JSON.stringify(arr));
    setAllUsers(arr);
  };

  useEffect(() => {
    const usersAll = JSON.parse(localStorage.getItem('users') || '[]');
    setAllUsers(usersAll);
    const clubsAll = listClubsForUser ? listClubsForUser() : JSON.parse(localStorage.getItem('clubs') || '[]');
    setClubs(Array.isArray(clubsAll) ? clubsAll : []);
    if (Array.isArray(clubsAll) && clubsAll.length > 0) setSelectedClubId(prev => prev || clubsAll[0].id);
  }, [user, listClubsForUser]);

  const loadClubData = (clubId) => {
    if (!clubId) {
      setClubMembers([]);
      setFilteredMembers([]);
      setClubTeams([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const clubsAll = JSON.parse(localStorage.getItem('clubs') || '[]');
    const usersAll = JSON.parse(localStorage.getItem('users') || '[]');
    const club = clubsAll.find(c => c.id === clubId);
    if (!club) {
      setClubMembers([]);
      setFilteredMembers([]);
      setClubTeams([]);
      setLoading(false);
      return;
    }

    const membersRaw = [
      ...(club.trainers || []).map(id => ({ id, role: ROLES.TRAINER })),
      ...(club.assistants || []).map(id => ({ id, role: ROLES.ASSISTANT })),
      ...(club.members || []).map(id => ({ id, role: ROLES.USER })),
    ];

    const uniqueMembers = Array.from(new Map(membersRaw.map(m => [m.id, m])).values());

    const members = uniqueMembers.map(m => {
      const u = usersAll.find(u => u.id === m.id) || {};
      const teams = club.teams || [];
      const userTeamIds = teams.filter(t => (t.members || []).includes(m.id)).map(t => t.id);
      const userTeamNames = teams.filter(t => (t.members || []).includes(m.id)).map(t => t.name);
      return { ...m, username: u.username || '', email: u.email || '', teamIds: userTeamIds, teamNames: userTeamNames };
    });

    setClubMembers(members);
    setFilteredMembers(members);
    setClubTeams(club.teams || []);
    setSelectedMemberId(''); // clear selection when switching clubs
    setRemoveSearch('');
    setRemoveMatches([]);
    setLoading(false);
  };

  useEffect(() => {
    loadClubData(selectedClubId);
    setSelectedTeamFilter('');
  }, [selectedClubId]);

  useEffect(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    const result = clubMembers.filter(m => {
      const matchesQuery = !q || (m.username && m.username.toLowerCase().includes(q)) || (m.email && m.email.toLowerCase().includes(q));
      if (!matchesQuery) return false;
      if (!selectedTeamFilter) return true;
      if (selectedTeamFilter === 'none') return !(m.teamIds && m.teamIds.length > 0);
      return m.teamIds.includes(selectedTeamFilter);
    });
    setFilteredMembers(result);
  }, [searchQuery, selectedTeamFilter, clubMembers]);

  // update removeMatches when search changes
  useEffect(() => {
    const q = (removeSearch || '').trim().toLowerCase();
    if (!q) {
      setRemoveMatches([]);
      return;
    }
    const matches = clubMembers.filter(m => {
      return (m.username || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q);
    }).slice(0, 20);
    setRemoveMatches(matches);
  }, [removeSearch, clubMembers]);

  /* -------------------- CRUD & actions -------------------- */

  const handleDeleteClub = (clubId) => {
    if (!window.confirm('Delete this club? This cannot be undone.')) return;
    const clubsAll = JSON.parse(localStorage.getItem('clubs') || '[]');
    const updated = clubsAll.filter(c => c.id !== clubId);
    persistClubs(updated);

    const usersAll = JSON.parse(localStorage.getItem('users') || '[]');
    const usersUpdated = usersAll.map(u => {
      const nextClubIds = (u.clubIds || []).filter(id => id !== clubId);
      let nextRole = u.role;
      const remainingClubs = updated;
      const stillTrainer = remainingClubs.some(rc => (rc.trainers || []).includes(u.id));
      const stillAssistant = remainingClubs.some(rc => (rc.assistants || []).includes(u.id));
      if (!stillTrainer && !stillAssistant && nextRole !== ROLES.ADMIN) nextRole = ROLES.USER;
      return { ...u, clubIds: nextClubIds, role: nextRole };
    });
    persistUsers(usersUpdated);

    if (selectedClubId === clubId) setSelectedClubId(updated.length > 0 ? updated[0].id : '');
    setClubs(updated);
    showToast('Club deleted', 'success');
  };

  const handleCreateTeam = () => {
    if (!selectedClubId || !newTeamName.trim()) return showToast('Select club & enter team name', 'error');
    const clubsAll = JSON.parse(localStorage.getItem('clubs') || '[]');
    const cidx = clubsAll.findIndex(c => c.id === selectedClubId);
    if (cidx === -1) return;
    const team = { id: Date.now().toString(), name: newTeamName.trim(), members: [], trainers: [], assistants: [] };
    clubsAll[cidx].teams = [...(clubsAll[cidx].teams || []), team];
    persistClubs(clubsAll);
    setNewTeamName('');
    loadClubData(selectedClubId);
    showToast('Team created', 'success');
  };

  const handleDeleteTeam = (teamId) => {
    if (!selectedClubId) return;
    if (!window.confirm('Delete this team? Users in this team remain in club.')) return;
    const clubsAll = JSON.parse(localStorage.getItem('clubs') || '[]');
    const cidx = clubsAll.findIndex(c => c.id === selectedClubId);
    if (cidx === -1) return;
    clubsAll[cidx].teams = (clubsAll[cidx].teams || []).filter(t => t.id !== teamId);
    persistClubs(clubsAll);
    loadClubData(selectedClubId);
    showToast('Team deleted', 'success');
  };

  const addUserToClub = (userId) => {
    if (!selectedClubId || !userId) return;
    const clubsAll = JSON.parse(localStorage.getItem('clubs') || '[]');
    const usersAll = JSON.parse(localStorage.getItem('users') || '[]');
    const cidx = clubsAll.findIndex(c => c.id === selectedClubId);
    const uidx = usersAll.findIndex(u => u.id === userId);
    if (cidx === -1 || uidx === -1) return;
    const club = clubsAll[cidx];
    if ([...(club.members || []), ...(club.trainers || []), ...(club.assistants || [])].includes(userId)) {
      return showToast('User already in club', 'error');
    }
    club.members = [...(club.members || []), userId];
    usersAll[uidx].clubIds = Array.from(new Set([...(usersAll[uidx].clubIds || []), selectedClubId]));
    persistClubs(clubsAll);
    persistUsers(usersAll);
    loadClubData(selectedClubId);
    setSelectedUserToAdd('');
    showToast('User added to club', 'success');
  };

  // Remove user from CLUB (bottom action)
  const removeUserFromClub = (userId) => {
    if (!selectedClubId) return;
    if (!window.confirm('Remove user from club? This will remove them from all teams and roles in this club.')) return;
    const clubsAll = JSON.parse(localStorage.getItem('clubs') || '[]');
    const usersAll = JSON.parse(localStorage.getItem('users') || '[]');
    const cidx = clubsAll.findIndex(c => c.id === selectedClubId);
    const uidx = usersAll.findIndex(u => u.id === userId);
    if (cidx === -1 || uidx === -1) return;
    const club = clubsAll[cidx];
    club.members = (club.members || []).filter(id => id !== userId);
    club.trainers = (club.trainers || []).filter(id => id !== userId);
    club.assistants = (club.assistants || []).filter(id => id !== userId);
    club.teams = (club.teams || []).map(t => ({ ...t, members: (t.members || []).filter(id => id !== userId) }));
    usersAll[uidx].clubIds = (usersAll[uidx].clubIds || []).filter(id => id !== selectedClubId);

    // update session if needed
    try {
      const cuRaw = localStorage.getItem('currentUser');
      if (cuRaw) {
        const cu = JSON.parse(cuRaw);
        if (cu.id === userId) {
          const updatedCU = { ...cu, clubIds: usersAll[uidx].clubIds || [] };
          localStorage.setItem('currentUser', JSON.stringify(updatedCU));
        }
      }
    } catch (e) {}

    const remainingClubs = clubsAll;
    const stillTrainer = remainingClubs.some(rc => (rc.trainers || []).includes(userId));
    const stillAssistant = remainingClubs.some(rc => (rc.assistants || []).includes(userId));
    if (!stillTrainer && !stillAssistant && usersAll[uidx].role !== ROLES.ADMIN) {
      usersAll[uidx].role = ROLES.USER;
    }

    persistClubs(clubsAll);
    persistUsers(usersAll);
    loadClubData(selectedClubId);
    showToast('User removed from club', 'success');
    if (selectedMemberId === userId) setSelectedMemberId('');
    // clear picker
    setRemoveSearch('');
    setRemoveMatches([]);
  };

  /* -------------------- ROLE MANAGEMENT (promote/demote) -------------------- */

  const promoteToTrainer = (targetUserId) => {
    if (!selectedClubId) return;
    if (!window.confirm('Promote user to Trainer for this club?')) return;
    const clubsAll = JSON.parse(localStorage.getItem('clubs') || '[]');
    const usersAll = JSON.parse(localStorage.getItem('users') || '[]');
    const cidx = clubsAll.findIndex(c => c.id === selectedClubId);
    if (cidx === -1) return;
    const club = clubsAll[cidx];
    club.trainers = Array.from(new Set([...(club.trainers || []), targetUserId]));
    club.assistants = (club.assistants || []).filter(id => id !== targetUserId);
    club.members = (club.members || []).filter(id => id !== targetUserId);
    const uidx = usersAll.findIndex(u => u.id === targetUserId);
    if (uidx !== -1) {
      usersAll[uidx].clubIds = Array.from(new Set([...(usersAll[uidx].clubIds || []), selectedClubId]));
      if (usersAll[uidx].role !== ROLES.ADMIN) usersAll[uidx].role = ROLES.TRAINER;
    }
    persistClubs(clubsAll);
    persistUsers(usersAll);
    loadClubData(selectedClubId);
    showToast('User promoted to Trainer', 'success');
  };

  const promoteToAssistant = (targetUserId) => {
    if (!selectedClubId) return;
    if (!window.confirm('Promote user to Assistant for this club?')) return;
    const clubsAll = JSON.parse(localStorage.getItem('clubs') || '[]');
    const usersAll = JSON.parse(localStorage.getItem('users') || '[]');
    const cidx = clubsAll.findIndex(c => c.id === selectedClubId);
    if (cidx === -1) return;
    const club = clubsAll[cidx];
    club.assistants = Array.from(new Set([...(club.assistants || []), targetUserId]));
    club.trainers = (club.trainers || []).filter(id => id !== targetUserId);
    club.members = (club.members || []).filter(id => id !== targetUserId);
    const uidx = usersAll.findIndex(u => u.id === targetUserId);
    if (uidx !== -1) {
      usersAll[uidx].clubIds = Array.from(new Set([...(usersAll[uidx].clubIds || []), selectedClubId]));
      if (usersAll[uidx].role !== ROLES.ADMIN) usersAll[uidx].role = ROLES.ASSISTANT;
    }
    persistClubs(clubsAll);
    persistUsers(usersAll);
    loadClubData(selectedClubId);
    showToast('User promoted to Assistant', 'success');
  };

  const demoteToUser = (targetUserId) => {
    if (!selectedClubId) return;
    if (!window.confirm('Demote user to regular User for this club?')) return;
    const clubsAll = JSON.parse(localStorage.getItem('clubs') || '[]');
    const usersAll = JSON.parse(localStorage.getItem('users') || '[]');
    const cidx = clubsAll.findIndex(c => c.id === selectedClubId);
    if (cidx === -1) return;
    const club = clubsAll[cidx];
    club.trainers = (club.trainers || []).filter(id => id !== targetUserId);
    club.assistants = (club.assistants || []).filter(id => id !== targetUserId);
    club.members = Array.from(new Set([...(club.members || []), targetUserId]));
    const uidx = usersAll.findIndex(u => u.id === targetUserId);
    if (uidx !== -1) {
      const remainingClubs = clubsAll;
      const stillTrainer = remainingClubs.some(rc => (rc.trainers || []).includes(targetUserId));
      const stillAssistant = remainingClubs.some(rc => (rc.assistants || []).includes(targetUserId));
      if (!stillTrainer && !stillAssistant && usersAll[uidx].role !== ROLES.ADMIN) {
        usersAll[uidx].role = ROLES.USER;
      }
    }
    persistClubs(clubsAll);
    persistUsers(usersAll);
    loadClubData(selectedClubId);
    showToast('User demoted to User (club-level)', 'success');
  };

  const demoteTrainerToAssistant = (targetUserId) => {
    if (!selectedClubId) return;
    if (!window.confirm('Demote Trainer to Assistant for this club?')) return;
    const clubsAll = JSON.parse(localStorage.getItem('clubs') || '[]');
    const usersAll = JSON.parse(localStorage.getItem('users') || '[]');
    const cidx = clubsAll.findIndex(c => c.id === selectedClubId);
    if (cidx === -1) return;
    const club = clubsAll[cidx];
    club.trainers = (club.trainers || []).filter(id => id !== targetUserId);
    club.assistants = Array.from(new Set([...(club.assistants || []), targetUserId]));
    club.members = (club.members || []).filter(id => id !== targetUserId);
    const uidx = usersAll.findIndex(u => u.id === targetUserId);
    if (uidx !== -1) {
      const stillTrainer = clubsAll.some(rc => (rc.trainers || []).includes(targetUserId));
      if (!stillTrainer && usersAll[uidx].role !== ROLES.ADMIN) {
        usersAll[uidx].role = ROLES.ASSISTANT;
      }
    }
    persistClubs(clubsAll);
    persistUsers(usersAll);
    loadClubData(selectedClubId);
    showToast('Trainer demoted to Assistant', 'success');
  };

  const demoteAssistantToUser = (targetUserId) => {
    if (!selectedClubId) return;
    if (!window.confirm('Demote Assistant to regular User for this club?')) return;
    const clubsAll = JSON.parse(localStorage.getItem('clubs') || '[]');
    const usersAll = JSON.parse(localStorage.getItem('users') || '[]');
    const cidx = clubsAll.findIndex(c => c.id === selectedClubId);
    if (cidx === -1) return;
    const club = clubsAll[cidx];
    club.assistants = (club.assistants || []).filter(id => id !== targetUserId);
    club.trainers = (club.trainers || []).filter(id => id !== targetUserId);
    club.members = Array.from(new Set([...(club.members || []), targetUserId]));
    const uidx = usersAll.findIndex(u => u.id === targetUserId);
    if (uidx !== -1) {
      const stillTrainer = clubsAll.some(rc => (rc.trainers || []).includes(targetUserId));
      const stillAssistant = clubsAll.some(rc => (rc.assistants || []).includes(targetUserId));
      if (!stillTrainer && !stillAssistant && usersAll[uidx].role !== ROLES.ADMIN) {
        usersAll[uidx].role = ROLES.USER;
      }
    }
    persistClubs(clubsAll);
    persistUsers(usersAll);
    loadClubData(selectedClubId);
    showToast('Assistant demoted to User', 'success');
  };

  /* -------------------- TEAM membership actions -------------------- */

  // Remove user from specific team:
  // - if user in 0 teams -> alert
  // - if in 1 team -> remove from that team
  // - if in multiple -> prompt index selection
  const removeUserFromTeam = (userId) => {
    if (!selectedClubId) return;
    const clubsAll = JSON.parse(localStorage.getItem('clubs') || '[]');
    const cidx = clubsAll.findIndex(c => c.id === selectedClubId);
    if (cidx === -1) return;
    const club = clubsAll[cidx];
    const teams = club.teams || [];
    const userTeams = teams.filter(t => (t.members || []).includes(userId));
    if (!userTeams || userTeams.length === 0) {
      return showToast('User is not in any team', 'error');
    }
    if (userTeams.length === 1) {
      if (!window.confirm(`Remove ${userTeams[0].name} membership from this user?`)) return;
      const tid = userTeams[0].id;
      club.teams = teams.map(t => (t.id === tid ? { ...t, members: (t.members || []).filter(id => id !== userId) } : t));
      persistClubs(clubsAll);
      loadClubData(selectedClubId);
      return showToast('User removed from team', 'success');
    }
    // multiple teams -> prompt to pick
    const list = userTeams.map((t, i) => `${i + 1}) ${t.name}`).join('\n');
    const pick = window.prompt(`User is in multiple teams:\n${list}\nEnter number to remove:`);
    if (!pick) return;
    const idx = parseInt(pick, 10) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= userTeams.length) {
      return showToast('Invalid selection', 'error');
    }
    const tid = userTeams[idx].id;
    if (!window.confirm(`Remove "${userTeams[idx].name}" membership from this user?`)) return;
    club.teams = teams.map(t => (t.id === tid ? { ...t, members: (t.members || []).filter(id => id !== userId) } : t));
    persistClubs(clubsAll);
    loadClubData(selectedClubId);
    showToast('User removed from team', 'success');
  };

  // Open team assignment modal
  const openTeamAssignModal = (userId) => {
    if (!selectedClubId) return;
    const clubsAll = JSON.parse(localStorage.getItem('clubs') || '[]');
    const club = clubsAll.find(c => c.id === selectedClubId);
    if (!club) return;
    
    const userObj = allUsers.find(u => u.id === userId);
    if (!userObj) return;
    
    // Get teams user is already in
    const teams = club.teams || [];
    const userTeamIds = teams
      .filter(t => (t.members || []).includes(userId))
      .map(t => t.id);
    
    setUserToAssign(userObj);
    setSelectedTeamsForAssignment(userTeamIds);
    setShowTeamAssignModal(true);
  };

  // Toggle team selection in modal
  const toggleTeamSelection = (teamId) => {
    setSelectedTeamsForAssignment(prev => {
      if (prev.includes(teamId)) {
        return prev.filter(id => id !== teamId);
      } else {
        return [...prev, teamId];
      }
    });
  };

  // Save team assignments
  const saveTeamAssignments = () => {
    if (!selectedClubId || !userToAssign) return;
    
    const clubsAll = JSON.parse(localStorage.getItem('clubs') || '[]');
    const cidx = clubsAll.findIndex(c => c.id === selectedClubId);
    if (cidx === -1) return;
    
    const club = clubsAll[cidx];
    const teams = club.teams || [];
    
    // Update each team's members array
    club.teams = teams.map(team => {
      const shouldBeInTeam = selectedTeamsForAssignment.includes(team.id);
      const isInTeam = (team.members || []).includes(userToAssign.id);
      
      if (shouldBeInTeam && !isInTeam) {
        // Add user to team
        return { ...team, members: [...(team.members || []), userToAssign.id] };
      } else if (!shouldBeInTeam && isInTeam) {
        // Remove user from team
        return { ...team, members: (team.members || []).filter(id => id !== userToAssign.id) };
      }
      
      return team;
    });
    
    persistClubs(clubsAll);
    loadClubData(selectedClubId);
    setShowTeamAssignModal(false);
    setUserToAssign(null);
    setSelectedTeamsForAssignment([]);
    showToast('Team assignments updated successfully', 'success');
  };

  if (authLoading) return <div className="p-6">Loading…</div>;
  if (!user) return <div className="p-6 text-red-600">Please login</div>;

  return (
    <div className="flex flex-col min-h-screen p-6 bg-gray-50">
      <div className="flex-1 overflow-auto">
        <h1 className="text-2xl font-bold mb-4">Club Management</h1>

        {/* Club selector */}
        <div className="mb-4 flex flex-col md:flex-row md:gap-4 md:items-center">
          <div>
            <label className="block mb-1 font-medium">Select Club</label>
            <select
              value={selectedClubId}
              onChange={e => setSelectedClubId(e.target.value)}
              className="border p-2 rounded"
            >
              <option value="">-- Select club --</option>
              {clubs.map(c => <option key={c.id} value={c.id}>{c.name} {c.clubNumber ? `(${c.clubNumber})` : ''}</option>)}
            </select>
          </div>
        </div>

        {/* Create team */}
        {selectedClubId && isClubManager(clubs.find(c => c.id === selectedClubId)) && (
          <div className="mb-6 bg-white p-4 rounded shadow max-w-md">
            <h2 className="font-semibold mb-2">Create Team</h2>
            <div className="flex gap-2">
              <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Team name" className="border p-2 rounded flex-1" />
              <button onClick={handleCreateTeam} className="px-4 py-2 bg-blue-600 text-white rounded">Create</button>
            </div>
          </div>
        )}

        {/* Teams list */}
        {selectedClubId && clubTeams.length > 0 && (
          <div className="mb-6 max-w-md">
            <h2 className="font-semibold mb-2">Teams</h2>
            <ul>
              {clubTeams.map(t => (
                <li key={t.id} className="flex justify-between items-center mb-1">
                  <span>{t.name}</span>
                  {isClubManager(clubs.find(c => c.id === selectedClubId)) && (
                    <button onClick={() => handleDeleteTeam(t.id)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm">Delete</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Add user */}
        {selectedClubId && isClubManager(clubs.find(c => c.id === selectedClubId)) && (
          <div className="mb-6 bg-white p-4 rounded shadow max-w-2xl">
            <h2 className="font-semibold mb-2">Add User</h2>
            <div className="flex gap-2">
              <select value={selectedUserToAdd} onChange={e => setSelectedUserToAdd(e.target.value)} className="border p-2 rounded flex-1">
                <option value="">-- Select user --</option>
                {allUsers.filter(u => !(clubMembers || []).some(m => m.id === u.id)).map(u => <option key={u.id} value={u.id}>{u.username || u.email}</option>)}
              </select>
              <button onClick={() => addUserToClub(selectedUserToAdd)} className="px-4 py-2 bg-green-600 text-white rounded">Add</button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-4 max-w-2xl">
          <input type="text" placeholder="Search members by username or email" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="border p-2 rounded w-full" />
        </div>

        {/* Team filter */}
        <div className="mb-4 max-w-md">
          <label className="block mb-1 font-medium">Filter by Team</label>
          <select value={selectedTeamFilter} onChange={e => setSelectedTeamFilter(e.target.value)} className="border p-2 rounded w-full">
            <option value="">All</option>
            <option value="none">No team</option>
            {clubTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Members table (click row to select) */}
        <div className="max-w-6xl mb-6">
          {loading ? (
            <p>Loading members…</p>
          ) : (
            <table className="w-full bg-white border rounded shadow">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border text-left">Username</th>
                  <th className="p-2 border text-left">Email</th>
                  <th className="p-2 border text-left">Role</th>
                  <th className="p-2 border text-left">Teams</th>
                  <th className="p-2 border text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-gray-500">No members found.</td>
                  </tr>
                ) : filteredMembers.map(m => {
                  const isSelected = selectedMemberId === m.id;
                  return (
                    <tr
                      key={m.id}
                      onClick={() => {
                        setSelectedMemberId(m.id);
                        setRemoveSearch('');
                        setRemoveMatches([]);
                      }}
                      className={`${isSelected ? 'bg-blue-50' : ''} cursor-pointer`}
                    >
                      <td className="p-2 border">{m.username || '—'}</td>
                      <td className="p-2 border">{m.email || '—'}</td>
                      <td className="p-2 border">{m.role}</td>
                      <td className="p-2 border">
                        {(m.teamNames || []).length === 0 ? '—' : (
                          <div className="flex flex-wrap gap-2">
                            {(m.teamNames || []).map((tName, idx) => (
                              <span key={`${m.id}-t-${idx}`} className="inline-flex items-center gap-2 bg-gray-100 px-2 py-1 rounded text-sm">
                                {tName}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-2 border space-x-1">
                        {isClubManager(clubs.find(c => c.id === selectedClubId)) ? (
                          <>
                            {m.id !== user.id && (
                              <>
                                {/* Promote buttons */}
                                {m.role !== ROLES.TRAINER && m.role !== ROLES.ASSISTANT && (
                                  <button
                                    onClick={(ev) => { ev.stopPropagation(); promoteToTrainer(m.id); }}
                                    className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                                  >
                                    ⬆️ Trainer
                                  </button>
                                )}
                                {m.role !== ROLES.TRAINER && m.role !== ROLES.ASSISTANT && (
                                  <button
                                    onClick={(ev) => { ev.stopPropagation(); promoteToAssistant(m.id); }}
                                    className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                                  >
                                    ⬆️ Assistant
                                  </button>
                                )}
                                {m.role === ROLES.ASSISTANT && (
                                  <button
                                    onClick={(ev) => { ev.stopPropagation(); promoteToTrainer(m.id); }}
                                    className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                                  >
                                    ⬆️ Trainer
                                  </button>
                                )}
                                
                                {/* Demote buttons - granular options */}
                                {m.role === ROLES.TRAINER && (
                                  <>
                                    <button
                                      onClick={(ev) => { ev.stopPropagation(); demoteTrainerToAssistant(m.id); }}
                                      className="px-2 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
                                    >
                                      ⬇️ to Assistant
                                    </button>
                                    <button
                                      onClick={(ev) => { ev.stopPropagation(); demoteToUser(m.id); }}
                                      className="px-2 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600"
                                    >
                                      ⬇️ to User
                                    </button>
                                  </>
                                )}
                                {m.role === ROLES.ASSISTANT && (
                                  <button
                                    onClick={(ev) => { ev.stopPropagation(); demoteAssistantToUser(m.id); }}
                                    className="px-2 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600"
                                  >
                                    ⬇️ to User
                                  </button>
                                )}
                                {/* Remove from Team button (per-row) */}
                                <button
                                  onClick={(ev) => { ev.stopPropagation(); removeUserFromTeam(m.id); }}
                                  className="px-2 py-1 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300"
                                >
                                  ❌ Remove from Team
                                </button>
                                {/* Assign to Team button */}
                                <button
                                  onClick={(ev) => { ev.stopPropagation(); openTeamAssignModal(m.id); }}
                                  className="px-2 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                                >
                                  📋 Assign to Team
                                </button>
                              </>
                            )}
                            {m.id === user.id && <span className="text-gray-500">You</span>}
                          </>
                        ) : (
                          <span className="text-xs text-gray-500">No actions</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Bottom actions area: searchable picker + Remove selected user + Delete club */}
      <div className="mt-4">
        {selectedClubId && isClubManager(clubs.find(c => c.id === selectedClubId)) && (
          <div className="mb-3 max-w-2xl">
            <div className="bg-white p-4 rounded shadow">
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Find member to remove</label>
                <input
                  value={removeSearch}
                  onChange={e => {
                    setRemoveSearch(e.target.value);
                    setShowRemoveDropdown(true);
                  }}
                  onFocus={() => setShowRemoveDropdown(true)}
                  onBlur={() => setTimeout(() => setShowRemoveDropdown(false), 150)} // small delay to allow click
                  placeholder="Type username or email..."
                  className="border p-2 rounded w-full"
                />
                {showRemoveDropdown && removeMatches.length > 0 && (
                  <ul className="border rounded mt-1 max-h-48 overflow-auto bg-white shadow z-20">
                    {removeMatches.map(m => (
                      <li
                        key={m.id}
                        onMouseDown={(ev) => { // use mouseDown so it fires before blur
                          ev.preventDefault();
                          setSelectedMemberId(m.id);
                          setRemoveSearch('');
                          setRemoveMatches([]);
                          setShowRemoveDropdown(false);
                        }}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                      >
                        <div className="text-sm font-medium">{m.username || '—'}</div>
                        <div className="text-xs text-gray-500">{m.email || '—'}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm">Selected member: <strong>{(clubMembers.find(m => m.id === selectedMemberId)?.username) || selectedMemberId || '—'}</strong></div>
                  <div className="text-xs text-gray-500">You can select a row or pick a member with the search above.</div>
                </div>
<div className="flex gap-2">
  <button
    onClick={() => {
      if (!selectedMemberId) return showToast('Please select a member first', 'error');
      if (selectedMemberId === user.id) return showToast('You cannot remove yourself here', 'error');
      removeUserFromClub(selectedMemberId);
    }}
    className="px-4 py-2 bg-red-600 text-white rounded"
  >
    Remove selected user from Club
  </button>

  <button
    onClick={() => {
      setSelectedMemberId('');
      setRemoveSearch('');
      setRemoveMatches([]);
      setShowRemoveDropdown(false);
      showToast('Removal cancelled', 'info');
    }}
    className="px-4 py-2 bg-gray-300 text-gray-800 rounded"
  >
    Cancel
  </button>
</div>

              </div>
            </div>
          </div>
        )}

        {/* Delete club button at the very bottom */}
        {selectedClubId && isClubManager(clubs.find(c => c.id === selectedClubId)) && (
          <div className="mt-6">
            <button
              onClick={() => handleDeleteClub(selectedClubId)}
              className="w-full px-4 py-3 bg-red-600 text-white rounded shadow-lg hover:bg-red-700 transition"
            >
              Delete Club
            </button>
          </div>
        )}
      </div>

      {/* Team Assignment Modal */}
      {showTeamAssignModal && userToAssign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              📋 Assign Teams
            </h2>
            
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <strong>User:</strong> {userToAssign.username || 'Unknown'}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Select which teams this user should belong to
              </p>
            </div>

            {/* Team List */}
            <div className="space-y-2 mb-6">
              {clubTeams.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No teams in this club yet. Create a team first.
                </p>
              ) : (
                clubTeams.map(team => (
                  <label
                    key={team.id}
                    className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50 cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTeamsForAssignment.includes(team.id)}
                      onChange={() => toggleTeamSelection(team.id)}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{team.name}</div>
                      <div className="text-xs text-gray-500">
                        {team.sport || 'Sport'} • {(team.members || []).length} members
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={saveTeamAssignments}
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition"
                disabled={clubTeams.length === 0}
              >
                Save Assignments
              </button>
              <button
                onClick={() => {
                  setShowTeamAssignModal(false);
                  setUserToAssign(null);
                  setSelectedTeamsForAssignment([]);
                }}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition"
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
