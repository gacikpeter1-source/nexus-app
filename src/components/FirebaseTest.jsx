// src/components/FirebaseTest.jsx
import React, { useState } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs } from 'firebase/firestore';

export default function FirebaseTest() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const testFirebase = async () => {
    setLoading(true);
    setStatus('🔥 Testing Firebase connection...');

    try {
      // Test write
      const docRef = await addDoc(collection(db, 'test'), {
        message: 'Hello from NEXUS!',
        timestamp: new Date().toISOString(),
        testNumber: Math.random()
      });
      
      setStatus(prev => prev + '\n✅ WRITE TEST PASSED! Document ID: ' + docRef.id);

      // Test read
      const snapshot = await getDocs(collection(db, 'test'));
      setStatus(prev => prev + '\n✅ READ TEST PASSED! Found ' + snapshot.size + ' documents');

      snapshot.forEach(doc => {
        setStatus(prev => prev + '\n📄 Document: ' + doc.id);
      });

      setStatus(prev => prev + '\n\n🎉 FIREBASE IS WORKING PERFECTLY!');
    } catch (error) {
      setStatus('❌ FIREBASE ERROR: ' + error.message);
      console.error('Full error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl p-4 max-w-md">
        <h3 className="font-bold text-lg mb-2">🔥 Firebase Test</h3>
        
        <button
          onClick={testFirebase}
          disabled={loading}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 mb-2"
        >
          {loading ? 'Testing...' : 'Test Firebase Connection'}
        </button>

        {status && (
          <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap">
            {status}
          </pre>
        )}
      </div>
    </div>
  );
}
