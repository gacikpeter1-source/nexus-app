// src/components/CreateClubWithSubscription.jsx - WITH VOUCHER SUPPORT
import React, { useState } from 'react';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import SubscriptionPlans from './SubscriptionPlans';
import { validateVoucher, redeemVoucher } from '../firebase/firestore';

export default function CreateClubWithSubscription({ onClose }) {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const { subscribe } = useSubscription();
  
  const [step, setStep] = useState(1);
  const [clubName, setClubName] = useState('');
  const [clubType, setClubType] = useState('');
  const [customClubType, setCustomClubType] = useState('');
  const [initialTeamName, setInitialTeamName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [customerID, setCustomerID] = useState('');
  const [createdClub, setCreatedClub] = useState(null);
  
  // Payment method selection
  const [paymentMethod, setPaymentMethod] = useState(''); // 'voucher' or 'subscription'
  const [voucherCode, setVoucherCode] = useState('');
  const [validatingVoucher, setValidatingVoucher] = useState(false);
  const [validatedVoucher, setValidatedVoucher] = useState(null);
  
  // Subscription state
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedCycle, setSelectedCycle] = useState(null);

  const CLUB_TYPES = [
    'Football',
    'Basketball',
    'Volleyball',
    'Ice Hockey',
    'Swimming',
    'Scouting',
    'Dancing',
    'Music Academy',
    'Music Band',
    'Custom'
  ];

  const ownedClubs = React.useMemo(() => {
    if (!user) return [];
    return user.ownedClubIds || [];
  }, [user]);

  const generateCustomerID = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const extra = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${timestamp}${random}${extra}`.substring(0, 15).padEnd(15, '0');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!clubName.trim() || clubName.trim().length < 2) {
      showToast('Club name must be at least 2 characters', 'error');
      return;
    }
    setStep(2);
  };

  const handleAcceptTerms = () => {
    if (!termsAccepted) {
      showToast('Please accept the terms and conditions', 'error');
      return;
    }
    setStep(3); // Go to payment method selection
  };

  const handleValidateVoucher = async () => {
    if (!voucherCode.trim()) {
      showToast('Please enter a voucher code', 'error');
      return;
    }

    try {
      setValidatingVoucher(true);
      const voucher = await validateVoucher(voucherCode.trim().toUpperCase());
      
      if (voucher.valid) {
        setValidatedVoucher(voucher);
        showToast('Voucher validated successfully!', 'success');
      } else {
        showToast(voucher.reason || 'Invalid voucher code', 'error');
        setValidatedVoucher(null);
      }
    } catch (error) {
      console.error('Error validating voucher:', error);
      showToast('Failed to validate voucher', 'error');
      setValidatedVoucher(null);
    } finally {
      setValidatingVoucher(false);
    }
  };

  const handleCreateClubWithVoucher = async () => {
    if (!validatedVoucher) {
      showToast('Please validate your voucher first', 'error');
      return;
    }

    setBusy(true);
    
    try {
      const newCustomerID = generateCustomerID();
      setCustomerID(newCustomerID);

      const clubCode = String(Math.floor(100000 + Math.random() * 900000));
      
      // Create club
      const clubData = {
        name: clubName.trim(),
        clubType: clubType === 'Custom' ? customClubType.trim() : clubType,
        customerID: newCustomerID,
        subscriptionActive: true,
        subscriptionType: 'voucher',
        voucherCode: validatedVoucher.code,
        subscriptionDate: new Date().toISOString(),
        subscriptionExpiryDate: validatedVoucher.expirationDate,
        superTrainer: user.id,
        clubCode: clubCode,
        clubNumber: clubCode,
        createdBy: user.id,
        trainers: [user.id],
        assistants: [],
        members: [],
        teams: []
      };

      if (initialTeamName.trim()) {
        const team = {
          id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: initialTeamName.trim(),
          trainers: [user.id],
          assistants: [],
          members: [user.id]
        };
        clubData.teams.push(team);
        clubData.members.push(user.id);
      }

      const { createClub: createClubInFirestore } = await import('../firebase/firestore');
      const newClub = await createClubInFirestore(clubData);
      
      // Redeem voucher
      await redeemVoucher(validatedVoucher.id, user.id, newClub.id);
      
      // Create subscription from voucher
      await subscribe(validatedVoucher.plan, 'custom', newClub.id, validatedVoucher);
      
      // Update user
      const { updateUser } = await import('../firebase/firestore');
      const newRole = (user.role === ROLES.TRAINER || user.role === ROLES.ADMIN) 
        ? user.role 
        : ROLES.TRAINER;
      
      await updateUser(user.id, {
        role: newRole,
        clubIds: [...(user.clubIds || []), newClub.id],
        ownedClubIds: [...(user.ownedClubIds || []), newClub.id],
        isSuperTrainer: true
      });

      if (refreshUser) {
        await refreshUser();
      }

      setCreatedClub({
        ...newClub,
        clubCode: clubCode,
        voucherUsed: true,
        expiryDate: validatedVoucher.expirationDate
      });
      setStep(5); // Success screen
      
      showToast('Club created successfully with voucher!', 'success');

    } catch (error) {
      console.error('Error creating club:', error);
      showToast(error.message || 'Failed to create club', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSelectPlan = async (plan, billingCycle) => {
    setSelectedPlan(plan);
    setSelectedCycle(billingCycle);
    setStep(4); // Go to confirmation/invoice step
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      window.location.reload();
    }
  };

  if (!user) {
    return (
      <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
        <p className="text-light">Please log in to create a club.</p>
      </div>
    );
  }

  const hasExistingClubs = ownedClubs.length > 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Step 1: Club Details */}
      {step === 1 && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-fade-in">
          <h2 className="font-title text-3xl text-light mb-6 flex items-center gap-3">
            <span className="w-1 h-8 bg-primary rounded"></span>
            Create Your Club
          </h2>

          {hasExistingClubs && (
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-accent mb-2 flex items-center gap-2">
                <span>ℹ️</span>
                Additional Subscription Required
              </h3>
              <p className="text-light/80 text-sm mb-3">
                You currently own <strong>{ownedClubs.length}</strong> club{ownedClubs.length > 1 ? 's' : ''}. 
                Creating a new club will require a <strong>separate subscription or voucher</strong>.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-light/80 font-medium mb-2">
                Club Name *
              </label>
              <input
                type="text"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="e.g., Elite Football Academy"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-light/80 font-medium mb-2">
                Initial Team Name (Optional)
              </label>
              <input
                type="text"
                value={initialTeamName}
                onChange={(e) => setInitialTeamName(e.target.value)}
                placeholder="e.g., U-12 Boys Team"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-light/80 font-medium mb-2">
                Club Type *
              </label>
              <select
                value={clubType}
                onChange={(e) => {
                  setClubType(e.target.value);
                  if (e.target.value !== 'Custom') {
                    setCustomClubType('');
                  }
                }}
                className="w-full bg-dark border border-white/20 rounded-lg px-4 py-3 text-light focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                style={{ colorScheme: 'dark' }}
                required
              >
                <option value="" className="bg-dark text-light">Select club type...</option>
                {CLUB_TYPES.map(type => (
                  <option key={type} value={type} className="bg-dark text-light">{type}</option>
                ))}
              </select>
            </div>

            {clubType === 'Custom' && (
              <div>
                <label className="block text-light/80 font-medium mb-2">
                  Custom Club Type *
                </label>
                <input
                  type="text"
                  value={customClubType}
                  onChange={(e) => setCustomClubType(e.target.value)}
                  placeholder="e.g., Rock Climbing, Martial Arts..."
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                />
              </div>
            )}

            {/* Voucher Code Field (Optional) */}
            <div>
              <label className="block text-light/80 font-medium mb-2">
                Voucher Code <span className="text-light/50 text-sm">(Optional)</span>
              </label>
              <input
                type="text"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                placeholder="e.g., TRIA-A7F9-251231-30D"
                className="w-full bg-dark border border-white/20 rounded-lg px-4 py-3 text-light placeholder-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono"
              />
              <p className="text-xs text-light/50 mt-1">
                💡 Have a voucher code? Enter it here to activate your subscription instantly!
              </p>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all disabled:opacity-50"
            >
              Continue to Terms & Conditions
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Terms */}
      {step === 2 && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-fade-in">
          <h2 className="font-title text-3xl text-light mb-6">Terms & Conditions</h2>

          <div className="bg-white/5 border border-white/10 rounded-lg p-6 max-h-96 overflow-y-auto mb-6">
            <div className="text-light/80 space-y-4 text-sm">
              <h3 className="font-bold text-light text-lg">NEXUS Club Subscription Agreement</h3>
              <p><strong>1. Subscription Terms</strong></p>
              <p>By creating a club, you agree to maintain an active subscription or use a valid voucher for club management services.</p>
              <p><strong>2. SuperTrainer Role</strong></p>
              <p>As the club creator, you will become the SuperTrainer with full access to all teams.</p>
              <p><strong>3. Voucher Usage</strong></p>
              <p>If using a voucher code, the subscription will expire based on the voucher's expiration date.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 mb-6">
            <input
              type="checkbox"
              id="terms"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 w-5 h-5"
            />
            <label htmlFor="terms" className="text-light/80 text-sm">
              I accept the Terms & Conditions
            </label>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg"
            >
              Back
            </button>
            <button
              onClick={handleAcceptTerms}
              disabled={!termsAccepted}
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg disabled:opacity-50"
            >
              Accept & Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Payment Method Selection */}
      {step === 3 && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h2 className="font-title text-3xl text-light mb-6">Choose Payment Method</h2>

            {/* Voucher Option */}
            <div className={`border-2 rounded-xl p-6 mb-4 cursor-pointer transition-all ${
              paymentMethod === 'voucher'
                ? 'border-accent bg-accent/10'
                : 'border-white/20 hover:border-white/40'
            }`}
            onClick={() => setPaymentMethod('voucher')}>
              <div className="flex items-start gap-4">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'voucher'}
                  onChange={() => setPaymentMethod('voucher')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-light mb-2">🎫 Use Voucher Code</h3>
                  <p className="text-light/70 mb-4">
                    Have a voucher code? Activate full features instantly!
                  </p>

                  {paymentMethod === 'voucher' && (
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={voucherCode}
                          onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                          placeholder="Enter voucher code (e.g., TRIAL-A7F9-251231-30D)"
                          className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-light font-mono"
                        />
                        <button
                          onClick={handleValidateVoucher}
                          disabled={validatingVoucher}
                          className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium disabled:opacity-50"
                        >
                          {validatingVoucher ? 'Validating...' : 'Validate'}
                        </button>
                      </div>

                      {validatedVoucher && (
                        <div className="bg-success/20 border border-success/30 rounded-lg p-4">
                          <h4 className="font-semibold text-success mb-2">✓ Valid Voucher</h4>
                          <div className="space-y-1 text-sm text-light/80">
                            <p><strong>Plan:</strong> {validatedVoucher.planName}</p>
                            <p><strong>Duration:</strong> {validatedVoucher.duration} days</p>
                            <p><strong>Expires:</strong> {new Date(validatedVoucher.expirationDate).toLocaleDateString()}</p>
                          </div>
                          <button
                            onClick={handleCreateClubWithVoucher}
                            disabled={busy}
                            className="mt-4 w-full px-6 py-3 bg-success hover:bg-success/80 text-white rounded-lg font-semibold disabled:opacity-50"
                          >
                            {busy ? 'Creating Club...' : '✓ Create Club with Voucher'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Subscription Option */}
            <div className={`border-2 rounded-xl p-6 cursor-pointer transition-all ${
              paymentMethod === 'subscription'
                ? 'border-primary bg-primary/10'
                : 'border-white/20 hover:border-white/40'
            }`}
            onClick={() => setPaymentMethod('subscription')}>
              <div className="flex items-start gap-4">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'subscription'}
                  onChange={() => setPaymentMethod('subscription')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-light mb-2">💳 Purchase Subscription</h3>
                  <p className="text-light/70">
                    Choose a plan and receive an invoice
                  </p>
                </div>
              </div>
            </div>

            {paymentMethod === 'subscription' && (
              <div className="mt-6">
                <SubscriptionPlans 
                  onSelectPlan={handleSelectPlan}
                  clubId="new"
                />
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={() => setStep(2)}
                className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Success */}
      {step === 5 && (
        <div className="bg-white/5 backdrop-blur-sm border border-success/30 rounded-xl p-6 animate-scale-in">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🎉</span>
            </div>
            <h2 className="font-title text-4xl text-light mb-2">Congratulations!</h2>
            <p className="text-light/70">Your club has been created successfully!</p>
          </div>

          <div className="bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-primary/50 rounded-xl p-6 mb-6">
            <h3 className="font-bold text-light text-center mb-4">Club Details</h3>
            <div className="space-y-2 text-sm text-light/70">
              <div className="flex justify-between">
                <span>Club Name:</span>
                <span className="font-medium text-light">{createdClub?.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Club Code:</span>
                <span className="font-mono font-medium text-secondary">{createdClub?.clubCode}</span>
              </div>
              {createdClub?.voucherUsed && (
                <>
                  <div className="flex justify-between">
                    <span>Voucher:</span>
                    <span className="font-medium text-accent">{createdClub?.voucherCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expires:</span>
                    <span className="font-medium text-warning">
                      {new Date(createdClub?.expiryDate).toLocaleDateString()}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-full px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
