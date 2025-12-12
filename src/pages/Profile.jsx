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
  const { user } = useAuth();
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
      alert('Display name is required');
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

    alert('Profile updated successfully!');
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
      console.error('Error creating subscription:', error);
      alert('Failed to create subscription');
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
      
      alert('✅ Subscription cancelled successfully! You now have a Free account.');
      setShowCancelModal(false);
      window.location.reload(); // Reload to update subscription context
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      alert('❌ Failed to cancel subscription: ' + error.message);
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
        alert('✅ Downgraded to Free plan!');
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
      console.error('Error changing plan:', error);
      alert('❌ Failed to change plan: ' + error.message);
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-light">{t('common.Please_login_to_view_your_profile')}</p>
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
          <h1 className="font-display text-5xl md:text-6xl text-light tracking-wider">
            👤 {t('userMenu.profile')}
          </h1>
          <p className="text-light/60 text-lg mt-2">
            {t('userMenu.profileDesc')}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10">
          {['profile', 'notifications', 'subscription'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium transition-all ${
                activeTab === tab
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-light/60 hover:text-light'
              }`}
            >
              {tab === 'profile' && '👤 Profile'}
              {tab === 'notifications' && '🔔 Notifications'}
              {tab === 'subscription' && '💳 Subscription'}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
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
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-6xl font-bold text-white shadow-lg">
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
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-light/50 cursor-not-allowed"
                  />
                  <p className="text-xs text-light/50 mt-1">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-light/80 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+421 XXX XXX XXX"
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Bio */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <h2 className="font-title text-2xl text-light mb-4 flex items-center gap-3">
                <span className="w-1 h-6 bg-primary rounded"></span>
                Bio
              </h2>

              <div>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder="Write a short bio..."
                  rows={4}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                />
              </div>
            </div>

            {/* ADD HERE - Member Card Information */}
            <MemberProfileFields
              userData={user}
              onUpdate={async (profileData) => {
                await updateUserMemberProfile(user.id, profileData);
                alert('Profile updated successfully!');
                window.location.reload();
              }}
            />

            {/* Save Button */}
            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 btn-primary py-4 text-lg font-semibold"
              >
                💾 Save Changes
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-6 py-4 bg-white/10 hover:bg-white/20 text-light rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
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
                  <h3 className="text-2xl font-bold text-light mb-2">Current Plan</h3>
                  <p className="text-3xl font-bold text-accent">{planFeatures.name}</p>
                  <p className="text-light/70 mt-1">{planFeatures.description}</p>
                  {userSubscription && isSubscriptionActive() && (
                    <p className="text-sm text-success mt-2">
                      ✓ Active until {new Date(getExpiryDate()).toLocaleDateString()}
                    </p>
                  )}
                </div>
                
                {/* Cancel Button (only if not free) */}
                {currentPlan !== 'free' && userSubscription && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-all border border-red-600/50"
                  >
                    🚫 Cancel Subscription
                  </button>
                )}
              </div>

              {/* Current Plan Features */}
              <div className="mt-4 p-4 bg-dark/30 rounded-lg">
                <p className="text-sm text-light/60 mb-2">Your current features:</p>
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
                <h3 className="text-xl font-bold text-light mb-4">Switch Plan</h3>
                <p className="text-light/60 mb-4">Choose a different plan instantly:</p>
                
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
                          <p className="text-xs mt-2 text-success">✓ Current</p>
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
                <h3 className="text-2xl font-bold text-light">All Available Plans</h3>
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
                  <h3 className="text-2xl font-bold text-light mb-4">⚠️ Cancel Subscription?</h3>
                  <p className="text-light/80 mb-4">
                    Are you sure you want to cancel your <strong className="text-accent">{planFeatures.name}</strong> subscription?
                  </p>
                  <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-4 mb-4">
                    <p className="text-red-400 text-sm">
                      <strong>You will lose:</strong>
                    </p>
                    <ul className="text-red-400/80 text-sm mt-2 space-y-1">
                      {planFeatures.features.map((feature, idx) => (
                        <li key={idx}>• {feature}</li>
                      ))}
                    </ul>
                    <p className="text-red-400 text-sm mt-3">
                      You will be downgraded to the <strong>Free</strong> plan immediately.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCancelModal(false)}
                      className="flex-1 px-4 py-3 bg-dark hover:bg-dark/80 text-light rounded-lg transition"
                      disabled={busy}
                    >
                      Keep Subscription
                    </button>
                    <button
                      onClick={handleCancelSubscription}
                      className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50"
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
                    Change from <strong className="text-primary">{planFeatures.name}</strong> to{' '}
                    <strong className="text-accent">{PLAN_FEATURES[changingToPlan].name}</strong>?
                  </p>
                  
                  {changingToPlan === 'free' ? (
                    <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-4 mb-4">
                      <p className="text-yellow-400 text-sm">
                        <strong>⚠️ Warning:</strong> Downgrading to Free will remove all premium features immediately.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-4">
                      <p className="text-primary text-sm">
                        <strong>✓ You'll get:</strong>
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
                      className="flex-1 px-4 py-3 bg-dark hover:bg-dark/80 text-light rounded-lg transition"
                      disabled={busy}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmChangePlan}
                      className="flex-1 px-4 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition disabled:opacity-50"
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
      </div>
    </div>
  );
}
