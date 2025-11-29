// src/components/SuperAdminCleanup.jsx
// Tool to clean up duplicate SuperAdmin accounts

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAllUsers, deleteUser } from '../firebase/firestore';
import { deleteUser as deleteAuthUser } from 'firebase/auth';
import { auth } from '../firebase/config';

export default function SuperAdminCleanup() {
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const addResult = (message, type = 'info') => {
    setResults(prev => [...prev, { 
      message, 
      type, 
      timestamp: new Date().toLocaleTimeString() 
    }]);
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const fetchedUsers = await getAllUsers();
      setUsers(fetchedUsers);
      
      const superAdmins = fetchedUsers.filter(u => u.isSuperAdmin);
      addResult(`Found ${fetchedUsers.length} total users`, 'info');
      addResult(`Found ${superAdmins.length} SuperAdmin accounts`, superAdmins.length > 1 ? 'warning' : 'success');
      
      if (superAdmins.length > 1) {
        addResult('⚠️ Multiple SuperAdmin accounts detected!', 'warning');
      }
    } catch (err) {
      addResult(`Error loading users: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const cleanupDuplicateSuperAdmins = async () => {
    if (!window.confirm('This will delete ALL SuperAdmin accounts EXCEPT the one you are currently logged in with. Continue?')) {
      return;
    }

    setProcessing(true);
    setResults([]);
    addResult('🔄 Starting cleanup process...', 'info');

    try {
      const superAdmins = users.filter(u => u.isSuperAdmin);
      addResult(`Found ${superAdmins.length} SuperAdmin accounts`, 'info');

      if (superAdmins.length <= 1) {
        addResult('✅ No duplicate SuperAdmins found!', 'success');
        setProcessing(false);
        return;
      }

      // Keep only the current user's account
      const accountsToDelete = superAdmins.filter(u => u.id !== user.uid);
      addResult(`Will delete ${accountsToDelete.length} duplicate accounts`, 'warning');
      addResult(`Will keep: ${user.email} (current user)`, 'success');

      let deletedCount = 0;
      let failedCount = 0;

      for (const account of accountsToDelete) {
        try {
          addResult(`Deleting: ${account.email}...`, 'info');
          
          // Delete from Firestore
          await deleteUser(account.id);
          
          deletedCount++;
          addResult(`✅ Deleted: ${account.email}`, 'success');
        } catch (err) {
          failedCount++;
          addResult(`❌ Failed to delete ${account.email}: ${err.message}`, 'error');
        }
      }

      addResult('', 'info');
      addResult('📊 Cleanup Summary:', 'info');
      addResult(`✅ Successfully deleted: ${deletedCount}`, 'success');
      if (failedCount > 0) {
        addResult(`❌ Failed to delete: ${failedCount}`, 'error');
      }
      addResult(`🔒 Kept: 1 (your account)`, 'success');

      // Reload users
      await loadUsers();

    } catch (err) {
      addResult(`❌ Cleanup failed: ${err.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const deleteSpecificUser = async (userId, email) => {
    if (userId === user.uid) {
      alert('❌ You cannot delete your own account!');
      return;
    }

    if (!window.confirm(`Delete account: ${email}?`)) {
      return;
    }

    try {
      addResult(`Deleting ${email}...`, 'info');
      await deleteUser(userId);
      addResult(`✅ Deleted ${email}`, 'success');
      await loadUsers();
    } catch (err) {
      addResult(`❌ Failed to delete: ${err.message}`, 'error');
    }
  };

  if (!user || !isAdmin()) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl text-red-500">Access Denied</h1>
        <p className="text-light mt-2">Only admins can access this tool.</p>
      </div>
    );
  }

  const superAdmins = users.filter(u => u.isSuperAdmin);
  const hasDuplicates = superAdmins.length > 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-mid-dark rounded-lg p-6 border border-white/10 mb-6">
        <h1 className="text-3xl font-bold text-light mb-2">🧹 SuperAdmin Cleanup Tool</h1>
        <p className="text-light/60">
          Remove duplicate SuperAdmin accounts from your database
        </p>
      </div>

      {/* Status Card */}
      <div className={`rounded-lg p-6 mb-6 border ${
        hasDuplicates 
          ? 'bg-yellow-500/10 border-yellow-500/30' 
          : 'bg-green-500/10 border-green-500/30'
      }`}>
        <div className="flex items-center gap-4">
          <div className="text-4xl">
            {hasDuplicates ? '⚠️' : '✅'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-light mb-1">
              {hasDuplicates ? 'Duplicates Detected!' : 'All Clear!'}
            </h2>
            <p className={hasDuplicates ? 'text-yellow-400' : 'text-green-400'}>
              {superAdmins.length} SuperAdmin account{superAdmins.length !== 1 ? 's' : ''} found
            </p>
          </div>
        </div>
      </div>

      {/* Current User Info */}
      <div className="bg-mid-dark rounded-lg p-6 border border-white/10 mb-6">
        <h3 className="text-lg font-bold text-light mb-3">👤 Your Account (Will Not Be Deleted)</h3>
        <div className="bg-dark rounded-lg p-4">
          <p className="text-light"><strong>Email:</strong> {user.email}</p>
          <p className="text-light"><strong>User ID:</strong> {user.uid}</p>
          <p className="text-green-400 mt-2">✅ This account will be preserved</p>
        </div>
      </div>

      {/* SuperAdmin Accounts List */}
      <div className="bg-mid-dark rounded-lg p-6 border border-white/10 mb-6">
        <h3 className="text-lg font-bold text-light mb-4">
          🔍 All SuperAdmin Accounts ({superAdmins.length})
        </h3>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-light mt-4">Loading users...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {superAdmins.map((sa) => (
              <div 
                key={sa.id} 
                className={`rounded-lg p-4 border ${
                  sa.id === user.uid 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : 'bg-dark border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-light font-medium">
                      {sa.email}
                      {sa.id === user.uid && (
                        <span className="ml-2 px-2 py-1 bg-green-600 text-white text-xs rounded">
                          YOU
                        </span>
                      )}
                    </p>
                    <p className="text-light/60 text-sm">ID: {sa.id}</p>
                    <p className="text-light/60 text-sm">
                      Username: {sa.username || 'Not set'}
                    </p>
                  </div>
                  <div>
                    {sa.id === user.uid ? (
                      <span className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">
                        ✅ Keep
                      </span>
                    ) : (
                      <button
                        onClick={() => deleteSpecificUser(sa.id, sa.email)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm"
                        disabled={processing}
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {hasDuplicates && (
        <div className="bg-mid-dark rounded-lg p-6 border border-white/10 mb-6">
          <h3 className="text-lg font-bold text-light mb-4">⚡ Quick Actions</h3>
          <div className="flex gap-4">
            <button
              onClick={cleanupDuplicateSuperAdmins}
              disabled={processing || loading}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? '⏳ Processing...' : '🧹 Delete All Duplicates'}
            </button>
            <button
              onClick={loadUsers}
              disabled={processing || loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🔄 Refresh
            </button>
          </div>
          <p className="text-yellow-400 text-sm mt-3">
            ⚠️ This will delete all SuperAdmin accounts except yours ({user.email})
          </p>
        </div>
      )}

      {/* Results Log */}
      <div className="bg-dark rounded-lg p-6 border border-white/10">
        <h3 className="text-lg font-bold text-light mb-4">📊 Activity Log</h3>
        
        {results.length === 0 ? (
          <p className="text-light/60 text-center py-8">
            No activity yet. Click "Delete All Duplicates" to start cleanup.
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded text-sm ${
                  result.type === 'success'
                    ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                    : result.type === 'error'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                    : result.type === 'warning'
                    ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                    : 'bg-white/5 text-light/80 border border-white/10'
                }`}
              >
                <span className="text-light/40 mr-2">[{result.timestamp}]</span>
                {result.message}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-mid-dark rounded-lg p-6 border border-white/10 mt-6">
        <h3 className="text-lg font-bold text-light mb-3">📝 Instructions</h3>
        <ol className="list-decimal list-inside space-y-2 text-light/80">
          <li>Review the SuperAdmin accounts listed above</li>
          <li>Your current account (marked with "YOU") will be kept</li>
          <li>Click individual "Delete" buttons to remove specific accounts</li>
          <li>OR click "Delete All Duplicates" to remove all duplicates at once</li>
          <li>Check the Activity Log for results</li>
          <li>Click "Refresh" to reload the user list</li>
        </ol>
      </div>

      {/* Warning */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 mt-6">
        <h3 className="text-lg font-bold text-red-400 mb-2">⚠️ Important Notes</h3>
        <ul className="list-disc list-inside space-y-1 text-red-400/80 text-sm">
          <li>This action cannot be undone!</li>
          <li>Your current account ({user.email}) will NEVER be deleted</li>
          <li>Only Firestore user documents are deleted (Firebase Auth users may remain)</li>
          <li>Make sure you're logged in with the correct SuperAdmin account</li>
          <li>Consider backing up your database before cleanup</li>
        </ul>
      </div>
    </div>
  );
}
