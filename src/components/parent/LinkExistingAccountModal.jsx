// src/components/parent/LinkExistingAccountModal.jsx
import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { requestParentChildLink } from '../../firebase/parentChild';

export default function LinkExistingAccountModal({ onClose, onSuccess }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [childEmail, setChildEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const validate = () => {
    if (!childEmail.trim()) {
      setError(t('common.required'));
      return false;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(childEmail)) {
      setError('Invalid email format');
      return false;
    }
    
    // Check if trying to link own email
    if (childEmail.toLowerCase() === user.email.toLowerCase()) {
      setError('Cannot link to your own email');
      return false;
    }
    
    setError('');
    return true;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    setLoading(true);
    try {
      await requestParentChildLink(user.id, childEmail);
      showToast(t('parentchild.linkRequestSent'), 'success');
      onSuccess();
    } catch (error) {
      console.error('Error sending link request:', error);
      
      if (error.message === 'ACCOUNT_NOT_FOUND') {
        setError(t('parentchild.childNotFound'));
      } else if (error.message === 'ALREADY_LINKED') {
        setError(t('parentchild.alreadyLinked'));
      } else if (error.message === 'MAX_PARENTS_REACHED') {
        setError(t('parentchild.maxParents'));
      } else {
        setError(t('parentchild.errorSendingRequest'));
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-mid-dark border border-white/20 rounded-xl shadow-2xl max-w-lg w-full">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-light flex items-center gap-2">
              <span>🔗</span>
              {t('parentchild.linkAccountTitle')}
            </h2>
            <button
              onClick={onClose}
              className="text-light/60 hover:text-light text-2xl"
            >
              ×
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Info Banner */}
          <div className="p-4 bg-blue-500/20 border border-blue-500/40 rounded-lg space-y-2">
            <p className="text-sm text-blue-200">
              ℹ️ {t('parentchild.linkedInfo')}
            </p>
            <p className="text-sm text-blue-200">
              ✉️ {t('parentchild.bothMustApprove')}
            </p>
          </div>
          
          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-light mb-2">
              {t('parentchild.childEmail')} *
            </label>
            <input
              type="email"
              value={childEmail}
              onChange={(e) => {
                setChildEmail(e.target.value);
                setError('');
              }}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-light focus:outline-none focus:border-primary"
              placeholder={t('parentchild.enterChildEmail')}
              disabled={loading}
            />
            {error && (
              <p className="text-red-400 text-sm mt-2">{error}</p>
            )}
          </div>
          
          {/* How It Works */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
            <h4 className="font-semibold text-light mb-2">How it works:</h4>
            <ol className="space-y-2 text-sm text-light/70 list-decimal list-inside">
              <li>Enter the child's email address</li>
              <li>Both you and the child will receive verification emails</li>
              <li>Both parties must approve the link request</li>
              <li>Once approved, you can view their activity</li>
              <li>The child's account remains independent</li>
            </ol>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  {t('common.loading')}
                </>
              ) : (
                <>
                  <span>📧</span>
                  {t('parentchild.sendLinkRequest')}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg font-semibold transition-all"
            >
              {t('common.cancel')}
            </button>
          </div>
          
          {/* Additional Info */}
          <div className="text-xs text-light/50 space-y-1">
            <p>• Maximum 3 parents can be linked to one child</p>
            <p>• Child can decline the link request</p>
            <p>• Either party can remove the link at any time</p>
          </div>
        </form>
      </div>
    </div>
  );
}


