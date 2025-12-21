// src/pages/AdminDashboard.jsx - FIXED VERSION
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { 
  getAllUsers, 
  updateUser, 
  deleteUser as deleteUserFromFirestore,
  getAllClubs,
  getClub,
  updateClub,
  deleteClub as deleteClubFromFirestore,
  getPendingRequests,
  updateRequest,
  createClub as createClubInFirestore
} from '../firebase/firestore';
import { logAuditAction, logRoleChange } from '../utils/auditLogger';
import { AUDIT_ACTIONS } from '../constants/roles';
import { canAssignRole } from '../firebase/privileges';
import RoleBadge from '../components/RoleBadge';
import { RequireAdmin } from '../components/PermissionGuard';

export default function AdminDashboard() {
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  
  // Early return if not admin
  if (!user) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl text-red-500">Please Log In</h1>
        <p className="text-light mt-2">You must be logged in to view this page.</p>
      </div>
    );
  }

  // Check if user is SuperAdmin OR regular Admin
  const isSuperAdminOrAdmin = user.isSuperAdmin === true || isAdmin();
  
  if (!isSuperAdminOrAdmin) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl text-red-500">Access Denied</h1>
        <p className="text-light mt-2">You must be an admin to view this page.</p>
      </div>
    );
  }

  return (
    <RequireAdmin>
      <div className="max-w-7xl mx-auto px-2 py-0.5">
        {/* Header */}
        <div className="mb-1">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-light mb-2">👑 Admin Dashboard</h1>
          <p className="text-light/60">Manage users, clubs, teams, and requests</p>
        </div>

      {/* Quick Actions - UPDATED WITH COMPACT BUTTONS */}
      <div className="flex flex-wrap gap-3 mb-3 max-w-2xl">
        <button
          onClick={() => navigate('/admin/vouchers')}
          className="bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 text-white rounded-lg px-2 py-1 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 flex-1"
        >
          <span className="text-2xl">🎫</span>
          <div className="text-left">
            <h3 className="font-bold text-base">Manage Vouchers</h3>
            <p className="text-xs text-white/80">Generate trial codes</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/admin/subscriptions')}
          className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white rounded-lg px-2 py-1 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 flex-1"
        >
          <span className="text-2xl">💳</span>
          <div className="text-left">
            <h3 className="font-bold text-base">Manage Subscriptions</h3>
            <p className="text-xs text-white/80">Verify payments</p>
          </div>
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-mid-dark rounded-lg border border-white/10 overflow-hidden mb-6">
        <div className="flex border-b border-white/10 overflow-x-auto">
          <TabButton
            active={activeTab === 'users'}
            onClick={() => setActiveTab('users')}
            icon="👥"
            label="Users"
          />
          <TabButton
            active={activeTab === 'clubs'}
            onClick={() => setActiveTab('clubs')}
            icon="🏢"
            label="Clubs"
          />
          <TabButton
            active={activeTab === 'teams'}
            onClick={() => setActiveTab('teams')}
            icon="⚽"
            label="Teams"
          />
          <TabButton
            active={activeTab === 'requests'}
            onClick={() => setActiveTab('requests')}
            icon="📋"
            label="Requests"
          />
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'clubs' && <ClubsTab />}
        {activeTab === 'teams' && <TeamsTab />}
        {activeTab === 'requests' && <RequestsTab />}
      </div>
      </div>
    </RequireAdmin>
  );
}

/* ==========================================
   TAB BUTTON COMPONENT
   ========================================== */
