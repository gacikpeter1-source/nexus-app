// src/pages/ClubManagement.jsx
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import NotificationsTab from '../components/NotificationsTab';

import { 
  getAllClubs, 
  getClub, 
  getAllUsers, 
  updateClub, 
  updateUser, 
  getPendingRequests, 
  updateRequest,
  createOrderTemplate,
  getOrderTemplate,
  updateOrderTemplate,
  deleteOrderTemplate,
  getClubOrderTemplates,
  getOrderResponses
} from '../firebase/firestore';
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
  const navigate = useNavigate();

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

  // Edit Club modal state
  const [showEditClubModal, setShowEditClubModal] = useState(false);
  const [editClubName, setEditClubName] = useState('');
  const [editClubType, setEditClubType] = useState('');
  const [editCustomClubType, setEditCustomClubType] = useState('');

  // Logo upload state
  const [showLogoUpload, setShowLogoUpload] = useState(false);
  const [logoUploadType, setLogoUploadType] = useState(''); // 'club' or 'team'
  const [selectedTeamForLogo, setSelectedTeamForLogo] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');

  const CLUB_TYPES = [
    'Football', 'Basketball', 'Volleyball', 'Ice Hockey',
    'Swimming', 'Scouting', 'Dancing', 'Music Academy',
    'Music Band', 'Custom'
  ];

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
  const [activeTab, setActiveTab] = useState('management'); // management, requests, statistics, orders, notifications

  // Orders tab state
