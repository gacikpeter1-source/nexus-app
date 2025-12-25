// src/pages/Teams.jsx
import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getUserClubs, getUserPendingOrders, createOrderResponse } from '../firebase/firestore';
import { useToast } from '../contexts/ToastContext';

/**
 * Teams page with enhanced filtering:
 * - Filter by Club
 * - Filter by Team
 * - Filter by Athlete/Child (for parents)
 */

export default function Teams() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  
  // Filter state
  const [filterType, setFilterType] = useState('all'); // "all" | "club" | "team" | "athlete"
  const [filterValue, setFilterValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingOrders, setPendingOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderResponseModal, setShowOrderResponseModal] = useState(false);
  const [orderResponseForm, setOrderResponseForm] = useState({});
  const [respondingToOrder, setRespondingToOrder] = useState(false);

  // Load clubs from Firestore (teams are nested inside clubs)
  const { data: clubs, isLoading, error } = useQuery({
    queryKey: ['userClubs', user?.id],
    queryFn: () => getUserClubs(user?.id),
    enabled: !!user?.id
  });

  // Extract all teams from clubs
  const mergedTeams = useMemo(() => {
    if (!clubs || !Array.isArray(clubs)) return [];
    
    const teams = [];
    for (const club of clubs) {
      if (!Array.isArray(club.teams)) continue;
      
      for (const t of club.teams) {
        teams.push({
          id: t.id || t._id || Math.random().toString(36).slice(2,8),
          name: t.name || t.title || 'Unnamed Team',
          sport: t.sport || t.category || t.type || '',
          trainers: Array.isArray(t.trainers) ? t.trainers : (t.trainer ? [t.trainer] : []),
          assistants: Array.isArray(t.assistants) ? t.assistants : (t.assistant ? [t.assistant] : []),
          members: Array.isArray(t.members) ? t.members : (t.member ? [t.member] : []),
          clubId: club.id || null,
          clubName: club.name || null
        });
      }
    }
    
    console.log('📦 Extracted teams from Firestore clubs:', teams);
    return teams;
  }, [clubs]);

  // Filter teams by user access
  const userTeams = useMemo(() => {
    if (!user) return [];
    
    const isAdmin = user.role === ROLES.ADMIN || user.isSuperAdmin;
    
    console.log('🔍 Teams Page Debug:', {
      userId: user.id,
      userRole: user.role,
      isAdmin,
      totalMergedTeams: mergedTeams.length,
      mergedTeamsPreview: mergedTeams.map(t => ({
        id: t.id,
        name: t.name,
        trainers: t.trainers,
        assistants: t.assistants,
        members: t.members
      }))
    });
    
    return mergedTeams.filter(t => {
      if (isAdmin) return true;
      const trainers = Array.isArray(t.trainers) ? t.trainers : [];
      const assistants = Array.isArray(t.assistants) ? t.assistants : [];
      const members = Array.isArray(t.members) ? t.members : [];
      const hasAccess = trainers.includes(user.id) || assistants.includes(user.id) || members.includes(user.id);
      
      if (!hasAccess) {
        console.log(`❌ No access to team "${t.name}" - User ${user.id} not in trainers/assistants/members`);
      }
      
      return hasAccess;
    });
  }, [mergedTeams, user]);

  // Build filter options
  const filterOptions = useMemo(() => {
    if (!user) return { clubs: [], teams: [], athletes: [] };
    
    // Build clubs list
    const clubsMap = {};
    userTeams.forEach(t => {
      if (t && t.clubId) {
        clubsMap[t.clubId] = clubsMap[t.clubId] || { 
          id: t.clubId, 
          name: t.clubName || `Club ${t.clubId}` 
        };
      }
    });
    const clubsList = Object.values(clubsMap);

    // Teams are already filtered by user access
    const teamsList = userTeams;

    // Athletes/children (for parents)
    const athletes = (user && user.athletes) ? user.athletes : [];

    return {
      clubs: clubsList,
      teams: teamsList,
      athletes
    };
  }, [userTeams, user]);

  // Apply filters
  const filteredTeams = useMemo(() => {
    let filtered = userTeams;

    // Apply type filter
    if (filterType === 'club' && filterValue) {
      filtered = filtered.filter(t => String(t.clubId) === String(filterValue));
    } else if (filterType === 'team' && filterValue) {
      filtered = filtered.filter(t => String(t.id) === String(filterValue));
    } else if (filterType === 'athlete' && filterValue) {
      // Filter teams that have this athlete as member
      filtered = filtered.filter(t => 
        (t.members || []).includes(filterValue)
      );
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        (t.sport || '').toLowerCase().includes(query) ||
        (t.clubName || '').toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [userTeams, filterType, filterValue, searchQuery]);

  // Load pending orders
  useEffect(() => {
    if (user) {
      loadPendingOrders();
    }
  }, [user]);

  async function loadPendingOrders() {
    if (!user) return;
    
    try {
      const orders = await getUserPendingOrders(user.id);
      setPendingOrders(orders);
    } catch (error) {
      console.error('Error loading pending orders:', error);
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-light/60">{t('common.loading')}...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">Error: {error.message}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen p-6">
        <h1 className="font-display text-2xl md:text-4xl text-light mb-4">{t('nav.myTeams')}</h1>
        <p className="text-light/60">Please sign in to see your teams.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl md:text-4xl text-light mb-1">
              MY <span className="text-primary">TEAMS</span>
            </h1>
            <p className="text-light/60 text-sm">
              {filteredTeams.length} {filteredTeams.length === 1 ? 'team' : 'teams'}
            </p>
          </div>
        </div>
      </div>

            {/* Pending Orders Section - Minimal */}
      {pendingOrders.length > 0 && (
        <div className="mb-4 animate-fade-in" style={{ animationDelay: '0.05s' }}>
          <div className="space-y-1">
            {pendingOrders.map(order => (
              <button
                key={order.id}
                onClick={() => {
                  setSelectedOrder(order);
                  setShowOrderResponseModal(true);
                  setOrderResponseForm({});
                }}
                className="w-full bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 hover:border-orange-500/50 rounded-lg px-3 py-2 transition-all text-left group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm">📋</span>
                    <span className="text-xs font-medium text-orange-300 uppercase tracking-wide shrink-0">
                      Pending Order
                    </span>
                    <span className="text-xs text-light font-semibold truncate">
                      {order.title}
                    </span>
                    {order.deadline && (
                      <span className="hidden sm:inline text-xs text-light/40 shrink-0">
                        • Due {new Date(order.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity text-xs shrink-0">
                    Click to respond →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 space-y-3 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        {/* Filter Type Selection */}
        <div className="flex flex-wrap gap-2">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setFilterValue(''); }}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          >
            <option value="all" className="bg-mid-dark">{t('common.all')}</option>
            <option value="club" className="bg-mid-dark">Filter by Club</option>
            <option value="team" className="bg-mid-dark">Filter by Team</option>
            {user?.role === 'parent' && (
              <option value="athlete" className="bg-mid-dark">Filter by Child/Athlete</option>
            )}
          </select>

          {/* Dynamic filter value selection */}
          {filterType !== 'all' && (
            <select
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="" className="bg-mid-dark">
                {filterType === 'club' ? 'Select Club' : 
                 filterType === 'team' ? 'Select Team' : 
                 'Select Athlete'}
              </option>

              {filterType === 'club' && filterOptions.clubs.map(c => (
                <option key={c.id} value={c.id} className="bg-mid-dark">
                  {c.name}
                </option>
              ))}

              {filterType === 'team' && filterOptions.teams.map(t => (
                <option key={t.id} value={t.id} className="bg-mid-dark">
                  {t.name} {t.clubName ? `(${t.clubName})` : ''}
                </option>
              ))}

              {filterType === 'athlete' && (filterOptions.athletes || []).map(a => (
                <option key={a.id} value={a.id} className="bg-mid-dark">
                  {a.name}
                </option>
              ))}
            </select>
          )}

          {/* Search input */}
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px] bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Active filters display */}
        {(filterType !== 'all' || searchQuery) && (
          <div className="flex items-center gap-2 text-sm text-light/60">
            <span>Active filters:</span>
            {filterType !== 'all' && filterValue && (
              <span className="px-2 py-1 bg-primary/20 text-primary rounded">
                {filterType === 'club' ? filterOptions.clubs.find(c => c.id === filterValue)?.name :
                 filterType === 'team' ? filterOptions.teams.find(t => t.id === filterValue)?.name :
                 filterOptions.athletes?.find(a => a.id === filterValue)?.name}
              </span>
            )}
            {searchQuery && (
              <span className="px-2 py-1 bg-accent/20 text-accent rounded">
                Search: "{searchQuery}"
              </span>
            )}
            <button
              onClick={() => { setFilterType('all'); setFilterValue(''); setSearchQuery(''); }}
              className="text-primary hover:text-primary/80 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Teams List */}
      <section className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        {filteredTeams.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 backdrop-blur-sm p-8 text-center max-w-2xl mx-auto">
            <div className="text-3xl md:text-4xl mb-3">⚽</div>
            <h3 className="font-title text-xl text-light/80 mb-2">
              {userTeams.length === 0 ? 'No Teams Yet' : 'No Teams Found'}
            </h3>
            <p className="text-light/50 text-sm mb-4">
              {userTeams.length === 0 
                ? user?.role === 'trainer' || user?.role === 'assistant'
                  ? 'Create a team in Club Management or be added to an existing team by a club owner.'
                  : 'Join a club and create/join a team to see it here.'
                : 'Try adjusting your filters or search query.'}
            </p>
            {mergedTeams.length > 0 && userTeams.length === 0 && (
              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-left">
                <p className="text-xs text-yellow-200/80 mb-2">
                  <strong>🔍 Debug Info:</strong>
                </p>
                <p className="text-xs text-yellow-200/60">
                  • Total teams in system: {mergedTeams.length}<br/>
                  • Your user ID: {user?.id}<br/>
                  • Your role: {user?.role}<br/>
                  • Teams you can access: 0<br/>
                  <br/>
                  <strong>Why you can't see teams:</strong><br/>
                  You are not added to any team's trainers, assistants, or members list. Check browser console for details.
                </p>
              </div>
            )}
            {(filterType !== 'all' || searchQuery) && (
              <button
                onClick={() => { setFilterType('all'); setFilterValue(''); setSearchQuery(''); }}
                className="btn-secondary mt-4"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTeams.map((team) => {
              const totalMembers = (team.trainers || []).length + 
                                 (team.assistants || []).length + 
                                 (team.members || []).length;
              
              return (
                <Link
                  key={team.id}
                  to={`/team/${team.clubId}/${team.id}`}
                  className="group flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 p-3 rounded-lg hover:bg-white/10 hover:border-primary/50 transition-all"
                >
                  {/* Team Icon */}
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center text-xl shrink-0">
                    {team.sport === 'Football' ? '⚽' :
                     team.sport === 'Basketball' ? '🏀' :
                     team.sport === 'Volleyball' ? '🏐' :
                     team.sport === 'Swimming' ? '🏊' :
                     '🏆'}
                  </div>

                  {/* Team Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-light group-hover:text-primary transition-colors truncate">
                        {team.name}
                      </h3>
                      {team.sport && (
                        <span className="text-xs text-light/50">• {team.sport}</span>
                      )}
                    </div>
                    {team.clubName && (
                      <p className="text-xs text-light/40 truncate">{team.clubName}</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <div className="text-sm font-bold text-primary">
                        {(team.trainers || []).length}
                      </div>
                      <div className="text-xs text-light/50">
                        {t('team.trainers')}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-accent">
                        {totalMembers}
                      </div>
                      <div className="text-xs text-light/50">
                        {t('team.members')}
                      </div>
                    </div>
                  </div>

                  {/* Arrow indicator */}
                  <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    →
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
            {/* Order Response Modal */}
      {showOrderResponseModal && selectedOrder && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            if (!respondingToOrder) {
              setShowOrderResponseModal(false);
              setSelectedOrder(null);
              setOrderResponseForm({});
            }
          }}
        >
          <div 
            className="bg-mid-dark border border-orange-500/30 rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4 pb-4 border-b border-white/10">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📋</span>
                  <span className="text-xs font-semibold text-orange-300 uppercase tracking-wide">
                    Pending Order
                  </span>
                </div>
                <h3 className="font-title text-xl text-light">{selectedOrder.title}</h3>
              </div>
              <button
                onClick={() => {
                  setShowOrderResponseModal(false);
                  setSelectedOrder(null);
                  setOrderResponseForm({});
                }}
                className="text-light/60 hover:text-light transition-colors p-1"
                disabled={respondingToOrder}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Order Info */}
            <div className="flex items-center gap-3 mb-4 text-xs text-light/60">
              <span>📋 {selectedOrder.fields.length} field{selectedOrder.fields.length !== 1 ? 's' : ''}</span>
              {selectedOrder.deadline && (
                <span>⏰ Due {new Date(selectedOrder.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              )}
            </div>

            {selectedOrder.description && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-6">
                <p className="text-sm text-light/80">{selectedOrder.description}</p>
              </div>
            )}

            {/* Form Fields */}
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
                      disabled={respondingToOrder}
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
                      disabled={respondingToOrder}
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
                      disabled={respondingToOrder}
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
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                      value={orderResponseForm[field.id] || ''}
                      onChange={(e) => setOrderResponseForm(f => ({ 
                        ...f, 
                        [field.id]: e.target.value 
                      }))}
                      required={field.required}
                      disabled={respondingToOrder}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => handleSubmitOrderResponse('accepted')}
                className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={respondingToOrder}
              >
                {respondingToOrder ? 'Submitting...' : '✓ Accept & Submit'}
              </button>
              <button
                onClick={() => handleSubmitOrderResponse('declined')}
                className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={respondingToOrder}
              >
                ✗ Decline
              </button>
              <button
                onClick={() => {
                  setShowOrderResponseModal(false);
                  setSelectedOrder(null);
                  setOrderResponseForm({});
                }}
                className="px-4 py-3 bg-white/10 hover:bg-white/15 text-light rounded-lg font-medium transition-all disabled:opacity-50"
                disabled={respondingToOrder}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
