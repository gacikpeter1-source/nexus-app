// src/pages/Profile.jsx - Updated with Subscription Tab and Management
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { updateSubscription } from '../firebase/firestore';
import NotificationSettings from '../components/NotificationSettings';
import SubscriptionPlans from '../components/SubscriptionPlans';
import InvoiceGenerator from '../components/InvoiceGenerator';
import MemberProfileFields from '../components/MemberProfileFields';
import { updateUserMemberProfile } from '../firebase/firestore';

export default function Profile() {
  const { user, deleteAccount } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { 
    userSubscription, 
    getCurrentPlan, 
    isSubscriptionActive, 
    getExpiryDate,
    subscribe,
    PLAN_FEATURES 
  } = useSubscription();

  const [activeTab, setActiveTab] = useState('profile'); // profile, notifications, subscription
  const [form, setForm] = useState({
    displayName: '',
    avatar: '',
    phone: '',
    bio: '',
  });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [pendingSubscription, setPendingSubscription] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  
  // Subscription management modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changingToPlan, setChangingToPlan] = useState(null);
  const [busy, setBusy] = useState(false);

  // Load user data
  useEffect(() => {
    if (user) {
      setForm({
        displayName: user.displayName || user.username || '',
        avatar: user.avatar || '',
        phone: user.phone || '',
        bio: user.bio || '',
      });
      setAvatarPreview(user.avatar || null);
    }
  }, [user]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
        setForm(f => ({ ...f, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.displayName.trim()) {
      alert(t('profile.displayNameRequired'));
      return;
    }

    // Update user in localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const updatedUsers = users.map(u => {
      if (u.id === user.id) {
        return {
          ...u,
          displayName: form.displayName.trim(),
          avatar: form.avatar,
          phone: form.phone.trim(),
          bio: form.bio.trim(),
        };
      }
      return u;
    });
    localStorage.setItem('users', JSON.stringify(updatedUsers));

    // Update currentUser
    const updatedUser = {
      ...user,
      displayName: form.displayName.trim(),
      avatar: form.avatar,
      phone: form.phone.trim(),
      bio: form.bio.trim(),
    };
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));

    alert(t('profile.profileUpdated'));
    window.location.reload(); // Reload to update navbar
  };

  const handleSelectPlan = async (plan, billingCycle) => {
    setSelectedPlan(plan);
    setSelectedCycle(billingCycle);
    
    try {
      const result = await subscribe(plan, billingCycle);
      setPendingSubscription(result.subscription);
      setShowInvoice(true);
    } catch (error) {
      console.error(t('profile.errorCreatingSubscription'), error);
      alert(t('profile.failedToCreateSubscription'));
    }
  };

  const handleCancelSubscription = async () => {
    if (!userSubscription) return;
    
    setBusy(true);
    try {
      // Update subscription to cancelled and downgrade to free
      await updateSubscription(userSubscription.id, {
        status: 'cancelled',
        plan: 'free',
        cancelledAt: new Date().toISOString()
      });
      
      alert(t('profile.subscriptionCancelled'));
      setShowCancelModal(false);
      window.location.reload(); // Reload to update subscription context
    } catch (error) {
      console.error(t('profile.errorCancellingSubscription'), error);
      alert(t('profile.failedToCancelSubscription') + ' ' + error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleChangePlan = async (newPlan) => {
    setChangingToPlan(newPlan);
    setShowChangeModal(true);
  };

  const confirmChangePlan = async () => {
    if (!changingToPlan) return;
    
    setBusy(true);
    try {
      if (changingToPlan === 'free') {
        // Downgrade to free (same as cancel)
        await updateSubscription(userSubscription.id, {
          status: 'cancelled',
          plan: 'free',
          cancelledAt: new Date().toISOString()
        });
        alert(t('profile.downgradedToFree'));
      } else {
        // For upgrades/changes, create new subscription request
        const result = await subscribe(changingToPlan, 'monthly');
        setPendingSubscription(result.subscription);
        setShowInvoice(true);
      }
      
      setShowChangeModal(false);
      setChangingToPlan(null);
      
      if (changingToPlan === 'free') {
        window.location.reload();
      }
    } catch (error) {
      console.error(t('profile.errorChangingPlan'), error);
      alert(t('profile.failedToChangePlan') + ' ' + error.message);
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-light">{t('profile.loginRequired')}</p>
      </div>
    );
  }

  const currentPlan = getCurrentPlan();
  const planFeatures = PLAN_FEATURES[currentPlan];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 text-light/60 hover:text-light flex items-center gap-2 transition-colors"
          >
            ← Back
          </button>
          <h1 className="font-display text-3xl md:text-5xl lg:text-6xl text-light tracking-wider">
            👤 {t('profile.title')}
          </h1>
          <p className="text-light/60 text-lg mt-2">
            {t('profile.subtitle')}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10 overflow-x-auto">
          {['profile', 'notifications', 'subscription', ...(user && user.role === 'parent' ? ['children'] : [])].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 md:px-6 md:py-3 text-sm md:text-base font-medium transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-light/60 hover:text-light'
              }`}
            >
              {tab === 'profile' && '👤 ' + t('profile.title')}
              {tab === 'notifications' && '🔔 ' + t('profile.notificationTab')}
              {tab === 'subscription' && '💳 ' + t('profile.subscriptionTab')}
              {tab === 'children' && '👨‍👩‍👧‍👦 ' + t('parentchild.myChildren')}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <>
          <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
            {/* Avatar Section */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <h2 className="font-title text-2xl text-light mb-4 flex items-center gap-3">
                <span className="w-1 h-6 bg-primary rounded"></span>
                {t('profile.avatarSection')} 
              </h2>

              <div className="flex items-center gap-6">
                <div className="relative">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar"
                      className="w-32 h-32 rounded-full object-cover border-4 border-primary shadow-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-4xl md:text-6xl font-bold text-white shadow-lg">
                      {(form.displayName || user.username || user.email).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <label
                    htmlFor="avatar-upload"
                    className="absolute bottom-0 right-0 w-10 h-10 bg-primary hover:bg-primary/80 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-all"
                  >
                    <span className="text-2xl">📷</span>
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>

                <div className="flex-1">
                  <p className="text-light/80 text-sm mb-2">
                    {t('profile.uploadAvatar')}
                  </p>
                  <p className="text-light/50 text-xs">
                    {t('profile.acceptedFormats')}
                  </p>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarPreview(null);
                        setForm(f => ({ ...f, avatar: '' }));
                      }}
                      className="mt-3 px-3 py-1 bg-red-600/20 text-red-400 rounded text-sm hover:bg-red-600/30 transition-colors"
                    >
                      {t('profile.removePicture')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Display Name */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <h2 className="font-title text-2xl text-light mb-4 flex items-center gap-3">
                <span className="w-1 h-6 bg-primary rounded"></span>
                {t('profile.displayName')}
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-light/80 mb-2">
                  {t('profile.displayNameDesc')}
                </label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm(f => ({ ...f, displayName: e.target.value }))}
                  placeholder="Enter your display name"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 md:px-4 md:py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                />
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <h2 className="font-title text-2xl text-light mb-4 flex items-center gap-3">
                <span className="w-1 h-6 bg-primary rounded"></span>
                {t('profile.contactInfo')}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-light/80 mb-2">Email</label>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 md:px-4 md:py-3 text-light/50 cursor-not-allowed"
                  />
                  <p className="text-xs text-light/50 mt-1">{t('profile.emailCannotChange')}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-light/80 mb-2">{t('profile.phone')}</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+421 XXX XXX XXX"
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 md:px-4 md:py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Bio */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <h2 className="font-title text-2xl text-light mb-4 flex items-center gap-3">
                <span className="w-1 h-6 bg-primary rounded"></span>
                {t('profile.bio')}
              </h2>

              <div>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder={t('profile.bioPlaceholder')}
                  rows={4}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 md:px-4 md:py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                />
              </div>
            </div>

            {/* ADD HERE - Member Card Information */}
            <MemberProfileFields
              userData={user}
              onUpdate={async (profileData) => {
                await updateUserMemberProfile(user.id, profileData);
                alert(t('profile.profileUpdated'));
                window.location.reload();
              }}
            />

            {/* Save Button */}
            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 btn-primary py-2 md:py-4 text-base md:text-lg font-semibold"
              >
                💾 {t('profile.saveChanges')}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-2 md:px-6 md:py-4 bg-white/10 hover:bg-white/20 text-light rounded-lg text-sm md:text-base transition-colors"
              >
                {t('profile.cancel')}
              </button>
            </div>
          </form>
          
          {/* Danger Zone - Delete Account */}
          <div className="mt-8 bg-red-500/5 backdrop-blur-sm border-2 border-red-500/30 rounded-xl p-6 animate-fade-in">
            <h2 className="font-title text-2xl text-red-400 mb-4 flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              Danger Zone
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-light font-semibold mb-1">Delete Account</h3>
                  <p className="text-light/60 text-sm">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (window.confirm('⚠️ Are you absolutely sure you want to delete your account?\n\nThis will:\n• Delete all your data\n• Remove you from all clubs and teams\n• Cancel any active subscriptions\n\nThis action CANNOT be undone!\n\nType "DELETE" in the next prompt to confirm.')) {
                      const confirmation = window.prompt('Type DELETE to confirm account deletion:');
                      if (confirmation === 'DELETE') {
                        const result = await deleteAccount();
                        if (result.ok) {
                          alert('✅ Account deleted successfully');
                          navigate('/register');
                        } else {
                          alert('❌ ' + result.message);
                        }
                      } else {
                        alert('Account deletion cancelled');
                      }
                    }
                  }}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all whitespace-nowrap"
                >
                  🗑️ Delete Account
                </button>
              </div>
            </div>
          </div>
          </>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="animate-fade-in">
            <NotificationSettings />
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div className="space-y-6 animate-fade-in">
            {/* Current Plan */}
            <div className="bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-primary/50 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-light mb-2">{t('profile.current')}</h3>
                  <p className="text-2xl md:text-3xl font-bold text-accent">{planFeatures.name}</p>
                  <p className="text-light/70 mt-1">{planFeatures.description}</p>
                  {userSubscription && isSubscriptionActive() && (
                    <p className="text-sm text-success mt-2">
                      ✓ {t('profile.activeUntil')} {new Date(getExpiryDate()).toLocaleDateString()}
                    </p>
                  )}
                </div>
                
                {/* Cancel Button (only if not free) */}
                {currentPlan !== 'free' && userSubscription && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-all border border-red-600/50"
                  >
                    🚫 {t('profile.cancelSubscription')}
                  </button>
                )}
              </div>

              {/* Current Plan Features */}
              <div className="mt-4 p-4 bg-dark/30 rounded-lg">
                <p className="text-sm text-light/60 mb-2">{t('profile.yourCurrentFeatures')}</p>
                <ul className="grid grid-cols-2 gap-2 text-sm">
                  {planFeatures.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-light/80">
                      <span className="text-success">✓</span> {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Quick Plan Switcher */}
            {!showInvoice && (
              <div className="bg-mid-dark rounded-xl p-6 border border-white/10">
                <h3 className="text-xl font-bold text-light mb-4">{t('profile.switchPlan')}</h3>
                <p className="text-light/60 mb-4">{t('profile.chooseDifferentPlan')}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['free', 'user', 'club', 'full'].map(plan => {
                    const isCurrent = currentPlan === plan;
                    const planInfo = PLAN_FEATURES[plan];
                    
                    return (
                      <button
                        key={plan}
                        onClick={() => !isCurrent && handleChangePlan(plan)}
                        disabled={isCurrent}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isCurrent
                            ? 'bg-primary/20 border-primary text-primary cursor-default'
                            : 'bg-dark border-white/20 text-light hover:border-primary hover:bg-primary/10'
                        }`}
                      >
                        <p className="font-bold text-lg">{planInfo.name}</p>
                        <p className="text-xs opacity-70 mt-1">{planInfo.shortDesc || planInfo.description}</p>
                        {isCurrent && (
                          <p className="text-xs mt-2 text-success">✓ {t('profile.current')}</p>
                        )}
                        {!isCurrent && plan !== 'free' && (
                          <p className="text-xs mt-2 text-accent">
                            {plan === 'user' && '€9.99/mo'}
                            {plan === 'club' && '€49.99/mo'}
                            {plan === 'full' && '€99.99/mo'}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upgrade Plans or Invoice */}
            {showInvoice && pendingSubscription ? (
              <InvoiceGenerator 
                subscription={pendingSubscription}
                onInvoiceCreated={() => {
                  setShowInvoice(false);
                  setPendingSubscription(null);
                }}
              />
            ) : (
              <>
                <h3 className="text-2xl font-bold text-light">{t('profile.allAvailablePlans')}</h3>
                <SubscriptionPlans 
                  onSelectPlan={handleSelectPlan}
                  showFreePlan={true}
                />
              </>
            )}

            {/* Cancel Modal */}
            {showCancelModal && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-mid-dark rounded-xl p-6 max-w-md w-full border border-white/10">
                  <h3 className="text-2xl font-bold text-light mb-4">⚠️ {t('profile.cancelSubscriptionQuestion')}</h3>
                  <p className="text-light/80 mb-4">
                    {t('profile.areYouSureCancelSubscription').split('{planName}')[0]}
                    <strong className="text-accent">{planFeatures.name}</strong>
                    {t('profile.areYouSureCancelSubscription').split('{planName}')[1]}
                  </p>
                  <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-4 mb-4">
                    <p className="text-red-400 text-sm">
                      <strong>{t('profile.youWillLose')}</strong>
                    </p>
                    <ul className="text-red-400/80 text-sm mt-2 space-y-1">
                      {planFeatures.features.map((feature, idx) => (
                        <li key={idx}>• {feature}</li>
                      ))}
                    </ul>
                    <p className="text-red-400 text-sm mt-3" dangerouslySetInnerHTML={{ __html: t('profile.downgradedToFreeImmediately') }} />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCancelModal(false)}
                      className="flex-1 px-3 py-2 md:px-4 md:py-3 text-sm md:text-base bg-dark hover:bg-dark/80 text-light rounded-lg transition"
                      disabled={busy}
                    >
                      {t('profile.keepSubscription')}
                    </button>
                    <button
                      onClick={handleCancelSubscription}
                      className="flex-1 px-3 py-2 md:px-4 md:py-3 text-sm md:text-base bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50"
                      disabled={busy}
                    >
                      {busy ? 'Cancelling...' : 'Yes, Cancel'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Change Plan Modal */}
            {showChangeModal && changingToPlan && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-mid-dark rounded-xl p-6 max-w-md w-full border border-white/10">
                  <h3 className="text-2xl font-bold text-light mb-4">
                    {changingToPlan === 'free' ? '⬇️ Downgrade' : '⬆️ Change Plan'}
                  </h3>
                  <p className="text-light/80 mb-4">
                    {t('profile.changeFromTo')
                      .replace('{fromPlan}', `<strong className="text-primary">${planFeatures.name}</strong>`)
                      .replace('{toPlan}', `<strong className="text-accent">${PLAN_FEATURES[changingToPlan].name}</strong>`)}
                  </p>
                  
                  {changingToPlan === 'free' ? (
                    <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-4 mb-4">
                      <p className="text-yellow-400 text-sm" dangerouslySetInnerHTML={{ __html: t('profile.warningDowngrading') }} />
                    </div>
                  ) : (
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-4">
                      <p className="text-primary text-sm">
                        <strong>{t('profile.youllGet')}</strong>
                      </p>
                      <ul className="text-light/80 text-sm mt-2 space-y-1">
                        {PLAN_FEATURES[changingToPlan].features.slice(0, 3).map((feature, idx) => (
                          <li key={idx}>• {feature}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowChangeModal(false);
                        setChangingToPlan(null);
                      }}
                      className="flex-1 px-3 py-2 md:px-4 md:py-3 text-sm md:text-base bg-dark hover:bg-dark/80 text-light rounded-lg transition"
                      disabled={busy}
                    >
                      {t('profile.cancel')}
                    </button>
                    <button
                      onClick={confirmChangePlan}
                      className="flex-1 px-3 py-2 md:px-4 md:py-3 text-sm md:text-base bg-primary hover:bg-primary-dark text-white rounded-lg transition disabled:opacity-50"
                      disabled={busy}
                    >
                      {busy ? 'Processing...' : 'Confirm Change'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Children Tab (Parent Users Only) */}
        {activeTab === 'children' && user && user.role === 'parent' && (
          <div className="space-y-6 animate-fade-in">
            {/* Parent Account Header */}
            <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 backdrop-blur-sm border border-purple-500/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl">👨‍👩‍👧‍👦</span>
                <div>
                  <h2 className="font-title text-2xl text-light">
                    {t('parentchild.parentAccount')}
                  </h2>
                  <p className="text-light/60 text-sm">
                    Manage your children's accounts and monitor their activity
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* My Children Card */}
              <div 
                onClick={() => navigate('/parent-dashboard')}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    👨‍👩‍👧‍👦
                  </div>
                  <span className="text-primary text-2xl group-hover:translate-x-1 transition-transform">→</span>
                </div>
                <h3 className="text-xl font-semibold text-light mb-2">
                  {t('parentchild.myChildren')}
                </h3>
                <p className="text-light/60 text-sm">
                  View and manage all your child accounts, create new children, or link existing accounts
                </p>
              </div>

              {/* Subscription Approvals Card */}
              <div 
                onClick={() => navigate('/subscription-approvals')}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    💳
                  </div>
                  <span className="text-blue-400 text-2xl group-hover:translate-x-1 transition-transform">→</span>
                </div>
                <h3 className="text-xl font-semibold text-light mb-2">
                  {t('parentchild.subscriptionApprovals')}
                </h3>
                <p className="text-light/60 text-sm">
                  Review and approve subscription requests from your children
                </p>
              </div>
            </div>

            {/* Info Section */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-light mb-3 flex items-center gap-2">
                <span>ℹ️</span>
                Parent Account Features
              </h3>
              <ul className="space-y-2 text-sm text-light/70">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>Create and manage up to 3 child subaccounts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>Link existing accounts as children (with their approval)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>Automatically included in all child's chats for supervision</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>Approve subscription purchases for children</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>Manage child profiles, passwords, and team assignments</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>Add up to 3 parents per child for shared management</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}