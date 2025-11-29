// src/pages/ClubsDashboard.jsx
import { useEffect, useMemo, useState } from 'react';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import CreateClubWithSubscription from '../components/CreateClubWithSubscription';
import { getAllClubs } from '../firebase/firestore';

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-mid-dark border border-white/20 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-in">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-title text-2xl text-light tracking-wide">{title}</h3>
          <button 
            onClick={onClose} 
            className="text-light/60 hover:text-light w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

export default function ClubsDashboard() {
  const {
    user,
    listClubsForUser,
  } = useAuth();

  const { showToast } = useToast();
  const navigate = useNavigate();

  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClubId, setSelectedClubId] = useState(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openRequestModal, setOpenRequestModal] = useState(false);

  const isManager = useMemo(() => 
    user && [ROLES.ADMIN, ROLES.TRAINER, ROLES.ASSISTANT].includes(user.role), 
    [user]
  );

  useEffect(() => {
    loadClubs();
  }, [user]);

  async function loadClubs() {
    setLoading(true);
    try {
      console.log('Loading clubs for user:', user?.email, 'isSuperAdmin:', user?.isSuperAdmin);
      
      let list = [];
      
      // SuperAdmin sees ALL clubs
      if (user?.isSuperAdmin === true) {
        console.log('User is SuperAdmin - loading ALL clubs from Firebase');
        list = await getAllClubs();
        console.log('All clubs loaded:', list);
      } else {
        // Regular users see only their clubs
        console.log('Regular user - loading user clubs');
        list = listClubsForUser ? await listClubsForUser() : [];
        console.log('User clubs loaded:', list);
      }
      
      if (!Array.isArray(list)) list = [];

      const deduped = list.reduce((acc, club) => {
        if (!acc.find(c => c.id === club.id)) acc.push(club);
        return acc;
      }, []);

      console.log('Setting clubs to state:', deduped);
      setClubs(deduped);
    } catch (error) {
      console.error('Error loading clubs:', error);
      setClubs([]);
    } finally {
      setLoading(false);
    }
  }

  // Get selected club object
  const selectedClub = useMemo(() => {
    if (!selectedClubId) return null;
    return clubs.find(c => c.id === selectedClubId);
  }, [selectedClubId, clubs]);

  // Get teams in selected club where user is a member
  const userTeamsInClub = useMemo(() => {
    if (!selectedClub) return [];
    const clubTeams = Array.isArray(selectedClub.teams) ? selectedClub.teams : [];
    
    // If manager or SuperAdmin, show all teams
    if (isManager || user?.isSuperAdmin) return clubTeams;
    return clubTeams.filter(t => (t.members || []).includes(user.id));
  }, [selectedClub, user, isManager]);

  // Join request modal state
  const [selectedClubForRequest, setSelectedClubForRequest] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');

  const availableClubs = useMemo(() => {
    return clubs; // Use clubs from Firebase, not localStorage
  }, [clubs]);

  const availableTeams = useMemo(() => {
    if (!selectedClubForRequest) return [];
    const club = availableClubs.find(c => c.id === selectedClubForRequest);
    return club?.teams || [];
  }, [selectedClubForRequest, availableClubs]);

  const submitJoinRequest = async () => {
    if (!selectedClubForRequest) return showToast('Please select a club.', 'error');

    try {
      // TODO: Implement Firebase join request
      showToast('Join request feature coming soon!', 'info');
      setOpenRequestModal(false);
      setSelectedClubForRequest('');
      setSelectedTeam('');
    } catch (error) {
      console.error('Error submitting join request:', error);
      showToast('Failed to submit request', 'error');
    }
  };

  // Render club list (Level 1)
  const renderClubList = () => {
    if (loading) {
      return (
        <div className="text-center py-12">
          <div className="text-light/60">Loading clubs...</div>
        </div>
      );
    }

    if (clubs.length === 0) {
      return (
        <div className="text-light/40 text-sm">
          No clubs yet. Use the buttons above to get started.
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clubs.map((club, idx) => {
          const clubTeams = Array.isArray(club.teams) ? club.teams : [];
          const userTeams = (isManager || user?.isSuperAdmin)
            ? clubTeams 
            : clubTeams.filter(t => (t.members || []).includes(user.id));
          const totalMembers = new Set([
            ...(club.trainers || []),
            ...(club.assistants || []),
            ...(club.members || [])
          ]).size;

          return (
            <div
              key={club.id}
              onClick={() => setSelectedClubId(club.id)}
              className="group relative cursor-pointer bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all duration-300 card-hover overflow-hidden"
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              {/* Shine effect on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              </div>

              <div className="relative z-10">
                {/* Club Icon */}
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl mb-4">
                  🏛️
                </div>

                <h3 className="font-title text-2xl text-light group-hover:text-primary transition-colors mb-2">
                  {club.name}
                </h3>
                
                {club.clubNumber && (
                  <p className="text-sm text-light/40 mb-4">{club.clubNumber}</p>
                )}

                {/* Stats */}
                <div className="flex gap-6 mt-4">
                  <div>
                    <div className="text-2xl font-bold text-primary">{userTeams.length}</div>
                    <div className="text-xs text-light/50 uppercase tracking-wider">
                      {userTeams.length === 1 ? 'Team' : 'Teams'}
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-accent">{totalMembers}</div>
                    <div className="text-xs text-light/50 uppercase tracking-wider">
                      {totalMembers === 1 ? 'Member' : 'Members'}
                    </div>
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="absolute bottom-6 right-6 text-primary opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                  →
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render team list for selected club (Level 2)
  const renderTeamList = () => {
    if (!selectedClub) return null;

    return (
      <div className="animate-fade-in">
        {/* Back button and club header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => setSelectedClubId(null)}
            className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-light transition-all"
          >
            ←
          </button>
          <div>
            <h2 className="font-title text-3xl text-light">{selectedClub.name}</h2>
            {selectedClub.clubNumber && (
              <p className="text-sm text-light/60">{selectedClub.clubNumber}</p>
            )}
          </div>
        </div>

        {/* Teams in this club */}
        {userTeamsInClub.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-white/20 bg-white/5 backdrop-blur-sm p-12 text-center">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="font-title text-2xl text-light mb-2">No Teams Yet</h3>
            <p className="text-light/60 mb-6 max-w-md mx-auto">
              You haven&apos;t joined any teams in this club yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {userTeamsInClub.map((team, idx) => {
              const memberCount = (team.members || []).length;
              return (
                <div
                  key={team.id}
                  onClick={() => navigate(`/team/${selectedClub.id}/${team.id}`)}
                  className="group relative cursor-pointer bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-xl hover:bg-white/10 hover:border-accent/50 transition-all duration-300 card-hover"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="relative z-10">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center text-2xl mb-3">
                      ⚽
                    </div>
                    <h4 className="font-title text-xl text-light group-hover:text-accent transition-colors mb-1">
                      {team.name}
                    </h4>
                    <p className="text-sm text-light/50 mb-4">
                      {memberCount} {memberCount === 1 ? 'member' : 'members'}
                    </p>
                    <div className="absolute bottom-4 right-4 text-accent opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                      →
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen p-6">
      <div className="flex-1 overflow-auto">
        {/* Page Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-6xl md:text-7xl text-light mb-2 tracking-wider">
            MY <span className="text-primary">CLUBS</span>
          </h1>
          <p className="text-light/60 text-lg mb-4">Manage your clubs and teams</p>
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            <button 
              onClick={() => setOpenCreateModal(true)} 
              className="px-6 py-2.5 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all flex items-center gap-2"
            >
              <span>+</span>
              <span>Create Club</span>
            </button>
            <button 
              onClick={() => setOpenRequestModal(true)} 
              className="px-6 py-2.5 bg-accent hover:bg-accent/80 text-white rounded-lg font-medium transition-all flex items-center gap-2"
            >
              <span>+</span>
              <span>Request to Join</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        {!selectedClubId ? renderClubList() : renderTeamList()}
      </div>

      {/* Create Club Modal */}
      <Modal
        open={openCreateModal}
        title="Create New Club"
        onClose={() => setOpenCreateModal(false)}
      >
        <CreateClubWithSubscription onClose={() => {
          setOpenCreateModal(false);
          loadClubs(); // Reload clubs after creation
        }} />
      </Modal>

      {/* Join Request Modal */}
      {openRequestModal && (
        <Modal
          open={openRequestModal}
          title="Request to Join Club"
          onClose={() => setOpenRequestModal(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-light/80">Select Club</label>
              <select
                value={selectedClubForRequest}
                onChange={e => setSelectedClubForRequest(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="" className="bg-mid-dark">-- Select Club --</option>
                {availableClubs.map(c => (
                  <option key={c.id} value={c.id} className="bg-mid-dark">{c.name}</option>
                ))}
              </select>
            </div>

            {selectedClubForRequest && availableTeams.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2 text-light/80">Select Team (Optional)</label>
                <select
                  value={selectedTeam}
                  onChange={e => setSelectedTeam(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="" className="bg-mid-dark">-- No Team --</option>
                  {availableTeams.map(t => (
                    <option key={t.id} value={t.id} className="bg-mid-dark">{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setOpenRequestModal(false)}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={submitJoinRequest}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg transition-all font-medium"
              >
                Submit Request
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
