// src/components/CreateClubWithSubscription.jsx
import React, { useState } from 'react';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function CreateClubWithSubscription() {
  const { user, createClub, refreshUser } = useAuth();
  const { showToast } = useToast();
  
  const [step, setStep] = useState(1); // 1: Form, 2: Terms, 3: Payment, 4: Success
  const [clubName, setClubName] = useState('');
  const [initialTeamName, setInitialTeamName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [customerID, setCustomerID] = useState('');
  const [createdClub, setCreatedClub] = useState(null);

  // Get list of clubs user already owns (for display purposes)
  const ownedClubs = React.useMemo(() => {
    if (!user) return [];
    // This will be populated from user.ownedClubIds in Firebase
    return user.ownedClubIds || [];
  }, [user]);

  // Generate unique 15-character Customer ID
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
    setStep(2); // Move to Terms & Conditions
  };

  const handleAcceptTerms = () => {
    if (!termsAccepted) {
      showToast('Please accept the terms and conditions', 'error');
      return;
    }
    setStep(3); // Move to Payment simulation
  };

  const handlePaymentSimulation = async () => {
    setBusy(true);
    
    try {
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Generate Customer ID
      const newCustomerID = generateCustomerID();
      setCustomerID(newCustomerID);

      // Create club object
      const clubCode = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit code
      
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

      // Add initial team if provided
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

      // Save to Firebase
      const { createClub: createClubInFirestore } = await import('../firebase/firestore');
      const newClub = await createClubInFirestore(clubData);
      
      // Update user in Firebase
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

      // Refresh user data
      if (refreshUser) {
        await refreshUser();
      }

      setCreatedClub({
        ...newClub,
        clubCode: clubCode
      });
      setStep(4); // Move to Success screen
      
      showToast('Club created successfully!', 'success');

Your Customer ID: ${newCustomerID}

Club Code (share with trainers): ${newClub.clubCode}

You are now the SuperTrainer (Club Owner) with full access to all teams.

${isAdditionalClub ? `\nâš ï¸ BILLING NOTICE:\nThis is subscription #${ownedClubs.length + 1}. You now own ${ownedClubs.length + 1} club(s), each with separate billing.\n\nYour clubs:\n${ownedClubs.map((c, i) => `  ${i + 1}. ${c.name} (ID: ${c.customerID})`).join('\n')}\n  ${ownedClubs.length + 1}. ${newClub.name} (ID: ${newCustomerID})\n` : ''}

Important: Keep your Customer ID safe. You'll need it for support and billing.

Welcome to NEXUS!
        `,
        createdAt: Date.now()
      });
      localStorage.setItem('mailbox', JSON.stringify(mailbox));

      setCreatedClub(newClub);
      setStep(4); // Success!

      // Refresh auth state
      if (typeof refreshUser === 'function') {
        await refreshUser();
      }

      showToast('Club created successfully! You are now SuperTrainer!', 'success');

    } catch (error) {
      showToast(error.message || 'Failed to create club', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    window.location.reload(); // Refresh to show new club
  };

  if (!user) {
    return (
      <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
        <p className="text-light">Please log in to create a club.</p>
      </div>
    );
  }

  // Show info about existing clubs if user already owns some
  const hasExistingClubs = ownedClubs.length > 0;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step 1: Club Details Form */}
      {step === 1 && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-fade-in">
          <h2 className="font-title text-3xl text-light mb-6 flex items-center gap-3">
            <span className="w-1 h-8 bg-primary rounded"></span>
            Create Your Club
          </h2>

          {/* Show existing clubs notice if applicable */}
          {hasExistingClubs && (
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-accent mb-2 flex items-center gap-2">
                <span>â„¹ï¸</span>
                Additional Subscription Required
              </h3>
              <p className="text-light/80 text-sm mb-3">
                You currently own <strong>{ownedClubs.length}</strong> club{ownedClubs.length > 1 ? 's' : ''}. 
                Creating a new club will require a <strong>separate subscription</strong>.
              </p>
              <div className="bg-white/5 rounded p-3 space-y-1">
                {ownedClubs.map((club, idx) => (
                  <div key={club.id} className="text-sm text-light/70 flex justify-between items-center">
                    <span>Club {idx + 1}: <span className="font-medium text-light">{club.name}</span></span>
                    <span className="text-xs font-mono text-accent">{club.customerID}</span>
                  </div>
                ))}
              </div>
              <p className="text-light/60 text-xs mt-3">
                Each club is billed separately with its own Customer ID.
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

            <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
              <h3 className="font-semibold text-accent mb-2 flex items-center gap-2">
                <span>â„¹ï¸</span>
                What happens next?
              </h3>
              <ul className="text-sm text-light/70 space-y-1">
                <li>â€¢ You&apos;ll review and accept our terms</li>
                <li>â€¢ Complete subscription setup (simulated for dev)</li>
                <li>â€¢ Receive your unique Customer ID</li>
                <li>â€¢ Become SuperTrainer with full club access</li>
                <li>â€¢ Get a club code to share with trainers</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue to Terms & Conditions
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Terms & Conditions */}
      {step === 2 && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-fade-in">
          <h2 className="font-title text-3xl text-light mb-6 flex items-center gap-3">
            <span className="w-1 h-8 bg-secondary rounded"></span>
            Terms & Conditions
          </h2>

          <div className="bg-white/5 border border-white/10 rounded-lg p-6 max-h-96 overflow-y-auto mb-6">
            <div className="text-light/80 space-y-4 text-sm">
              <h3 className="font-bold text-light text-lg">NEXUS Club Subscription Agreement</h3>
              
              <p><strong>1. Subscription Terms</strong></p>
              <p>By creating a club, you agree to an annual subscription for club management services.</p>

              <p><strong>2. SuperTrainer Role</strong></p>
              <p>As the club creator, you will become the SuperTrainer (Club Owner) with full access to all teams within your club. This role can be transferred to another trainer within your club at any time.</p>

              <p><strong>3. Customer ID</strong></p>
              <p>You will receive a unique 15-character Customer ID. This ID is required for support, billing inquiries, and club management. Keep it secure.</p>

              <p><strong>4. Club Features</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Unlimited teams per club</li>
                <li>Up to 2 trainers + 2 assistants per team</li>
                <li>Unlimited trainers at club level</li>
                <li>Calendar and event management</li>
                <li>Member management and communication</li>
              </ul>

              <p><strong>5. Payment</strong></p>
              <p>Subscription is billed annually. Payment details and pricing will be confirmed during activation.</p>

              <p><strong>6. Data & Privacy</strong></p>
              <p>We protect your club&apos;s data according to our Privacy Policy. You retain ownership of all content and member information.</p>

              <p><strong>7. Cancellation</strong></p>
              <p>You may cancel your subscription at any time. Access will continue until the end of the current billing period.</p>

              <p><strong>8. Support</strong></p>
              <p>Customer support is available via email. Response time: 24-48 hours.</p>

              <p className="text-light/60 italic mt-4">
                Last updated: November 2024
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 mb-6">
            <input
              type="checkbox"
              id="terms"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-white/20 bg-white/10 text-primary focus:ring-primary cursor-pointer"
            />
            <label htmlFor="terms" className="text-light/80 text-sm cursor-pointer">
              I have read and accept the Terms & Conditions. I understand that I will become the SuperTrainer (Club Owner) and will receive a unique Customer ID for my club.
            </label>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg transition-all font-medium"
            >
              Back
            </button>
            <button
              onClick={handleAcceptTerms}
              disabled={!termsAccepted}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Accept & Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Payment Simulation */}
      {step === 3 && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-fade-in">
          <h2 className="font-title text-3xl text-light mb-6 flex items-center gap-3">
            <span className="w-1 h-8 bg-accent rounded"></span>
            {hasExistingClubs ? 'Additional Subscription' : 'Subscription Setup'}
          </h2>

          {hasExistingClubs && (
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-6">
              <p className="text-accent font-semibold mb-2">ðŸ’³ Additional Club Subscription</p>
              <p className="text-light/70 text-sm">
                This is subscription #{ownedClubs.length + 1}. You will be charged separately for this club.
                Each club has its own billing and Customer ID.
              </p>
            </div>
          )}

          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-6">
            <p className="text-warning font-semibold mb-2">ðŸš§ Development Mode</p>
            <p className="text-light/70 text-sm">
              This is a simulated payment for development purposes. In production, this will integrate with a real payment processor.
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
              <div className="border-t border-white/10 pt-3 mt-3">
                <div className="flex justify-between">
                  <span>Subscription Plan:</span>
                  <span className="font-semibold text-light">Annual</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span>Billing:</span>
                  <span className="font-semibold text-accent">Simulated (Dev Mode)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(2)}
              disabled={busy}
              className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg transition-all font-medium disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handlePaymentSimulation}
              disabled={busy}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {busy ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Processing...
                </span>
              ) : (
                'Complete Setup'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Success with Customer ID */}
      {step === 4 && (
        <div className="bg-white/5 backdrop-blur-sm border border-success/30 rounded-xl p-6 animate-scale-in">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">ðŸŽ‰</span>
            </div>
            <h2 className="font-title text-4xl text-light mb-2">
              Congratulations!
            </h2>
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
              âš ï¸ Save this ID! You&apos;ll need it for support and billing.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6 space-y-4">
            <div>
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
                  <span className="font-medium text-accent">SuperTrainer (Club Owner)</span>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <h3 className="font-semibold text-light mb-2">Next Steps</h3>
              <ul className="text-sm text-light/70 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary">âœ“</span>
                  <span>Share Club Code <code className="text-secondary font-mono">{createdClub?.clubCode}</code> with trainers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">âœ“</span>
                  <span>Create teams for different age groups</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">âœ“</span>
                  <span>Invite athletes and parents</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">âœ“</span>
                  <span>Start scheduling events</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-6">
            <p className="text-accent font-semibold mb-2">ðŸ“§ Email Sent</p>
            <p className="text-light/70 text-sm">
              A confirmation email with your Customer ID has been sent to <strong>{user.email}</strong>
            </p>
          </div>

          <button
            onClick={handleClose}
            className="w-full btn-primary"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