const [orders, setOrders] = useState([]);
const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
const [selectedOrder, setSelectedOrder] = useState(null);
const [showOrderResponsesModal, setShowOrderResponsesModal] = useState(false);
const [orderResponses, setOrderResponses] = useState([]);
const [loadingResponses, setLoadingResponses] = useState(false);
const [orderStatusFilter, setOrderStatusFilter] = useState('all'); // 'all', 'accepted', 'declined', 'pending'
const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // Order form state
  const [orderForm, setOrderForm] = useState({
    title: '',
    description: '',
    teams: [],
    deadline: '',
    fields: []
  });

  // Field builder state
  const [newField, setNewField] = useState({
    label: '',
    type: 'text',
    required: false,
    options: []
  });

  // Statistics tab state
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [trainerSearchQuery, setTrainerSearchQuery] = useState('');

  // Pending requests state
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Remove action modal state
  const [showRemoveActionModal, setShowRemoveActionModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);

  // Remove user from specific team (from Actions dropdown)
  const [showRemoveUserFromTeamModal, setShowRemoveUserFromTeamModal] = useState(false);
  const [teamForUserRemoval, setTeamForUserRemoval] = useState(null);

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

  // Load pending requests for selected club
  const loadPendingRequests = async (clubId) => {
    if (!clubId) {
      setPendingRequests([]);
      return;
    }

    setLoadingRequests(true);
    try {
      const allRequests = await getPendingRequests();
      const clubRequests = allRequests.filter(r => r.clubId === clubId && r.status === 'pending');
      setPendingRequests(clubRequests);
    } catch (error) {
      console.error('Error loading pending requests:', error);
      setPendingRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Handle approve request
  const handleApproveRequest = async (request) => {
    try {
      // Update request status
      await updateRequest(request.id, {
        status: 'approved',
        handledBy: user.id,
        handledAt: new Date().toISOString()
      });

      // Get fresh club data
      const club = await getClub(request.clubId);
      if (!club) return;

      // Add user to club members
      const updatedMembers = [...(club.members || [])];
      if (!updatedMembers.includes(request.userId)) {
        updatedMembers.push(request.userId);
      }

      // If specific team requested, add to team
      let updatedTeams = club.teams || [];
      if (request.teamId) {
        updatedTeams = updatedTeams.map(t => {
          if (t.id === request.teamId) {
            const teamMembers = [...(t.members || [])];
            if (!teamMembers.includes(request.userId)) {
              teamMembers.push(request.userId);
            }
            return { ...t, members: teamMembers };
          }
          return t;
        });
      }

      // Update club in Firebase
      await updateClub(request.clubId, {
        members: updatedMembers,
        teams: updatedTeams
      });

      showToast('✅ Request approved!', 'success');
      await loadPendingRequests(selectedClubId);
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error approving request:', error);
      showToast('Failed to approve request', 'error');
    }
  };

  // Handle deny request
  const handleDenyRequest = async (requestId) => {
    try {
      await updateRequest(requestId, {
        status: 'denied',
        handledBy: user.id,
        handledAt: new Date().toISOString()
      });

      showToast('Request denied', 'info');
      await loadPendingRequests(selectedClubId);
    } catch (error) {
      console.error('Error denying request:', error);
      showToast('Failed to deny request', 'error');
    }
  };

  useEffect(() => {
    loadClubData(selectedClubId);
    setSelectedTeamFilter('');
  }, [selectedClubId, allUsers]);

  useEffect(() => {
    if (activeTab === 'requests' && selectedClubId) {
      loadPendingRequests(selectedClubId);
    }
  }, [activeTab, selectedClubId]);

  // Load orders when tab changes to orders
useEffect(() => {
  if (activeTab === 'orders' && selectedClubId) {
    loadOrders();
  }
}, [activeTab, selectedClubId]);

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
    
    // Show action choice modal
    setMemberToRemove(member);
    setShowRemoveActionModal(true);
  };

  // Remove from teams only
  const handleRemoveFromTeamsChoice = async () => {
    if (!selectedClubId || !memberToRemove) return;
    
    try {
      // Get fresh club data from Firebase
      const club = await getClub(selectedClubId);
      if (!club) {
        setShowRemoveActionModal(false);
        return showToast('Club not found', 'error');
      }
      
      const userTeams = (club.teams || []).filter(team => 
        (team.members || []).includes(memberToRemove.id) ||
        (team.trainers || []).includes(memberToRemove.id) ||
        (team.assistants || []).includes(memberToRemove.id)
      );
      
      console.log('User teams found:', userTeams.length, 'for user:', memberToRemove.id);
      console.log('All teams:', club.teams?.length);
      
      if (userTeams.length === 0) {
        setShowRemoveActionModal(false);
        return showToast('User is not in any teams', 'info');
      }
      
      // Open team selection modal
      setUserToRemove(memberToRemove);
      setTeamsToRemoveFrom([]);
      setShowRemoveActionModal(false);
      setShowRemoveModal(true);
    } catch (error) {
      console.error('Error loading teams:', error);
      showToast('Failed to load teams', 'error');
    }
  };

  // Remove from club entirely
  const handleRemoveFromClub = async () => {
    if (!selectedClubId || !memberToRemove) return;

    // Check permission - only trainer or superadmin
    const club = clubs.find(c => c.id === selectedClubId);
    if (!club) return;

    const isTrainerOrAbove = user.isSuperAdmin || 
                             (club.trainers || []).includes(user.id) ||
                             user.role === ROLES.ADMIN;
    
    if (!isTrainerOrAbove) {
      setShowRemoveActionModal(false);
      return showToast('Only trainers can remove users from club', 'error');
    }

    if (!confirm(`Remove ${memberToRemove.username || memberToRemove.email} from club entirely?`)) {
      return;
    }

    try {
      // Remove from all role arrays
      const updatedTrainers = (club.trainers || []).filter(id => id !== memberToRemove.id);
      const updatedAssistants = (club.assistants || []).filter(id => id !== memberToRemove.id);
      const updatedMembers = (club.members || []).filter(id => id !== memberToRemove.id);

      // Remove from all teams
      const updatedTeams = (club.teams || []).map(team => ({
        ...team,
        members: (team.members || []).filter(id => id !== memberToRemove.id),
        trainers: (team.trainers || []).filter(id => id !== memberToRemove.id),
        assistants: (team.assistants || []).filter(id => id !== memberToRemove.id)
      }));

      await updateClub(selectedClubId, {
        trainers: updatedTrainers,
        assistants: updatedAssistants,
        members: updatedMembers,
        teams: updatedTeams
      });

      showToast('User removed from club', 'success');
      setShowRemoveActionModal(false);
      setMemberToRemove(null);
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error removing from club:', error);
      showToast('Failed to remove from club', 'error');
    }
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
    
    console.log('🔄 Changing role:', { userId, newRole, selectedClubId });
    
    try {
      // Update user's role in Firebase users collection
      console.log('📝 Step 1: Updating user role in Firestore...');
      await updateUser(userId, { role: newRole });
      console.log('✅ User role updated successfully');
      
      // Get fresh club data
      console.log('📝 Step 2: Getting fresh club data...');
      const club = await getClub(selectedClubId);
      if (!club) {
        console.error('❌ Club not found');
        return showToast('Club not found', 'error');
      }
      console.log('✅ Club data loaded:', club.name);

      // Remove user from all role arrays first
      let updatedTrainers = (club.trainers || []).filter(id => id !== userId);
      let updatedAssistants = (club.assistants || []).filter(id => id !== userId);
      let updatedMembers = (club.members || []).filter(id => id !== userId);

      console.log('📝 Current arrays:', {
        trainers: club.trainers?.length || 0,
        assistants: club.assistants?.length || 0,
        members: club.members?.length || 0
      });

      // Add user to correct array based on new role
      if (newRole === 'trainer') {
        updatedTrainers.push(userId);
        console.log('➕ Added to trainers');
      } else if (newRole === 'assistant') {
        updatedAssistants.push(userId);
        console.log('➕ Added to assistants');
      } else {
        // user, parent, or any other role goes to members
        updatedMembers.push(userId);
        console.log('➕ Added to members');
      }

      // Update club in Firebase
      console.log('📝 Step 3: Updating club arrays in Firestore...');
      await updateClub(selectedClubId, {
        trainers: updatedTrainers,
        assistants: updatedAssistants,
        members: updatedMembers
      });
      console.log('✅ Club arrays updated successfully');
      
      showToast(`Role updated to ${newRole}`, 'success');
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('❌ Error changing role:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      showToast(`Failed to change role: ${error.message}`, 'error');
    }
  };

  // Edit Club function
  async function handleEditClub() {
    if (!editClubName.trim()) {
      showToast('Club name is required', 'error');
      return;
    }

    const finalClubType = editClubType === 'Custom' 
      ? editCustomClubType.trim() 
      : editClubType;

    if (!finalClubType) {
      showToast('Club type is required', 'error');
      return;
    }

    try {
      await updateClub(selectedClubId, {
        name: editClubName.trim(),
        clubType: finalClubType
      });

      showToast('Club updated successfully', 'success');
      setShowEditClubModal(false);
      
      // Reload clubs list
      await loadClubs();
    } catch (error) {
      console.error('Error updating club:', error);
      showToast('Failed to update club', 'error');
    }
  }

  // Logo upload functions
  function handleLogoFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be less than 5MB', 'error');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleUploadLogo() {
    if (!logoFile) {
      showToast('Please select an image', 'error');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = reader.result;
        
        if (logoUploadType === 'club') {
          await updateClub(selectedClubId, { logoUrl: base64Image });
          showToast('Club logo updated!', 'success');
          await loadClubData(selectedClubId);
        } else if (logoUploadType === 'team' && selectedTeamForLogo) {
          const club = await getClub(selectedClubId);
          const updatedTeams = club.teams.map(t =>
            t.id === selectedTeamForLogo.id ? { ...t, logoUrl: base64Image } : t
          );
          await updateClub(selectedClubId, { teams: updatedTeams });
          showToast('Team logo updated!', 'success');
          await loadClubData(selectedClubId);
        }
        
        setShowLogoUpload(false);
        setLogoFile(null);
        setLogoPreview('');
      };
      reader.readAsDataURL(logoFile);
    } catch (error) {
      console.error('Error uploading logo:', error);
      showToast('Failed to upload logo', 'error');
    }
  }

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

