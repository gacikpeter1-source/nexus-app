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
    const now = Date.now();
    const expiry = expiresAt.toMillis();
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
    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🔄</span>
        <h3 className="font-title text-lg text-purple-300">Pending Substitution Requests</h3>
        <span className="px-2 py-0.5 bg-purple-500/30 text-purple-200 rounded-full text-xs font-bold">
          {substitutions.length}
        </span>
      </div>

      <div className="space-y-3">
        {substitutions.map(sub => {
          const timeRemaining = getTimeRemaining(sub.expiresAt);
          const isExpired = timeRemaining === 'Expired';

          return (
            <div
              key={sub.id}
              className="bg-white/5 border border-white/10 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <Link
                    to={`/event/${sub.eventId}`}
                    className="font-medium text-light hover:text-primary transition-colors"
                  >
                    {sub.eventTitle}
                  </Link>
                  <p className="text-sm text-light/70 mt-1">
                    <strong>{sub.originalUserName}</strong> requests you as their substitute
                  </p>
                </div>
                <div className={`text-xs font-mono ${isExpired ? 'text-red-300' : 'text-yellow-300'}`}>
                  ⏱️ {timeRemaining}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleRespond(sub.id, 'accept')}
                  disabled={responding === sub.id || isExpired}
                  className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✅ Accept
                </button>
                <button
                  onClick={() => handleRespond(sub.id, 'reject')}
                  disabled={responding === sub.id || isExpired}
                  className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ❌ Decline
                </button>
              </div>

              {isExpired && (
                <p className="text-xs text-red-300 mt-2">
                  This request has expired and will be removed shortly.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

