// src/pages/ClubManagement.jsx
import { useEffect, useState, useMemo } from 'react';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getAllClubs, getClub, getAllUsers, updateClub } from '../firebase/firestore';

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

  const handleRemoveMember = async (memberId) => {
    if (!selectedClubId || !memberId) return;
    if (!window.confirm('Remove this member from the club?')) return;
    
    try {
      const club = await getClub(selectedClubId);
      if (!club) return;

      const updatedClub = {
        trainers: (club.trainers || []).filter(id => id !== memberId),
        assistants: (club.assistants || []).filter(id => id !== memberId),
        members: (club.members || []).filter(id => id !== memberId),
        teams: (club.teams || []).map(team => ({
          ...team,
          members: (team.members || []).filter(id => id !== memberId),
          trainers: (team.trainers || []).filter(id => id !== memberId),
          assistants: (team.assistants || []).filter(id => id !== memberId)
        }))
      };

      await updateClub(selectedClubId, updatedClub);
      showToast('Member removed from club', 'success');
      await loadClubData(selectedClubId); // Reload club data
    } catch (error) {
      console.error('Error removing member:', error);
      showToast('Failed to remove member', 'error');
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
        trainers: [],
        assistants: []
      };

      const updatedClub = {
        teams: [...(club.teams || []), newTeam]
      };

      await updateClub(selectedClubId, updatedClub);
      showToast('Team created successfully', 'success');
      setNewTeamName('');
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
            className="w-full md:w-auto bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          >
            <option value="" className="bg-mid-dark">-- Select club --</option>
            {clubs.map(c => (
              <option key={c.id} value={c.id} className="bg-mid-dark">
                {c.name} {c.clubNumber ? `(${c.clubNumber})` : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedClubId && (
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
                              {m.role === ROLES.TRAINER ? (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleDemoteToMember(m.id);
                                  }}
                                  className="bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 text-sm font-medium transition-all"
                                >
                                  Demote
                                </button>
                              ) : (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    handlePromoteToTrainer(m.id);
                                  }}
                                  className="bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 text-sm font-medium transition-all"
                                >
                                  Promote
                                </button>
                              )}
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  handleRemoveMember(m.id);
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

            {/* Create Team Section */}
            {isClubManager(clubs.find(c => c.id === selectedClubId)) && (
              <div className="mt-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
                <h3 className="font-title text-2xl text-light mb-3">Create Team</h3>
                <div className="flex gap-2">
                  <input
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    placeholder="Team name"
                    className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all flex-1"
                  />
                  <button
                    onClick={handleCreateTeam}
                    className="px-6 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}
          </>
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
    </div>
  );
}