/* ===========================
   ORDERS TAB - ADD THESE FUNCTIONS (after handlePromoteToAssistant)
   =========================== */

async function loadOrders() {
  try {
    const ordersList = await getClubOrderTemplates(selectedClubId);
    setOrders(ordersList);
  } catch (error) {
    console.error('Error loading orders:', error);
    showToast('Failed to load orders', 'error');
  }
}

function resetOrderForm() {
  setOrderForm({
    title: '',
    description: '',
    teams: [],
    deadline: '',
    fields: []
  });
  setNewField({
    label: '',
    type: 'text',
    required: false,
    options: []
  });
}

function addFieldToOrder() {
  if (!newField.label.trim()) {
    showToast('Field label is required', 'error');
    return;
  }

  const field = {
    id: `field_${Date.now()}`,
    label: newField.label.trim(),
    type: newField.type,
    required: newField.required
  };

  // Only add options if dropdown
  if (newField.type === 'dropdown' && newField.options.length > 0) {
    field.options = newField.options;
  }

  setOrderForm(f => ({
    ...f,
    fields: [...f.fields, field]
  }));

  // Reset new field form
  setNewField({
    label: '',
    type: 'text',
    required: false,
    options: []
  });
}

function removeFieldFromOrder(fieldId) {
  setOrderForm(f => ({
    ...f,
    fields: f.fields.filter(field => field.id !== fieldId)
  }));
}

function exportToExcel(order, responses) {
  if (responses.length === 0) {
    showToast('No users to export', 'info');
    return;
  }

  // Create CSV content - NOW INCLUDES ALL USERS (responded + pending)
  const headers = ['Name', 'Email', 'Status', ...order.fields.map(f => f.label)];
  const csvRows = [headers.join(',')];

  responses.forEach(response => {
    const row = [
      `"${response.userName}"`,
      `"${response.userEmail}"`,
      response.status === 'pending' ? 'Not Responded' : response.status,
      ...order.fields.map(field => {
        const value = response.responses?.[field.id] || '-';
        return `"${value}"`;
      })
    ];
    csvRows.push(row.join(','));
  });

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${order.title}_responses_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast(`Exported ${responses.length} users to Excel!`, 'success');
}

async function handleCreateOrder() {
  if (!orderForm.title.trim()) {
    showToast('Order title is required', 'error');
    return;
  }

  if (orderForm.fields.length === 0) {
    showToast('Add at least one custom field', 'error');
    return;
  }

  try {
    const orderData = {
      clubId: selectedClubId,
      createdBy: user.id,
      title: orderForm.title.trim(),
      description: orderForm.description.trim() || '',
      teams: orderForm.teams || [],
      fields: orderForm.fields
    };

    // Only add deadline if it exists
    if (orderForm.deadline) {
      orderData.deadline = orderForm.deadline;
    }

    await createOrderTemplate(orderData);
    showToast('Order created successfully!', 'success');
    setShowCreateOrderModal(false);
    resetOrderForm();
    await loadOrders();
  } catch (error) {
    console.error('Error creating order:', error);
    showToast('Failed to create order', 'error');
  }
}

async function handleCloseOrder(orderId) {
  if (!confirm('Close this order? No more responses will be accepted.')) return;

  try {
    await updateOrderTemplate(orderId, { status: 'closed' });
    showToast('Order closed', 'success');
    await loadOrders();
  } catch (error) {
    console.error('Error closing order:', error);
    showToast('Failed to close order', 'error');
  }
}

async function handleDeleteOrder(orderId) {
  if (!confirm('Delete this order? All responses will be lost.')) return;

  try {
    await deleteOrderTemplate(orderId);
    showToast('Order deleted', 'success');
    await loadOrders();
  } catch (error) {
    console.error('Error deleting order:', error);
    showToast('Failed to delete order', 'error');
  }
}

async function handleViewOrderResponses(order) {
  setSelectedOrder(order);
  setShowOrderResponsesModal(true);
  await loadOrderResponses(order);
}

async function loadOrderResponses(order) {
  setLoadingResponses(true);
  try {
    // Get all responses for this order
    const responses = await getOrderResponses(order.id);
    
    // Get all eligible users for this order
    let eligibleUsers = [];
    
    if (!order.teams || order.teams.length === 0) {
      // All teams = all club members
      const club = clubs.find(c => c.id === order.clubId);
      if (club) {
        const memberIds = [
          ...(club.trainers || []),
          ...(club.assistants || []),
          ...(club.members || [])
        ];
        eligibleUsers = allUsers.filter(u => memberIds.includes(u.id));
      }
    } else {
      // Specific teams = members of those teams only
      const club = clubs.find(c => c.id === order.clubId);
      if (club && club.teams) {
        const teamMemberIds = new Set();
        order.teams.forEach(teamId => {
          const team = club.teams.find(t => t.id === teamId);
          if (team) {
            (team.members || []).forEach(id => teamMemberIds.add(id));
            (team.trainers || []).forEach(id => teamMemberIds.add(id));
            (team.assistants || []).forEach(id => teamMemberIds.add(id));
          }
        });
        eligibleUsers = allUsers.filter(u => teamMemberIds.has(u.id));
      }
    }
    
    // Create response objects for all eligible users
    const allUserResponses = eligibleUsers.map(user => {
      const existingResponse = responses.find(r => r.userId === user.id);
      
      if (existingResponse) {
        // User has responded
        return {
          ...existingResponse,
          userName: user.username || user.email,
          userEmail: user.email,
          hasResponded: true
        };
      } else {
        // User hasn't responded yet
        return {
          userId: user.id,
          userName: user.username || user.email,
          userEmail: user.email,
          status: 'pending',
          hasResponded: false,
          responses: {}
        };
      }
    });
    
    // Sort: Responded first, then pending
    allUserResponses.sort((a, b) => {
      if (a.hasResponded && !b.hasResponded) return -1;
      if (!a.hasResponded && b.hasResponded) return 1;
      return 0;
    });
    
    setOrderResponses(allUserResponses);
  } catch (error) {
    console.error('Error loading order responses:', error);
    showToast('Failed to load responses', 'error');
  } finally {
    setLoadingResponses(false);
  }
}

