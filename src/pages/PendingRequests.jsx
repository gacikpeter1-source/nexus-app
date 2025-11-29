// src/pages/PendingRequests.jsx
import { useEffect, useState } from 'react';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function PendingRequests() {
  const { user, approveJoinRequest, denyJoinRequest } = useAuth();
  const { showToast } = useToast();
  
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState([]);

  const isManager = user && [ROLES.ADMIN, ROLES.TRAINER, ROLES.ASSISTANT].includes(user.role);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = () => {
    setLoading(true);
    
    // Load clubs user manages
    const clubsAll = JSON.parse(localStorage.getItem('clubs') || '[]');
    const myClubs = clubsAll.filter(club => {
      if (!club) return false;
      if (user.role === ROLES.ADMIN) return true;
      const trainers = club.trainers || [];
      const assistants = club.assistants || [];
      return trainers.includes(user.id) || assistants.includes(user.id);
    });
    setClubs(myClubs);

    // Load pending requests for those clubs
    const requests = JSON.parse(localStorage.getItem('joinRequests') || '[]');
    const myClubIds = myClubs.map(c => c.id);
    const pending = requests.filter(r => 
      r.status === 'pending' && myClubIds.includes(r.clubId)
    );
    
    setPendingRequests(pending);
    setLoading(false);
  };

  const handleApprove = (requestId) => {
    try {
      approveJoinRequest({ requestId, handledByUserId: user.id });
      showToast('Request approved!', 'success');
      // Reload data after a short delay to ensure localStorage is updated
      setTimeout(() => {
        loadData();
      }, 100);
    } catch (error) {
      showToast(error.message || 'Failed to approve request', 'error');
    }
  };

  const handleDeny = (requestId) => {
    try {
      denyJoinRequest({ requestId, handledByUserId: user.id });
      showToast('Request denied', 'info');
      // Reload data after a short delay to ensure localStorage is updated
      setTimeout(() => {
        loadData();
      }, 100);
    } catch (error) {
      showToast(error.message || 'Failed to deny request', 'error');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark">
        <div className="text-light">Please log in</div>
      </div>
    );
  }

  if (!isManager) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark">
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 max-w-md">
          <div className="text-6xl mb-4 text-center">🔒</div>
          <h2 className="font-title text-2xl text-light text-center mb-2">Access Denied</h2>
          <p className="text-light/70 text-center">
            Only managers (Trainers, Assistants, or Admins) can view pending requests.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-title text-5xl text-light mb-2 flex items-center gap-3">
            <span className="w-2 h-12 bg-secondary rounded"></span>
            Pending Requests
          </h1>
          <p className="text-light/60 text-lg ml-8">
            Approve or deny join requests for your clubs
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-light/60">Loading requests...</div>
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="bg-white/5 border-2 border-dashed border-white/20 rounded-2xl p-12 text-center max-w-2xl mx-auto">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="font-title text-3xl text-light mb-2">All Caught Up!</h2>
            <p className="text-light/60">
              No pending join requests at the moment.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {pendingRequests.map(request => {
              const users = JSON.parse(localStorage.getItem('users') || '[]');
              const requester = users.find(u => u.id === request.userId) || { email: request.userId };
              const club = clubs.find(c => c.id === request.clubId) || { name: 'Unknown Club' };
              
              // Get team info if teamId exists
              let teamName = null;
              if (request.teamId && club.teams) {
                const team = club.teams.find(t => t.id === request.teamId);
                if (team) teamName = team.name;
              }

              return (
                <div 
                  key={request.id}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 hover:border-primary/30 transition-all animate-fade-in"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* User Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white">
                          {(requester.username || requester.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-light text-lg">
                            {requester.username || requester.email}
                          </div>
                          <div className="text-xs text-light/50">
                            {requester.email}
                          </div>
                        </div>
                      </div>

                      {/* Request Details */}
                      <div className="ml-15 space-y-1">
                        <div className="text-sm text-light/80">
                          <span className="text-light/50">Club:</span>{' '}
                          <span className="text-accent font-medium">{club.name}</span>
                        </div>
                        {teamName && (
                          <div className="text-sm text-light/80">
                            <span className="text-light/50">Team:</span>{' '}
                            <span className="text-secondary font-medium">{teamName}</span>
                          </div>
                        )}
                        <div className="text-xs text-light/40">
                          Requested: {new Date(request.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(request.id)}
                        className="px-5 py-2.5 bg-success hover:bg-success/80 text-white rounded-lg transition-all font-semibold text-sm flex items-center gap-2"
                      >
                        <span>✓</span>
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleDeny(request.id)}
                        className="px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-all font-semibold text-sm flex items-center gap-2"
                      >
                        <span>✕</span>
                        <span>Deny</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Stats */}
        {pendingRequests.length > 0 && (
          <div className="mt-8 text-center">
            <div className="inline-block bg-white/5 border border-white/10 rounded-lg px-6 py-3">
              <span className="text-light/60 text-sm">Total Pending: </span>
              <span className="font-bold text-secondary text-lg">{pendingRequests.length}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
