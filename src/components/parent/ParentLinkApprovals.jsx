// src/components/parent/ParentLinkApprovals.jsx
import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { approveParentChildLink, declineParentChildLink } from '../../firebase/parentChild';

export default function ParentLinkApprovals() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  
  useEffect(() => {
    if (user) {
      loadRequests();
    }
  }, [user]);
  
  const loadRequests = async () => {
    try {
      setLoading(true);
      
      // Find pending additional parent link requests where this user is the new parent
      const q = query(
        collection(db, 'parentChildRelationships'),
        where('parentId', '==', user.id),
        where('relationshipType', '==', 'additional_parent'),
        where('status', '==', 'pending')
      );
      
      const snapshot = await getDocs(q);
      const requestsData = [];
      
      for (const docSnap of snapshot.docs) {
        const request = { id: docSnap.id, ...docSnap.data() };
        
        // Fetch child data
        const childDoc = await getDoc(doc(db, 'users', request.childId));
        if (childDoc.exists()) {
          request.child = { id: childDoc.id, ...childDoc.data() };
        }
        
        // Fetch requesting parent data
        const requestingParentDoc = await getDoc(doc(db, 'users', request.requestedByParentId));
        if (requestingParentDoc.exists()) {
          request.requestingParent = { id: requestingParentDoc.id, ...requestingParentDoc.data() };
        }
        
        requestsData.push(request);
      }
      
      setRequests(requestsData);
    } catch (error) {
      console.error('Error loading requests:', error);
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleApprove = async (request) => {
    if (!window.confirm(`Approve being added as parent to ${request.child?.username || 'this child'}?`)) {
      return;
    }
    
    setProcessing(request.id);
    try {
      await approveParentChildLink(request.id, user.id);
      showToast(t('parentchild.linkRequestApproved'), 'success');
      await loadRequests();
    } catch (error) {
      console.error('Error approving link:', error);
      showToast(t('parentchild.errorApproving'), 'error');
    } finally {
      setProcessing(null);
    }
  };
  
  const handleDecline = async (request) => {
    if (!window.confirm(`Decline being added as parent to ${request.child?.username || 'this child'}?`)) {
      return;
    }
    
    setProcessing(request.id);
    try {
      await declineParentChildLink(request.id);
      showToast(t('parentchild.linkRequestDeclined'), 'success');
      await loadRequests();
    } catch (error) {
      console.error('Error declining link:', error);
      showToast(t('parentchild.errorDeclining'), 'error');
    } finally {
      setProcessing(null);
    }
  };
  
  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-light/60 text-sm">{t('common.loading')}</p>
        </div>
      </div>
    );
  }
  
  if (requests.length === 0) {
    return null; // Don't show anything if no requests
  }
  
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
      <h3 className="text-xl font-semibold text-light mb-4 flex items-center gap-2">
        <span>🔗</span>
        Pending Parent Link Requests
      </h3>
      
      <div className="space-y-3">
        {requests.map(request => (
          <div key={request.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    {request.child?.username?.[0] || '?'}
                  </div>
                  <div>
                    <h4 className="font-semibold text-light">{request.child?.username || 'Child'}</h4>
                    <p className="text-xs text-light/60">{request.child?.email}</p>
                  </div>
                </div>
                
                <div className="text-sm text-light/70 space-y-1">
                  <p>
                    <span className="text-light/50">Requested by:</span>{' '}
                    <span className="text-light">{request.requestingParent?.username || 'Another parent'}</span>
                  </p>
                  <p className="text-xs text-light/50">
                    {request.createdAt?.toDate ? 
                      new Date(request.createdAt.toDate()).toLocaleDateString() : 
                      'Recently'
                    }
                  </p>
                  {request.sharedTeams && request.sharedTeams.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-green-300 mt-2">
                      <span>✅</span>
                      <span>You share {request.sharedTeams.length} team(s)</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleApprove(request)}
                  disabled={processing === request.id}
                  className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                >
                  {processing === request.id ? '...' : t('common.approve')}
                </button>
                <button
                  onClick={() => handleDecline(request)}
                  disabled={processing === request.id}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                >
                  {t('common.decline')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