// Filter order responses based on status and search
const filteredOrderResponses = useMemo(() => {
  let filtered = orderResponses;

  // Filter by status
  if (orderStatusFilter !== 'all') {
    filtered = filtered.filter(r => r.status === orderStatusFilter);
  }

  // Filter by search query
  if (orderSearchQuery.trim()) {
    const query = orderSearchQuery.toLowerCase();
    filtered = filtered.filter(r =>
      r.userName.toLowerCase().includes(query) ||
      r.userEmail.toLowerCase().includes(query)
    );
  }

  return filtered;
}, [orderResponses, orderStatusFilter, orderSearchQuery]);

  // Handle removing user from specific team (from Actions dropdown)
  const handleRemoveUserFromTeam = async (userId) => {
    if (!selectedClubId || !teamForUserRemoval || !userId) return;

    try {
      const club = await getClub(selectedClubId);
      if (!club) return;

      const updatedTeams = (club.teams || []).map(t => {
        if (t.id === teamForUserRemoval.id) {
          return {
            ...t,
            members: (t.members || []).filter(id => id !== userId),
            trainers: (t.trainers || []).filter(id => id !== userId),
            assistants: (t.assistants || []).filter(id => id !== userId)
          };
        }
        return t;
      });

      await updateClub(selectedClubId, { teams: updatedTeams });
      showToast('User removed from team', 'success');
      setShowRemoveUserFromTeamModal(false);
      setTeamForUserRemoval(null);
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error removing user from team:', error);
      showToast('Failed to remove user from team', 'error');
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
        <div className="mb-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <label className="block mb-1 text-light/80 font-medium">Select Club</label>
          <select
            value={selectedClubId}
            onChange={e => setSelectedClubId(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setShowCreateTeamModal(true)}
                className="px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2"
              >
                <span>Create Team</span>
              </button>
              
              <button
                onClick={() => {
                  const club = clubs.find(c => c.id === selectedClubId);
                  setEditClubName(club?.name || '');
                  setEditClubType(club?.clubType || '');
                  setEditCustomClubType('');
                  setShowEditClubModal(true);
                }}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2"
              >
                <span>Edit Club</span>
              </button>
              
              <button
                onClick={() => {
                  setLogoUploadType('club');
                  setShowLogoUpload(true);
                }}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2"
              >
                 <span>Change Logo</span>
              </button>
            </div>
          )}

          {/* Club Info Bar */}
          {selectedClubId && (() => {
            const club = clubs.find(c => c.id === selectedClubId);
            if (!club) return null;

            const ownerUser = allUsers.find(u => u.id === club.createdBy);
            const ownerEmail = ownerUser?.email || club.createdBy || 'Unknown';
            const teamsCount = (club.teams || []).length;
            const trainersCount = (club.trainers || []).length;
            const assistantsCount = (club.assistants || []).length;
            const usersCount = (club.members || []).length;

            return (
              <div className="mt-3 px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-light/70">
                  <span className="flex items-center gap-1">
                    <span className="text-light/50">Owner:</span>
                    <span className="text-light font-medium">{ownerEmail}</span>
                  </span>
                  <span className="hidden sm:inline text-light/30">•</span>
                  <span className="flex items-center gap-1">
                    <span className="text-light/50">Teams:</span>
                    <span className="text-accent font-medium">{teamsCount}</span>
                  </span>
                  <span className="hidden sm:inline text-light/30">•</span>
                  <span className="flex items-center gap-1">
                    <span className="text-light/50">Trainers:</span>
                    <span className="text-success font-medium">{trainersCount}</span>
                  </span>
                  <span className="hidden sm:inline text-light/30">•</span>
                  <span className="flex items-center gap-1">
                    <span className="text-light/50">Assistants:</span>
                    <span className="text-secondary font-medium">{assistantsCount}</span>
                  </span>
                  <span className="hidden sm:inline text-light/30">•</span>
                  <span className="flex items-center gap-1">
                    <span className="text-light/50">Users:</span>
                    <span className="text-primary font-medium">{usersCount}</span>
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Tabs */}
        {selectedClubId && (
  <div className="mb-6">
    <div className="flex gap-2 border-b border-white/10 overflow-x-auto pb-px">
              <button
                onClick={() => setActiveTab('management')}
                className={`px-3 py-2 text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === 'management'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-light/60 hover:text-light'
                }`}
              >
                Management
              </button>

              <button
                onClick={() => setActiveTab('statistics')}
                className={`px-3 py-2 text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === 'statistics'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-light/60 hover:text-light'
                }`}
              >
                Statistics
              </button>

              <button
                onClick={() => setActiveTab('requests')}
                className={`px-3 py-2 text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === 'requests'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-light/60 hover:text-light'
                }`}
              >
                Pending Requests
              </button>

              <button
                onClick={() => setActiveTab('orders')}
                className={`
                  px-6 py-2 rounded-lg transition-all duration-200 font-medium
                  ${activeTab === 'orders'
                    ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg'
                    : 'bg-white/5 text-light/70 hover:bg-white/10 hover:text-light'}
                `}
              >
                Orders
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`
                  px-6 py-2 rounded-lg transition-all duration-200 font-medium
                  ${activeTab === 'notifications'
                    ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg'
                    : 'bg-white/5 text-light/70 hover:bg-white/10 hover:text-light'}
                `}
              >
                🔔 Notifications
              </button>
            </div>
          </div>
        )}

        {selectedClubId && activeTab === 'management' && (
          <>
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
                              <h3 
                                onClick={() => navigate(`/team/${selectedClubId}/${t.id}`)}
                                className="font-semibold text-light text-lg mb-2 cursor-pointer hover:text-primary transition-colors"
                              >
                                {t.name}
                              </h3>
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
                                        setTeamForUserRemoval(t);
                                        setShowRemoveUserFromTeamModal(true);
                                      }}
                                      className="w-full px-4 py-2 text-left text-light hover:bg-white/10 transition flex items-center gap-2"
                                    >
                                      <span>➖</span>
                                      <span>Remove User</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedTeamForLogo(t);
                                        setLogoUploadType('team');
                                        setShowLogoUpload(true);
                                        setTeamActionDropdown(null);
                                      }}
                                      className="w-full px-4 py-2 text-left hover:bg-white/10 transition flex items-center gap-2"
                                    >
                                      <span>🖼️</span>
                                      <span>Change Logo</span>
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
                                  <span 
                                    onClick={e => {
                                      e.stopPropagation();
                                      navigate(`/team/${selectedClubId}/${m.teamIds[idx]}`);
                                    }}
                                    className="cursor-pointer hover:text-primary transition-colors"
                                  >
                                    {tn}
                                  </span>
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


          </>
        )}

        {/* Pending Requests Tab */}
        {selectedClubId && activeTab === 'requests' && (
          <div className="animate-fade-in">
            <h2 className="font-title text-3xl text-light mb-6">Pending Join Requests</h2>
            
            {loadingRequests ? (
              <div className="text-center py-12">
                <div className="text-light/60">Loading requests...</div>
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-12 text-center">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="font-title text-2xl text-light mb-2">All Caught Up!</h3>
                <p className="text-light/60">No pending join requests at the moment.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map(request => {
                  const requester = allUsers.find(u => u.id === request.userId) || { email: request.userId };
                  const club = clubs.find(c => c.id === request.clubId) || { name: 'Unknown Club' };
                  
                  // Get team info if teamId exists
                  let teamName = null;
                  if (request.teamId && club.teams) {
                    const team = club.teams.find(t => t.id === request.teamId);
                    if (team) teamName = team.name;
                  }

                  return (
                    <div 
                      key={request.id}
                      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* User Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white">
                              {(requester.username || requester.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-light text-lg">
                                {requester.username || requester.email}
                              </div>
                              <div className="text-xs text-light/50">
                                {requester.email}
                              </div>
                            </div>
                          </div>

                          {/* Request Details */}
                          <div className="ml-15 space-y-1">
                            <div className="text-sm text-light/80">
                              <span className="text-light/50">Club:</span>{' '}
                              <span className="text-accent font-medium">{club.name}</span>
                            </div>
                            {teamName && (
                              <div className="text-sm text-light/80">
                                <span className="text-light/50">Team:</span>{' '}
                                <span className="text-secondary font-medium">{teamName}</span>
                              </div>
                            )}
                            <div className="text-xs text-light/40">
                              Requested: {request.createdAt ? new Date(request.createdAt).toLocaleString() : 'Unknown'}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveRequest(request)}
                            className="px-5 py-2.5 bg-success hover:bg-success/80 text-white rounded-lg transition-all font-semibold text-sm flex items-center gap-2"
                          >
                            <span>✔</span>
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleDenyRequest(request.id)}
                            className="px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-all font-semibold text-sm flex items-center gap-2"
                          >
                            <span>✕</span>
                            <span>Deny</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stats */}
            {pendingRequests.length > 0 && (
              <div className="mt-8 text-center">
                <div className="inline-block bg-white/5 border border-white/10 rounded-lg px-6 py-3">
                  <span className="text-light/60 text-sm">Total Pending: </span>
                  <span className="font-bold text-secondary text-lg">{pendingRequests.length}</span>
                </div>
              </div>
            )}
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

        {/* Orders Tab */}
{selectedClubId && activeTab === 'orders' && (
  <div className="space-y-6">
    {/* Header */}
    <div className="flex items-center justify-between">
      <h2 className="font-title text-2xl text-light">Order Management</h2>
      <button
        onClick={() => setShowCreateOrderModal(true)}
        className="px-4 py-2 text-sm bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
      >
        Create Order
      </button>
    </div>

    {/* Orders List */}
    {orders.length === 0 ? (
      <div className="text-center py-12 bg-white/5 border border-white/10 rounded-xl">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="font-title text-xl text-light/80 mb-2">No Orders Yet</h3>
        <p className="text-light/50 text-sm mb-4">
          Create your first order template to collect information from members.
        </p>
        <button
          onClick={() => setShowCreateOrderModal(true)}
          className="px-4 py-2 text-sm bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
        >
          Create First Order
        </button>
      </div>
    ) : (
      <div className="grid gap-4">
        {orders.map(order => {
          const isActive = order.status === 'active';
          const teamNames = order.teams && order.teams.length > 0
            ? order.teams.map(tid => {
                const team = clubTeams.find(t => t.id === tid);
                return team ? team.name : tid;
              }).join(', ')
            : 'All Teams';

          return (
            <div
              key={order.id}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-title text-xl text-light">{order.title}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      isActive 
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-gray-500/20 text-gray-300'
                    }`}>
                      {isActive ? '🟢 Active' : '⚫ Closed'}
                    </span>
                  </div>
                  {order.description && (
                    <p className="text-sm text-light/60 mb-2">{order.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-light/50">
                    <span>{teamNames}</span>
                    <span>{order.fields.length} fields</span>
                    {order.deadline && (
                      <span>Deadline: {new Date(order.deadline).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewOrderResponses(order)}
                    className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all"
                  >
                    View Responses
                  </button>
                  {isActive && (
                    <button
                      onClick={() => handleCloseOrder(order.id)}
                      className="px-3 py-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all"
                    >
                      Close
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteOrder(order.id)}
                    className="px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Order Fields Preview */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-light/50 mb-2">Required Fields:</p>
                <div className="flex flex-wrap gap-2">
                  {order.fields.slice(0, 5).map(field => (
                    <span
                      key={field.id}
                      className="px-2 py-1 text-xs bg-white/5 text-light/70 rounded"
                    >
                      {field.label} ({field.type})
                    </span>
                  ))}
                  {order.fields.length > 5 && (
                    <span className="px-2 py-1 text-xs text-light/50">
                      +{order.fields.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}

    {/* Create Order Modal */}
    {showCreateOrderModal && (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-mid-dark border border-white/20 rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-title text-2xl text-light">Create Order Template</h3>
            <button
              onClick={() => {
                setShowCreateOrderModal(false);
                resetOrderForm();
              }}
              className="text-light/60 hover:text-light transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block font-medium text-light/80 mb-1">Order Title *</label>
              <input
                type="text"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                value={orderForm.title}
                onChange={(e) => setOrderForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g., Jersey Order 2025"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block font-medium text-light/80 mb-1">Description</label>
              <textarea
                rows={2}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                value={orderForm.description}
                onChange={(e) => setOrderForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Order details..."
              />
            </div>

            {/* Teams Selection - Visual Circles */}
            <div>
              <label className="block font-medium text-light/80 mb-2">Select Teams</label>
              
              <div className="flex flex-wrap gap-2">
                {/* All Teams Option */}
                <button
                  type="button"
                  onClick={() => {
                    if (orderForm.teams.length === clubTeams.length) {
                      setOrderForm(f => ({ ...f, teams: [] }));
                    } else {
                      setOrderForm(f => ({ ...f, teams: clubTeams.map(t => t.id) }));
                    }
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    orderForm.teams.length === clubTeams.length || orderForm.teams.length === 0
                      ? 'bg-primary text-white ring-2 ring-primary'
                      : 'bg-white/10 text-light/70 hover:bg-white/15'
                  }`}
                >
                  All Teams
                </button>

                {/* Individual Teams */}
                {clubTeams.map(team => {
                  const isSelected = orderForm.teams.includes(team.id);
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setOrderForm(f => ({ 
                            ...f, 
                            teams: f.teams.filter(id => id !== team.id) 
                          }));
                        } else {
                          setOrderForm(f => ({ 
                            ...f, 
                            teams: [...f.teams, team.id] 
                          }));
                        }
                      }}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-primary text-white ring-2 ring-primary'
                          : 'bg-white/10 text-light/70 hover:bg-white/15'
                      }`}
                    >
                      {team.name}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-light/50 mt-2">
                {orderForm.teams.length === 0 || orderForm.teams.length === clubTeams.length
                  ? 'All teams selected'
                  : `${orderForm.teams.length} team${orderForm.teams.length !== 1 ? 's' : ''} selected`}
              </p>
            </div>

            {/* Deadline */}
            <div>
              <label className="block font-medium text-light/80 mb-1">Deadline (Optional)</label>
              <input
                type="date"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                value={orderForm.deadline}
                onChange={(e) => setOrderForm(f => ({ ...f, deadline: e.target.value }))}
              />
            </div>

            {/* Custom Fields */}
            <div className="border-t border-white/10 pt-4">
              <h4 className="font-medium text-light mb-3">Custom Fields</h4>
              
              {/* Existing Fields */}
              {orderForm.fields.length > 0 && (
                <div className="space-y-2 mb-4">
                  {orderForm.fields.map(field => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3"
                    >
                      <div>
                        <span className="text-light font-medium">{field.label}</span>
                        <span className="text-xs text-light/50 ml-2">
                          ({field.type})
                          {field.required && ' *'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFieldFromOrder(field.id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Field */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-light/80 mb-1">Field Label</label>
                    <input
                      type="text"
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-light placeholder-light/40"
                      value={newField.label}
                      onChange={(e) => setNewField(f => ({ ...f, label: e.target.value }))}
                      placeholder="e.g., Size, Color"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-light/80 mb-1">Field Type</label>
                    <select
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-light"
                      value={newField.type}
                      onChange={(e) => setNewField(f => ({ ...f, type: e.target.value }))}
                    >
                      <option value="text" className="bg-mid-dark">Text</option>
                      <option value="number" className="bg-mid-dark">Number</option>
                      <option value="dropdown" className="bg-mid-dark">Dropdown</option>
                      <option value="textarea" className="bg-mid-dark">Long Text</option>
                    </select>
                  </div>
                </div>

                {newField.type === 'dropdown' && (
                  <div>
                    <label className="block text-sm font-medium text-light/80 mb-1">Options (comma separated)</label>
                    <input
                      type="text"
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-light placeholder-light/40"
                      placeholder="e.g., S, M, L, XL"
                      onChange={(e) => {
                        const opts = e.target.value.split(',').map(o => o.trim()).filter(o => o);
                        setNewField(f => ({ ...f, options: opts }));
                      }}
                    />
                  </div>
                )}

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newField.required}
                    onChange={(e) => setNewField(f => ({ ...f, required: e.target.checked }))}
                  />
                  <span className="text-sm text-light/80">Required field</span>
                </label>

                <button
                  type="button"
                  onClick={addFieldToOrder}
                  className="w-full px-4 py-2 text-sm bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-all"
                >
                  Add Field
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleCreateOrder}
                className="flex-1 px-4 py-2 text-sm bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
                disabled={orderForm.fields.length === 0}
              >
                Create Order
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateOrderModal(false);
                  resetOrderForm();
                }}
                className="px-4 py-2 text-sm bg-white/10 hover:bg-white/15 text-light rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
)}
      </div>

{/* View Responses Modal */}
{showOrderResponsesModal && selectedOrder && (
  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-mid-dark border border-white/20 rounded-xl shadow-2xl p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
      <div className="mb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-title text-2xl text-light">{selectedOrder.title} - Responses</h3>
            <p className="text-sm text-light/60 mt-1">
              {orderResponses.filter(r => r.status === 'accepted').length} Accepted • 
              {orderResponses.filter(r => r.status === 'declined').length} Declined • 
              {orderResponses.filter(r => r.status === 'pending').length} Pending
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportToExcel(selectedOrder, orderResponses)}
              className="px-4 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all"
              disabled={orderResponses.length === 0}
            >
              📊 Export All
            </button>
            <button
              onClick={() => {
                setShowOrderResponsesModal(false);
                setSelectedOrder(null);
                setOrderResponses([]);
                setOrderStatusFilter('all');
                setOrderSearchQuery('');
              }}
              className="text-light/60 hover:text-light transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filters - NEW SECTION */}
        {!loadingResponses && orderResponses.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 p-4 bg-white/5 rounded-lg border border-white/10">
            {/* Status Filters */}
            <div className="flex gap-1">
              <button
                onClick={() => setOrderStatusFilter('all')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  orderStatusFilter === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-white/5 text-light/70 hover:bg-white/10'
                }`}
              >
                All ({orderResponses.length})
              </button>
              <button
                onClick={() => setOrderStatusFilter('accepted')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  orderStatusFilter === 'accepted'
                    ? 'bg-green-500 text-white'
                    : 'bg-white/5 text-light/70 hover:bg-white/10'
                }`}
              >
                ✓ Accepted ({orderResponses.filter(r => r.status === 'accepted').length})
              </button>
              <button
                onClick={() => setOrderStatusFilter('declined')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  orderStatusFilter === 'declined'
                    ? 'bg-red-500 text-white'
                    : 'bg-white/5 text-light/70 hover:bg-white/10'
                }`}
              >
                ✗ Declined ({orderResponses.filter(r => r.status === 'declined').length})
              </button>
              <button
                onClick={() => setOrderStatusFilter('pending')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  orderStatusFilter === 'pending'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-white/5 text-light/70 hover:bg-white/10'
                }`}
              >
                ⏳ Pending ({orderResponses.filter(r => r.status === 'pending').length})
              </button>
            </div>

            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="🔍 Search by name or email..."
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Clear Filters */}
            {(orderStatusFilter !== 'all' || orderSearchQuery) && (
              <button
                onClick={() => {
                  setOrderStatusFilter('all');
                  setOrderSearchQuery('');
                }}
                className="px-3 py-1.5 text-xs bg-white/5 text-light/70 hover:bg-white/10 rounded-lg transition-all"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {loadingResponses ? (
        <div className="text-center py-12 text-light/60">Loading responses...</div>
      ) : orderResponses.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-light/60">No eligible users found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-sm font-medium text-light/80 pb-3 pr-4">Name</th>
                <th className="text-left text-sm font-medium text-light/80 pb-3 pr-4">Status</th>
                {selectedOrder.fields.map(field => (
                  <th key={field.id} className="text-left text-sm font-medium text-light/80 pb-3 pr-4">
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredOrderResponses.length === 0 ? (
                <tr>
                  <td colSpan={selectedOrder.fields.length + 2} className="text-center py-8 text-light/60">
                    No users match your filters
                  </td>
                </tr>
              ) : (
                <>
                  {filteredOrderResponses.map((response, idx) => (
                    <tr
                      key={response.userId || idx}
                      className={`border-b border-white/5 ${
                        !response.hasResponded ? 'opacity-40' : 
                        response.status === 'declined' ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="py-3 pr-4">
                        <div>
                          <div className={`text-sm font-medium ${
                            !response.hasResponded ? 'text-light/50' : 'text-light'
                          }`}>
                            {response.userName}
                          </div>
                          <div className="text-xs text-light/50">{response.userEmail}</div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        {response.status === 'accepted' && (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-300 ring-1 ring-green-400">
                            ✓ Accepted
                          </span>
                        )}
                        {response.status === 'declined' && (
                          <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-300">
                            ✗ Declined
                          </span>
                        )}
                        {response.status === 'pending' && (
                          <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-300">
                            ⏳ Pending
                          </span>
                        )}
                      </td>
                      {selectedOrder.fields.map(field => (
                        <td key={field.id} className={`py-3 pr-4 text-sm ${
                          response.hasResponded ? 'text-light/70' : 'text-light/30'
                        }`}>
                          {response.responses?.[field.id] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Statistics */}
      {orderResponses.length > 0 && (
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-sm font-medium text-light/80 mb-3">Statistics</h4>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-light">{orderResponses.length}</div>
              <div className="text-xs text-light/50 mt-1">Total Eligible</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-400">
                {orderResponses.filter(r => r.status === 'accepted').length}
              </div>
              <div className="text-xs text-green-300 mt-1">Accepted</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-400">
                {orderResponses.filter(r => r.status === 'declined').length}
              </div>
              <div className="text-xs text-red-300 mt-1">Declined</div>
            </div>
            <div className="bg-yellow-500/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {orderResponses.filter(r => r.status === 'pending').length}
              </div>
              <div className="text-xs text-yellow-300 mt-1">Pending</div>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
)}
        {/* Notifications Tab */}
        {selectedClubId && activeTab === 'notifications' && (
          <NotificationsTab
            clubId={selectedClubId}
            clubTeams={clubTeams}
            userRole={user?.role}
          />
        )}

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

      {/* Remove Action Choice Modal */}
      {showRemoveActionModal && memberToRemove && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-mid-dark border border-white/20 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-light mb-4">
              Remove User
            </h3>
            
            <p className="text-light/70 mb-6">
              Choose how to remove <span className="text-light font-medium">{memberToRemove.username || memberToRemove.email}</span>:
            </p>

            <div className="space-y-3">
              <button
                onClick={handleRemoveFromTeamsChoice}
                className="w-full px-4 py-3 bg-white/10 hover:bg-white/15 text-light rounded-lg font-medium transition-all text-left flex items-center gap-3"
              >
                <span className="text-xl">👥</span>
                <div>
                  <div className="font-semibold">Remove from Teams</div>
                  <div className="text-xs text-light/60">Remove from selected teams only</div>
                </div>
              </button>

              <button
                onClick={handleRemoveFromClub}
                className="w-full px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg font-medium transition-all text-left flex items-center gap-3"
              >
                <span className="text-xl">🚫</span>
                <div>
                  <div className="font-semibold">Remove from Club</div>
                  <div className="text-xs text-red-300/60">Remove from club and all teams (Trainer only)</div>
                </div>
              </button>
            </div>

            <button
              onClick={() => {
                setShowRemoveActionModal(false);
                setMemberToRemove(null);
              }}
              className="w-full mt-4 px-4 py-3 bg-white/10 text-light rounded-lg hover:bg-white/15 font-medium transition"
            >
              Cancel
            </button>
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

      {/* Remove User from Specific Team Modal */}
      {showRemoveUserFromTeamModal && teamForUserRemoval && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-mid-dark border border-white/20 rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-2xl font-bold text-light mb-4">
              Remove User from {teamForUserRemoval.name}
            </h3>
            
            <p className="text-light/70 text-sm mb-6">
              Select which user to remove from this team:
            </p>

            <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
              {(() => {
                const allUserIds = [
                  ...(teamForUserRemoval.members || []),
                  ...(teamForUserRemoval.trainers || []),
                  ...(teamForUserRemoval.assistants || [])
                ];
                const uniqueUserIds = [...new Set(allUserIds)];

                if (uniqueUserIds.length === 0) {
                  return <p className="text-light/50 text-center py-4">No users in this team</p>;
                }

                return uniqueUserIds.map(userId => {
                  const userInfo = allUsers.find(u => u.id === userId) || { id: userId, email: userId };
                  const isMember = (teamForUserRemoval.members || []).includes(userId);
                  const isTrainer = (teamForUserRemoval.trainers || []).includes(userId);
                  const isAssistant = (teamForUserRemoval.assistants || []).includes(userId);

                  let roleLabel = '';
                  if (isTrainer) roleLabel = 'Trainer';
                  else if (isAssistant) roleLabel = 'Assistant';
                  else if (isMember) roleLabel = 'Member';

                  return (
                    <div
                      key={userId}
                      onClick={() => handleRemoveUserFromTeam(userId)}
                      className="p-4 bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/50 rounded-lg cursor-pointer transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-light">
                            {userInfo.username || userInfo.email}
                          </div>
                          <div className="text-xs text-light/50">{userInfo.email}</div>
                        </div>
                        <span className="px-2 py-1 bg-white/10 rounded text-xs text-light/70">
                          {roleLabel}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <button
              onClick={() => {
                setShowRemoveUserFromTeamModal(false);
                setTeamForUserRemoval(null);
              }}
              className="w-full px-4 py-3 bg-white/10 text-light rounded-lg hover:bg-white/15 font-medium transition"
            >
              Cancel
            </button>
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

      {/* Edit Club Modal */}
      {showEditClubModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-mid-dark border border-white/10 rounded-xl p-6 max-w-md w-full">
            <h3 className="font-title text-2xl text-light mb-4">Edit Club</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-light/80 font-medium mb-2">Club Name</label>
                <input
                  type="text"
                  value={editClubName}
                  onChange={(e) => setEditClubName(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-light/80 font-medium mb-2">Club Type</label>
                <select
                  value={editClubType}
                  onChange={(e) => {
                    setEditClubType(e.target.value);
                    if (e.target.value !== 'Custom') {
                      setEditCustomClubType('');
                    }
                  }}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="" className="bg-mid-dark text-light">Select type...</option>
                  {CLUB_TYPES.map(type => (
                    <option key={type} value={type} className="bg-mid-dark text-light">{type}</option>
                  ))}
                </select>
              </div>

              {editClubType === 'Custom' && (
                <div>
                  <label className="block text-light/80 font-medium mb-2">Custom Type</label>
                  <input
                    type="text"
                    value={editCustomClubType}
                    onChange={(e) => setEditCustomClubType(e.target.value)}
                    placeholder="Enter custom club type"
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowEditClubModal(false)}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/15 text-light rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleEditClub}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logo Upload Modal */}
      {showLogoUpload && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-mid-dark border border-white/10 rounded-xl p-6 max-w-md w-full">
            <h3 className="font-title text-2xl text-light mb-4">
              Change {logoUploadType === 'club' ? 'Club' : 'Team'} Logo
            </h3>
            
            <div className="mb-4">
              <label className="block text-light/80 font-medium mb-2">Select Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-white file:cursor-pointer hover:file:bg-primary/80"
              />
              <p className="text-xs text-light/50 mt-1">Max size: 5MB (JPG, PNG, GIF, WebP)</p>
            </div>

            {logoPreview && (
              <div className="mb-4">
                <p className="text-light/80 text-sm mb-2">Preview:</p>
                <img 
                  src={logoPreview} 
                  alt="Preview" 
                  className="w-full h-48 object-cover rounded-lg border border-white/20"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowLogoUpload(false);
                  setLogoFile(null);
                  setLogoPreview('');
                }}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/15 text-light rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadLogo}
                disabled={!logoFile}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
