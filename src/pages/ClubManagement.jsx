// src/pages/ClubManagement.jsx
import { useEffect, useState, useMemo } from 'react';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getAllClubs, getClub, getAllUsers, updateClub, updateUser } from '../firebase/firestore';
import {
  canPromoteToTrainer,
  canPromoteToAssistant,
  canDemoteUser,
  canRemoveFromClub,
  canRemoveFromTeam,
  isClubOwner
} from '../utils/permissions';

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

  // selection state
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

  // Remove from teams modal state
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [userToRemove, setUserToRemove] = useState(null);
  const [teamsToRemoveFrom, setTeamsToRemoveFrom] = useState([]);

  // Quick assign to team modal state
  const [showQuickAssignModal, setShowQuickAssignModal] = useState(false);
  const [teamToAssign, setTeamToAssign] = useState(null);
  const [quickAssignSearch, setQuickAssignSearch] = useState('');
  const [quickAssignMatches, setQuickAssignMatches] = useState([]);

  // Create Team modal state
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);

  // Team action dropdown state
  const [teamActionDropdown, setTeamActionDropdown] = useState(null);

  // Rename Team modal state
  const [showRenameTeamModal, setShowRenameTeamModal] = useState(false);
  const [teamToRename, setTeamToRename] = useState(null);
  const [renameTeamName, setRenameTeamName] = useState('');

  // Team trainer filter
  const [teamTrainerFilter, setTeamTrainerFilter] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState('management'); // management, requests, statistics

  // Statistics tab state
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [trainerSearchQuery, setTrainerSearchQuery] = useState('');

  const isClubManager = (club) => {
    if (!user || !club) return false;
    if (user.role === ROLES.ADMIN || user.isSuperAdmin) return true;
    const trainers = club.trainers || [];
    const assistants = club.assistants || [];
    return trainers.includes(user.id) || assistants.includes(user.id);
  };

  // Load clubs and users from Firebase
  useEffect(() => {
    loadInitialData();
  }, [user]);

  async function loadInitialData() {
    try {
      // Load users
      const usersAll = await getAllUsers();
      setAllUsers(usersAll);

      // Load clubs - SuperAdmin sees all, others see their clubs
      let clubsAll = [];
      if (user?.isSuperAdmin === true) {
        clubsAll = await getAllClubs();
      } else {
        clubsAll = listClubsForUser ? await listClubsForUser() : [];
      }
      
      setClubs(Array.isArray(clubsAll) ? clubsAll : []);
      if (Array.isArray(clubsAll) && clubsAll.length > 0) {
        setSelectedClubId(prev => prev || clubsAll[0].id);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      setClubs([]);
      setAllUsers([]);
    }
  }

  // Load club data when selected club changes
  const loadClubData = async (clubId) => {
    if (!clubId) {
      setClubMembers([]);
      setFilteredMembers([]);
      setClubTeams([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Get club from Firebase
      const club = await getClub(clubId);
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
        const u = allUsers.find(u => u.id === m.id) || {};
        const teams = club.teams || [];
        const userTeamIds = teams.filter(t => (t.members || []).includes(m.id)).map(t => t.id);
        const userTeamNames = teams.filter(t => (t.members || []).includes(m.id)).map(t => t.name);
        return { ...m, username: u.username || '', email: u.email || '', teamIds: userTeamIds, teamNames: userTeamNames };
      });

      setClubMembers(members);
      setFilteredMembers(members);
      setClubTeams(club.teams || []);
      setSelectedMemberId('');
      setRemoveSearch('');
      setRemoveMatches([]);
      setLoading(false);
    } catch (error) {
      console.error('Error loading club data:', error);
      setClubMembers([]);
      setFilteredMembers([]);
      setClubTeams([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClubData(selectedClubId);
    setSelectedTeamFilter('');
  }, [selectedClubId, allUsers]);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setTeamActionDropdown(null);
    if (teamActionDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [teamActionDropdown]);

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

  const handleDeleteClub = async (clubId) => {
    if (!window.confirm('Delete this club? This cannot be undone.')) return;
    try {
      const { deleteClub } = await import('../firebase/firestore');
      await deleteClub(clubId);
      showToast('Club deleted successfully', 'success');
      await loadInitialData(); // Reload clubs
      setSelectedClubId('');
    } catch (error) {
      console.error('Error deleting club:', error);
      showToast('Failed to delete club', 'error');
    }
  };

  const handleRemoveMember = async (member) => {
    if (!selectedClubId || !member) return;
    
    // Get teams user is in
    const club = clubs.find(c => c.id === selectedClubId);
    if (!club) return;
    
    const userTeams = (club.teams || []).filter(team => 
      (team.members || []).includes(member.id) ||
      (team.trainers || []).includes(member.id) ||
      (team.assistants || []).includes(member.id)
    );
    
    if (userTeams.length === 0) {
      return showToast('User is not in any teams', 'info');
    }
    
    // Open modal to select teams
    setUserToRemove(member);
    setTeamsToRemoveFrom([]);
    setShowRemoveModal(true);
  };

  const confirmRemoveFromTeams = async () => {
    if (!userToRemove || teamsToRemoveFrom.length === 0) {
      return showToast('Please select at least one team', 'error');
    }
    
    try {
      const club = await getClub(selectedClubId);
      if (!club) return;

      // Remove from selected teams only
      const updatedClub = {
        teams: (club.teams || []).map(team => {
          if (teamsToRemoveFrom.includes(team.id)) {
            return {
              ...team,
              members: (team.members || []).filter(id => id !== userToRemove.id),
              trainers: (team.trainers || []).filter(id => id !== userToRemove.id),
              assistants: (team.assistants || []).filter(id => id !== userToRemove.id)
            };
          }
          return team;
        })
      };

      await updateClub(selectedClubId, updatedClub);
      showToast(`Removed from ${teamsToRemoveFrom.length} team(s)`, 'success');
      setShowRemoveModal(false);
      setUserToRemove(null);
      setTeamsToRemoveFrom([]);
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error removing member:', error);
      showToast('Failed to remove member from teams', 'error');
    }
  };

  const toggleTeamForRemoval = (teamId) => {
    setTeamsToRemoveFrom(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const selectAllTeamsForRemoval = () => {
    const club = clubs.find(c => c.id === selectedClubId);
    if (!club || !userToRemove) return;
    
    const userTeams = (club.teams || []).filter(team => 
      (team.members || []).includes(userToRemove.id) ||
      (team.trainers || []).includes(userToRemove.id) ||
      (team.assistants || []).includes(userToRemove.id)
    );
    
    setTeamsToRemoveFrom(userTeams.map(t => t.id));
  };

  const openQuickAssignModal = (team) => {
    setTeamToAssign(team);
    setQuickAssignSearch('');
    setQuickAssignMatches([]);
    setShowQuickAssignModal(true);
  };

  const handleQuickAssignSearch = (value) => {
    setQuickAssignSearch(value);
    if (value.trim().length < 2) {
      setQuickAssignMatches([]);
      return;
    }

    const matches = clubMembers.filter(m => 
      (m.username?.toLowerCase().includes(value.toLowerCase()) ||
       m.email?.toLowerCase().includes(value.toLowerCase())) &&
      !(teamToAssign.members || []).includes(m.id)
    ).slice(0, 5);
    
    setQuickAssignMatches(matches);
  };

  const quickAssignToTeam = async (userId) => {
    if (!selectedClubId || !teamToAssign) return;

    try {
      const club = await getClub(selectedClubId);
      if (!club) return;

      const updatedTeams = (club.teams || []).map(t => {
        if (t.id === teamToAssign.id) {
          return {
            ...t,
            members: [...new Set([...(t.members || []), userId])]
          };
        }
        return t;
      });

      await updateClub(selectedClubId, { teams: updatedTeams });
      showToast('User added to team', 'success');
      setShowQuickAssignModal(false);
      setQuickAssignSearch('');
      setQuickAssignMatches([]);
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error assigning to team:', error);
      showToast('Failed to assign user', 'error');
    }
  };

  const handleRenameTeam = async () => {
    if (!selectedClubId || !teamToRename || !renameTeamName.trim()) {
      showToast('Please enter a team name', 'error');
      return;
    }

    try {
      const club = await getClub(selectedClubId);
      if (!club) return;

      const updatedTeams = (club.teams || []).map(t => 
        t.id === teamToRename.id 
          ? { ...t, name: renameTeamName.trim() }
          : t
      );

      await updateClub(selectedClubId, { teams: updatedTeams });
      showToast('Team renamed successfully', 'success');
      setShowRenameTeamModal(false);
      setTeamToRename(null);
      setRenameTeamName('');
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error renaming team:', error);
      showToast('Failed to rename team', 'error');
    }
  };

  const handleLeaveClub = async () => {
    if (!selectedClubId) return;
    
    const selectedClub = clubs.find(c => c.id === selectedClubId);
    if (!selectedClub) return;
    
    // Can't leave if you're the owner
    if (isClubOwner(user, selectedClub)) {
      return showToast('Club owners cannot leave. Transfer ownership first.', 'error');
    }
    
    if (!window.confirm(`Are you sure you want to leave ${selectedClub.name}?`)) return;
    
    try {
      const club = await getClub(selectedClubId);
      const updatedMembers = (club.members || []).filter(id => id !== user.id);
      const updatedTrainers = (club.trainers || []).filter(id => id !== user.id);
      const updatedAssistants = (club.assistants || []).filter(id => id !== user.id);
      
      // Remove from all teams
      const updatedTeams = (club.teams || []).map(team => ({
        ...team,
        members: (team.members || []).filter(id => id !== user.id),
        trainers: (team.trainers || []).filter(id => id !== user.id),
        assistants: (team.assistants || []).filter(id => id !== user.id)
      }));
      
      await updateClub(selectedClubId, {
        members: updatedMembers,
        trainers: updatedTrainers,
        assistants: updatedAssistants,
        teams: updatedTeams
      });
      
      showToast('Left club successfully', 'success');
      setSelectedClubId('');
      await loadInitialData();
    } catch (error) {
      console.error('Error leaving club:', error);
      showToast('Failed to leave club', 'error');
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    if (!selectedClubId) return;
    
    try {
      // Update user's role in Firebase
      await updateUser(userId, { role: newRole });
      
      showToast(`Role updated to ${newRole}`, 'success');
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error changing role:', error);
      showToast('Failed to change role', 'error');
    }
  };

  const handlePromoteToTrainer = async (memberId) => {
    if (!selectedClubId || !memberId) return;
    
    try {
      const club = await getClub(selectedClubId);
      if (!club) return;

      const updatedClub = {
        trainers: [...new Set([...(club.trainers || []), memberId])],
        assistants: (club.assistants || []).filter(id => id !== memberId),
        members: (club.members || []).filter(id => id !== memberId)
      };

      await updateClub(selectedClubId, updatedClub);
      showToast('Member promoted to trainer', 'success');
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error promoting member:', error);
      showToast('Failed to promote member', 'error');
    }
  };

  const handleDemoteToMember = async (memberId) => {
    if (!selectedClubId || !memberId) return;
    
    try {
      const club = await getClub(selectedClubId);
      if (!club) return;

      const updatedClub = {
        trainers: (club.trainers || []).filter(id => id !== memberId),
        assistants: (club.assistants || []).filter(id => id !== memberId),
        members: [...new Set([...(club.members || []), memberId])]
      };

      await updateClub(selectedClubId, updatedClub);
      showToast('Member demoted to regular member', 'success');
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error demoting member:', error);
      showToast('Failed to demote member', 'error');
    }
  };

  const handleCreateTeam = async () => {
    if (!selectedClubId || !newTeamName.trim()) {
      showToast('Please enter a team name', 'error');
      return;
    }
    
    try {
      const club = await getClub(selectedClubId);
      if (!club) return;

      const newTeam = {
        id: `team_${Date.now()}`,
        name: newTeamName.trim(),
        members: [],
        trainers: [user.id], // Creator is automatically trainer
        assistants: []
      };

      const updatedClub = {
        teams: [...(club.teams || []), newTeam]
      };

      await updateClub(selectedClubId, updatedClub);
      showToast('Team created successfully! You are now a trainer.', 'success');
      setNewTeamName('');
      setShowCreateTeamModal(false);
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error creating team:', error);
      showToast('Failed to create team', 'error');
    }
  };

  const handleAssignToTeams = async () => {
    if (!userToAssign || selectedTeamsForAssignment.length === 0) return;
    
    try {
      const club = await getClub(selectedClubId);
      if (!club) return;

      const updatedTeams = (club.teams || []).map(team => {
        if (selectedTeamsForAssignment.includes(team.id)) {
          return {
            ...team,
            members: [...new Set([...(team.members || []), userToAssign.id])]
          };
        }
        return team;
      });

      await updateClub(selectedClubId, { teams: updatedTeams });
      showToast('Member assigned to teams', 'success');
      setShowTeamAssignModal(false);
      setUserToAssign(null);
      setSelectedTeamsForAssignment([]);
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error assigning to teams:', error);
      showToast('Failed to assign to teams', 'error');
    }
  };

  const handleRemoveFromTeam = async (memberId, teamId) => {
    if (!selectedClubId) return;
    
    try {
      const club = await getClub(selectedClubId);
      if (!club) return;

      const updatedTeams = (club.teams || []).map(team => {
        if (team.id === teamId) {
          return {
            ...team,
            members: (team.members || []).filter(id => id !== memberId),
            trainers: (team.trainers || []).filter(id => id !== memberId),
            assistants: (team.assistants || []).filter(id => id !== memberId)
          };
        }
        return team;
      });

      await updateClub(selectedClubId, { teams: updatedTeams });
      showToast('Member removed from team', 'success');
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error removing from team:', error);
      showToast('Failed to remove from team', 'error');
    }
  };

  if (authLoading) {
    return <div className="p-6 text-light">Loading...</div>;
  }

  if (!user) {
    return <div className="p-6 text-light">Please sign in</div>;
  }

  return (
    <div className="flex flex-col min-h-screen p-6">
      <div className="flex-1 overflow-auto">
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-6xl md:text-7xl text-light mb-2 tracking-wider">
            <span className="text-primary">CLUB</span> MANAGEMENT
          </h1>
          <p className="text-light/60 text-lg">Manage your club members and teams</p>
        </div>

        {/* Club selector */}
        <div className="mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <label className="block mb-2 text-light/80 font-medium">Select Club</label>
          <select
            value={selectedClubId}
            onChange={e => setSelectedClubId(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          >
            <option value="" className="bg-mid-dark">-- Select club --</option>
            {clubs.map(c => (
              <option key={c.id} value={c.id} className="bg-mid-dark">
                {c.name} {c.clubNumber ? `(${c.clubNumber})` : ''}
              </option>
            ))}
          </select>

          {/* Create Team Button - Below Select Club */}
          {selectedClubId && isClubManager(clubs.find(c => c.id === selectedClubId)) && (
            <button
              onClick={() => setShowCreateTeamModal(true)}
              className="mt-3 px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2"
            >
              <span>+</span>
              <span>Create Team</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        {selectedClubId && (
          <div className="mb-6">
            <div className="flex gap-2 border-b border-white/10">
              <button
                onClick={() => setActiveTab('management')}
                className={`px-6 py-3 font-medium transition-all ${
                  activeTab === 'management'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-light/60 hover:text-light'
                }`}
              >
                Management
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`px-6 py-3 font-medium transition-all ${
                  activeTab === 'requests'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-light/60 hover:text-light'
                }`}
              >
                Pending Requests
              </button>
              <button
                onClick={() => setActiveTab('statistics')}
                className={`px-6 py-3 font-medium transition-all ${
                  activeTab === 'statistics'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-light/60 hover:text-light'
                }`}
              >
                Statistics
              </button>
            </div>
          </div>
        )}

        {selectedClubId && activeTab === 'management' && (
          <>
            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search members by username or email"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all w-full"
              />
            </div>

            {/* Filter by Team */}
            <div className="mb-4 flex items-center gap-2">
              <label className="text-light/80">Filter by Team:</label>
              <select
                value={selectedTeamFilter}
                onChange={e => setSelectedTeamFilter(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="" className="bg-mid-dark">All</option>
                <option value="none" className="bg-mid-dark">No team</option>
                {clubTeams.map(t => (
                  <option key={t.id} value={t.id} className="bg-mid-dark">{t.name}</option>
                ))}
              </select>
            </div>

            {/* Members Table */}
            <div className="overflow-x-auto bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-1">
              {loading ? (
                <div className="py-8 text-center text-light/60">Loading members...</div>
              ) : filteredMembers.length === 0 ? (
                <div className="py-8 text-center text-light/40">No members found.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-left text-light font-semibold">Username</th>
                      <th className="px-4 py-3 text-left text-light font-semibold">Email</th>
                      <th className="px-4 py-3 text-left text-light font-semibold">Role</th>
                      <th className="px-4 py-3 text-left text-light font-semibold">Teams</th>
                      <th className="px-4 py-3 text-left text-light font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map(m => (
                      <tr
                        key={m.id}
                        onClick={() => setSelectedMemberId(m.id)}
                        className={`cursor-pointer border-b border-white/5 transition-colors ${
                          m.id === selectedMemberId ? 'bg-primary/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <td className="px-4 py-3 text-light">{m.username}</td>
                        <td className="px-4 py-3 text-light">{m.email}</td>
                        <td className="px-4 py-3 text-light">{m.role}</td>
                        <td className="px-4 py-3 text-light">
                          {m.teamNames && m.teamNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {m.teamNames.map((tn, idx) => (
                                <span
                                  key={`${m.id}-t-${idx}`}
                                  className="inline-flex items-center gap-2 bg-white/5 px-2 py-1 rounded text-sm"
                                >
                                  {tn}
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleRemoveFromTeam(m.id, m.teamIds[idx]);
                                    }}
                                    className="text-red-400 hover:text-red-300"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-light/50">No teams</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-light">
                          {isClubManager(clubs.find(c => c.id === selectedClubId)) ? (
                            <div className="flex gap-2">
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setUserToAssign(m);
                                  setShowTeamAssignModal(true);
                                }}
                                className="px-2 py-1 bg-white/10 text-light rounded text-sm hover:bg-white/15"
                              >
                                Assign
                              </button>
                              <select
                                value={m.role}
                                onChange={e => {
                                  e.stopPropagation();
                                  handleChangeRole(m.id, e.target.value);
                                }}
                                className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-light text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                              >
                                <option value="user" className="bg-mid-dark">User</option>
                                <option value="parent" className="bg-mid-dark">Parent</option>
                                <option value="assistant" className="bg-mid-dark">Assistant</option>
                                <option value="trainer" className="bg-mid-dark">Trainer</option>
                              </select>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  handleRemoveMember(m);
                                }}
                                className="bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 text-sm font-medium transition-all"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-light/50">No actions</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Teams List - Enhanced */}
            {selectedClubId && clubTeams.length > 0 && (
              <div className="mb-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <h2 className="font-title text-2xl text-light mb-4">Teams in this Club</h2>
                
                {/* Filter by Trainer/Assistant */}
<div className="mb-4">
                  <label className="block text-sm font-medium text-light/80 mb-2">Filter by Trainer/Assistant</label>
                  <select
                    value={teamTrainerFilter}
                    onChange={e => setTeamTrainerFilter(e.target.value)}
                    className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    <option value="" className="bg-mid-dark">All Teams</option>
                    {(() => {
                      // Get unique trainers and assistants from all teams
                      const trainersSet = new Set();
                      const assistantsSet = new Set();
                      
                      clubTeams.forEach(team => {
                        (team.trainers || []).forEach(id => trainersSet.add(id));
                        (team.assistants || []).forEach(id => assistantsSet.add(id));
                      });

                      const trainersList = [];
                      const assistantsList = [];
                      
                      // Get trainers
                      trainersSet.forEach(id => {
                        const member = clubMembers.find(m => m.id === id);
                        if (member) {
                          trainersList.push(member);
                        }
                      });
                      
                      // Get assistants
                      assistantsSet.forEach(id => {
                        const member = clubMembers.find(m => m.id === id);
                        if (member && !trainersSet.has(id)) {
                          assistantsList.push(member);
                        }
                      });

                      return (
                        <>
                          {trainersList.length > 0 && (
                            <optgroup label="Trainers" className="bg-mid-dark">
                              {trainersList.map(m => (
                                <option key={m.id} value={m.id} className="bg-mid-dark">
                                  {m.username} - {m.email}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {assistantsList.length > 0 && (
                            <optgroup label="Assistants" className="bg-mid-dark">
                              {assistantsList.map(m => (
                                <option key={m.id} value={m.id} className="bg-mid-dark">
                                  {m.username} - {m.email}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      );
                    })()}
                  </select>
                </div>

                <div className="grid gap-3">
                  {clubTeams
                    .filter(t => {
                      if (!teamTrainerFilter) return true;
                      return (t.trainers || []).includes(teamTrainerFilter) || 
                             (t.assistants || []).includes(teamTrainerFilter);
                    })
                    .map(t => {
                      const memberCount = (t.members || []).length;
                      const trainerCount = (t.trainers || []).length;
                      const assistantCount = (t.assistants || []).length;
                      
                      return (
                        <div key={t.id} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-all">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-light text-lg mb-2">{t.name}</h3>
                              <div className="flex gap-4 text-sm text-light/70">
                                <div className="flex items-center gap-1">
                                  <span>👥</span>
                                  <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span>👨‍🏫</span>
                                  <span>{trainerCount} trainer{trainerCount !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span>👨‍💼</span>
                                  <span>{assistantCount} assistant{assistantCount !== 1 ? 's' : ''}</span>
                                </div>
                              </div>
                            </div>
                            
                            {isClubManager(clubs.find(c => c.id === selectedClubId)) && (
                              <div className="relative">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTeamActionDropdown(teamActionDropdown === t.id ? null : t.id);
                                  }}
                                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-light rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                                >
                                  <span>Actions</span>
                                  <span className="text-xs">▼</span>
                                </button>

                                {/* Dropdown Menu */}
                                {teamActionDropdown === t.id && (
                                  <div 
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 mt-2 w-48 bg-mid-dark border border-white/20 rounded-lg shadow-xl z-10"
                                  >
                                    <button
                                      onClick={() => {
                                        setTeamActionDropdown(null);
                                        setTeamToRename(t);
                                        setRenameTeamName(t.name);
                                        setShowRenameTeamModal(true);
                                      }}
                                      className="w-full px-4 py-2 text-left text-light hover:bg-white/10 transition rounded-t-lg flex items-center gap-2"
                                    >
                                      <span>✏️</span>
                                      <span>Rename Team</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setTeamActionDropdown(null);
                                        openQuickAssignModal(t);
                                      }}
                                      className="w-full px-4 py-2 text-left text-light hover:bg-white/10 transition flex items-center gap-2"
                                    >
                                      <span>➕</span>
                                      <span>Assign User</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setTeamActionDropdown(null);
                                        // TODO: Implement remove user from team
                                        showToast('Remove user feature coming soon', 'info');
                                      }}
                                      className="w-full px-4 py-2 text-left text-light hover:bg-white/10 transition flex items-center gap-2"
                                    >
                                      <span>➖</span>
                                      <span>Remove User</span>
                                    </button>
                                    <div className="border-t border-white/10"></div>
                                    <button
                                      onClick={() => {
                                        setTeamActionDropdown(null);
                                        handleDeleteTeam(t.id);
                                      }}
                                      className="w-full px-4 py-2 text-left text-red-400 hover:bg-red-500/10 transition rounded-b-lg flex items-center gap-2"
                                    >
                                      <span>🗑️</span>
                                      <span>Delete Team</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

          </>
        )}

        {/* Pending Requests Tab */}
        {selectedClubId && activeTab === 'requests' && (
          <div className="animate-fade-in">
            <h2 className="font-title text-3xl text-light mb-6">Pending Join Requests</h2>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <p className="text-light/70">Pending requests feature - Coming soon</p>
              <p className="text-light/50 text-sm mt-2">This will show users who requested to join the club/teams</p>
            </div>
          </div>
        )}

        {/* Statistics Tab */}
        {selectedClubId && activeTab === 'statistics' && (
          <div className="animate-fade-in">
            <h2 className="font-title text-3xl text-light mb-6">Trainer Statistics</h2>
            
            {!selectedTrainer ? (
              <>
                {/* Search Trainers */}
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search trainers by name or email..."
                    value={trainerSearchQuery}
                    onChange={e => setTrainerSearchQuery(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                {/* Trainers List */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                  <h3 className="font-semibold text-light text-lg mb-4">Select Trainer</h3>
                  <div className="space-y-2">
                    {(() => {
                      const trainers = clubMembers.filter(m => 
                        (m.role === 'trainer' || m.role === 'assistant') &&
                        (!trainerSearchQuery || 
                          m.username?.toLowerCase().includes(trainerSearchQuery.toLowerCase()) ||
                          m.email?.toLowerCase().includes(trainerSearchQuery.toLowerCase()))
                      );

                      if (trainers.length === 0) {
                        return <p className="text-light/50 text-center py-4">No trainers found</p>;
                      }

                      return trainers.map(trainer => (
                        <div
                          key={trainer.id}
                          onClick={() => setSelectedTrainer(trainer)}
                          className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-primary/50 cursor-pointer transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-light">{trainer.username}</div>
                              <div className="text-sm text-light/60">{trainer.email}</div>
                              <div className="text-xs text-light/40 mt-1">
                                Role: {trainer.role}
                              </div>
                            </div>
                            <span className="text-light/40">→</span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Back Button */}
                <button
                  onClick={() => setSelectedTrainer(null)}
                  className="mb-4 px-4 py-2 bg-white/10 hover:bg-white/15 text-light rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2"
                >
                  <span>←</span>
                  <span>Back to Trainers</span>
                </button>

                {/* Trainer Info */}
                <div className="mb-6 bg-gradient-to-r from-primary/20 to-accent/20 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white text-2xl">
                      {selectedTrainer.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-title text-2xl text-light">{selectedTrainer.username}</h3>
                      <p className="text-light/60">{selectedTrainer.email}</p>
                      <p className="text-sm text-light/50 mt-1">Role: {selectedTrainer.role}</p>
                    </div>
                  </div>
                </div>

                {/* Statistics Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {/* Teams Count */}
                  <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">👥</span>
                      <h3 className="font-semibold text-light">Teams</h3>
                    </div>
                    <div className="text-4xl font-bold text-primary">
                      {(() => {
                        const club = clubs.find(c => c.id === selectedClubId);
                        if (!club) return 0;
                        return (club.teams || []).filter(t => 
                          (t.trainers || []).includes(selectedTrainer.id) ||
                          (t.assistants || []).includes(selectedTrainer.id) ||
                          (t.members || []).includes(selectedTrainer.id)
                        ).length;
                      })()}
                    </div>
                    <p className="text-light/50 text-sm mt-1">Teams as member</p>
                  </div>

                  {/* Games Attended */}
                  <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">⚽</span>
                      <h3 className="font-semibold text-light">Games</h3>
                    </div>
                    <div className="text-4xl font-bold text-success">0</div>
                    <p className="text-light/50 text-sm mt-1">Games attended</p>
                  </div>

                  {/* Extra Trainings */}
                  <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">🏋️</span>
                      <h3 className="font-semibold text-light">Training</h3>
                    </div>
                    <div className="text-4xl font-bold text-accent">0</div>
                    <p className="text-light/50 text-sm mt-1">Extra trainings</p>
                  </div>

                  {/* Tournaments */}
                  <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">🏆</span>
                      <h3 className="font-semibold text-light">Tournaments</h3>
                    </div>
                    <div className="text-4xl font-bold text-secondary">0</div>
                    <p className="text-light/50 text-sm mt-1">Tournaments attended</p>
                  </div>
                </div>

                {/* Manual Entry Form */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                  <h3 className="font-title text-2xl text-light mb-4">Add Manual Entry</h3>
                  
                  <div className="grid gap-4">
                    <div>
                      <label className="block text-sm font-medium text-light/80 mb-2">Team</label>
                      <input
                        type="text"
                        placeholder="Team name (optional)"
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-light/80 mb-2">Score</label>
                      <input
                        type="text"
                        placeholder="Score (optional)"
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-light/80 mb-2">Comments</label>
                      <textarea
                        placeholder="Comments (optional)"
                        rows="3"
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                      ></textarea>
                    </div>

                    <button className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all">
                      Add Entry
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Team Assignment Modal */}
      {showTeamAssignModal && userToAssign && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-mid-dark border border-white/20 rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-2xl font-bold text-light mb-4">
              Assign {userToAssign.username} to Teams
            </h3>
            <div className="space-y-2 mb-4">
              {clubTeams.map(team => (
                <div
                  key={team.id}
                  onClick={() => {
                    setSelectedTeamsForAssignment(prev =>
                      prev.includes(team.id)
                        ? prev.filter(id => id !== team.id)
                        : [...prev, team.id]
                    );
                  }}
                  className="flex items-center gap-3 p-3 border rounded hover:bg-white/5 cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedTeamsForAssignment.includes(team.id)}
                    onChange={() => {}}
                    className="mr-2 accent-primary"
                  />
                  <div className="font-medium text-light">{team.name}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowTeamAssignModal(false);
                  setUserToAssign(null);
                  setSelectedTeamsForAssignment([]);
                }}
                className="flex-1 px-4 py-3 bg-white/10 text-light rounded-lg hover:bg-white/15 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignToTeams}
                className="flex-1 px-4 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove from Teams Modal */}
      {showRemoveModal && userToRemove && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-mid-dark border border-white/20 rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-2xl font-bold text-light mb-4">
              Remove {userToRemove.username} from Teams
            </h3>
            
            <p className="text-light/70 text-sm mb-4">
              Select which teams to remove this user from:
            </p>

            {/* Select All button */}
            <button
              onClick={selectAllTeamsForRemoval}
              className="mb-3 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-light rounded text-sm transition"
            >
              Select All
            </button>

            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {(() => {
                const club = clubs.find(c => c.id === selectedClubId);
                if (!club) return null;
                
                const userTeams = (club.teams || []).filter(team => 
                  (team.members || []).includes(userToRemove.id) ||
                  (team.trainers || []).includes(userToRemove.id) ||
                  (team.assistants || []).includes(userToRemove.id)
                );

                if (userTeams.length === 0) {
                  return <p className="text-light/50 text-sm">User is not in any teams</p>;
                }

                return userTeams.map(team => (
                  <div
                    key={team.id}
                    onClick={() => toggleTeamForRemoval(team.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      teamsToRemoveFrom.includes(team.id)
                        ? 'bg-red-500/20 border-red-500/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={teamsToRemoveFrom.includes(team.id)}
                        onChange={() => {}}
                        className="w-4 h-4"
                      />
                      <span className="text-light font-medium">{team.name}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRemoveModal(false);
                  setUserToRemove(null);
                  setTeamsToRemoveFrom([]);
                }}
                className="flex-1 px-4 py-3 bg-white/10 text-light rounded-lg hover:bg-white/15 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveFromTeams}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition"
              >
                Remove from {teamsToRemoveFrom.length} Team(s)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Assign to Team Modal */}
      {showQuickAssignModal && teamToAssign && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-mid-dark border border-white/20 rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-2xl font-bold text-light mb-4">
              Assign User to {teamToAssign.name}
            </h3>
            
            <p className="text-light/70 text-sm mb-4">
              Search by name or email to add user to this team
            </p>

            {/* Search Input */}
            <div className="mb-4">
              <input
                type="text"
                value={quickAssignSearch}
                onChange={e => handleQuickAssignSearch(e.target.value)}
                placeholder="Type name or email..."
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                autoFocus
              />
            </div>

            {/* Search Results */}
            <div className="mb-4 max-h-64 overflow-y-auto">
              {quickAssignMatches.length > 0 ? (
                <div className="space-y-2">
                  {quickAssignMatches.map(m => (
                    <div
                      key={m.id}
                      onClick={() => quickAssignToTeam(m.id)}
                      className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/50 cursor-pointer transition"
                    >
                      <div className="font-medium text-light">{m.username}</div>
                      <div className="text-sm text-light/60">{m.email}</div>
                      <div className="text-xs text-light/40 mt-1">Role: {m.role}</div>
                    </div>
                  ))}
                </div>
              ) : quickAssignSearch.length >= 2 ? (
                <p className="text-light/50 text-sm text-center py-4">No matches found</p>
              ) : (
                <p className="text-light/50 text-sm text-center py-4">Type at least 2 characters to search</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowQuickAssignModal(false);
                  setTeamToAssign(null);
                  setQuickAssignSearch('');
                  setQuickAssignMatches([]);
                }}
                className="flex-1 px-4 py-3 bg-white/10 text-light rounded-lg hover:bg-white/15 font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-mid-dark border border-white/20 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-light mb-4">
              Create New Team
            </h3>
            
            <p className="text-light/70 text-sm mb-4">
              You will automatically become a trainer of this team.
            </p>

            {/* Team Name Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-light/80 mb-2">Team Name</label>
              <input
                type="text"
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                placeholder="Enter team name..."
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                autoFocus
                onKeyPress={e => {
                  if (e.key === 'Enter') handleCreateTeam();
                }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateTeamModal(false);
                  setNewTeamName('');
                }}
                className="flex-1 px-4 py-3 bg-white/10 text-light rounded-lg hover:bg-white/15 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTeam}
                className="flex-1 px-4 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition"
              >
                Create Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Team Modal */}
      {showRenameTeamModal && teamToRename && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-mid-dark border border-white/20 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-light mb-4">
              Rename Team
            </h3>
            
            <p className="text-light/70 text-sm mb-4">
              Current name: <span className="text-light font-medium">{teamToRename.name}</span>
            </p>

            {/* Team Name Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-light/80 mb-2">New Team Name</label>
              <input
                type="text"
                value={renameTeamName}
                onChange={e => setRenameTeamName(e.target.value)}
                placeholder="Enter new team name..."
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                autoFocus
                onKeyPress={e => {
                  if (e.key === 'Enter') handleRenameTeam();
                }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRenameTeamModal(false);
                  setTeamToRename(null);
                  setRenameTeamName('');
                }}
                className="flex-1 px-4 py-3 bg-white/10 text-light rounded-lg hover:bg-white/15 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameTeam}
                className="flex-1 px-4 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