function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 md:px-6 md:py-4 text-sm md:text-base font-medium transition flex items-center gap-2 whitespace-nowrap ${
        active
          ? 'bg-primary text-white border-b-2 border-primary'
          : 'text-light/60 hover:text-light hover:bg-white/5'
      }`}
    >
      <span>{icon}</span> {label}
    </button>
  );
}

/* ==========================================
   USERS TAB
   ========================================== */
function UsersTab() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  // Modals
  const [assignModal, setAssignModal] = useState({ open: false, user: null, selectedId: '' });
  const [roleModal, setRoleModal] = useState({ open: false, user: null, newRole: '' });
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null });
  const [passwordModal, setPasswordModal] = useState({ open: false, user: null, newPassword: '', confirmPassword: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedUsers, fetchedClubs] = await Promise.all([
        getAllUsers(),
        getAllClubs(currentUser.id, currentUser.isSuperAdmin || currentUser.role === 'admin')
      ]);
      setUsers(fetchedUsers);
      setClubs(fetchedClubs);
    } catch (err) {
      console.error('Error loading data:', err);
      showToast('Failed to load data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignToClub = async () => {
    const { user: targetUser, selectedId } = assignModal;
    if (!selectedId) {
      showToast('Please select a club', 'error');
      return;
    }
    try {
      const club = await getClub(selectedId);
      const members = Array.isArray(club.members) ? club.members : [];
      
      if (members.includes(targetUser.id)) {
        showToast('User is already a member of this club', 'error');
        return;
      }

      await updateClub(selectedId, { members: [...members, targetUser.id] });
      
      const clubIds = Array.isArray(targetUser.clubIds) ? targetUser.clubIds : [];
      await updateUser(targetUser.id, { clubIds: [...clubIds, selectedId] });
      
      // 🔒 AUDIT LOG: User assigned to club
      await logAuditAction(
        AUDIT_ACTIONS.USER_ASSIGNED_TO_CLUB,
        currentUser.id,
        targetUser.id,
        {
          clubId: selectedId,
          clubName: club.name,
          targetUserEmail: targetUser.email,
          action: 'assign_to_club'
        }
      );
      
      showToast('✅ User assigned to club successfully!', 'success');
      setAssignModal({ open: false, user: null, selectedId: '' });
      await loadData();
    } catch (err) {
      showToast('Failed to assign user: ' + err.message, 'error');
    }
  };

  const handleRoleChange = async () => {
    const { user: targetUser, newRole } = roleModal;
    if (!newRole) {
      showToast('Please select a role', 'error');
      return;
    }
    try {
      // 🔒 PERMISSION VALIDATION: Check if current user can assign this role
      const permissionCheck = await canAssignRole(currentUser.id, targetUser.id, newRole);
      if (!permissionCheck.allowed) {
        showToast(`❌ ${permissionCheck.reason}`, 'error');
        return;
      }
      
      const oldRole = targetUser.role;
      await updateUser(targetUser.id, { role: newRole });
      
      // 🔒 AUDIT LOG: Role change
      await logRoleChange(
        oldRole === newRole ? AUDIT_ACTIONS.ROLE_UPDATED : 
          (newRole === 'admin' || newRole === 'trainer') ? AUDIT_ACTIONS.ROLE_PROMOTED : AUDIT_ACTIONS.ROLE_DEMOTED,
        currentUser.id,
        targetUser.id,
        oldRole,
        newRole
      );
      
      showToast('✅ Role updated successfully!', 'success');
      setRoleModal({ open: false, user: null, newRole: '' });
      await loadData();
    } catch (err) {
      showToast('Failed to update role: ' + err.message, 'error');
    }
  };

  const handleDeleteUser = async () => {
    const { user: targetUser } = deleteModal;
    try {
      // 🔒 AUDIT LOG: User deletion (log BEFORE deleting)
      await logAuditAction(
        AUDIT_ACTIONS.USER_DELETED,
        currentUser.id,
        targetUser.id,
        {
          deletedUserEmail: targetUser.email,
          deletedUserRole: targetUser.role,
          action: 'delete_user'
        }
      );
      
      await deleteUserFromFirestore(targetUser.id);
      showToast('✅ User deleted successfully!', 'success');
      setDeleteModal({ open: false, user: null });
      await loadData();
    } catch (err) {
      showToast('Failed to delete user: ' + err.message, 'error');
    }
  };

  const handlePasswordChange = async () => {
    const { user: targetUser, newPassword, confirmPassword } = passwordModal;
    
    if (!newPassword || newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    
    try {
      // Note: This requires Firebase Admin SDK or Cloud Function
      // For now, we'll show a toast that this needs backend implementation
      showToast('⚠️ Password change requires backend implementation with Firebase Admin SDK', 'info');
      
      // TODO: Implement with Firebase Admin SDK:
      // await updateUserPassword(targetUser.id, newPassword);
      
      setPasswordModal({ open: false, user: null, newPassword: '', confirmPassword: '' });
      
      // Uncomment when implemented:
      // showToast('Password changed successfully!', 'success');
    } catch (err) {
      showToast('Failed to change password: ' + err.message, 'error');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return <LoadingSpinner message="Loading users..." />;
  }

  return (
    <div>
      {/* Filters */}
      <div className="bg-mid-dark rounded-lg p-6 mb-6 border border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-light/80 mb-2">🔍 Search Users</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by email or username..."
              className="w-full px-4 py-2 bg-dark border border-white/20 rounded-lg text-light focus:border-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-light/80 mb-2">Filter by Role</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-4 py-2 bg-dark border border-white/20 rounded-lg text-light focus:border-primary outline-none"
              style={{ colorScheme: 'dark' }}
            >
              <option value="all" className="bg-dark text-light">All Roles</option>
              <option value="admin" className="bg-dark text-light">Admin</option>
              <option value="trainer" className="bg-dark text-light">Trainer</option>
              <option value="assistant" className="bg-dark text-light">Assistant</option>
              <option value="user" className="bg-dark text-light">User</option>
              <option value="parent" className="bg-dark text-light">Parent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard label="Total Users" value={users.length} icon="👥" />
        <StatCard label="Admins" value={users.filter(u => u.role === 'admin').length} icon="👑" />
        <StatCard label="Trainers" value={users.filter(u => u.role === 'trainer').length} icon="⚽" />
        <StatCard label="Parents" value={users.filter(u => u.role === 'parent').length} icon="👤" />
      </div>

      {/* Users List */}
      <div className="space-y-4">
        {filteredUsers.map((u) => (
          <div key={u.id} className="bg-mid-dark rounded-lg p-6 border border-white/10">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold text-light">{u.username || 'No Username'}</h3>
                  {/* 🎨 NEW: Beautiful role badge */}
                  <RoleBadge role={u.role} isSuperAdmin={u.isSuperAdmin} size="sm" />
                </div>
                <p className="text-light/60 mb-3">📧 {u.email}</p>
                
                {/* Enhanced Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-2">
                  <div>
                    <span className="text-light/50">Registered:</span>
                    <p className="text-light font-medium">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-light/50">First Login:</span>
                    <p className="text-light font-medium">
                      {u.firstLoginAt ? new Date(u.firstLoginAt).toLocaleDateString() : 'Never'}
                    </p>
                  </div>
                  <div>
                    <span className="text-light/50">Last Login:</span>
                    <p className="text-light font-medium">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                    </p>
                  </div>
                  <div>
                    <span className="text-light/50">Clubs:</span>
                    <p className="text-light font-medium">
                      🏢 {u.clubIds?.length || 0}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setRoleModal({ open: true, user: u, newRole: u.role })}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
                  disabled={u.isSuperAdmin}
                >
                  ­ Role
                </button>
                <button
                  onClick={() => setAssignModal({ open: true, user: u, selectedId: '' })}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-sm"
                >
                   Assign
                </button>
                <button
                  onClick={() => setPasswordModal({ open: true, user: u, newPassword: '', confirmPassword: '' })}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition text-sm"
                  disabled={u.isSuperAdmin && u.id !== currentUser?.id}
                >
                   Password
                </button>
                <button
                  onClick={() => setDeleteModal({ open: true, user: u })}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm"
                  disabled={u.isSuperAdmin || u.id === currentUser?.id}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-light/60">No users found</p>
        </div>
      )}

      {/* MODALS */}
      {assignModal.open && (
        <Modal
          title="Assign User to Club"
          onClose={() => setAssignModal({ open: false, user: null, selectedId: '' })}
        >
          <div className="mb-4">
            <p className="text-light mb-4">
              Assign <strong>{assignModal.user?.username}</strong> to a club:
            </p>
            <select
              value={assignModal.selectedId}
              onChange={(e) => setAssignModal({ ...assignModal, selectedId: e.target.value })}
              className="w-full px-4 py-2 bg-dark border border-white/20 rounded-lg text-light focus:border-primary outline-none"
              style={{ colorScheme: 'dark' }}
            >
              <option value="" className="bg-dark text-light">Select a club...</option>
              {clubs.map(club => (
                <option key={club.id} value={club.id} className="bg-dark text-light">{club.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAssignModal({ open: false, user: null, selectedId: '' })}
              className="flex-1 px-4 py-2 bg-dark hover:bg-dark/80 text-light rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAssignToClub}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition"
            >
              Assign
            </button>
          </div>
        </Modal>
      )}

      {roleModal.open && (
        <Modal
          title="Change User Role"
          onClose={() => setRoleModal({ open: false, user: null, newRole: '' })}
        >
          <div className="mb-4">
            <p className="text-light mb-4">
              Change role for <strong>{roleModal.user?.username}</strong>:
            </p>
            <select
              value={roleModal.newRole}
              onChange={(e) => setRoleModal({ ...roleModal, newRole: e.target.value })}
              className="w-full px-4 py-2 bg-dark border border-white/20 rounded-lg text-light focus:border-primary outline-none"
              style={{ colorScheme: 'dark' }}
            >
              <option value="" className="bg-dark text-light">Select role...</option>
              <option value="admin" className="bg-dark text-light">Admin</option>
              <option value="trainer" className="bg-dark text-light">Trainer</option>
              <option value="assistant" className="bg-dark text-light">Assistant</option>
              <option value="user" className="bg-dark text-light">User</option>
              <option value="parent" className="bg-dark text-light">Parent</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setRoleModal({ open: false, user: null, newRole: '' })}
              className="flex-1 px-4 py-2 bg-dark hover:bg-dark/80 text-light rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleRoleChange}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition"
            >
              Save
            </button>
          </div>
        </Modal>
      )}

      {deleteModal.open && (
        <Modal
          title="Delete User"
          onClose={() => setDeleteModal({ open: false, user: null })}
          danger
        >
          <p className="text-light mb-4">
            Are you sure you want to delete <strong>{deleteModal.user?.username}</strong>?
          </p>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
            <p className="text-red-400 text-sm">
              This action cannot be undone!
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setDeleteModal({ open: false, user: null })}
              className="flex-1 px-4 py-2 bg-dark hover:bg-dark/80 text-light rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteUser}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
            >
              Delete User
            </button>
          </div>
        </Modal>
      )}

      {passwordModal.open && (
        <Modal
          title=" Change User Password"
          onClose={() => setPasswordModal({ open: false, user: null, newPassword: '', confirmPassword: '' })}
        >
          <p className="text-light mb-4">
            Change password for <strong>{passwordModal.user?.username}</strong>
          </p>
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm text-light/80 mb-2">New Password</label>
              <input
                type="password"
                value={passwordModal.newPassword}
                onChange={(e) => setPasswordModal({ ...passwordModal, newPassword: e.target.value })}
                placeholder="Enter new password (min 6 characters)"
                className="w-full px-4 py-2 bg-dark border border-white/20 rounded-lg text-light focus:border-primary outline-none"
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm text-light/80 mb-2">Confirm Password</label>
              <input
                type="password"
                value={passwordModal.confirmPassword}
                onChange={(e) => setPasswordModal({ ...passwordModal, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
                className="w-full px-4 py-2 bg-dark border border-white/20 rounded-lg text-light focus:border-primary outline-none"
              />
            </div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6">
            <p className="text-yellow-400 text-sm">
              This will immediately change the user&apos;s password. They will need to use the new password to log in.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPasswordModal({ open: false, user: null, newPassword: '', confirmPassword: '' })}
              className="flex-1 px-4 py-2 bg-dark hover:bg-dark/80 text-light rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handlePasswordChange}
              className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition"
            >
              Change Password
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
/* ==========================================
   CLUBS TAB
   ========================================== */
function ClubsTab() {
  const { showToast } = useToast();
  const [clubs, setClubs] = useState([]);
  const [users, setUsers] = useState([]); // NEW: For email lookup
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [createModal, setCreateModal] = useState({ open: false, name: '' });
  const [editModal, setEditModal] = useState({ open: false, club: null, name: '' });
  const [deleteModal, setDeleteModal] = useState({ open: false, club: null });

  useEffect(() => {
    loadClubs();
  }, []);

  const loadClubs = async () => {
    try {
      setLoading(true);
      const [fetchedClubs, fetchedUsers] = await Promise.all([
        getAllClubs(),
        getAllUsers() // NEW: Load users for email lookup
      ]);
      setClubs(fetchedClubs);
      setUsers(fetchedUsers); // NEW: Save users
    } catch (err) {
      console.error('Error loading clubs:', err);
      showToast('Failed to load clubs: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClub = async () => {
    if (!createModal.name.trim()) {
      showToast('Please enter a club name', 'error');
      return;
    }
    try {
      await createClubInFirestore({
        name: createModal.name.trim(),
        createdBy: 'admin',
        trainers: [],
        assistants: [],
        members: [],
        teams: []
      });
      showToast('Club created successfully!', 'success');
      setCreateModal({ open: false, name: '' });
      await loadClubs();
    } catch (err) {
      showToast('Failed to create club: ' + err.message, 'error');
    }
  };

  const handleEditClub = async () => {
    if (!editModal.name.trim()) {
      showToast('Please enter a club name', 'error');
      return;
    }
    try {
      await updateClub(editModal.club.id, { name: editModal.name.trim() });
      showToast('Club updated successfully!', 'success');
      setEditModal({ open: false, club: null, name: '' });
      await loadClubs();
    } catch (err) {
      showToast('Failed to update club: ' + err.message, 'error');
    }
  };

  const handleDeleteClub = async () => {
    try {
      await deleteClubFromFirestore(deleteModal.club.id);
      showToast('Club deleted successfully!', 'success');
      setDeleteModal({ open: false, club: null });
      await loadClubs();
    } catch (err) {
      showToast('Failed to delete club: ' + err.message, 'error');
    }
  };

  const filteredClubs = clubs.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner message="Loading clubs..." />;
  }

  return (
    <div>
      {/* Header with Create Button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-light">🏢 All Clubs</h2>
          <p className="text-light/60">Total: {clubs.length} clubs</p>
        </div>
        <button
          onClick={() => setCreateModal({ open: true, name: '' })}
          className="px-3 py-2 md:px-6 md:py-3 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm md:text-base transition font-medium"
        >
        Create Club
        </button>
      </div>

      {/* Search */}
      <div className="bg-mid-dark rounded-lg p-6 mb-6 border border-white/10">
        <label className="block text-sm text-light/80 mb-2">earch Clubs</label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by club name..."
          className="w-full px-4 py-2 bg-dark border border-white/20 rounded-lg text-light focus:border-primary outline-none"
        />
      </div>

      {/* Clubs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredClubs.map((club) => {
          // Find owner email from users list
          const ownerId = club.ownerId || club.createdBy;
          const ownerUser = users.find(u => u.id === ownerId);
          const ownerEmail = ownerUser?.email || 'Unknown';
          
          return (
            <div key={club.id} className="bg-mid-dark rounded-lg p-6 border border-white/10">
              <h3 className="text-xl font-bold text-light mb-3">{club.name}</h3>
              
              {/* Enhanced Details */}
              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div>
                  <span className="text-light/50">Created:</span>
                  <p className="text-light font-medium">
                    {club.createdAt ? new Date(club.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-light/50">Club Code:</span>
                  <p className="text-light font-medium">
                    <code className="bg-dark px-2 py-1 rounded text-xs">{club.clubCode || 'N/A'}</code>
                  </p>
                </div>
                <div>
                  <span className="text-light/50">Owner:</span>
                  <p className="text-light font-medium text-xs truncate" title={ownerEmail}>
                    👤 {ownerEmail}
                  </p>
                </div>
                <div>
                  <span className="text-light/50">Teams:</span>
                  <p className="text-light font-medium">
                    ⚽ {club.teams?.length || 0}
                  </p>
                </div>
              </div>
              
              {/* Stats Row */}
              <div className="flex gap-4 text-sm mb-4 p-3 bg-dark/50 rounded-lg">
                <div className="flex-1 text-center">
                  <p className="text-light/50 text-xs">Members</p>
                  <p className="text-light font-bold">{club.members?.length || 0}</p>
                </div>
                <div className="flex-1 text-center border-l border-white/10">
                  <p className="text-light/50 text-xs">Trainers</p>
                  <p className="text-light font-bold">{club.trainers?.length || 0}</p>
                </div>
                <div className="flex-1 text-center border-l border-white/10">
                  <p className="text-light/50 text-xs">Assistants</p>
                  <p className="text-light font-bold">{club.assistants?.length || 0}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setEditModal({ open: true, club, name: club.name })}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleteModal({ open: true, club })}
                  className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredClubs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-light/60">No clubs found</p>
        </div>
      )}

      {/* MODALS */}
      {createModal.open && (
        <Modal
          title=" Create New Club"
          onClose={() => setCreateModal({ open: false, name: '' })}
        >
          <input
            type="text"
            value={createModal.name}
            onChange={(e) => setCreateModal({ ...createModal, name: e.target.value })}
            placeholder="Enter club name..."
            className="w-full px-4 py-2 bg-dark border border-white/20 rounded-lg text-light focus:border-primary outline-none mb-4"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setCreateModal({ open: false, name: '' })}
              className="flex-1 px-4 py-2 bg-dark hover:bg-dark/80 text-light rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateClub}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition"
            >
              Create
            </button>
          </div>
        </Modal>
      )}

      {editModal.open && (
        <Modal
          title="âœï¸ Edit Club"
          onClose={() => setEditModal({ open: false, club: null, name: '' })}
        >
          <input
            type="text"
            value={editModal.name}
            onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
            placeholder="Enter club name..."
            className="w-full px-4 py-2 bg-dark border border-white/20 rounded-lg text-light focus:border-primary outline-none mb-4"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setEditModal({ open: false, club: null, name: '' })}
              className="flex-1 px-4 py-2 bg-dark hover:bg-dark/80 text-light rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleEditClub}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition"
            >
              Save
            </button>
          </div>
        </Modal>
      )}

      {deleteModal.open && (
        <Modal
          title="Delete Club"
          onClose={() => setDeleteModal({ open: false, club: null })}
          danger
        >
          <p className="text-light mb-4">
            Are you sure you want to delete <strong>{deleteModal.club?.name}</strong>?
          </p>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
            <p className="text-red-400 text-sm">
              This will delete all teams and remove all members!
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setDeleteModal({ open: false, club: null })}
              className="flex-1 px-4 py-2 bg-dark hover:bg-dark/80 text-light rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteClub}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
            >
              Delete Club
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ==========================================
   TEAMS TAB
   ========================================== */
function TeamsTab() {
  const { showToast } = useToast();
  const [clubs, setClubs] = useState([]);
  const [users, setUsers] = useState([]); // NEW: For email lookup
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClub, setSelectedClub] = useState('all');

  useEffect(() => {
    loadClubs();
  }, []);

  const loadClubs = async () => {
    try {
      setLoading(true);
      const [fetchedClubs, fetchedUsers] = await Promise.all([
        getAllClubs(),
        getAllUsers() // NEW: Load users for email lookup
      ]);
      setClubs(fetchedClubs);
      setUsers(fetchedUsers); // NEW: Save users
    } catch (err) {
      console.error('Error loading clubs:', err);
      showToast('Failed to load clubs: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Flatten all teams from all clubs
  const allTeams = clubs.flatMap(club => 
    (club.teams || []).map(team => ({
      ...team,
      clubId: club.id,
      clubName: club.name
    }))
  );

  // Filter teams based on search and selected club
  const filteredTeams = allTeams.filter(team => {
    const matchesSearch = team.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClub = selectedClub === 'all' || team.clubId === selectedClub;
    return matchesSearch && matchesClub;
  });

  if (loading) {
    return <LoadingSpinner message="Loading teams..." />;
  }

  return (
    <div>
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Clubs" value={clubs.length} icon="🏢" />
        <StatCard label="Total Teams" value={allTeams.length} icon="⚽" />
        <StatCard 
          label="Total Members" 
          value={allTeams.reduce((sum, team) => sum + (team.members?.length || 0), 0)} 
          icon="👥" 
        />
      </div>

      {/* Filters */}
      <div className="bg-mid-dark rounded-lg p-6 mb-6 border border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm text-light/80 mb-2">Search Teams</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by team name..."
              className="w-full px-4 py-2 bg-dark border border-white/20 rounded-lg text-light focus:border-primary outline-none"
            />
          </div>

          {/* Club Filter */}
          <div>
            <label className="block text-sm text-light/80 mb-2">Filter by Club</label>
            <select
              value={selectedClub}
              onChange={(e) => setSelectedClub(e.target.value)}
              className="w-full px-4 py-2 bg-dark border border-white/20 rounded-lg text-light focus:border-primary outline-none"
              style={{ colorScheme: 'dark' }}
            >
              <option value="all" className="bg-dark text-light">All Clubs</option>
              {clubs.map(club => (
                <option key={club.id} value={club.id} className="bg-dark text-light">{club.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Teams Display */}
      {filteredTeams.length === 0 ? (
        <div className="bg-mid-dark rounded-lg p-12 border border-white/10 text-center">
          <div className="text-4xl md:text-6xl mb-4">⚽</div>
          <h3 className="text-xl font-bold text-light mb-2">No Teams Found</h3>
          <p className="text-light/60">
            {allTeams.length === 0 
              ? "No teams have been created yet. Teams are created within clubs."
              : "No teams match your search criteria."}
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-light">All Teams</h2>
            <p className="text-light/60">Showing {filteredTeams.length} of {allTeams.length} teams</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeams.map((team, index) => {
              // Find club info for owner
              const parentClub = clubs.find(c => c.id === team.clubId);
              const ownerId = parentClub?.ownerId || parentClub?.createdBy;
              const ownerUser = users.find(u => u.id === ownerId);
              const ownerEmail = ownerUser?.email || 'Unknown';
              
              return (
                <div key={`${team.clubId}-${index}`} className="bg-mid-dark rounded-lg p-6 border border-white/10">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-light mb-1">{team.name}</h3>
                      <p className="text-primary text-sm">🏢 {team.clubName}</p>
                    </div>
                    <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-medium">
                      {team.ageGroup || 'N/A'}
                    </span>
                  </div>
                  
                  {/* Enhanced Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3 p-2 bg-dark/50 rounded">
                    <div>
                      <span className="text-light/50">Created:</span>
                      <p className="text-light font-medium">
                        {team.createdAt ? new Date(team.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-light/50">Club Owner:</span>
                      <p className="text-light font-medium truncate" title={ownerEmail}>
                        👤 {ownerEmail}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-light/60 text-sm">
                      <span>👥</span>
                      <span>Members: <strong>{team.members?.length || 0}</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-light/60 text-sm">
                      <span>🏃</span>
                      <span>Trainers: <strong>{team.trainers?.length || 0}</strong></span>
                    </div>
                    {team.description && (
                      <p className="text-light/60 text-sm mt-2 pt-2 border-t border-white/10">
                        {team.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================
   REQUESTS TAB
   ========================================== */
function RequestsTab() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const fetchedRequests = await getPendingRequests();
      setRequests(fetchedRequests);
    } catch (err) {
      console.error('Error loading requests:', err);
      showToast('Failed to load requests: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    try {
      await updateRequest(requestId, { status: 'approved', handledBy: user.id });
      showToast('Request approved!', 'success');
      await loadRequests();
    } catch (err) {
      showToast('Failed to approve request: ' + err.message, 'error');
    }
  };

  const handleDeny = async (requestId) => {
    try {
      await updateRequest(requestId, { status: 'denied', handledBy: user.id });
      showToast('Request denied', 'info');
      await loadRequests();
    } catch (err) {
      showToast('Failed to deny request: ' + err.message, 'error');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading requests..." />;
  }

  return (
    <div>
      <div className="bg-mid-dark rounded-lg p-6 mb-6 border border-white/10">
        <h2 className="text-2xl font-bold text-light mb-2">Join Requests</h2>
        <p className="text-light/60">Pending: <strong>{requests.length}</strong> requests</p>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-light/60">No pending requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-mid-dark rounded-lg p-6 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-light font-medium">{req.userId}</p>
                  <p className="text-light/60 text-sm">wants to join: <strong>{req.clubName}</strong></p>
                  {req.teamName && <p className="text-light/60 text-sm">Team: {req.teamName}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(req.id)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDeny(req.id)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                  >
                    Deny
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==========================================
   UTILITY COMPONENTS
   ========================================== */
function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="text-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      <p className="text-light mt-4">{message}</p>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-mid-dark rounded-lg p-4 border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-2xl md:text-3xl font-bold text-light">{value}</span>
      </div>
      <p className="text-light/60 text-sm">{label}</p>
    </div>
  );
}

function Modal({ title, children, onClose, danger = false }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`bg-mid-dark rounded-lg max-w-md w-full p-6 ${danger ? 'border border-red-500/50' : 'border border-white/20'}`}>
        <h3 className={`text-xl font-bold mb-4 ${danger ? 'text-red-400' : 'text-light'}`}>
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

function getRoleBadgeColor(role) {
  switch (role) {
    case 'admin':
      return 'bg-purple-600 text-white';
    case 'trainer':
      return 'bg-blue-600 text-white';
    case 'assistant':
      return 'bg-green-600 text-white';
    case 'parent':
      return 'bg-yellow-600 text-white';
    default:
      return 'bg-gray-600 text-white';
  }
}

