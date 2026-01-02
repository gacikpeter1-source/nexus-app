// src/pages/ClubManagement.jsx
import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import NotificationsTab from '../components/NotificationsTab';

import { 
  getUserClubs, 
  getClub, 
  getAllUsers,
  getUser, 
  updateClub, 
  updateUser, 
  getPendingRequests, 
  updateRequest,
  createOrderTemplate,
  getOrderTemplate,
  updateOrderTemplate,
  deleteOrderTemplate,
  getClubOrderTemplates,
  getOrderResponses,
  getTeamEvents,
  deleteEvent
} from '../firebase/firestore';
import { getTeamChats, deleteChat } from '../firebase/chats';
import { notifyUserAdded, notifyUserRemoved, notifyRoleChanged } from '../utils/userManagementNotifications';
import {
  canPromoteToTrainer,
  canPromoteToAssistant,
  canDemoteUser,
  canRemoveFromClub,
  canRemoveFromTeam,
  isClubOwner
} from '../utils/permissions';
import { logAuditAction, logRoleChange } from '../utils/auditLogger';
import { AUDIT_ACTIONS } from '../constants/roles';
import { canAssignRole } from '../firebase/privileges';

export default function ClubManagement() {
  const { user, loading: authLoading, listClubsForUser } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();
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
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const actionButtonRefs = useRef({});

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

  // Teams Modal state
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [selectedMemberTeams, setSelectedMemberTeams] = useState(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!teamActionDropdown) return;

    const handleClickOutside = (e) => {
      const isClickOnButton = Object.values(actionButtonRefs.current).some(
        ref => ref?.contains(e.target)
      );
      if (!isClickOnButton) {
        setTeamActionDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [teamActionDropdown]);

  async function loadInitialData() {
    try {
      // Load users
      const usersAll = await getAllUsers();
      setAllUsers(usersAll);

      // Load clubs - Use getUserClubs for all users (including SuperAdmin)
      let clubsAll = [];
      if (user?.id) {
        // Use getUserClubs which queries by user membership
        clubsAll = await getUserClubs(user.id);
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
        const userTeamIds = teams.filter(team => (team.members || []).includes(m.id)).map(team => team.id);
        const userTeamNames = teams.filter(team => (team.members || []).includes(m.id)).map(team => team.name);
        return { 
          ...m, 
          username: u.username || '', 
          email: u.email || '', 
          userRole: u.role || 'user', // Global user role (parent/admin/user)
          clubRole: m.role, // Club role (trainer/assistant/user)
          teamIds: userTeamIds, 
          teamNames: userTeamNames 
        };
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
      // Pass clubId to query so Firestore can filter at database level
      const clubRequests = await getPendingRequests(clubId);
      // Filter again for safety (status already filtered in query)
      const pendingOnly = clubRequests.filter(r => r.status === 'pending');
      setPendingRequests(pendingOnly);
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
        updatedTeams = updatedTeams.map(team => {
          if (team.id === request.teamId) {
            const teamMembers = [...(team.members || [])];
            if (!teamMembers.includes(request.userId)) {
              teamMembers.push(request.userId);
            }
            return { ...team, members: teamMembers };
          }
          return team;
        });
      }

      // Update club in Firebase
      await updateClub(request.clubId, {
        members: updatedMembers,
        teams: updatedTeams
      });

      // Update user's clubIds array
      const requestUser = await getUser(request.userId);
      const updatedClubIds = [...(requestUser.clubIds || [])];
      if (!updatedClubIds.includes(request.clubId)) {
        updatedClubIds.push(request.clubId);
      }
      await updateUser(request.userId, { clubIds: updatedClubIds });

      // Send notification to user
      const teamName = request.teamId 
        ? updatedTeams.find(t => t.id === request.teamId)?.name 
        : null;
      await notifyUserAdded(
        request.userId,
        request.clubId,
        club.name,
        request.teamId || null,
        teamName
      );

      showToast(t('clubmgmt.requestApproved'), 'success');
      await loadPendingRequests(selectedClubId);
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error approving request:', error);
      showToast(t('clubmgmt.failedToApproveRequest'), 'error');
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

      showToast(t('clubmgmt.requestDenied'), 'info');
      await loadPendingRequests(selectedClubId);
    } catch (error) {
      console.error('Error denying request:', error);
      showToast(t('clubmgmt.failedToDenyRequest'), 'error');
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
      showToast(t('clubmgmt.clubDeletedSuccessfully'), 'success');
      await loadInitialData(); // Reload clubs
      setSelectedClubId('');
    } catch (error) {
      console.error('Error deleting club:', error);
      showToast(t('clubmgmt.failedToDeleteClub'), 'error');
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
        return showToast(t('clubmgmt.clubNotFound'), 'error');
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
        return showToast(t('clubmgmt.userIsNotInAnyTeams'), 'info');
      }
      
      // Open team selection modal
      setUserToRemove(memberToRemove);
      setTeamsToRemoveFrom([]);
      setShowRemoveActionModal(false);
      setShowRemoveModal(true);
    } catch (error) {
      console.error('Error loading teams:', error);
      showToast(t('clubmgmt.failedToLoadTeams'), 'error');
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
      return showToast(t('clubmgmt.onlyTrainersCanRemoveUsers'), 'error');
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

      // Send notification to user
      await notifyUserRemoved(
        memberToRemove.id,
        selectedClubId,
        club.name,
        null,
        null
      );

      showToast(t('clubmgmt.userRemovedFromClub'), 'success');
      setShowRemoveActionModal(false);
      setMemberToRemove(null);
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error removing from club:', error);
      showToast(t('clubmgmt.failedToRemoveFromClub'), 'error');
    }
  };

  const confirmRemoveFromTeams = async () => {
    if (!userToRemove || teamsToRemoveFrom.length === 0) {
      return showToast(t('clubmgmt.pleaseSelectAtLeastOneTeam'), 'error');
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
      showToast(t('clubmgmt.removedFrom') + ` ${teamsToRemoveFrom.length} team(s)`, 'success');
      setShowRemoveModal(false);
      setUserToRemove(null);
      setTeamsToRemoveFrom([]);
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error removing member:', error);
      showToast(t('clubmgmt.failedToRemoveMemberFromTeams'), 'error');
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
    
    setTeamsToRemoveFrom(userTeams.map(team => team.id));
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

      const updatedTeams = (club.teams || []).map(team => {
        if (team.id === teamToAssign.id) {
          return {
            ...team,
            members: [...new Set([...(team.members || []), userId])]
          };
        }
        return team;
      });

      await updateClub(selectedClubId, { teams: updatedTeams });
      showToast(t('clubmgmt.userAddedToTeam'), 'success');
      setShowQuickAssignModal(false);
      setQuickAssignSearch('');
      setQuickAssignMatches([]);
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error assigning to team:', error);
      showToast(t('clubmgmt.failedToAssignUser'), 'error');
    }
  };

  const handleRenameTeam = async () => {
    if (!selectedClubId || !teamToRename || !renameTeamName.trim()) {
      showToast(t('clubmgmt.pleaseEnterTeamName'), 'error');
      return;
    }

    try {
      const club = await getClub(selectedClubId);
      if (!club) return;

      const updatedTeams = (club.teams || []).map(team => 
        team.id === teamToRename.id 
          ? { ...team, name: renameTeamName.trim() }
          : team
      );

      await updateClub(selectedClubId, { teams: updatedTeams });
      showToast(t('clubmgmt.teamRenamedSuccessfully'), 'success');
      setShowRenameTeamModal(false);
      setTeamToRename(null);
      setRenameTeamName('');
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error renaming team:', error);
      showToast(t('clubmgmt.failedToRenameTeam'), 'error');
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!selectedClubId || !teamId) return;

    const club = await getClub(selectedClubId);
    if (!club) return;

    const teamToDelete = (club.teams || []).find(t => t.id === teamId);
    if (!teamToDelete) return;

    // Confirm deletion
    const confirmMessage = t('clubmgmt.areYouSureWantToDelete') + ` "${teamToDelete.name}"?\n\n⚠️ This will permanently delete:\n- The team\n- All team events\n- All team chats\n- All team members will be unassigned\n\nThis action cannot be undone!`;
    
    if (!window.confirm(confirmMessage)) return;

    try {
      // 1. Delete all team events
      const teamEvents = await getTeamEvents(teamId);
      for (const event of teamEvents) {
        await deleteEvent(event.id);
      }

      // 2. Delete all team chats
      const teamChats = await getTeamChats(selectedClubId, teamId);
      for (const chat of teamChats) {
        await deleteChat(chat.id);
      }

      // 3. Remove team from club
      const updatedTeams = (club.teams || []).filter(t => t.id !== teamId);
      await updateClub(selectedClubId, { teams: updatedTeams });

      // 🔒 AUDIT LOG: Team deletion
      await logAuditAction(
        AUDIT_ACTIONS.TEAM_DELETED,
        user.id,
        teamId,
        {
          clubId: selectedClubId,
          clubName: club.name,
          teamName: teamToDelete.name,
          memberCount: (teamToDelete.members || []).length,
          eventsDeleted: teamEvents.length,
          chatsDeleted: teamChats.length,
          action: 'delete_team'
        }
      );

      showToast(t('clubmgmt.teamDeletedSuccessfully').replace('{teamName}', teamToDelete.name), 'success');
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error deleting team:', error);
      showToast(t('clubmgmt.failedToDeleteTeam') + ': ' + error.message, 'error');
    }
  };

  const handleLeaveClub = async () => {
    if (!selectedClubId) return;
    
    const selectedClub = clubs.find(c => c.id === selectedClubId);
    if (!selectedClub) return;
    
    // Can't leave if you're the owner
    if (isClubOwner(user, selectedClub)) {
      return showToast(t('clubmgmt.clubOwnersCannotLeave'), 'error');
    }
    
    if (!window.confirm(t('clubmgmt.areYouSureWantToLeave') + ` ${selectedClub.name}?`)) return;
    
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
      
      showToast(t('clubmgmt.leftClubSuccessfully'), 'success');
      setSelectedClubId('');
      await loadInitialData();
    } catch (error) {
      console.error('Error leaving club:', error);
      showToast(t('clubmgmt.failedToLeaveClub'), 'error');
    }
  };

  const handleChangeRole = async (userId, newClubRole) => {
    if (!selectedClubId) return;
    
    console.log('🔄 Changing CLUB role:', { userId, newClubRole, selectedClubId });
    
    try {
      // Get fresh club data
      const club = await getClub(selectedClubId);
      if (!club) {
        console.error('❌ Club not found');
        return showToast(t('clubmgmt.clubNotFound'), 'error');
      }

      // Remove user from all club role arrays first
      let updatedTrainers = (club.trainers || []).filter(id => id !== userId);
      let updatedAssistants = (club.assistants || []).filter(id => id !== userId);
      let updatedMembers = (club.members || []).filter(id => id !== userId);

      // Add user to correct array based on new CLUB role
      if (newClubRole === 'trainer') {
        updatedTrainers.push(userId);
        console.log('➕ Added to trainers array');
      } else if (newClubRole === 'assistant') {
        updatedAssistants.push(userId);
        console.log('➕ Added to assistants array');
      } else {
        // 'user' or default goes to members
        updatedMembers.push(userId);
        console.log('➕ Added to members array');
      }

      // Update club arrays ONLY (do NOT touch user's role field)
      await updateClub(selectedClubId, {
        trainers: updatedTrainers,
        assistants: updatedAssistants,
        members: updatedMembers
      });
      console.log('✅ Club role arrays updated successfully');
      
      // Send notification to user
      const targetUser = await getUser(userId);
      await notifyRoleChanged(
        userId,
        selectedClubId,
        club.name,
        newClubRole,
        'previous-role'
      );
      
      showToast(`Club role updated to ${newClubRole}`, 'success');
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('❌ Error changing club role:', error);
      showToast(t('clubmgmt.failedToChangeRole') + `: ${error.message}`, 'error');
    }
  };

  // Edit Club function
  async function handleEditClub() {
    if (!editClubName.trim()) {
      showToast(t('clubmgmt.clubNameRequired'), 'error');
      return;
    }

    const finalClubType = editClubType === 'Custom' 
      ? editCustomClubType.trim() 
      : editClubType;

    if (!finalClubType) {
      showToast(t('clubmgmt.clubTypeRequired'), 'error');
      return;
    }

    try {
      await updateClub(selectedClubId, {
        name: editClubName.trim(),
        clubType: finalClubType
      });

      showToast(t('clubmgmt.clubUpdatedSuccessfully'), 'success');
      setShowEditClubModal(false);
      
      // Reload clubs list
      await loadClubs();
    } catch (error) {
      console.error('Error updating club:', error);
      showToast(t('clubmgmt.failedToUpdateClub'), 'error');
    }
  }

  // Logo upload functions
  function handleLogoFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast(t('clubmgmt.imageMustBeLessThan5MB'), 'error');
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
      showToast(t('clubmgmt.pleaseSelectImage'), 'error');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = reader.result;
        
        if (logoUploadType === 'club') {
          await updateClub(selectedClubId, { logoUrl: base64Image });
          showToast(t('clubmgmt.clubLogoUpdated'), 'success');
          await loadClubData(selectedClubId);
        } else if (logoUploadType === 'team' && selectedTeamForLogo) {
          const club = await getClub(selectedClubId);
          const updatedTeams = club.teams.map(team =>
            team.id === selectedTeamForLogo.id ? { ...team, logoUrl: base64Image } : team
          );
          await updateClub(selectedClubId, { teams: updatedTeams });
          showToast(t('clubmgmt.teamLogoUpdated'), 'success');
          await loadClubData(selectedClubId);
        }
        
        setShowLogoUpload(false);
        setLogoFile(null);
        setLogoPreview('');
      };
      reader.readAsDataURL(logoFile);
    } catch (error) {
      console.error('Error uploading logo:', error);
      showToast(t('clubmgmt.failedToUploadLogo'), 'error');
    }
  }

  const handlePromoteToTrainer = async (memberId) => {
    if (!selectedClubId || !memberId) return;
    
    try {
      // 🔒 PERMISSION VALIDATION: Check if current user can assign trainer role
      const permissionCheck = await canAssignRole(user.id, memberId, 'trainer', selectedClubId);
      if (!permissionCheck.allowed) {
        showToast(`❌ ${permissionCheck.reason}`, 'error');
        return;
      }
      
      const club = await getClub(selectedClubId);
      if (!club) return;

      const updatedClub = {
        trainers: [...new Set([...(club.trainers || []), memberId])],
        assistants: (club.assistants || []).filter(id => id !== memberId),
        members: (club.members || []).filter(id => id !== memberId)
      };

      await updateClub(selectedClubId, updatedClub);
      
      // 🔒 AUDIT LOG: Role promotion to trainer
      const targetUser = await getUser(memberId);
      await logRoleChange(
        AUDIT_ACTIONS.ROLE_PROMOTED,
        user.id,
        memberId,
        targetUser?.role || 'user',
        'trainer',
        selectedClubId
      );
      
      showToast(t('clubmgmt.memberPromotedToTrainer'), 'success');
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error promoting member:', error);
      showToast(t('clubmgmt.failedToPromoteMember'), 'error');
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
      
      // 🔒 AUDIT LOG: Role demotion to member
      const targetUser = await getUser(memberId);
      await logRoleChange(
        AUDIT_ACTIONS.ROLE_DEMOTED,
        user.id,
        memberId,
        targetUser?.role || 'trainer',
        'user',
        selectedClubId
      );
      
      showToast(t('clubmgmt.memberDemotedToRegularMember'), 'success');
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error demoting member:', error);
      showToast(t('clubmgmt.failedToDemoteMember'), 'error');
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
    showToast(t('clubmgmt.failedToLoadOrders'), 'error');
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
    showToast(t('clubmgmt.fieldLabelRequired'), 'error');
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
    showToast(t('clubmgmt.noUsersToExport'), 'info');
    return;
  }

  // Create CSV content - NOW INCLUDES ALL USERS (responded + pending)
  const headers = ['Name', 'Email', 'Status', ...order.fields.map(f => f.label)];
  const csvRows = [headers.join(',')];

  responses.forEach(response => {
    const row = [
      `"${response.userName}"`,
      `"${response.userEmail}"`,
      response.status === 'pending' ? t('clubmgmt.notResponded') : response.status,
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
  
  showToast(t('clubmgmt.exported') + ` ${responses.length} ` + t('clubmgmt.usersToExcel'), 'success');
}

async function handleCreateOrder() {
  if (!orderForm.title.trim()) {
    showToast(t('clubmgmt.orderTitleRequired'), 'error');
    return;
  }

  if (orderForm.fields.length === 0) {
    showToast(t('clubmgmt.addAtLeastOneCustomField'), 'error');
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

    // Send notification to club members
    try {
      const { notifyNewOrder, getNotificationRecipients } = await import('../utils/notifications');
      const recipients = await getNotificationRecipients(selectedClubId);
      await notifyNewOrder(orderData, recipients);
    } catch (err) {
      console.log('Could not send notification:', err);
    }

    showToast(t('clubmgmt.orderCreatedSuccessfully'), 'success');
    setShowCreateOrderModal(false);
    resetOrderForm();
    await loadOrders();
    } catch (error) {
      console.error('Error creating order:', error);
      showToast(t('clubmgmt.failedToCreateOrder'), 'error');
    }
}

async function handleCloseOrder(orderId) {
  if (!confirm('Close this order? No more responses will be accepted.')) return;

  try {
    await updateOrderTemplate(orderId, { status: 'closed' });
    showToast(t('clubmgmt.orderClosed'), 'success');
    await loadOrders();
  } catch (error) {
    console.error('Error closing order:', error);
    showToast(t('clubmgmt.failedToCloseOrder'), 'error');
  }
}

async function handleDeleteOrder(orderId) {
  if (!confirm('Delete this order? All responses will be lost.')) return;

  try {
    await deleteOrderTemplate(orderId);
    showToast(t('clubmgmt.orderDeleted'), 'success');
    await loadOrders();
  } catch (error) {
    console.error('Error deleting order:', error);
    showToast(t('clubmgmt.failedToDeleteOrder'), 'error');
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
    showToast(t('clubmgmt.failedToLoadResponses'), 'error');
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

      // 🔒 MINIMUM TRAINER ENFORCEMENT: Check if removing last trainer
      const targetTeam = (club.teams || []).find(t => t.id === teamForUserRemoval.id);
      if (targetTeam) {
        const isTrainer = (targetTeam.trainers || []).includes(userId);
        const trainerCount = (targetTeam.trainers || []).length;
        
        if (isTrainer && trainerCount <= 1) {
          showToast(
            '❌ ' + t('clubmgmt.cannotRemoveLastTrainer') ,
            'error'
          );
          return;
        }
      }

      const updatedTeams = (club.teams || []).map(team => {
        if (team.id === teamForUserRemoval.id) {
          return {
            ...team,
            members: (team.members || []).filter(id => id !== userId),
            trainers: (team.trainers || []).filter(id => id !== userId),
            assistants: (team.assistants || []).filter(id => id !== userId)
          };
        }
        return team;
      });

      await updateClub(selectedClubId, { teams: updatedTeams });
      
      // Send notification to user
      await notifyUserRemoved(
        userId,
        selectedClubId,
        club.name,
        teamForUserRemoval.id,
        teamForUserRemoval.name
      );
      
      showToast(t('clubmgmt.userRemovedFromTeam'), 'success');
      setShowRemoveUserFromTeamModal(false);
      setTeamForUserRemoval(null);
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error removing user from team:', error);
      showToast(t('clubmgmt.failedToRemoveUserFromTeam'), 'error');
    }
  };

  const handleCreateTeam = async () => {
    if (!selectedClubId || !newTeamName.trim()) {
      showToast(t('clubmgmt.pleaseEnterTeamName'), 'error');
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
        assistants: [],
        createdAt: new Date().toISOString()
      };

      const updatedClub = {
        teams: [...(club.teams || []), newTeam]
      };

      await updateClub(selectedClubId, updatedClub);
      
      // 🔒 AUDIT LOG: Team creation
      await logAuditAction(
        AUDIT_ACTIONS.TEAM_CREATED,
        user.id,
        newTeam.id,
        {
          clubId: selectedClubId,
          clubName: club.name,
          teamName: newTeam.name,
          action: 'create_team'
        }
      );
      
      showToast(t('clubmgmt.teamCreatedSuccessfully'), 'success');
      setNewTeamName('');
      setShowCreateTeamModal(false);
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error creating team:', error);
      showToast(t('clubmgmt.failedToCreateTeam'), 'error');
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
      showToast(t('clubmgmt.memberAssignedToTeams'), 'success');
      setShowTeamAssignModal(false);
      setUserToAssign(null);
      setSelectedTeamsForAssignment([]);
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error assigning to teams:', error);
      showToast(t('clubmgmt.failedToAssignToTeams'), 'error');
    }
  };

  const handleRemoveFromTeam = async (memberId, teamId) => {
    if (!selectedClubId) return;
    
    try {
      const club = await getClub(selectedClubId);
      if (!club) return;

      // 🔒 MINIMUM TRAINER ENFORCEMENT: Check if removing last trainer
      const targetTeam = (club.teams || []).find(t => t.id === teamId);
      if (targetTeam) {
        const isTrainer = (targetTeam.trainers || []).includes(memberId);
        const trainerCount = (targetTeam.trainers || []).length;
        
        if (isTrainer && trainerCount <= 1) {
          showToast(
            '❌ Cannot remove last trainer from team. Please assign another trainer first.',
            'error'
          );
          return;
        }
      }

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
      showToast(t('clubmgmt.memberRemovedFromTeam'), 'success');
      await loadClubData(selectedClubId);
    } catch (error) {
      console.error('Error removing from team:', error);
      showToast(t('clubmgmt.failedToRemoveFromTeam'), 'error');
    }
  };

  if (authLoading) {
    return <div className="p-6 text-light">{t('clubmgmt.loading')}</div>;
  }

  if (!user) {
    return <div className="p-6 text-light">{t('clubmgmt.pleaseSignIn')}</div>;
  }

  return (
    <div className="flex flex-col min-h-screen p-1">
      <div 
        className="flex-1 overflow-auto"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          overscrollBehavior: 'contain'
        }}
      >
        <div className="mb-2 animate-fade-in">
          <h1 className="font-display text-3xl md:text-5xl lg:text-7xl text-light mb-2 tracking-wider">
            <span className="text-primary">{t('event.club')}</span> {t('clubmgmt.management')}
          </h1>
          <p className="text-light/60 text-sm md:text-lg">{t('clubmgmt.manageClubMembersAndTeams')}</p>
        </div>

        {/* Club selector */}
        <div className="mb-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <label className="block mb-1 text-light/80 font-medium">{t('clubmgmt.selectClub')}</label>
          <select
            value={selectedClubId}
            onChange={e => setSelectedClubId(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          >
            <option value="" className="bg-mid-dark">-- {t('clubmgmt.management')} --</option>
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
                className="px-1 py-0.5 md:px-2 md:py-0.8 md:px-4 md:py-2 bg-primary/80 hover:bg-primary text-white rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2"
              >
                <span>{t('clubmgmt.createTeam')}</span>
              </button>
              
              <button
                onClick={() => {
                  const club = clubs.find(c => c.id === selectedClubId);
                  setEditClubName(club?.name || '');
                  setEditClubType(club?.clubType || '');
                  setEditCustomClubType('');
                  setShowEditClubModal(true);
                }}
                className="px-1 py-0.5 md:px-2 md:py-0.8 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2"
              >
                <span>{t('clubmgmt.editClub')}</span>
              </button>
              
              <button
                onClick={() => {
                  setLogoUploadType('club');
                  setShowLogoUpload(true);
                }}
                className="px-1 py-0.5 md:px-2 md:py-0.8 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2"
              >
                 <span>{t('clubmgmt.changeLogo')}</span>
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
                    <span className="text-light/50">{t('clubmgmt.owner')}:</span>
                    <span className="text-light font-medium">{ownerEmail}</span>
                  </span>
                  <span className="hidden sm:inline text-light/30">•</span>
                  <span className="flex items-center gap-1">
                    <span className="text-light/50">{t('clubmgmt.teams')}:</span>
                    <span className="text-accent font-medium">{teamsCount}</span>
                  </span>
                  <span className="hidden sm:inline text-light/30">•</span>
                  <span className="flex items-center gap-1">
                    <span className="text-light/50">{t('clubmgmt.trainers')}:</span>
                    <span className="text-success font-medium">{trainersCount}</span>
                  </span>
                  <span className="hidden sm:inline text-light/30">•</span>
                  <span className="flex items-center gap-1">
                    <span className="text-light/50">{t('clubmgmt.assistants')}:</span>
                    <span className="text-secondary font-medium">{assistantsCount}</span>
                  </span>
                  <span className="hidden sm:inline text-light/30">•</span>
                  <span className="flex items-center gap-1">
                    <span className="text-light/50">{t('clubmgmt.users')}:</span>
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
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setActiveTab('management')}
                className={`
                  px-1 py-0.5 md:px-2 md:py-0.8 rounded-lg transition-all duration-200 font-medium text-xs md:text-sm
                  ${activeTab === 'management'
                    ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg'
                    : 'bg-white/5 text-light/70 hover:bg-white/10 hover:text-light'}
                `}
              >
                👥 {t('clubmgmt.management')}
              </button>

              <button
                onClick={() => setActiveTab('statistics')}
                className={`
                  px-1 py-0.5 md:px-2 md:py-0.8 rounded-lg transition-all duration-200 font-medium text-xs md:text-sm
                  ${activeTab === 'statistics'
                    ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg'
                    : 'bg-white/5 text-light/70 hover:bg-white/10 hover:text-light'}
                `}
              >
                📊 {t('clubmgmt.statistics')}
              </button>

              <button
                onClick={() => setActiveTab('requests')}
                className={`
                  px-1 py-0.5 md:px-2 md:py-0.8 rounded-lg transition-all duration-200 font-medium text-xs md:text-sm
                  ${activeTab === 'requests'
                    ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg'
                    : 'bg-white/5 text-light/70 hover:bg-white/10 hover:text-light'}
                `}
              >
                📬 {t('clubmgmt.pendingRequests')}
              </button>

              <button
                onClick={() => setActiveTab('orders')}
                className={`
                  px-1 py-0.5 md:px-2 md:py-0.8 rounded-lg transition-all duration-200 font-medium text-xs md:text-sm
                  ${activeTab === 'orders'
                    ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg'
                    : 'bg-white/5 text-light/70 hover:bg-white/10 hover:text-light'}
                `}
              >
                🛒 {t('clubmgmt.orders')}
              </button>

              <button
                onClick={() => setActiveTab('notifications')}
                className={`
                  px-1 py-0.5 md:px-2 md:py-0.8 rounded-lg transition-all duration-200 font-medium text-xs md:text-sm
                  ${activeTab === 'notifications'
                    ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg'
                    : 'bg-white/5 text-light/70 hover:bg-white/10 hover:text-light'}
                `}
              >
                🔔 {t('clubmgmt.notifications')}
              </button>
            </div>
          </div>
        )}

        {selectedClubId && activeTab === 'management' && (
          <>
            {/* Teams List - Enhanced */}
            {selectedClubId && clubTeams.length > 0 && (
              <div className="mb-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 overflow-visible">
                <h2 className="font-title text-xl md:text-2xl text-light mb-4">Teams in this Club</h2>
                
                {/* Filter by Trainer/Assistant */}
<div className="mb-4">
                  <label className="block text-sm font-medium text-light/80 mb-2">{t('clubmgmt.filterByTrainerAssistant')}</label>
                  <select
                    value={teamTrainerFilter}
                    onChange={e => setTeamTrainerFilter(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 md:px-4 py-2 text-sm md:text-base text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    <option value="" className="bg-mid-dark">{t('clubmgmt.allTeams')}</option>
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
                            <optgroup label={t('clubmgmt.trainers')} className="bg-mid-dark">
                              {trainersList.map(m => (
                                <option key={m.id} value={m.id} className="bg-mid-dark">
                                  {m.username} - {m.email}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {assistantsList.length > 0 && (
                            <optgroup label={t('clubmgmt.assistants')} className="bg-mid-dark">
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

                <div className="grid gap-3 overflow-visible">
                  {clubTeams
                    .filter(t => {
                      if (!teamTrainerFilter) return true;
                      return (t.trainers || []).includes(teamTrainerFilter) || 
                             (t.assistants || []).includes(teamTrainerFilter);
                    })
                    .map(team => {
                      const memberCount = (team.members || []).length;
                      const trainerCount = (team.trainers || []).length;
                      const assistantCount = (team.assistants || []).length;
                      
                      return (
                        <div key={team.id} className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4 hover:bg-white/10 transition-all overflow-visible">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 
                                onClick={() => navigate(`/team/${selectedClubId}/${team.id}`)}
                                className="font-semibold text-light text-base md:text-lg mb-2 cursor-pointer hover:text-primary transition-colors truncate"
                              >
                                {team.name}
                              </h3>
                              <div className="flex flex-wrap gap-2 md:gap-4 text-xs md:text-sm text-light/70">
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
                              <div className="relative flex-shrink-0">
                                <button 
                                  ref={(el) => {
                                    if (el) actionButtonRefs.current[team.id] = el;
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (teamActionDropdown === team.id) {
                                      setTeamActionDropdown(null);
                                    } else {
                                      const rect = actionButtonRefs.current[team.id]?.getBoundingClientRect();
                                      if (rect) {
                                        setDropdownPosition({
                                          top: rect.bottom + window.scrollY + 8,
                                          right: window.innerWidth - rect.right + window.scrollX
                                        });
                                      }
                                      setTeamActionDropdown(team.id);
                                    }
                                  }}
                                  className="px-3 md:px-4 py-1.5 md:py-2 bg-white/10 hover:bg-white/15 text-light rounded-lg text-xs md:text-sm font-medium transition-all flex items-center gap-1 md:gap-2 whitespace-nowrap"
                                >
                                  <span>{t('clubmgmt.actions')}</span>
                                  <span className="text-xs">▼</span>
                                </button>

                                {/* Dropdown Menu - Rendered via Portal */}
                                {teamActionDropdown === team.id && createPortal(
                                  <div 
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      position: 'fixed',
                                      top: `${dropdownPosition.top}px`,
                                      right: `${dropdownPosition.right}px`,
                                      zIndex: 9999
                                    }}
                                    className="w-48 bg-mid-dark border border-white/20 rounded-lg shadow-xl"
                                  >
                                    <button
                                      onClick={() => {
                                        setTeamActionDropdown(null);
                                        setTeamToRename(team);
                                        setRenameTeamName(team.name);
                                        setShowRenameTeamModal(true);
                                      }}
                                      className="w-full px-4 py-2 text-left text-light hover:bg-white/10 transition rounded-t-lg flex items-center gap-2"
                                    >
                                      <span>✏️</span>
                                      <span>{t('clubmgmt.renameTeam')}</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setTeamActionDropdown(null);
                                        openQuickAssignModal(team);
                                      }}
                                      className="w-full px-4 py-2 text-left text-light hover:bg-white/10 transition flex items-center gap-2"
                                    >
                                      <span>➕</span>
                                      <span>Assign User</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setTeamActionDropdown(null);
                                        setTeamForUserRemoval(team);
                                        setShowRemoveUserFromTeamModal(true);
                                      }}
                                      className="w-full px-4 py-2 text-left text-light hover:bg-white/10 transition flex items-center gap-2"
                                    >
                                      <span>➖</span>
                                      <span>{t('clubmgmt.removeUser')}</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedTeamForLogo(team);
                                        setLogoUploadType('team');
                                        setShowLogoUpload(true);
                                        setTeamActionDropdown(null);
                                      }}
                                      className="w-full px-4 py-2 text-left hover:bg-white/10 transition flex items-center gap-2"
                                    >
                                      <span>🖼️</span>
                                      <span>{t('clubmgmt.changeLogo')}</span>
                                    </button>
                                    <div className="border-t border-white/10"></div>
                                    <button
                                      onClick={() => {
                                        setTeamActionDropdown(null);
                                        handleDeleteTeam(team.id);
                                      }}
                                      className="w-full px-4 py-2 text-left text-red-400 hover:bg-red-500/10 transition rounded-b-lg flex items-center gap-2"
                                    >
                                      <span>🗑️</span>
                                      <span>{t('clubmgmt.deleteTeam')}</span>
                                    </button>
                                  </div>,
                                  document.body
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
                placeholder={t('clubmgmt.searchMembersByUsernameOrEmail')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all w-full"
              />
            </div>

            {/* Filter by Team */}
            <div className="mb-4 flex items-center gap-2">
              <label className="text-light/80">{t('clubmgmt.filterByTeam')}:</label>
              <select
                value={selectedTeamFilter}
                onChange={e => setSelectedTeamFilter(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="" className="bg-mid-dark">{t('clubmgmt.all')}</option>
                <option value="none" className="bg-mid-dark">{t('clubmgmt.noTeam')}</option>
                {clubTeams.map(team => (
                  <option key={team.id} value={team.id} className="bg-mid-dark">{team.name}</option>
                ))}
              </select>
            </div>

            {/* Members Cards - Card-Based Layout */}
            <div className="space-y-2">
              {loading ? (
                <div className="py-8 text-center text-light/60">Loading members...</div>
              ) : filteredMembers.length === 0 ? (
                <div className="py-8 text-center text-light/40">{t('clubmgmt.noMembersFound')}</div>
              ) : (
                filteredMembers.map(m => {
                  // Get user initials for avatar
                  const getInitials = () => {
                    return m.username
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);
                  };

                  // Role-based dark colors (ONLY Trainer/Assistant get color, rest grey)
                  const getRoleColors = () => {
                    if (m.clubRole === 'trainer') {
                      return {
                        border: 'border-primary/30',
                        bg: 'bg-primary/10',
                        label: 'Trainer',
                        labelBg: 'bg-primary/20',
                        labelText: 'text-primary'
                      };
                    } else if (m.clubRole === 'assistant') {
                      return {
                        border: 'border-blue-500/30',
                        bg: 'bg-blue-500/10',
                        label: 'Assistant',
                        labelBg: 'bg-blue-500/20',
                        labelText: 'text-blue-300'
                      };
                    } else {
                      // Parent and Member get same grey style
                      return {
                        border: 'border-white/10',
                        bg: 'bg-white/5',
                        label: 'Member',
                        labelBg: 'bg-white/10',
                        labelText: 'text-light/70'
                      };
                    }
                  };

                  const colors = getRoleColors();

                  return (
                    <div
                      key={m.id}
                      className={`relative ${colors.bg} backdrop-blur-sm border ${colors.border} rounded-lg overflow-hidden transition-all hover:bg-white/10 ${
                        m.id === selectedMemberId ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 p-2 md:p-3">
                        {/* LEFT: User Avatar - FIXED SIZE */}
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border-2 border-white/20">
                            <div className="text-lg font-black text-primary">
                              {getInitials()}
                            </div>
                          </div>
                        </div>

                        {/* MIDDLE: User Info */}
                        <div className="flex-1 min-w-0">
                          {/* Role Label (Team Role + User Role if parent) */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-block px-2 py-0.5 ${colors.labelBg} ${colors.labelText} rounded text-[10px] font-semibold uppercase`}>
                              {colors.label}
                            </span>
                            {m.userRole === 'parent' && (
                              <span className="inline-block px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-[10px] font-semibold uppercase">
                                Parent
                              </span>
                            )}
                          </div>

                          {/* Username */}
                          <h3 className="text-light font-semibold text-sm md:text-base truncate">
                            {m.username}
                          </h3>

                          {/* Email */}
                          <p className="text-light/60 text-xs truncate">
                            {m.email}
                          </p>

                          {/* Club Name (Optional) */}
                          {(() => {
                            const club = clubs.find(c => c.id === selectedClubId);
                            return club ? (
                              <p className="text-light/40 text-[10px] mt-0.5">
                                {club.name}
                              </p>
                            ) : null;
                          })()}

                          {/* Teams - Clickable if multiple */}
                          {m.teamNames && m.teamNames.length > 0 && (
                            <div className="mt-1">
                              {m.teamNames.length === 1 ? (
                                <span className="inline-block text-[10px] text-light/50">
                                  Team: {m.teamNames[0]}
                                </span>
                              ) : (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setSelectedMemberTeams(m);
                                    setShowTeamsModal(true);
                                  }}
                                  className="text-[10px] text-accent hover:text-accent/80 underline"
                                >
                                  Teams: {m.teamNames.length} team{m.teamNames.length > 1 ? 's' : ''}
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* RIGHT: Actions Dropdown (50% smaller) */}
                        {isClubManager(clubs.find(c => c.id === selectedClubId)) && (
                          <div className="flex-shrink-0">
                            <select
                              onChange={async e => {
                                e.stopPropagation();
                                const action = e.target.value;
                                if (action === 'assign') {
                                  setUserToAssign(m);
                                  setShowTeamAssignModal(true);
                                } else if (action === 'promote-trainer') {
                                  handleChangeRole(m.id, 'trainer');
                                } else if (action === 'promote-assistant') {
                                  handleChangeRole(m.id, 'assistant');
                                } else if (action === 'demote-member') {
                                  handleChangeRole(m.id, 'user');
                                } else if (action === 'set-parent') {
                                  // Update USER role (not club role)
                                  try {
                                    await updateUser(m.id, { role: 'parent' });
                                    showToast('User role set to Parent', 'success');
                                    await loadClubData(selectedClubId);
                                  } catch (error) {
                                    console.error('Error setting parent role:', error);
                                    showToast('Failed to set parent role', 'error');
                                  }
                                } else if (action === 'remove-parent') {
                                  // Remove parent role (set back to 'user')
                                  try {
                                    await updateUser(m.id, { role: 'user' });
                                    showToast('Parent role removed', 'success');
                                    await loadClubData(selectedClubId);
                                  } catch (error) {
                                    console.error('Error removing parent role:', error);
                                    showToast('Failed to remove parent role', 'error');
                                  }
                                } else if (action === 'remove') {
                                  handleRemoveMember(m);
                                }
                                e.target.value = ''; // Reset dropdown
                              }}
                              className="px-2 py-1 bg-white/10 hover:bg-white/15 border border-white/20 text-light rounded text-[10px] font-medium transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                              defaultValue=""
                            >
                              <option value="" disabled className="bg-mid-dark">Action</option>
                              <option value="assign" className="bg-mid-dark">📌 Assign Team</option>
                              {m.clubRole !== 'trainer' && (
                                <option value="promote-trainer" className="bg-mid-dark">↑ Trainer</option>
                              )}
                              {m.clubRole !== 'assistant' && (
                                <option value="promote-assistant" className="bg-mid-dark">↑ Assistant</option>
                              )}
                              {(m.clubRole === 'trainer' || m.clubRole === 'assistant') && (
                                <option value="demote-member" className="bg-mid-dark">↓ Member</option>
                              )}
                              <option disabled className="bg-mid-dark">───</option>
                              {m.userRole !== 'parent' ? (
                                <option value="set-parent" className="bg-mid-dark">👨‍👩‍👧 Set Parent</option>
                              ) : (
                                <option value="remove-parent" className="bg-mid-dark">× Remove Parent</option>
                              )}
                              <option disabled className="bg-mid-dark">───</option>
                              <option value="remove" className="bg-mid-dark">🗑️ Remove</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>


          </>
        )}

        {/* Pending Requests Tab */}
        {selectedClubId && activeTab === 'requests' && (
          <div className="animate-fade-in">
            <h2 className="font-title text-xl md:text-3xl text-light mb-4 md:mb-6">Pending Join Requests</h2>
            
            {loadingRequests ? (
              <div className="text-center py-12">
                <div className="text-light/60">{t('clubmgmt.loadingRequests')}</div>
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-12 text-center">
                <div className="text-4xl md:text-6xl mb-4">✅</div>
                <h3 className="font-title text-lg md:text-2xl text-light mb-2">All Caught Up!</h3>
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
                              <div className="font-semibold text-light text-base md:text-lg">
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
                                <span className="text-light/50">{t('clubmgmt.team')}:</span>{' '}
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
                            <span>{t('clubmgmt.approve')}</span>
                          </button>
                          <button
                            onClick={() => handleDenyRequest(request.id)}
                            className="px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-all font-semibold text-sm flex items-center gap-2"
                          >
                            <span>✕</span>
                            <span>{t('clubmgmt.deny')}</span>
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
                <div className="inline-block bg-white/5 border border-white/10 rounded-lg px-4 py-2 md:px-6 md:py-3">
                  <span className="text-light/60 text-sm">Total Pending: </span>
                  <span className="font-bold text-secondary text-base md:text-lg">{pendingRequests.length}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Statistics Tab */}
        {selectedClubId && activeTab === 'statistics' && (
          <div className="animate-fade-in">
            <h2 className="font-title text-xl md:text-3xl text-light mb-4 md:mb-6">{t('clubmgmt.trainerStatistics')}</h2>
            
            {!selectedTrainer ? (
              <>
                {/* Search Trainers */}
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder={t('clubmgmt.searchTrainersByNameOrEmail') + "..."}
                    value={trainerSearchQuery}
                    onChange={e => setTrainerSearchQuery(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                {/* Trainers List */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                  <h3 className="font-semibold text-light text-base md:text-lg mb-4">{t('clubmgmt.selectTrainer')}</h3>
                  <div className="space-y-2">
                    {(() => {
                      const trainers = clubMembers.filter(m => 
                        (m.role === 'trainer' || m.role === 'assistant') &&
                        (!trainerSearchQuery || 
                          m.username?.toLowerCase().includes(trainerSearchQuery.toLowerCase()) ||
                          m.email?.toLowerCase().includes(trainerSearchQuery.toLowerCase()))
                      );

                      if (trainers.length === 0) {
                        return <p className="text-light/50 text-center py-4">{t('clubmgmt.noTrainersFound')}</p>;
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
                              {t('clubmgmt.roleColon')} {trainer.role}
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
                  <span>{t('clubmgmt.backToTrainers')}</span>
                </button>

                {/* Trainer Info */}
                <div className="mb-6 bg-gradient-to-r from-primary/20 to-accent/20 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white text-lg md:text-2xl">
                      {selectedTrainer.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-title text-lg md:text-2xl text-light">{selectedTrainer.username}</h3>
                      <p className="text-light/60">{selectedTrainer.email}</p>
                      <p className="text-sm text-light/50 mt-1">{t('clubmgmt.roleColon')}: {selectedTrainer.role}</p>
                    </div>
                  </div>
                </div>

                {/* Statistics Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {/* Teams Count */}
                  <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl md:text-3xl">👥</span>
                      <h3 className="font-semibold text-light">{t('clubmgmt.teams')}</h3>
                    </div>
                    <div className="text-2xl md:text-4xl font-bold">
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
                    <p className="text-light/50 text-sm mt-1">{t('clubmgmt.teamsAsMember')}</p>
                  </div>

                  {/* Games Attended */}
                  <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl md:text-3xl">⚽</span>
                      <h3 className="font-semibold text-light">{t('clubmgmt.games')}</h3>
                    </div>
                    <div className="text-2xl md:text-4xl font-bold">0</div>
                    <p className="text-light/50 text-sm mt-1">Games attended</p>
                  </div>

                  {/* Extra Trainings */}
                  <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl md:text-3xl">🏋️</span>
                      <h3 className="font-semibold text-light">{t('clubmgmt.training')}</h3>
                    </div>
                    <div className="text-2xl md:text-4xl font-bold">0</div>
                    <p className="text-light/50 text-sm mt-1">{t('clubmgmt.extraTrainings')}</p>
                  </div>

                  {/* Tournaments */}
                  <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl md:text-3xl">🏆</span>
                      <h3 className="font-semibold text-light">{t('clubmgmt.tournaments')}</h3>
                    </div>
                    <div className="text-2xl md:text-4xl font-bold">0</div>
                    <p className="text-light/50 text-sm mt-1">{t('clubmgmt.tournamentsAttended')}</p>
                  </div>
                </div>

                {/* Manual Entry Form */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                  <h3 className="font-title text-xl md:text-2xl text-light mb-4">{t('clubmgmt.addManualEntry')}</h3>
                  
                  <div className="grid gap-4">
                    <div>
                      <label className="block text-sm font-medium text-light/80 mb-2">{t('clubmgmt.team')}</label>
                      <input
                        type="text"
                        placeholder={t('clubmgmt.teamNameOptional')}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-light/80 mb-2">{t('clubmgmt.score')}:</label>
                      <input
                        type="text"
                        placeholder={t('clubmgmt.scoreOptional')}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-light/80 mb-2">{t('clubmgmt.comments')}</label>
                      <textarea
                        placeholder={t('clubmgmt.commentsOptional')}
                        rows="3"
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                      ></textarea>
                    </div>

                    <button className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all">
                      {t('clubmgmt.addEntry')}
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
      <h2 className="font-title text-lg md:text-2xl text-light">{t('clubmgmt.orderManagement')}</h2>
      <button
        onClick={() => setShowCreateOrderModal(true)}
        className="px-4 py-2 text-sm bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
      >
        {t('clubmgmt.createOrder')}
      </button>
    </div>

    {/* Orders List */}
    {orders.length === 0 ? (
      <div className="text-center py-12 bg-white/5 border border-white/10 rounded-xl">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="font-title text-xl text-light/80 mb-2">{t('clubmgmt.noOrdersYet')}</h3>
        <p className="text-light/50 text-sm mb-4">
        {t('clubmgmt.createFirstOrderTemplate')}
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
                      {isActive ? "🟢" + t('clubmgmt.active') : "⚫" + t('clubmgmt.closed')}
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
                    {t('clubmgmt.viewResponses')}
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
                <p className="text-xs text-light/50 mb-2">{t('clubmgmt.requiredFields')}:</p>
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
            <h3 className="font-title text-lg md:text-2xl text-light">{t('clubmgmt.createOrderTemplate')}</h3>
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
              <label className="block font-medium text-light/80 mb-1">{t('clubmgmt.orderTitleAsterisk')}</label>
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
              <label className="block font-medium text-light/80 mb-1">{t('clubmgmt.description')}</label>
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
              <label className="block font-medium text-light/80 mb-2">{t('clubmgmt.selectTeams')}</label>
              
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
              <label className="block font-medium text-light/80 mb-1">{t('clubmgmt.deadlineOptional')}</label>
              <input
                type="date"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                value={orderForm.deadline}
                onChange={(e) => setOrderForm(f => ({ ...f, deadline: e.target.value }))}
              />
            </div>

            {/* Custom Fields */}
            <div className="border-t border-white/10 pt-4">
              <h4 className="font-medium text-light mb-3">{t('clubmgmt.customFields')}</h4>
              
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
                    <label className="block text-sm font-medium text-light/80 mb-1">{t('clubmgmt.fieldLabel')}</label>
                    <input
                      type="text"
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-light placeholder-light/40"
                      value={newField.label}
                      onChange={(e) => setNewField(f => ({ ...f, label: e.target.value }))}
                      placeholder="e.g., Size, Color"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-light/80 mb-1">{t('clubmgmt.fieldType')}</label>
                    <select
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-light"
                      value={newField.type}
                      onChange={(e) => setNewField(f => ({ ...f, type: e.target.value }))}
                    >
                      <option value="text" className="bg-mid-dark">{t('clubmgmt.text')}</option>
                      <option value="number" className="bg-mid-dark">{t('clubmgmt.number')}</option>
                      <option value="dropdown" className="bg-mid-dark">{t('clubmgmt.dropdown')}</option>
                      <option value="textarea" className="bg-mid-dark">{t('clubmgmt.longText')}</option>
                    </select>
                  </div>
                </div>

                {newField.type === 'dropdown' && (
                  <div>
                    <label className="block text-sm font-medium text-light/80 mb-1">{t('clubmgmt.optionsCommaSeparated')}</label>
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
                  <span className="text-sm text-light/80">{t('clubmgmt.requiredField')}</span>
                </label>

                <button
                  type="button"
                  onClick={addFieldToOrder}
                  className="w-full px-4 py-2 text-sm bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-all"
                >
                  {t('clubmgmt.addField')}
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
                {t('clubmgmt.createOrder')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateOrderModal(false);
                  resetOrderForm();
                }}
                className="px-4 py-2 text-sm bg-white/10 hover:bg-white/15 text-light rounded-lg font-medium transition-all"
              >
                {t('clubmgmt.cancel')}
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
            <h3 className="font-title text-lg md:text-2xl text-light">{selectedOrder.title} - Responses</h3>
            <p className="text-sm text-light/60 mt-1">
              {orderResponses.filter(r => r.status === 'accepted').length} {t('clubmgmt.accepted')} • 
              {orderResponses.filter(r => r.status === 'declined').length} Declined • 
              {orderResponses.filter(r => r.status === 'pending').length} {t('clubmgmt.pending')}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportToExcel(selectedOrder, orderResponses)}
              className="px-4 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all"
              disabled={orderResponses.length === 0}
            >
              📊 {t('clubmgmt.exportAll')}
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
                ✓ {t('clubmgmt.accepted')} ({orderResponses.filter(r => r.status === 'accepted').length})
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
                ⏳ {t('clubmgmt.pending')} ({orderResponses.filter(r => r.status === 'pending').length})
              </button>
            </div>

            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder={"🔍 " + t('clubmgmt.searchByNameOrEmailToAddUser')}
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
        <div className="text-center py-12 text-light/60">{t('clubmgmt.loadingResponses')}</div>
      ) : orderResponses.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-light/60">{t('clubmgmt.noEligibleUsersFound')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-sm font-medium text-light/80 pb-3 pr-4">{t('common.name')}</th>
                <th className="text-left text-sm font-medium text-light/80 pb-3 pr-4">{t('clubmgmt.status')}</th>
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
                  {t('clubmgmt.noUsersMatchYourFilters')}
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
                            ✓ {t('clubmgmt.accepted')}
                          </span>
                        )}
                        {response.status === 'declined' && (
                          <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-300">
                            ✗ Declined
                          </span>
                        )}
                        {response.status === 'pending' && (
                          <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-300">
                            ⏳ {t('clubmgmt.pending')}
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
          <h4 className="text-sm font-medium text-light/80 mb-3">{t('clubmgmt.statistics')}</h4>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-light">{orderResponses.length}</div>
              <div className="text-xs text-light/50 mt-1">{t('clubmgmt.totalEligible')}</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-400">
                {orderResponses.filter(r => r.status === 'accepted').length}
              </div>
              <div className="text-xs text-green-300 mt-1">{t('clubmgmt.accepted')}</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-400">
                {orderResponses.filter(r => r.status === 'declined').length}
              </div>
              <div className="text-xs text-red-300 mt-1">{t('clubmgmt.declined')}</div>
            </div>
            <div className="bg-yellow-500/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {orderResponses.filter(r => r.status === 'pending').length}
              </div>
              <div className="text-xs text-yellow-300 mt-1">{t('clubmgmt.pending')}</div>
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
                {t('clubmgmt.cancel')}
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
            {t('clubmgmt.removeUser')}
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
                  <div className="font-semibold">{t('clubmgmt.removeFromTeams')}</div>
                  <div className="text-xs text-light/60">{t('clubmgmt.removeFromSelectedTeamsOnly')}</div>
                </div>
              </button>

              <button
                onClick={handleRemoveFromClub}
                className="w-full px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg font-medium transition-all text-left flex items-center gap-3"
              >
                <span className="text-xl">🚫</span>
                <div>
                  <div className="font-semibold">{t('clubmgmt.removeFromClub')}</div>
                  <div className="text-xs text-red-300/60">{t('clubmgmt.removeFromClubAndAllTeams')}</div>
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
              {t('clubmgmt.cancel')}
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
              {t('clubmgmt.selectAll')}
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
                {t('clubmgmt.cancel')}
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
            {t('clubmgmt.assignUserTo')} {teamToAssign.name}
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
                placeholder={t('clubmgmt.typeNameOrEmail')+ "..."}
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
                      <div className="text-xs text-light/40 mt-1">{t('clubmgmt.roleColon')}: {m.role}</div>
                    </div>
                  ))}
                </div>
              ) : quickAssignSearch.length >= 2 ? (
                <p className="text-light/50 text-sm text-center py-4">{t('clubmgmt.noMatchesFound')}</p>
              ) : (
                <p className="text-light/50 text-sm text-center py-4">{t('clubmgmt.typeAtLeast2Characters')}</p>
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
              {t('clubmgmt.createNewTeam')}
            </h3>
            
            <p className="text-light/70 text-sm mb-4">
            {t('clubmgmt.youWillAutomaticallyBecomeTrainer')}
            </p>

            {/* Team Name Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-light/80 mb-2">{t('clubmgmt.teamName')}</label>
              <input
                type="text"
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                placeholder={t('clubmgmt.enterTeamName')}
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
                {t('clubmgmt.cancel')}
              </button>
              <button
                onClick={handleCreateTeam}
                className="flex-1 px-4 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition"
              >
                {t('clubmgmt.createTeam')}
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
                  return <p className="text-light/50 text-center py-4">{t('clubmgmt.noUsersInThisTeam')}</p>;
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
              {t('clubmgmt.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Rename Team Modal */}
      {showRenameTeamModal && teamToRename && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-mid-dark border border-white/20 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-light mb-4">
            {t('clubmgmt.renameTeam')}
            </h3>
            
            <p className="text-light/70 text-sm mb-4">
              Current name: <span className="text-light font-medium">{teamToRename.name}</span>
            </p>

            {/* Team Name Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-light/80 mb-2">{t('clubmgmt.newTeamName')}</label>
              <input
                type="text"
                value={renameTeamName}
                onChange={e => setRenameTeamName(e.target.value)}
                placeholder={t('clubmgmt.enterNewTeamName')}
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
                {t('clubmgmt.cancel')}
              </button>
              <button
                onClick={handleRenameTeam}
                className="flex-1 px-4 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition"
              >
                {t('clubmgmt.rename')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Club Modal */}
      {showEditClubModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-mid-dark border border-white/10 rounded-xl p-6 max-w-md w-full">
            <h3 className="font-title text-xl md:text-2xl text-light mb-4">{t('clubmgmt.editClub')}</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-light/80 font-medium mb-2">{t('clubmgmt.deleteClub')}</label>
                <input
                  type="text"
                  value={editClubName}
                  onChange={(e) => setEditClubName(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-light/80 font-medium mb-2">{t('clubmgmt.clubType')}</label>
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
                  <option value="" className="bg-mid-dark text-light">{t('clubmgmt.selectType')}</option>
                  {CLUB_TYPES.map(type => (
                    <option key={type} value={type} className="bg-mid-dark text-light">{type}</option>
                  ))}
                </select>
              </div>

              {editClubType === 'Custom' && (
                <div>
                  <label className="block text-light/80 font-medium mb-2">{t('clubmgmt.customType')}</label>
                  <input
                    type="text"
                    value={editCustomClubType}
                    onChange={(e) => setEditCustomClubType(e.target.value)}
                    placeholder={t('clubmgmt.enterCustomClubType')}
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
                {t('clubmgmt.cancel')}
              </button>
              <button
                onClick={handleEditClub}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
              >
                {t('clubmgmt.saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logo Upload Modal */}
      {showLogoUpload && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-mid-dark border border-white/10 rounded-xl p-6 max-w-md w-full">
            <h3 className="font-title text-xl md:text-2xl text-light mb-4">
              Change {logoUploadType === 'club' ? 'Club' : 'Team'} Logo
            </h3>
            
            <div className="mb-4">
              <label className="block text-light/80 font-medium mb-2">{t('clubmgmt.selectImage')}</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-white file:cursor-pointer hover:file:bg-primary/80"
              />
              <p className="text-xs text-light/50 mt-1">{t('clubmgmt.maxSize5MB')}</p>
            </div>

            {logoPreview && (
              <div className="mb-4">
                <p className="text-light/80 text-sm mb-2">{t('clubmgmt.preview')}:</p>
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
                {t('clubmgmt.cancel')}
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

      {/* Teams List Modal */}
      {showTeamsModal && selectedMemberTeams && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-mid-dark border border-white/20 rounded-xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-title text-xl text-light">
                {selectedMemberTeams.username}'s Teams
              </h3>
              <button
                onClick={() => {
                  setShowTeamsModal(false);
                  setSelectedMemberTeams(null);
                }}
                className="text-light/60 hover:text-light transition-colors text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {selectedMemberTeams.teamNames && selectedMemberTeams.teamNames.length > 0 ? (
                selectedMemberTeams.teamNames.map((teamName, idx) => {
                  const teamId = selectedMemberTeams.teamIds[idx];
                  return (
                    <div
                      key={`${selectedMemberTeams.id}-team-${idx}`}
                      className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="text-light font-semibold text-sm">
                            🏆 {teamName}
                          </h4>
                          <p className="text-light/50 text-xs mt-1">
                            {(() => {
                              const club = clubs.find(c => c.id === selectedClubId);
                              return club ? club.name : '';
                            })()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              navigate(`/team/${selectedClubId}/${teamId}`);
                              setShowTeamsModal(false);
                            }}
                            className="px-3 py-1 bg-primary/20 hover:bg-primary/30 text-primary rounded text-xs font-medium transition-all"
                          >
                            View
                          </button>
                          {isClubManager(clubs.find(c => c.id === selectedClubId)) && (
                            <button
                              onClick={() => {
                                if (confirm(`Remove ${selectedMemberTeams.username} from ${teamName}?`)) {
                                  handleRemoveFromTeam(selectedMemberTeams.id, teamId);
                                  // Update local state
                                  const updatedTeamNames = selectedMemberTeams.teamNames.filter((_, i) => i !== idx);
                                  const updatedTeamIds = selectedMemberTeams.teamIds.filter((_, i) => i !== idx);
                                  if (updatedTeamNames.length === 0) {
                                    setShowTeamsModal(false);
                                  } else {
                                    setSelectedMemberTeams({
                                      ...selectedMemberTeams,
                                      teamNames: updatedTeamNames,
                                      teamIds: updatedTeamIds
                                    });
                                  }
                                }
                              }}
                              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs font-medium transition-all"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-light/50 py-4">No teams</p>
              )}
            </div>

            <button
              onClick={() => {
                setShowTeamsModal(false);
                setSelectedMemberTeams(null);
              }}
              className="w-full mt-4 px-4 py-2 bg-white/10 hover:bg-white/15 text-light rounded-lg font-medium transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
