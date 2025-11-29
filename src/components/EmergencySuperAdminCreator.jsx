// src/components/EmergencySuperAdminCreator.jsx
// EMERGENCY TOOL - Create SuperAdmin when locked out

import { useState } from 'react';
import { auth, db } from '../firebase/config';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function EmergencySuperAdminCreator() {
  const [email, setEmail] = useState('admin@nexus.local');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('SuperAdmin');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const createSuperAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // Validate
      if (!email || !password || password.length < 6) {
        throw new Error('Email required and password must be at least 6 characters');
      }

      console.log('Creating SuperAdmin account...');

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      console.log('Auth user created:', user.uid);

      // Create Firestore document
      await setDoc(doc(db, 'users', user.uid), {
        email: email.toLowerCase(),
        username: username || 'SuperAdmin',
        role: 'admin',
        isSuperAdmin: true,
        emailVerified: true,
        clubIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      console.log('Firestore document created');

      setResult({
        success: true,
        message: 'SuperAdmin created successfully!',
        userId: user.uid,
        email: email,
        password: password
      });

    } catch (error) {
      console.error('Error:', error);
      setResult({
        success: false,
        message: error.message,
        code: error.code
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-mid-dark to-dark flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Warning Banner */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🚨</span>
            <h2 className="text-xl font-bold text-red-400">Emergency SuperAdmin Creator</h2>
          </div>
          <p className="text-red-400/80 text-sm">
            Use this ONLY if you're locked out and cannot login!
          </p>
        </div>

        {/* Form */}
        <div className="bg-mid-dark rounded-lg p-6 border border-white/10">
          <form onSubmit={createSuperAdmin} className="space-y-4">
            <div>
              <label className="block text-sm text-light/80 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-dark border border-white/20 rounded-lg text-light focus:border-primary outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-light/80 mb-2">Password (min 6 chars)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-dark border border-white/20 rounded-lg text-light focus:border-primary outline-none"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm text-light/80 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 bg-dark border border-white/20 rounded-lg text-light focus:border-primary outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Creating...' : '🚨 Create Emergency SuperAdmin'}
            </button>
          </form>

          {/* Result */}
          {result && (
            <div className={`mt-4 p-4 rounded-lg ${
              result.success 
                ? 'bg-green-500/10 border border-green-500/30' 
                : 'bg-red-500/10 border border-red-500/30'
            }`}>
              {result.success ? (
                <div>
                  <p className="text-green-400 font-bold mb-3">✅ {result.message}</p>
                  <div className="space-y-1 text-sm">
                    <p className="text-green-400">
                      <strong>Email:</strong> {result.email}
                    </p>
                    <p className="text-green-400">
                      <strong>Password:</strong> {result.password}
                    </p>
                    <p className="text-green-400/60">
                      <strong>User ID:</strong> {result.userId}
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-green-500/30">
                    <p className="text-green-400 text-sm mb-2">
                      👉 Save these credentials! You can now login.
                    </p>
                    <a
                      href="/login"
                      className="block text-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                    >
                      Go to Login
                    </a>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-red-400 font-bold mb-2">❌ {result.message}</p>
                  {result.code === 'auth/email-already-in-use' && (
                    <div className="mt-3 text-sm text-red-400/80">
                      <p className="mb-2">This email already exists in Firebase Auth.</p>
                      <p>Possible solutions:</p>
                      <ul className="list-disc list-inside ml-2 space-y-1">
                        <li>Try logging in with this email</li>
                        <li>Use a different email address</li>
                        <li>Delete the existing auth user in Firebase Console</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-dark rounded-lg p-4 border border-white/10">
          <h3 className="text-light font-bold mb-2">📝 Instructions</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-light/80">
            <li>Enter a new email address</li>
            <li>Create a strong password (min 6 characters)</li>
            <li>Choose a username</li>
            <li>Click "Create Emergency SuperAdmin"</li>
            <li>Save the credentials shown</li>
            <li>Go to login page and sign in</li>
          </ol>
        </div>

        {/* Back Link */}
        <div className="mt-4 text-center">
          <a href="/login" className="text-primary hover:text-primary-dark text-sm">
            ← Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}
