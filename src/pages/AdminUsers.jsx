// src/pages/AdminUsers.jsx - IMPROVED UI WITH MODALS
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getAllUsers, updateUser, deleteUser as deleteUserFromFirestore, getAllClubs, getClub, updateClub } from '../firebase/firestore';

export default function AdminUsers() {
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  // Modal states
  const [assignModal, setAssignModal] = useState({ open: false, user: null, type: 'club', selectedId: '' });
  const [roleModal, setRoleModal] = useState({ open: false, user: null, newRole: '' });
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [fetchedUsers, fetchedClubs] = await Promise.all([getAllUsers(), getAllClubs()]);
      setUsers(fetchedUsers);
      setClubs(fetchedClubs);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openAssignModal = (targetUser) => {
    setAssignModal({ open: true, user: targetUser, type: 'club', selectedId: '' });
  };

  const handleAssign = async () => {
    const { user: targetUser, type, selectedId } = assignModal;
    if (!selectedId) {
      alert('Please select a ' + type);
      return;
    }
    try {
      if (type === 'club') {
        const club = await getClub(selectedId);
        const members = Array.isArray(club.members) ? club.members : [];
        if (members.includes(targetUser.id)) {
          alert('User is already a member of this club');
          return;
        }
        await updateClub(selectedId, { members: [...members, targetUser.id] });
        const clubIds = Array.isArray(targetUser.clubIds) ? targetUser.clubIds : [];
        await updateUser(targetUser.id, { clubIds: [...clubIds, selectedId] });
        alert('✅ User assigned to club successfully!');
      }
      setAssignModal({ open: false, user: null, type: 'club', selectedId: '' });
      await loadData();
    } catch (err) {
      console.error('Error assigning user:', err);
      alert('Failed to assign user: ' + err.message);
    }
  };

  const openRoleModal = (targetUser) => {
    setRoleModal({ open: true, user: targetUser, newRole: targetUser.role });
  };

  const handleRoleChange = async () => {
    const { user: targetUser, newRole } = roleModal;
    if (!newRole) {
      alert('Please select a role');
      return;
    }
    try {
      await updateUser(targetUser.id, { role: newRole });
      alert('✅ Role updated successfully!');
      setRoleModal({ open: false, user: null, newRole: '' });
      await loadData();
    } catch (err) {
      console.error('Error updating role:', err);
      alert('Failed to update role: ' + err.message);
    }
  };

  const openDeleteModal = (targetUser) => {
    if (targetUser.id === user.id) {
      alert('Cannot delete your own account!');
      return;
    }
    if (targetUser.isSuperAdmin) {
      alert('Cannot delete SuperAdmin account!');
      return;
    }
    setDeleteModal({ open: true, user: targetUser });
  };

  const handleDeleteUser = async () => {
    const { user: targetUser } = deleteModal;
    try {
      await deleteUserFromFirestore(targetUser.id);
      alert('✅ User deleted successfully!');
      setDeleteModal({ open: false, user: null });
      await loadData();
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Failed to delete user: ' + err.message);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  if (!isAdmin()) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl text-red-500">Access Denied</h1>
        <p className="text-light mt-2">You must be an admin to view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-light mb-2">👑 Admin Panel</h1>
        <p className="text-light/60">Manage users, roles, and permissions</p>
      </div>

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
            <label className="block text-sm text-light/80 mb-2">🎭 Filter by Role</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-4 py-2 bg-dark border border-white/20 rounded-lg text-light focus:border-primary outline-none"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="trainer">Trainer</option>
              <option value="assistant">Assistant</option>
              <option value="user">User</option>
              <option value="parent">Parent</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-light/60">
            📊 Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> users
          </p>
          <button onClick={loadData} className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition">
            🔄 Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-light mt-4">Loading users...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg mb-6">
          <p className="font-semibold">❌ Error:</p>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && filteredUsers.length > 0 && (
        <div className="bg-mid-dark rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead className="bg-dark border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-light">Username</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-light">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-light">Role</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-light">Clubs</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-light">Teams</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-light">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-white/5 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white">
                        {(u.username || u.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-light">{u.username || '-'}</div>
                        {u.isSuperAdmin && (
                          <span className="text-xs text-yellow-400">⭐ SuperAdmin</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-light">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      u.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                      u.role === 'trainer' ? 'bg-blue-500/20 text-blue-400' :
                      u.role === 'assistant' ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-light">{u.clubIds?.length || 0}</td>
                  <td className="px-6 py-4 text-sm text-light">0</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openAssignModal(u)}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition text-sm font-medium flex items-center gap-2"
                      >
                        <span>📋</span> Assign
                      </button>
                      <button
                        onClick={() => openRoleModal(u)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium flex items-center gap-2"
                      >
                        <span>🎭</span> Role
                      </button>
                      {!u.isSuperAdmin && u.id !== user.id && (
                        <button
                          onClick={() => openDeleteModal(u)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm font-medium flex items-center gap-2"
                        >
                          <span>🗑️</span> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ASSIGN MODAL */}
      {assignModal.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-mid-dark rounded-lg max-w-md w-full p-6 border border-white/20">
            <h3 className="text-xl font-bold text-light mb-4">📋 Assign User to Club/Team</h3>
            <p className="text-light/60 mb-4">
              Assigning: <strong>{assignModal.user?.email}</strong>
            </p>

            <div className="mb-4">
              <label className="block text-sm text-light/80 mb-2">Assign to:</label>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setAssignModal({...assignModal, type: 'club'})}
                  className={`flex-1 px-4 py-2 rounded-lg transition ${
                    assignModal.type === 'club' 
                      ? 'bg-primary text-white' 
                      : 'bg-dark text-light/60 hover:bg-dark/80'
                  }`}
                >
                  🏢 Club
                </button>
                <button
                  onClick={() => setAssignModal({...assignModal, type: 'team'})}
                  className={`flex-1 px-4 py-2 rounded-lg transition ${
                    assignModal.type === 'team' 
                      ? 'bg-primary text-white' 
                      : 'bg-dark text-light/60 hover:bg-dark/80'
                  }`}
                >
                  👥 Team
                </button>
              </div>

              {assignModal.type === 'club' && (
                <select
                  value={assignModal.selectedId}
                  onChange={(e) => setAssignModal({...assignModal, selectedId: e.target.value})}
                  className="w-full px-4 py-2 bg-dark border border-white/20 rounded-lg text-light focus:border-primary outline-none"
                >
                  <option value="">Select a club...</option>
                  {clubs.map(club => (
                    <option key={club.id} value={club.id}>{club.name}</option>
                  ))}
                </select>
              )}

              {assignModal.type === 'team' && (
                <p className="text-sm text-light/60 p-4 bg-dark rounded-lg">
                  Team assignment coming soon! Please assign to a club first.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setAssignModal({ open: false, user: null, type: 'club', selectedId: '' })}
                className="flex-1 px-4 py-2 bg-dark hover:bg-dark/80 text-light rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={!assignModal.selectedId}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROLE MODAL */}
      {roleModal.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-mid-dark rounded-lg max-w-md w-full p-6 border border-white/20">
            <h3 className="text-xl font-bold text-light mb-4">🎭 Change User Role</h3>
            <p className="text-light/60 mb-4">
              Changing role for: <strong>{roleModal.user?.email}</strong>
            </p>

            <div className="mb-6">
              <label className="block text-sm text-light/80 mb-2">Select new role:</label>
              <select
                value={roleModal.newRole}
                onChange={(e) => setRoleModal({...roleModal, newRole: e.target.value})}
                className="w-full px-4 py-3 bg-dark border border-white/20 rounded-lg text-light focus:border-primary outline-none"
              >
                <option value="admin">🛡️ Admin - Full access</option>
                <option value="trainer">👨‍🏫 Trainer - Manage clubs & teams</option>
                <option value="assistant">🤝 Assistant - Help trainers</option>
                <option value="user">👤 User - Basic access</option>
                <option value="parent">👨‍👩‍👧 Parent - View child's activities</option>
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
                Change Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-mid-dark rounded-lg max-w-md w-full p-6 border border-red-500/50">
            <h3 className="text-xl font-bold text-red-400 mb-4">⚠️ Delete User</h3>
            <p className="text-light mb-2">
              Are you sure you want to delete this user?
            </p>
            <p className="text-light/60 mb-4">
              Email: <strong>{deleteModal.user?.email}</strong>
            </p>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
              <p className="text-red-400 text-sm">
                ⚠️ This action cannot be undone! The user will be permanently removed from all clubs and teams.
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
          </div>
        </div>
      )}
    </div>
  );
}
