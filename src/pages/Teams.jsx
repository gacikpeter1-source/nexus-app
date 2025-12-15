// src/pages/Teams.jsx
import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTeams } from '../api/localApi';
import { Link } from 'react-router-dom';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getUserPendingOrders, createOrderResponse } from '../firebase/firestore';
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['teams'],
    queryFn: getTeams
  });

  // normalize returned shape: data could be object map or array
  const staticTeamsArr = useMemo(() => {
    const d = Array.isArray(data) ? data : (data ? Object.values(data) : []);
    return (d || []).map(t => ({
      id: t.id || t._id || t.teamId || Math.random().toString(36).slice(2,8),
      name: t.name || t.title || 'Unnamed Team',
      sport: t.sport || t.category || t.type || '',
      trainers: Array.isArray(t.trainers) ? t.trainers : (t.trainer ? [t.trainer] : []),
      assistants: Array.isArray(t.assistants) ? t.assistants : (t.assistant ? [t.assistant] : []),
      members: Array.isArray(t.members) ? t.members : (t.member ? [t.member] : []),
      clubId: t.clubId || null,
      clubName: t.clubName || null,
    }));
  }, [data]);

  // load teams nested under clubs in localStorage
  const localClubTeams = useMemo(() => {
    try {
      const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
      if (!Array.isArray(clubs)) return [];
      const teams = [];
      for (const c of clubs) {
        if (!Array.isArray(c.teams)) continue;
        for (const t of c.teams) {
          teams.push({
            id: t.id || t._id || Math.random().toString(36).slice(2,8),
            name: t.name || t.title || 'Unnamed Team',
            sport: t.sport || t.category || t.type || '',
            trainers: Array.isArray(t.trainers) ? t.trainers : (t.trainer ? [t.trainer] : []),
            assistants: Array.isArray(t.assistants) ? t.assistants : (t.assistant ? [t.assistant] : []),
            members: Array.isArray(t.members) ? t.members : (t.member ? [t.member] : []),
            clubId: c.id || null,
            clubName: c.name || null
          });
        }
      }
      return teams;
    } catch (e) {
      console.warn('Failed to read clubs from localStorage', e);
      return [];
    }
  }, []);

  // merge both sources, dedupe by id
  const mergedTeams = useMemo(() => {
    const map = new Map();
    for (const t of staticTeamsArr) {
      map.set(t.id, t);
    }
    for (const t of localClubTeams) {
      map.set(t.id, t);
    }
    return Array.from(map.values());
  }, [staticTeamsArr, localClubTeams]);

  // Filter teams by user access
  const userTeams = useMemo(() => {
    if (!user) return [];
    
    const isAdmin = user.role === ROLES.ADMIN || user.isSuperAdmin;
    
    return mergedTeams.filter(t => {
      if (isAdmin) return true;
      const trainers = Array.isArray(t.trainers) ? t.trainers : [];
      const assistants = Array.isArray(t.assistants) ? t.assistants : [];
      const members = Array.isArray(t.members) ? t.members : [];
      return trainers.includes(user.id) || assistants.includes(user.id) || members.includes(user.id);
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
      <div className="mb-8 animate-fade-in">
        <h1 className="font-display text-3xl md:text-5xl lg:text-7xl text-light mb-2 tracking-wider">
          MY <span className="text-primary">TEAMS</span>
        </h1>
        <p className="text-light/60 text-lg">
          {filteredTeams.length} {filteredTeams.length === 1 ? 'team' : 'teams'}
        </p>
      </div>

            {/* Pending Orders Section */}
      {pendingOrders.length > 0 && (
        <div className="mb-8 animate-fade-in" style={{ animationDelay: '0.05s' }}>
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-2xl md:text-3xl">📋</div>
              <div>
                <h2 className="font-title text-2xl text-light">Pending Orders</h2>
                <p className="text-sm text-light/60">
                  You have {pendingOrders.length} order{pendingOrders.length !== 1 ? 's' : ''} waiting for response
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingOrders.map(order => (
                <div
                  key={order.id}
                  className="bg-mid-dark border border-white/10 rounded-xl p-6 hover:border-orange-500/50 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-title text-lg text-light">{order.title}</h3>
                    <span className="px-2 py-1 text-xs bg-orange-500/20 text-orange-300 rounded-full whitespace-nowrap">
                      Action Required
                    </span>
                  </div>
                  
                  {order.description && (
                    <p className="text-sm text-light/60 mb-3 line-clamp-2">{order.description}</p>
                  )}
                  
                  <div className="flex flex-wrap gap-2 mb-4 text-xs text-light/50">
                    <span>📋 {order.fields.length} fields</span>
                    {order.deadline && (
                      <span>⏰ {new Date(order.deadline).toLocaleDateString()}</span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedOrder(order);
                      setShowOrderResponseModal(true);
                      setOrderResponseForm({});
                    }}
                    className="w-full px-4 py-2 text-sm bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
                  >
                    Respond Now →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        {/* Filter Type Selection */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setFilterValue(''); }}
            className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
              className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
            className="flex-1 min-w-[200px] bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
                ? 'Join a club or request to join a team to see it here.'
                : 'Try adjusting your filters or search query.'}
            </p>
            {(filterType !== 'all' || searchQuery) && (
              <button
                onClick={() => { setFilterType('all'); setFilterValue(''); setSearchQuery(''); }}
                className="btn-secondary"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {filteredTeams.map((team) => {
              const totalMembers = (team.trainers || []).length + 
                                 (team.assistants || []).length + 
                                 (team.members || []).length;
              
              return (
                <Link
                  key={team.id}
                  to={`/teams/${team.id}`}
                  className="group relative cursor-pointer bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all duration-300 card-hover overflow-hidden"
                >
                  {/* Shine effect on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  </div>

                  <div className="relative z-10">
                    {/* Team Icon */}
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center text-2xl md:text-3xl mb-4">
                      {team.sport === 'Football' ? '⚽' :
                       team.sport === 'Basketball' ? '🏀' :
                       team.sport === 'Volleyball' ? '🏐' :
                       team.sport === 'Swimming' ? '🏊' :
                       '🏆'}
                    </div>

                    <h3 className="font-title text-2xl text-light group-hover:text-primary transition-colors mb-1">
                      {team.name}
                    </h3>
                    
                    {team.sport && (
                      <p className="text-sm text-light/60 mb-2">{team.sport}</p>
                    )}

                    {team.clubName && (
                      <p className="text-xs text-light/40 mb-4">{team.clubName}</p>
                    )}

                    {/* Stats */}
                    <div className="flex gap-6 mt-4">
                      <div>
                        <div className="text-2xl font-bold text-primary">
                          {(team.trainers || []).length}
                        </div>
                        <div className="text-xs text-light/50 uppercase tracking-wider">
                          {t('team.trainers')}
                        </div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-accent">
                          {totalMembers}
                        </div>
                        <div className="text-xs text-light/50 uppercase tracking-wider">
                          {t('team.members')}
                        </div>
                      </div>
                    </div>

                    {/* Arrow indicator */}
                    <div className="absolute bottom-6 right-6 text-primary opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                      →
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
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
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
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
                className="flex-1 px-3 py-2 md:px-4 md:py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm md:text-base font-medium transition-all disabled:opacity-50"
                disabled={respondingToOrder}
              >
                {respondingToOrder ? 'Submitting...' : '✓ Accept & Submit'}
              </button>
              <button
                onClick={() => handleSubmitOrderResponse('declined')}
                className="px-3 py-2 md:px-4 md:py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm md:text-base font-medium transition-all disabled:opacity-50"
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
