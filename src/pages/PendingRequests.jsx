// src/pages/PendingRequests.jsx
import { useEffect, useState } from 'react';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getAllClubs, getPendingRequests, updateRequest, updateClub, getClub, getAllUsers } from '../firebase/firestore';
import { isClubOwner } from '../utils/permissions';

export default function PendingRequests() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState([]);
  const [users, setUsers] = useState([]);

  const isManager = user && (user.isSuperAdmin || [ROLES.ADMIN, ROLES.TRAINER, ROLES.ASSISTANT].includes(user.role));

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    
    try {
      // Load all clubs from Firebase
      const allClubs = await getAllClubs();
      
      // Filter clubs user can manage
      const myClubs = allClubs.filter(club => {
        if (user.isSuperAdmin) return true;
        if (isClubOwner(user, club)) return true;
        return (club.trainers || []).includes(user.id) || 
               (club.assistants || []).includes(user.id);
      });
      setClubs(myClubs);

      // Load all users for display
      const allUsers = await getAllUsers();
      setUsers(allUsers);

      // Load pending requests from Firebase
      const allRequests = await getPendingRequests();
      const myClubIds = myClubs.map(c => c.id);
      const pending = allRequests.filter(r => myClubIds.includes(r.clubId));
      
      setPendingRequests(pending);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('Failed to load requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request) => {
    try {
      // Update request status in Firebase
      await updateRequest(request.id, { 
        status: 'approved',
        handledBy: user.id,
        handledAt: new Date().toISOString()
      });
      
      // Get fresh club data
      const club = await getClub(request.clubId);
      
      // Add user to club members
      const updatedMembers = [...(club.members || [])];
      if (!updatedMembers.includes(request.userId)) {
        updatedMembers.push(request.userId);
      }
      
      // If specific team requested, add to team
      let updatedTeams = club.teams || [];
      if (request.teamId) {
        updatedTeams = updatedTeams.map(t => {
          if (t.id === request.teamId) {
            const teamMembers = [...(t.members || [])];
            if (!teamMembers.includes(request.userId)) {
              teamMembers.push(request.userId);
            }
            return { ...t, members: teamMembers };
          }
          return t;
        });
      }
      
      // Update club in Firebase
      await updateClub(request.clubId, { 
        members: updatedMembers,
        teams: updatedTeams
      });
      
      showToast('Request approved!', 'success');
      loadData();
    } catch (error) {
      console.error('Error approving request:', error);
      showToast('Failed to approve request', 'error');
    }
  };

  const handleDeny = async (requestId) => {
    try {
      await updateRequest(requestId, { 
        status: 'denied',
        handledBy: user.id,
        handledAt: new Date().toISOString()
      });
      
      showToast('Request denied', 'info');
      loadData();
    } catch (error) {
      console.error('Error denying request:', error);
      showToast('Failed to deny request', 'error');
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
                          Requested: {request.createdAt ? new Date(request.createdAt).toLocaleString() : 'Unknown'}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(request)}
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
