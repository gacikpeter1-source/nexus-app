// src/components/CreateClubWithSubscription.jsx
import React, { useState } from 'react';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function CreateClubWithSubscription({ onClose }) {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  
  const [step, setStep] = useState(1);
  const [clubName, setClubName] = useState('');
  const [initialTeamName, setInitialTeamName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [customerID, setCustomerID] = useState('');
  const [createdClub, setCreatedClub] = useState(null);

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
    setStep(3);
  };

  const handlePaymentSimulation = async () => {
    setBusy(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const newCustomerID = generateCustomerID();
      setCustomerID(newCustomerID);

      const clubCode = String(Math.floor(100000 + Math.random() * 900000));
      
      const clubData = {
        name: clubName.trim(),
        customerID: newCustomerID,
        subscriptionActive: true,
        subscriptionDate: new Date().toISOString(),
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
        clubCode: clubCode
      });
      setStep(4);
      
      showToast('Club created successfully!', 'success');

    } catch (error) {
      console.error('Error creating club:', error);
      showToast(error.message || 'Failed to create club', 'error');
    } finally {
      setBusy(false);
    }
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
    <div className="max-w-2xl mx-auto">
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
                Creating a new club will require a <strong>separate subscription</strong>.
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
              <p className="text-xs text-light/50 mt-1">Minimum 2 characters</p>
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
              <p className="text-xs text-light/50 mt-1">You can add more teams later</p>
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

      {step === 2 && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-fade-in">
          <h2 className="font-title text-3xl text-light mb-6">Terms & Conditions</h2>

          <div className="bg-white/5 border border-white/10 rounded-lg p-6 max-h-96 overflow-y-auto mb-6">
            <div className="text-light/80 space-y-4 text-sm">
              <h3 className="font-bold text-light text-lg">NEXUS Club Subscription Agreement</h3>
              <p><strong>1. Subscription Terms</strong></p>
              <p>By creating a club, you agree to an annual subscription for club management services.</p>
              <p><strong>2. SuperTrainer Role</strong></p>
              <p>As the club creator, you will become the SuperTrainer with full access to all teams.</p>
              <p><strong>3. Customer ID</strong></p>
              <p>You will receive a unique Customer ID for support and billing.</p>
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

      {step === 3 && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-fade-in">
          <h2 className="font-title text-3xl text-light mb-6">Subscription Setup</h2>

          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-6">
            <p className="text-warning font-semibold mb-2">🚧 Development Mode</p>
            <p className="text-light/70 text-sm">
              Simulated payment for development purposes.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6">
            <h3 className="font-bold text-light mb-4">Subscription Summary</h3>
            <div className="space-y-3 text-light/80">
              <div className="flex justify-between">
                <span>Club Name:</span>
                <span className="font-semibold text-light">{clubName}</span>
              </div>
              {initialTeamName && (
                <div className="flex justify-between">
                  <span>Initial Team:</span>
                  <span className="font-semibold text-light">{initialTeamName}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(2)}
              disabled={busy}
              className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handlePaymentSimulation}
              disabled={busy}
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg disabled:opacity-50"
            >
              {busy ? 'Processing...' : 'Complete Setup'}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="bg-white/5 backdrop-blur-sm border border-success/30 rounded-xl p-6 animate-scale-in">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🎉</span>
            </div>
            <h2 className="font-title text-4xl text-light mb-2">Congratulations!</h2>
            <p className="text-light/70">Your club has been created successfully!</p>
          </div>

          <div className="bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-primary/50 rounded-xl p-6 mb-6">
            <h3 className="font-bold text-light text-center mb-4">Your Customer ID</h3>
            <div className="bg-dark/50 rounded-lg p-4 text-center">
              <code className="text-3xl font-mono font-bold text-accent tracking-wider">
                {customerID}
              </code>
            </div>
            <p className="text-xs text-light/60 text-center mt-3">
              ⚠️ Save this ID for support and billing
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-light mb-2">Club Details</h3>
            <div className="space-y-2 text-sm text-light/70">
              <div className="flex justify-between">
                <span>Club Name:</span>
                <span className="font-medium text-light">{createdClub?.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Club Code:</span>
                <span className="font-mono font-medium text-secondary">{createdClub?.clubCode}</span>
              </div>
              <div className="flex justify-between">
                <span>Your Role:</span>
                <span className="font-medium text-accent">SuperTrainer</span>
              </div>
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
