// src/components/PendingSubstitutions.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getPendingSubstitutions, respondToSubstitution } from '../utils/substitutionUtils';
import { Link } from 'react-router-dom';

export default function PendingSubstitutions() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [substitutions, setSubstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);

  useEffect(() => {
    if (user) {
      loadPendingSubstitutions();
      // Refresh every 30 seconds
      const interval = setInterval(loadPendingSubstitutions, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  async function loadPendingSubstitutions() {
    if (!user) return;
    
    try {
      const pending = await getPendingSubstitutions(user.id);
      setSubstitutions(pending);
    } catch (error) {
      console.error('Error loading pending substitutions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRespond(substitutionId, action) {
    setResponding(substitutionId);
    
    try {
      await respondToSubstitution(substitutionId, action);
      
      if (action === 'accept') {
        showToast('✅ Substitution accepted! You are now attending.', 'success');
      } else {
        showToast('❌ Substitution declined.', 'info');
      }
      
      // Reload pending list
      await loadPendingSubstitutions();
    } catch (error) {
      console.error('Error responding to substitution:', error);
      showToast(error.message || 'Failed to respond', 'error');
    } finally {
      setResponding(null);
    }
  }

  function getTimeRemaining(expiresAt) {
    if (!expiresAt) return 'Expired';
    
    const now = Date.now();
    let expiry;
    
    // ✅ FIX: Handle different timestamp formats from Cloud Functions
    if (typeof expiresAt === 'number') {
      // Already in milliseconds
      expiry = expiresAt;
    } else if (typeof expiresAt.toMillis === 'function') {
      // Firebase Timestamp object
      expiry = expiresAt.toMillis();
    } else if (expiresAt._seconds !== undefined) {
      // Serialized timestamp from Cloud Function (has _seconds)
      expiry = expiresAt._seconds * 1000 + (expiresAt._nanoseconds || 0) / 1000000;
    } else if (expiresAt.seconds !== undefined) {
      // Alternative serialized format (has seconds)
      expiry = expiresAt.seconds * 1000 + (expiresAt.nanoseconds || 0) / 1000000;
    } else if (expiresAt instanceof Date) {
      // JavaScript Date object
      expiry = expiresAt.getTime();
    } else {
      // Unknown format
      console.error('Unknown expiresAt format:', expiresAt);
      return 'Expired';
    }
    
    const diff = expiry - now;
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
        <div className="text-light/60 text-sm">Loading substitution requests...</div>
      </div>
    );
  }

  if (substitutions.length === 0) {
    return null; // Don't show anything if no pending requests
  }

  return (
    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🔄</span>
        <h3 className="font-medium text-purple-300 text-sm">Substitution Request{substitutions.length > 1 ? 's' : ''}</h3>
        <span className="px-1.5 py-0.5 bg-purple-500/30 text-purple-200 rounded-full text-xs font-bold">
          {substitutions.length}
        </span>
      </div>

      <div className="space-y-2">
        {substitutions.map(sub => {
          const timeRemaining = getTimeRemaining(sub.expiresAt);
          const isExpired = timeRemaining === 'Expired';

          return (
            <div
              key={sub.id}
              className="bg-white/5 border border-white/10 rounded-lg p-2"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/event/${sub.eventId}`}
                    className="text-sm font-medium text-light hover:text-primary transition-colors truncate block"
                  >
                    {sub.eventTitle}
                  </Link>
                  <p className="text-xs text-light/70">
                    <strong>{sub.originalUserName}</strong> needs a substitute
                  </p>
                </div>
                <span className={`text-xs font-mono px-2 py-0.5 rounded shrink-0 ${isExpired ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                  ⏱️ {timeRemaining}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleRespond(sub.id, 'accept')}
                  disabled={responding === sub.id || isExpired}
                  className="flex-1 px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✅ Accept
                </button>
                <button
                  onClick={() => handleRespond(sub.id, 'reject')}
                  disabled={responding === sub.id || isExpired}
                  className="flex-1 px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ❌ Decline
                </button>
              </div>

              {isExpired && (
                <p className="text-xs text-red-300 mt-1">
                  This request has expired
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

