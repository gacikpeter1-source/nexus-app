// src/pages/ParentDashboard.jsx
import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { getParentChildren, deleteChildAccount, getParentPendingApprovals } from '../firebase/parentChild';
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
  const [selectedChild, setSelectedChild] = useState(null);
  
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
    } catch (error) {
      console.error('Error loading data:', error);
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
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
                    onClick={() => handleSwitchToChild(child)}
                    className="flex-1 min-w-[120px] px-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg text-sm font-medium transition-all"
                  >
                    {t('parentchild.switchAccount')}
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
    </div>
  );
}

