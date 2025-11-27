// src/pages/AdminUsers.jsx - FIXED FOR FIREBASE
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getAllUsers, updateUser, deleteUser as deleteUserFromFirestore } from '../firebase/firestore';

export default function AdminUsers() {
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  // Fetch users from Firestore
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('🔍 Fetching users from Firestore...');
      
      const fetchedUsers = await getAllUsers();
      console.log('✅ Fetched users:', fetchedUsers.length, fetchedUsers);
      
      setUsers(fetchedUsers);
    } catch (err) {
      console.error('❌ Error loading users:', err);
      setError('Failed to load users: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    if (!window.confirm(`Change user role to ${newRole}?`)) return;

    try {
      await updateUser(userId, { role: newRole });
      await loadUsers(); // Reload users
      alert('Role updated successfully!');
    } catch (err) {
      console.error('Error updating role:', err);
      alert('Failed to update role: ' + err.message);
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (userId === user.id) {
      alert('Cannot delete your own account!');
      return;
    }

    if (!window.confirm(`Delete user ${userEmail}? This cannot be undone!`)) return;

    try {
      await deleteUserFromFirestore(userId);
      await loadUsers(); // Reload users
      alert('User deleted successfully!');
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Failed to delete user: ' + err.message);
    }
  };

  // Filter users
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
        <h1 className="text-4xl font-bold text-light mb-2">Admin Panel</h1>
        <p className="text-light/60">Manage users and permissions</p>
      </div>

      {/* Filters */}
      <div className="bg-mid-dark rounded-lg p-6 mb-6 border border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-light/80 mb-2">Search Users</label>
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
            Showing {filteredUsers.length} of {users.length} users
          </p>
          <button
            onClick={loadUsers}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-light mt-4">Loading users...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg mb-6">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Users Table */}
      {!loading && !error && filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-light/60">No users found matching your filters.</p>
        </div>
      )}

      {!loading && !error && filteredUsers.length > 0 && (
        <div className="bg-mid-dark rounded-lg border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-light">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-light">Username</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-light">Role</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-light">Clubs</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-light">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-white/5 transition">
                    <td className="px-6 py-4 text-sm text-light">
                      {u.email}
                      {u.isSuperAdmin && (
                        <span className="ml-2 px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                          ⭐ SuperAdmin
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-light">{u.username || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      {u.isSuperAdmin ? (
                        <span className="text-yellow-400 font-semibold">Admin</span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="px-3 py-1 bg-dark border border-white/20 rounded text-light text-sm focus:border-primary outline-none"
                        >
                          <option value="admin">Admin</option>
                          <option value="trainer">Trainer</option>
                          <option value="assistant">Assistant</option>
                          <option value="user">User</option>
                          <option value="parent">Parent</option>
                        </select>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-light">
                      {u.clubIds?.length || 0} clubs
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {!u.isSuperAdmin && u.id !== user.id && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition text-sm"
                        >
                          Delete
                        </button>
                      )}
                      {u.id === user.id && (
                        <span className="text-light/60 text-sm">You</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Debug Info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-6 p-4 bg-dark rounded-lg border border-white/10">
          <p className="text-xs text-light/60">
            Debug: Total users in state: {users.length} | 
            Filtered: {filteredUsers.length} | 
            Loading: {loading ? 'Yes' : 'No'} | 
            Error: {error || 'None'}
          </p>
        </div>
      )}
    </div>
  );
}
