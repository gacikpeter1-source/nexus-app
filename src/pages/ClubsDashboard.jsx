// src/pages/ClubsDashboard.jsx
import { useEffect, useMemo, useState } from 'react';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import CreateClubWithSubscription from '../components/CreateClubWithSubscription';
import { 
  getAllClubs, 
  createRequest, 
  createOrderResponse,
  getClubOrderTemplates
} from '../firebase/firestore';

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
            ✖
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
  const [allClubsForRequest, setAllClubsForRequest] = useState([]);
  const [selectedClubForRequest, setSelectedClubForRequest] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderResponseModal, setShowOrderResponseModal] = useState(false);
  const [orderResponseForm, setOrderResponseForm] = useState({});
  const [respondingToOrder, setRespondingToOrder] = useState(false);
  

  const isManager = useMemo(() => 
    user && [ROLES.ADMIN, ROLES.TRAINER, ROLES.ASSISTANT].includes(user.role), 
    [user]
  );

  useEffect(() => {
    loadClubs();
  }, [user]);

  useEffect(() => {
    if (openRequestModal) {
      loadAllClubsForRequest();
    }
  }, [openRequestModal]);

  async function loadAllClubsForRequest() {
    try {
      const allClubs = await getAllClubs();
      // Filter out clubs user is already member of
      const availableClubs = allClubs.filter(club => {
        const isMember = (club.members || []).includes(user?.id) ||
                        (club.trainers || []).includes(user?.id) ||
                        (club.assistants || []).includes(user?.id);
        return !isMember;
      });
      setAllClubsForRequest(availableClubs);
    } catch (error) {
      console.error('Error loading clubs:', error);
      setAllClubsForRequest([]);
    }
  }

  async function loadClubs() {
    setLoading(true);
    try {
      // Load all clubs from Firebase
      const allClubs = await getAllClubs();
      
      // Filter clubs where user is a member
      let userClubs = allClubs.filter(club => {
        // SuperAdmin sees all clubs
        if (user?.isSuperAdmin) return true;
        
        // Admin sees all clubs
        if (user?.role === ROLES.ADMIN) return true;
        
        // Regular users see clubs where they are members
        return club.createdBy === user?.id ||
               (club.trainers || []).includes(user?.id) ||
               (club.assistants || []).includes(user?.id) ||
               (club.members || []).includes(user?.id);
      });

      setClubs(userClubs);
    } catch (error) {
      console.error('Error loading clubs:', error);
      setClubs([]);
    } finally {
      setLoading(false);
    }
  }

