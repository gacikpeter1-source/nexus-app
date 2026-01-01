// src/pages/SubscriptionApprovals.jsx
import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { getParentPendingApprovals, processSubscriptionApproval } from '../firebase/parentChild';
import { getUser } from '../firebase/firestore';

export default function SubscriptionApprovals() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [approvals, setApprovals] = useState([]);
  const [children, setChildren] = useState({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  
  useEffect(() => {
    if (user) {
      loadApprovals();
    }
  }, [user]);
  
  const loadApprovals = async () => {
    try {
      setLoading(true);
      const approvalsData = await getParentPendingApprovals(user.id);
      setApprovals(approvalsData);
      
      // Load child data for each approval
      const childrenData = {};
      for (const approval of approvalsData) {
        if (!childrenData[approval.childId]) {
          const childUser = await getUser(approval.childId);
          if (childUser) {
            childrenData[approval.childId] = childUser;
          }
        }
      }
      setChildren(childrenData);
    } catch (error) {
      console.error('Error loading approvals:', error);
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleApprove = async (approval) => {
    const confirmMsg = t('parentchild.approveSubscription');
    if (!window.confirm(confirmMsg)) return;
    
    setProcessing(approval.id);
    try {
      await processSubscriptionApproval(approval.id, user.id, true);
      showToast(t('parentchild.subscriptionApproved'), 'success');
      await loadApprovals();
    } catch (error) {
      console.error('Error approving subscription:', error);
      showToast(t('parentchild.errorProcessing'), 'error');
    } finally {
      setProcessing(null);
    }
  };
  
  const handleDecline = async (approval) => {
    const confirmMsg = t('parentchild.declineSubscription');
    if (!window.confirm(confirmMsg)) return;
    
    setProcessing(approval.id);
    try {
      await processSubscriptionApproval(approval.id, user.id, false);
      showToast(t('parentchild.subscriptionDeclined'), 'success');
      await loadApprovals();
    } catch (error) {
      console.error('Error declining subscription:', error);
      showToast(t('parentchild.errorProcessing'), 'error');
    } finally {
      setProcessing(null);
    }
  };
  
  const getDaysRemaining = (expiresAt) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
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
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-light mb-2">{t('requests.accessDenied')}</h1>
          <p className="text-light/60 mb-4">{t('parentchild.notParent')}</p>
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
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-light flex items-center gap-3">
              <span>📋</span>
              {t('parentchild.subscriptionApprovals')}
            </h1>
            <button
              onClick={() => navigate('/parent-dashboard')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-light rounded-lg transition-all"
            >
              {t('common.back')}
            </button>
          </div>
          <p className="text-light/60">
            {t('parentchild.expiresIn7Days')}
          </p>
        </div>
        
        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500/40 rounded-lg">
          <p className="text-sm text-blue-200">
            ℹ️ {t('parentchild.oneParentSufficient')}
          </p>
        </div>
        
        {/* Approvals List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-light/60">{t('common.loading')}</p>
          </div>
        ) : approvals.length === 0 ? (
          <div className="text-center py-12 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-xl font-semibold text-light mb-2">
              {t('requests.allCaughtUp')}
            </h3>
            <p className="text-light/60 mb-6">
              {t('parentchild.noPendingApprovals')}
            </p>
            <button
              onClick={() => navigate('/parent-dashboard')}
              className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-semibold transition-all"
            >
              {t('common.back')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map(approval => {
              const child = children[approval.childId];
              const daysRemaining = getDaysRemaining(approval.expiresAt);
              const isExpiringSoon = daysRemaining <= 2;
              
              return (
                <div
                  key={approval.id}
                  className={`bg-white/5 backdrop-blur-sm border rounded-xl p-6 ${
                    isExpiringSoon ? 'border-red-500/40' : 'border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-xl">
                        {child?.profilePicture ? (
                          <img
                            src={child.profilePicture}
                            alt={child.username}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span>{child?.firstName?.[0] || '?'}</span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-light">
                          {t('parentchild.childWantsToBuy').replace('{name}', child?.username || 'Child')}
                        </h3>
                        <p className="text-sm text-light/60">{child?.email}</p>
                      </div>
                    </div>
                    
                    <div className={`px-3 py-1 rounded-full text-sm ${
                      isExpiringSoon
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {daysRemaining > 0
                        ? t('parentchild.expiresInDays').replace('{days}', daysRemaining)
                        : t('parentchild.approvalExpired')
                      }
                    </div>
                  </div>
                  
                  {/* Subscription Details */}
                  <div className="mb-4 p-4 bg-white/5 border border-white/10 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-light/60">{t('parentchild.planLabel').split(':')[0]}:</span>
                        <span className="ml-2 text-light font-semibold">
                          {approval.subscriptionDetails.planName}
                        </span>
                      </div>
                      <div>
                        <span className="text-light/60">{t('parentchild.priceLabel').split(':')[0]}:</span>
                        <span className="ml-2 text-light font-semibold">
                          {approval.subscriptionDetails.price} {approval.subscriptionDetails.currency}
                          {approval.subscriptionDetails.billingCycle && (
                            <span className="text-light/60 ml-1">
                              / {approval.subscriptionDetails.billingCycle}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(approval)}
                      disabled={processing === approval.id || daysRemaining <= 0}
                      className="flex-1 px-6 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/40 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {processing === approval.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-green-300"></div>
                          {t('common.loading')}
                        </>
                      ) : (
                        <>
                          <span>✅</span>
                          {t('requests.approve')}
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleDecline(approval)}
                      disabled={processing === approval.id || daysRemaining <= 0}
                      className="flex-1 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {processing === approval.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-300"></div>
                          {t('common.loading')}
                        </>
                      ) : (
                        <>
                          <span>❌</span>
                          {t('clubsdashboard.decline')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


