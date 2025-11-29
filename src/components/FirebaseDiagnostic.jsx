// src/components/FirebaseDiagnostic.jsx
// Diagnostic tool to test Firebase connection and data

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  getAllClubs, 
  getAllUsers,
  createClub,
  generateUniqueCode 
} from '../firebase/firestore';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';

export default function FirebaseDiagnostic() {
  const { user } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message, type = 'info') => {
    setResults(prev => [...prev, { message, type, timestamp: new Date().toLocaleTimeString() }]);
  };

  const runDiagnostics = async () => {
    setResults([]);
    setLoading(true);

    try {
      // Test 1: Check Authentication
      addResult('🔍 Test 1: Checking Authentication...', 'info');
      if (user) {
        addResult(`✅ User is authenticated: ${user.email}`, 'success');
        addResult(`   User ID: ${user.uid}`, 'info');
        addResult(`   User Role: ${user.role || 'Not set'}`, 'info');
      } else {
        addResult('❌ No user authenticated!', 'error');
        setLoading(false);
        return;
      }

      // Test 2: Check Firebase Connection
      addResult('🔍 Test 2: Testing Firebase Connection...', 'info');
      try {
        const testCollection = collection(db, 'test');
        addResult('✅ Firebase connection successful!', 'success');
      } catch (err) {
        addResult(`❌ Firebase connection failed: ${err.message}`, 'error');
        setLoading(false);
        return;
      }

      // Test 3: Check if Clubs Collection Exists
      addResult('🔍 Test 3: Checking Clubs Collection...', 'info');
      try {
        const clubsSnapshot = await getDocs(collection(db, 'clubs'));
        addResult(`✅ Clubs collection exists`, 'success');
        addResult(`   Total documents: ${clubsSnapshot.size}`, 'info');
        
        if (clubsSnapshot.empty) {
          addResult('⚠️ Clubs collection is EMPTY!', 'warning');
        } else {
          clubsSnapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            addResult(`   Club ${index + 1}: ${data.name || 'Unnamed'} (ID: ${doc.id})`, 'info');
          });
        }
      } catch (err) {
        addResult(`❌ Error reading clubs: ${err.message}`, 'error');
      }

      // Test 4: Test getAllClubs function
      addResult('🔍 Test 4: Testing getAllClubs() function...', 'info');
      try {
        const clubs = await getAllClubs();
        addResult(`✅ getAllClubs() returned ${clubs.length} clubs`, 'success');
        clubs.forEach((club, index) => {
          addResult(`   Club ${index + 1}: ${club.name}`, 'info');
          addResult(`      - Members: ${club.members?.length || 0}`, 'info');
          addResult(`      - Teams: ${club.teams?.length || 0}`, 'info');
          addResult(`      - Club Code: ${club.clubCode || 'Not set'}`, 'info');
        });
      } catch (err) {
        addResult(`❌ getAllClubs() failed: ${err.message}`, 'error');
      }

      // Test 5: Check Users Collection
      addResult('🔍 Test 5: Checking Users Collection...', 'info');
      try {
        const users = await getAllUsers();
        addResult(`✅ Found ${users.length} users`, 'success');
      } catch (err) {
        addResult(`❌ Error reading users: ${err.message}`, 'error');
      }

      // Test 6: Check Firestore Rules
      addResult('🔍 Test 6: Checking Firestore Permissions...', 'info');
      addResult('   Note: If you see errors above, check your Firestore Rules', 'info');

      addResult('✅ Diagnostics Complete!', 'success');

    } catch (err) {
      addResult(`❌ Unexpected error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const createTestClub = async () => {
    setResults([]);
    setLoading(true);

    try {
      addResult('🔍 Creating test club...', 'info');
      
      const clubCode = await generateUniqueCode();
      const testClub = {
        name: `Test Club ${Date.now()}`,
        clubCode: clubCode,
        createdBy: user.uid,
        trainers: [user.uid],
        assistants: [],
        members: [],
        teams: [],
        description: 'Test club created by diagnostic tool'
      };

      const result = await createClub(testClub);
      addResult(`✅ Test club created successfully!`, 'success');
      addResult(`   Club ID: ${result.id}`, 'info');
      addResult(`   Club Code: ${clubCode}`, 'info');
      addResult('   Now run diagnostics again to see it!', 'info');

    } catch (err) {
      addResult(`❌ Failed to create test club: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-mid-dark rounded-lg p-6 border border-white/10 mb-6">
        <h1 className="text-3xl font-bold text-light mb-2">🔧 Firebase Diagnostic Tool</h1>
        <p className="text-light/60">
          This tool helps diagnose Firebase connection and data issues
        </p>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-medium disabled:opacity-50"
        >
          {loading ? '⏳ Running...' : '🔍 Run Diagnostics'}
        </button>

        <button
          onClick={createTestClub}
          disabled={loading}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium disabled:opacity-50"
        >
          {loading ? '⏳ Creating...' : '➕ Create Test Club'}
        </button>

        <button
          onClick={() => setResults([])}
          disabled={loading}
          className="px-6 py-3 bg-dark hover:bg-dark/80 text-light rounded-lg transition font-medium disabled:opacity-50"
        >
          🗑️ Clear Results
        </button>
      </div>

      {/* Results Display */}
      <div className="bg-dark rounded-lg p-6 border border-white/10">
        <h2 className="text-xl font-bold text-light mb-4">📊 Results</h2>
        
        {results.length === 0 ? (
          <p className="text-light/60 text-center py-8">
            Click "Run Diagnostics" to start testing your Firebase connection
          </p>
        ) : (
          <div className="space-y-2 font-mono text-sm">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded ${
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
        <h3 className="text-lg font-bold text-light mb-3">📝 How to Use</h3>
        <ol className="list-decimal list-inside space-y-2 text-light/80">
          <li>Click <strong>"Run Diagnostics"</strong> to test your Firebase setup</li>
          <li>Check the results for any errors (red messages)</li>
          <li>If you see "Clubs collection is EMPTY", click <strong>"Create Test Club"</strong></li>
          <li>Run diagnostics again to confirm the club was created</li>
          <li>Go back to Admin Dashboard → Clubs tab to see if it appears</li>
        </ol>
      </div>

      {/* Common Issues */}
      <div className="bg-mid-dark rounded-lg p-6 border border-white/10 mt-6">
        <h3 className="text-lg font-bold text-light mb-3">⚠️ Common Issues</h3>
        <div className="space-y-3 text-light/80">
          <div>
            <strong className="text-red-400">❌ "No user authenticated"</strong>
            <p className="text-sm ml-5">→ You need to log in first</p>
          </div>
          <div>
            <strong className="text-yellow-400">⚠️ "Clubs collection is EMPTY"</strong>
            <p className="text-sm ml-5">→ No clubs in database yet. Click "Create Test Club"</p>
          </div>
          <div>
            <strong className="text-red-400">❌ "Permission denied"</strong>
            <p className="text-sm ml-5">→ Check Firestore security rules</p>
          </div>
          <div>
            <strong className="text-red-400">❌ "Firebase connection failed"</strong>
            <p className="text-sm ml-5">→ Check your .env file and Firebase config</p>
          </div>
        </div>
      </div>
    </div>
  );
}