async function handleSubmitOrderResponse(status) {
  if (status === 'accepted') {
    // Validate required fields
    const missingFields = selectedOrder.fields
      .filter(field => field.required && !orderResponseForm[field.id]?.trim())
      .map(field => field.label);
    
    if (missingFields.length > 0) {
      showToast(`Please fill required fields: ${missingFields.join(', ')}`, 'error');
      return;
    }
  }

  try {
    setRespondingToOrder(true);
    
    const responseData = {
      orderId: selectedOrder.id,
      userId: user.id,
      clubId: selectedOrder.clubId,
      teamId: selectedOrder.teams[0] || null,
      status: status,
      responses: status === 'accepted' ? orderResponseForm : {}
    };

    await createOrderResponse(responseData);
    showToast(status === 'accepted' ? 'Order accepted!' : 'Order declined', 'success');
    
    setShowOrderResponseModal(false);
    setSelectedOrder(null);
    setOrderResponseForm({});
    
    // Reload pending orders
    await loadPendingOrders();
  } catch (error) {
    console.error('Error submitting order response:', error);
    showToast('Failed to submit response', 'error');
  } finally {
    setRespondingToOrder(false);
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
    
    // SuperAdmin and Admin see all teams
    if (user?.isSuperAdmin || user?.role === ROLES.ADMIN) return clubTeams;
    
    // Club trainers/assistants see all teams
    const isClubTrainer = (selectedClub.trainers || []).includes(user?.id);
    const isClubAssistant = (selectedClub.assistants || []).includes(user?.id);
    if (isClubTrainer || isClubAssistant) return clubTeams;
    
    // Regular users only see teams where they are member, trainer, or assistant
    return clubTeams.filter(t => 
      (t.members || []).includes(user?.id) ||
      (t.trainers || []).includes(user?.id) ||
      (t.assistants || []).includes(user?.id)
    );
  }, [selectedClub, user]);

  const availableTeams = useMemo(() => {
    if (!selectedClubForRequest) return [];
    const club = allClubsForRequest.find(c => c.id === selectedClubForRequest);
    return club?.teams || [];
  }, [selectedClubForRequest, allClubsForRequest]);

  const submitJoinRequest = async () => {
    if (!selectedClubForRequest) return showToast('Please select a club.', 'error');

    try {
      await createRequest({
        userId: user.id,
        clubId: selectedClubForRequest,
        teamId: selectedTeam || null,
      });
      
      setOpenRequestModal(false);
      setSelectedClubForRequest('');
      setSelectedTeam('');
      showToast('Join request submitted!', 'success');
    } catch (error) {
      console.error('Error submitting request:', error);
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
        <div className="text-center py-8">
          <p className="text-light/50 text-sm">No clubs yet. Use the buttons above to get started.</p>
        </div>
      );
    }

    
    return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clubs.map((club, idx) => {
          const clubTeams = Array.isArray(club.teams) ? club.teams : [];
          const userTeams = isManager 
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
              style={{ 
                animationDelay: `${idx * 0.05}s`,
                ...(club.logoUrl && {
                  backgroundImage: `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url(${club.logoUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                })
              }}
            >
              {/* Shine effect on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              </div>

              <div className="relative z-10">
                <h3 className="font-title text-2xl text-light group-hover:text-primary transition-colors mb-1">
                  {club.name}
                </h3>
                
                {club.clubType && (
                  <p className="text-sm text-light/60 mb-3">
                    {club.clubType}
                  </p>
                )}

                {/* Stats */}
                <div className="flex gap-6">
                  <div>
                    <div className="text-2xl font-bold text-primary">{clubTeams.length}</div>
                    <div className="text-xs text-light/50 uppercase tracking-wider">
                      {clubTeams.length === 1 ? 'Team' : 'Teams'}
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
    </>
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
          </div>
        </div>

        {/* Teams in this club */}
        {userTeamsInClub.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-white/20 bg-white/5 backdrop-blur-sm p-12 text-center">
            
            <h3 className="font-title text-2xl text-light mb-2">No Teams Yet</h3>
            <p className="text-light/60 mb-6 max-w-md mx-auto">
              You haven&apos;t joined any teams in this club yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {userTeamsInClub.map((team, idx) => (
              <div
                key={team.id}
                onClick={() => navigate(`/team/${selectedClubId}/${team.id}`)}
                className="group relative cursor-pointer bg-white/5 backdrop-blur-sm border border-white/10 p-5 rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all duration-300 card-hover overflow-hidden"
                style={{
                  animationDelay: `${idx * 0.05}s`,
                  ...(team.logoUrl && {
                    backgroundImage: `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url(${team.logoUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  })
                }}
              >
                {/* Shine effect on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                </div>

                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Team Icon */}
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold text-white">
                      {team.name.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <h3 className="font-title text-xl text-light group-hover:text-primary transition-colors">
                        {team.name}
                      </h3>
                      <p className="text-sm text-light/60">
                        {team.sport || 'Sport'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {(team.members || []).length}
                    </div>
                    <div className="text-xs text-light/50 uppercase tracking-wider">
                      {(team.members || []).length === 1 ? 'Member' : 'Members'}
                    </div>
                  </div>

                  {/* Arrow indicator */}
                  <div className="text-primary opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all ml-4">
                    →
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="mb-8 animate-fade-in">
        <h1 className="font-display text-6xl md:text-7xl text-light mb-2 tracking-wider">
          MY <span className="text-primary">CLUBS</span>
        </h1>
        <p className="text-light/60 text-lg">
          {selectedClub ? 'Select a team to view details' : 'Select a club to view your teams'}
        </p>
      </div>

      {/* Action Buttons - Only show when not viewing a specific club */}
      {!selectedClubId && (
        <div className="flex gap-3 mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <button
            onClick={() => setOpenCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <span>+</span>
            <span>Create Club</span>
          </button>
          <button
            onClick={() => setOpenRequestModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <span>+</span>
            <span>Request to Join</span>
          </button>
        </div>
      )}

      {/* Main Content */}
      <section className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        {selectedClubId ? renderTeamList() : renderClubList()}
      </section>

      {/* Join Request Modal */}
      <Modal 
        open={openRequestModal} 
        title="Request to Join" 
        onClose={() => setOpenRequestModal(false)}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-light/80 mb-2">Select Club</label>
            <select
              value={selectedClubForRequest}
              onChange={(e) => { setSelectedClubForRequest(e.target.value); setSelectedTeam(''); }}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="" className="bg-mid-dark">-- Select a club --</option>
              {allClubsForRequest.map(c => (
                <option key={c.id} value={c.id} className="bg-mid-dark">{c.name}</option>
              ))}
            </select>
          </div>

          {availableTeams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-light/80 mb-2">Select Team (optional)</label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="" className="bg-mid-dark">-- Select a team --</option>
                {availableTeams.map(t => (
                  <option key={t.id} value={t.id} className="bg-mid-dark">{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={submitJoinRequest}
            className="w-full btn-primary"
          >
            Submit Request
          </button>
        </div>
      </Modal>

      {/* Create Club Modal */}
      {openCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative max-w-4xl w-full my-8">
            <button
              onClick={() => setOpenCreateModal(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-light transition-all"
            >
              ✖
            </button>
            <CreateClubWithSubscription />
          </div>
        </div>
      )}

    {/* Order Response Modal */}
      {showOrderResponseModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-mid-dark border border-white/20 rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-title text-2xl text-light">{selectedOrder.title}</h3>
              <button
                onClick={() => {
                  setShowOrderResponseModal(false);
                  setSelectedOrder(null);
                  setOrderResponseForm({});
                }}
                className="text-light/60 hover:text-light transition-colors"
              >
                ✕
              </button>
            </div>

            {selectedOrder.description && (
              <p className="text-sm text-light/70 mb-6 pb-6 border-b border-white/10">
                {selectedOrder.description}
              </p>
            )}

            <div className="space-y-4 mb-6">
              {selectedOrder.fields.map(field => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-light/80 mb-2">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  
                  {field.type === 'text' && (
                    <input
                      type="text"
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      value={orderResponseForm[field.id] || ''}
                      onChange={(e) => setOrderResponseForm(f => ({ 
                        ...f, 
                        [field.id]: e.target.value 
                      }))}
                      required={field.required}
                    />
                  )}

                  {field.type === 'number' && (
                    <input
                      type="number"
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      value={orderResponseForm[field.id] || ''}
                      onChange={(e) => setOrderResponseForm(f => ({ 
                        ...f, 
                        [field.id]: e.target.value 
                      }))}
                      required={field.required}
                    />
                  )}

                  {field.type === 'dropdown' && (
                    <select
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      value={orderResponseForm[field.id] || ''}
                      onChange={(e) => setOrderResponseForm(f => ({ 
                        ...f, 
                        [field.id]: e.target.value 
                      }))}
                      required={field.required}
                    >
                      <option value="" className="bg-mid-dark">Select...</option>
                      {field.options?.map((opt, idx) => (
                        <option key={idx} value={opt} className="bg-mid-dark">
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.type === 'textarea' && (
                    <textarea
                      rows={3}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      value={orderResponseForm[field.id] || ''}
                      onChange={(e) => setOrderResponseForm(f => ({ 
                        ...f, 
                        [field.id]: e.target.value 
                      }))}
                      required={field.required}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleSubmitOrderResponse('accepted')}
                className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-all disabled:opacity-50"
                disabled={respondingToOrder}
              >
                {respondingToOrder ? 'Submitting...' : '✓ Accept & Submit'}
              </button>
              <button
                onClick={() => handleSubmitOrderResponse('declined')}
                className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all disabled:opacity-50"
                disabled={respondingToOrder}
              >
                ✗ Decline
              </button>
            </div>
          </div>
        </div>
      )}   
    </div>
  );
}
