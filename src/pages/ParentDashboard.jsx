// src/pages/ParentDashboard.jsx
import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { getParentChildren, deleteChildAccount, getParentPendingApprovals, assignChildToTeam } from '../firebase/parentChild';
import { getUser, getClub } from '../firebase/firestore';
import ChildAccountCreationModal from '../components/parent/ChildAccountCreationModal';
import LinkExistingAccountModal from '../components/parent/LinkExistingAccountModal';
import EditChildModal from '../components/parent/EditChildModal';
import AddParentToChildModal from '../components/parent/AddParentToChildModal';
import ParentLinkApprovals from '../components/parent/ParentLinkApprovals';

export default function ParentDashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [children, setChildren] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddParentModal, setShowAddParentModal] = useState(false);
  const [showAssignTeamModal, setShowAssignTeamModal] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);
  const [parentTeams, setParentTeams] = useState([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [assigning, setAssigning] = useState(false);
  
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);
  
  const loadData = async () => {
    try {
      setLoading(true);
      const [childrenData, approvalsData] = await Promise.all([
        getParentChildren(user.id),
        getParentPendingApprovals(user.id)
      ]);
      setChildren(childrenData);
      setPendingApprovals(approvalsData);
      
      // Load parent's teams
      await loadParentTeams();
    } catch (error) {
      console.error('Error loading data:', error);
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const loadParentTeams = async () => {
    try {
      const userData = await getUser(user.id);
      const allTeams = [];
      const clubIds = userData.clubIds || [];
      
      // Fetch teams from all clubs where parent is a member
      for (const clubId of clubIds) {
        try {
          const club = await getClub(clubId);
          if (club && club.teams) {
            // Get teams where user is a member, trainer, or assistant
            const userTeams = club.teams.filter(team => {
              const isMember = (team.members || []).includes(user.id);
              const isTrainer = (team.trainers || []).includes(user.id);
              const isAssistant = (team.assistants || []).includes(user.id);
              return isMember || isTrainer || isAssistant;
            });
            
            // Add club info to each team for display
            userTeams.forEach(team => {
              allTeams.push({
                ...team,
                clubId: clubId,
                clubName: club.name,
                displayName: `${team.name} (${club.name})`
              });
            });
          }
        } catch (clubError) {
          console.error(`Error loading club ${clubId}:`, clubError);
        }
      }
      
      setParentTeams(allTeams);
    } catch (error) {
      console.error('Error loading parent teams:', error);
    }
  };
  
  const handleDeleteChild = async (child) => {
    const messageKey = child.accountType === 'subaccount' 
      ? 'parentchild.subaccountWarning'
      : 'parentchild.linkedWarning';
    
    const confirmMsg = `${t('parentchild.deleteWarning').replace('{name}', child.username)}\n\n${t(messageKey)}\n\n${t('parentchild.cannotUndo')}`;
    
    if (!window.confirm(confirmMsg)) return;
    
    try {
      await deleteChildAccount(user.id, child.id);
      showToast(
        child.accountType === 'subaccount' 
          ? t('parentchild.childDeleted')
          : t('parentchild.relationshipRemoved'),
        'success'
      );
      await loadData();
    } catch (error) {
      console.error('Error deleting child:', error);
      showToast(t('parentchild.errorDeleting'), 'error');
    }
  };
  
  const handleSwitchToChild = (child) => {
    // TODO: Implement child account switching
    // This would require authentication flow changes
    console.log('Switch to child:', child);
    showToast(t('parentchild.switchToChild').replace('{name}', child.firstName), 'info');
  };
  
  const handleEditChild = (child) => {
    setSelectedChild(child);
    setShowEditModal(true);
  };
  
  const handleAddParent = (child) => {
    setSelectedChild(child);
    setShowAddParentModal(true);
  };
  
  const handleAssignToTeam = (child) => {
    setSelectedChild(child);
    setTeamSearch('');
    setShowAssignTeamModal(true);
  };
  
  const handleConfirmAssignment = async (team) => {
    if (!selectedChild || !team) return;
    
    try {
      setAssigning(true);
      const result = await assignChildToTeam(
        selectedChild.id,
        team.clubId,
        team.id,
        user.id
      );
      
      if (result.success) {
        if (result.autoApproved) {
          showToast(`${selectedChild.username} added to ${team.name}!`, 'success');
        } else if (result.alreadyMember) {
          showToast(result.message, 'info');
        } else {
          showToast(`Join request sent for ${team.name}`, 'info');
        }
        
        // Reload children data
        await loadData();
        setShowAssignTeamModal(false);
        setSelectedChild(null);
      }
    } catch (error) {
      console.error('Error assigning child to team:', error);
      showToast(t('parentchild.errorAssigning') || 'Failed to assign child to team', 'error');
    } finally {
      setAssigning(false);
    }
  };
  
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-bg via-mid-dark to-dark-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-light/60">{t('common.loading')}</p>
        </div>
      </div>
    );
  }
  
  if (user.role !== 'parent') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-bg via-mid-dark to-dark-bg flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">👨‍👩‍👧‍👦</div>
          <h1 className="text-2xl font-bold text-light mb-2">{t('parentchild.notParent')}</h1>
          <p className="text-light/60 mb-4">
            {t('parentchild.onlyTrainers')}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg transition-all"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-mid-dark to-dark-bg p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-light flex items-center gap-3">
              <span>👨‍👩‍👧‍👦</span>
              {t('parentchild.parentDashboard')}
            </h1>
          </div>
          <p className="text-light/60">{t('parentchild.manageChildren')}</p>
        </div>
        
        {/* Pending Approvals Alert */}
        {pendingApprovals.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/40 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏰</span>
              <div>
                <h3 className="font-semibold text-light">{t('parentchild.pendingApprovals')}</h3>
                <p className="text-sm text-light/70">
                  {pendingApprovals.length} {t('parentchild.subscriptionApprovals').toLowerCase()}
                </p>
              </div>
              <button
                onClick={() => navigate('/subscription-approvals')}
                className="ml-auto px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-all"
              >
                {t('common.view')}
              </button>
            </div>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="mb-6 flex flex-wrap gap-4">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-semibold transition-all shadow-lg"
          >
            <span>➕</span>
            {t('parentchild.createChildButton')}
          </button>
          
          <button 
            onClick={() => setShowLinkModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-light border border-white/20 rounded-lg font-semibold transition-all"
          >
            <span>🔗</span>
            {t('parentchild.linkAccountButton')}
          </button>
        </div>
        
        {/* Parent Link Approvals */}
        <div className="mb-6">
          <ParentLinkApprovals />
        </div>
        
        {/* Info Cards */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
            <div className="text-sm text-light/60 mb-1">{t('parentchild.subaccount')}</div>
            <div className="text-xs text-light/50">{t('parentchild.subaccountInfo')}</div>
          </div>
          
          <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
            <div className="text-sm text-light/60 mb-1">{t('parentchild.linkedAccount')}</div>
            <div className="text-xs text-light/50">{t('parentchild.linkedInfo')}</div>
          </div>
          
          <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
            <div className="text-sm text-light/60 mb-1">{t('parentchild.subscriptionApprovals')}</div>
            <div className="text-xs text-light/50">{t('parentchild.approvalInfo')}</div>
          </div>
        </div>
        
        {/* Children List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-light/60">{t('common.loading')}</p>
          </div>
        ) : children.length === 0 ? (
          <div className="text-center py-12 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
            <div className="text-6xl mb-4">👶</div>
            <h3 className="text-xl font-semibold text-light mb-2">{t('parentchild.noChildren')}</h3>
            <p className="text-light/60 mb-6">{t('parentchild.createFirstChild')}</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-semibold transition-all"
            >
              {t('parentchild.createChildButton')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map(child => (
              <div key={child.id} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-xl">
                      {child.profilePicture ? (
                        <img src={child.profilePicture} alt={child.username} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span>{child.firstName?.[0] || '?'}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-light">{child.username}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        child.accountType === 'subaccount' 
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-purple-500/20 text-purple-300'
                      }`}>
                        {child.accountType === 'subaccount' 
                          ? t('parentchild.subaccount')
                          : t('parentchild.linkedAccount')
                        }
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm text-light/60 mb-4">
                  <div className="flex items-center gap-2">
                    <span>📧</span>
                    <span className="truncate">{child.email}</span>
                  </div>
                  {child.teamIds && child.teamIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span>👥</span>
                      <span>{child.teamIds.length} {t('nav.teams').toLowerCase()}</span>
                    </div>
                  )}
                  {child.parentIds && (
                    <div className="flex items-center gap-2">
                      <span>👨‍👩‍👧</span>
                      <span>{child.parentIds.length}/3 {t('parentchild.parents')}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleAssignToTeam(child)}
                    className="flex-1 min-w-[120px] px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1"
                    title="Assign child to team"
                  >
                    <span>👥</span>
                    <span className="hidden sm:inline">Assign to Team</span>
                    <span className="inline sm:hidden">+Team</span>
                  </button>
                  <button
                    onClick={() => handleEditChild(child)}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg text-sm font-medium transition-all"
                  >
                    {t('common.edit')}
                  </button>
                  {(!child.parentIds || child.parentIds.length < 3) && (
                    <button
                      onClick={() => handleAddParent(child)}
                      className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg text-sm font-medium transition-all flex items-center gap-1"
                      title={t('parentchild.addParentTooltip')}
                    >
                      <span>👨‍👩‍👧</span>
                      <span className="hidden sm:inline">{t('parentchild.addParent')}</span>
                      <span className="inline sm:hidden">+</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteChild(child)}
                    className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium transition-all"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Modals */}
      {showCreateModal && (
        <ChildAccountCreationModal 
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadData();
          }}
        />
      )}
      
      {showLinkModal && (
        <LinkExistingAccountModal
          onClose={() => setShowLinkModal(false)}
          onSuccess={() => {
            setShowLinkModal(false);
            loadData();
          }}
        />
      )}
      
      {showEditModal && selectedChild && (
        <EditChildModal
          child={selectedChild}
          onClose={() => {
            setShowEditModal(false);
            setSelectedChild(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedChild(null);
            loadData();
          }}
        />
      )}
      
      {showAddParentModal && selectedChild && (
        <AddParentToChildModal
          child={selectedChild}
          onClose={() => {
            setShowAddParentModal(false);
            setSelectedChild(null);
          }}
          onSuccess={() => {
            setShowAddParentModal(false);
            setSelectedChild(null);
            loadData();
          }}
        />
      )}
      
      {/* Assign to Team Modal */}
      {showAssignTeamModal && selectedChild && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-mid-dark border border-white/20 rounded-xl max-w-md w-full shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-light">Assign to Team</h3>
                  <p className="text-sm text-light/60 mt-1">
                    Add {selectedChild.username} to a team
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAssignTeamModal(false);
                    setSelectedChild(null);
                    setTeamSearch('');
                  }}
                  className="text-light/60 hover:text-light transition text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* Search */}
            <div className="p-6 border-b border-white/10">
              <input
                type="text"
                placeholder="Search teams..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            
            {/* Teams List */}
            <div className="p-6 max-h-[400px] overflow-y-auto">
              {parentTeams.filter(team => 
                team.displayName.toLowerCase().includes(teamSearch.toLowerCase())
              ).length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">🔍</div>
                  <p className="text-light/60">
                    {teamSearch ? 'No teams found' : 'You are not a member of any teams'}
                  </p>
                  {!teamSearch && (
                    <p className="text-sm text-light/40 mt-2">
                      You must be a member of a team to add your child to it
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {parentTeams
                    .filter(team => 
                      team.displayName.toLowerCase().includes(teamSearch.toLowerCase())
                    )
                    .map(team => {
                      const isChildMember = (team.members || []).includes(selectedChild.id);
                      
                      return (
                        <button
                          key={`${team.clubId}-${team.id}`}
                          onClick={() => !isChildMember && handleConfirmAssignment(team)}
                          disabled={isChildMember || assigning}
                          className={`w-full p-4 rounded-lg text-left transition-all ${
                            isChildMember
                              ? 'bg-white/5 border border-white/10 opacity-50 cursor-not-allowed'
                              : 'bg-white/10 border border-white/20 hover:bg-white/20 hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="font-semibold text-light">{team.name}</div>
                              <div className="text-sm text-light/60">{team.clubName}</div>
                              {isChildMember && (
                                <div className="mt-1 text-xs text-green-400">
                                  ✓ Already a member
                                </div>
                              )}
                            </div>
                            {!isChildMember && (
                              <div className="text-2xl">→</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-white/10">
              <button
                onClick={() => {
                  setShowAssignTeamModal(false);
                  setSelectedChild(null);
                  setTeamSearch('');
                }}
                className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

