// src/pages/PermissionTest.jsx
import { useIsAdmin, useHasSubscription } from '../hooks/usePermissions';
import { useAuth } from '../contexts/AuthContext';

export default function PermissionTest() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const { hasSubscription } = useHasSubscription();

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-light mb-2">🧪 Permission System Test</h1>
        <p className="text-light/60">Testing the new privileges & access control system</p>
      </div>

      {/* Test 1: Does existing auth work? */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
        <h2 className="text-2xl font-bold text-light mb-4">✅ Existing Auth (Should Work)</h2>
        <div className="space-y-2 text-light/80">
          <p><strong>User Email:</strong> {user?.email || 'Not logged in'}</p>
          <p><strong>User ID:</strong> {user?.id || 'N/A'}</p>
          <p><strong>Role:</strong> <span className="px-2 py-1 bg-primary/20 text-primary rounded">{user?.role || 'N/A'}</span></p>
          <p><strong>Is SuperAdmin:</strong> {user?.isSuperAdmin ? '👑 Yes' : 'No'}</p>
          <p><strong>Is Admin (old way):</strong> 
            <span className={`ml-2 px-2 py-1 rounded ${user?.role === 'admin' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {user?.role === 'admin' ? '✓ Yes' : '✗ No'}
            </span>
          </p>
        </div>
      </div>

      {/* Test 2: Does new system work? */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
        <h2 className="text-2xl font-bold text-light mb-4">🆕 New Permission System</h2>
        <div className="space-y-2 text-light/80">
          <p><strong>Is Admin (new way - useIsAdmin hook):</strong>
            <span className={`ml-2 px-2 py-1 rounded ${isAdmin ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {isAdmin ? '✓ Yes' : '✗ No'}
            </span>
          </p>
          <p><strong>Has Subscription (new hook):</strong>
            <span className={`ml-2 px-2 py-1 rounded ${hasSubscription ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
              {hasSubscription ? '✓ Yes' : '⚠️ No'}
            </span>
          </p>
        </div>
      </div>

      {/* Test 3: Do they match? */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
        <h2 className="text-2xl font-bold text-light mb-4">🔍 Consistency Check</h2>
        <div className="space-y-3">
          {/* Debug Values */}
          <div className="p-4 bg-dark/50 rounded-lg mb-3">
            <h3 className="text-sm font-bold text-light/60 mb-2">🐛 Debug Values:</h3>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-light/50">Old check value:</span>
                <span className="ml-2 text-light">{String(user?.role === 'admin' || user?.isSuperAdmin)}</span>
                <span className="ml-2 text-light/40">({typeof (user?.role === 'admin' || user?.isSuperAdmin)})</span>
              </div>
              <div>
                <span className="text-light/50">New check value:</span>
                <span className="ml-2 text-light">{String(isAdmin)}</span>
                <span className="ml-2 text-light/40">({typeof isAdmin})</span>
              </div>
              <div>
                <span className="text-light/50">user.role:</span>
                <span className="ml-2 text-light">{user?.role || 'undefined'}</span>
              </div>
              <div>
                <span className="text-light/50">user.isSuperAdmin:</span>
                <span className="ml-2 text-light">{String(user?.isSuperAdmin)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-dark/50 rounded-lg">
            <span className="text-light/80">Admin check consistency:</span>
            <span className={`px-3 py-1 rounded font-bold ${
              Boolean(user?.role === 'admin' || user?.isSuperAdmin) === Boolean(isAdmin)
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {Boolean(user?.role === 'admin' || user?.isSuperAdmin) === Boolean(isAdmin) ? '✅ PASS' : '❌ FAIL'}
            </span>
          </div>
          
          {Boolean(user?.role === 'admin' || user?.isSuperAdmin) !== Boolean(isAdmin) && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">
                ⚠️ Warning: Old and new admin checks don't match. This may indicate an issue.
              </p>
              <p className="text-red-400 text-xs mt-2">
                Old: {String(user?.role === 'admin' || user?.isSuperAdmin)} | 
                New: {String(isAdmin)} | 
                Match: {String((user?.role === 'admin' || user?.isSuperAdmin) === isAdmin)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Additional Info */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
        <h3 className="text-lg font-bold text-blue-400 mb-2">ℹ️ Test Instructions</h3>
        <ul className="space-y-2 text-light/70 text-sm">
          <li>✅ If you see user information above, your existing auth works</li>
          <li>✅ If "PASS" shows green, the new system is compatible</li>
          <li>⚠️ If "FAIL" shows red, there may be a configuration issue</li>
          <li>💡 Try logging in as different roles (admin, trainer, user) to test</li>
        </ul>
      </div>
    </div>
  );
}

