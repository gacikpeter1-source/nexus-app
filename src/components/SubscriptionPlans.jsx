// src/components/SubscriptionPlans.jsx
import { useState } from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function SubscriptionPlans({ onSelectPlan, clubId = null, showFreePlan = false }) {
  const { SUBSCRIPTION_PLANS, BILLING_CYCLES, PLAN_PRICING, PLAN_FEATURES, getCurrentPlan } = useSubscription();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [selectedCycle, setSelectedCycle] = useState(BILLING_CYCLES.MONTHLY);

  const currentPlan = getCurrentPlan(clubId);

  const plans = [
    ...(showFreePlan ? [SUBSCRIPTION_PLANS.FREE] : []),
    SUBSCRIPTION_PLANS.USER,
    SUBSCRIPTION_PLANS.CLUB,
    SUBSCRIPTION_PLANS.FULL
  ];

  const handleSelectPlan = (plan) => {
    if (plan === SUBSCRIPTION_PLANS.FREE) {
      showToast('You are already on the free plan', 'info');
      return;
    }

    if (onSelectPlan) {
      onSelectPlan(plan, selectedCycle);
    }
  };

  const getPlanBadge = (plan) => {
    if (plan === currentPlan) {
      return <span className="absolute top-4 right-4 px-3 py-1 bg-success text-white text-xs font-bold rounded-full">Current Plan</span>;
    }
    if (plan === SUBSCRIPTION_PLANS.FULL) {
      return <span className="absolute top-4 right-4 px-3 py-1 bg-gradient-to-r from-accent to-primary text-white text-xs font-bold rounded-full">Popular</span>;
    }
    return null;
  };

  const getPrice = (plan) => {
    const pricing = PLAN_PRICING[plan];
    const amount = selectedCycle === BILLING_CYCLES.YEARLY ? pricing.yearly : pricing.monthly;
    
    if (amount === 0) return 'Free';
    
    const monthly = selectedCycle === BILLING_CYCLES.YEARLY ? (amount / 12).toFixed(2) : amount;
    return (
      <div>
        <span className="text-4xl font-bold">€{monthly}</span>
        <span className="text-light/60">/month</span>
        {selectedCycle === BILLING_CYCLES.YEARLY && (
          <div className="text-sm text-success mt-1">
            Save €{(pricing.monthly * 12 - pricing.yearly).toFixed(2)}/year
          </div>
        )}
      </div>
    );
  };

  const getFeatureList = (plan) => {
    const features = PLAN_FEATURES[plan];
    const items = [];

    if (features.canCreateClub) items.push('Create unlimited clubs & teams');
    else if (features.maxTeams > 0) items.push(`Create small team (max ${features.maxTeamSize} members)`);
    
    if (features.hasNotifications) items.push('Push & email notifications');
    if (features.hasStatistics) items.push('Statistics & analytics');
    if (features.hasLibrary) items.push('Personal library');
    if (features.hasChat) items.push('Team chat');
    if (features.canCustomizeTheme) items.push('Custom themes & backgrounds');
    if (features.canExportData) items.push('Export to Excel');
    if (features.hasSMSService) items.push('SMS service');
    if (features.hasPublicEvents) items.push('Public events & social media');

    // Free plan features
    if (plan === SUBSCRIPTION_PLANS.FREE) {
      items.push('View calendar');
      items.push('Respond to events');
      items.push('Create personal events');
      items.push('Request to join clubs');
    }

    return items;
  };

  return (
    <div className="space-y-6">
      {/* Billing Cycle Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex bg-white/10 rounded-lg p-1 border border-white/20">
          <button
            onClick={() => setSelectedCycle(BILLING_CYCLES.MONTHLY)}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              selectedCycle === BILLING_CYCLES.MONTHLY
                ? 'bg-primary text-white'
                : 'text-light/70 hover:text-light'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setSelectedCycle(BILLING_CYCLES.YEARLY)}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              selectedCycle === BILLING_CYCLES.YEARLY
                ? 'bg-primary text-white'
                : 'text-light/70 hover:text-light'
            }`}
          >
            Yearly
            <span className="ml-2 text-xs bg-success/20 text-success px-2 py-0.5 rounded">Save 17%</span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map(plan => {
          const features = PLAN_FEATURES[plan];
          const isCurrent = plan === currentPlan;
          const isFree = plan === SUBSCRIPTION_PLANS.FREE;

          return (
            <div
              key={plan}
              className={`relative bg-white/5 backdrop-blur-sm border rounded-xl p-6 transition-all hover:scale-105 ${
                isCurrent
                  ? 'border-success shadow-lg shadow-success/20'
                  : plan === SUBSCRIPTION_PLANS.FULL
                  ? 'border-accent shadow-lg shadow-accent/20'
                  : 'border-white/10 hover:border-primary/50'
              }`}
            >
              {getPlanBadge(plan)}

              {/* Plan Name */}
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-light mb-2">{features.name}</h3>
                <p className="text-sm text-light/60">{features.description}</p>
              </div>

              {/* Price */}
              <div className="mb-6">
                {getPrice(plan)}
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-6">
                {getFeatureList(plan).map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-light/80">
                    <span className="text-success mt-0.5">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                onClick={() => handleSelectPlan(plan)}
                disabled={isCurrent || isFree}
                className={`w-full py-3 rounded-lg font-semibold transition-all ${
                  isCurrent
                    ? 'bg-success/20 text-success cursor-default'
                    : isFree
                    ? 'bg-white/5 text-light/40 cursor-not-allowed'
                    : plan === SUBSCRIPTION_PLANS.FULL
                    ? 'bg-gradient-to-r from-accent to-primary text-white hover:opacity-90'
                    : 'bg-primary text-white hover:bg-primary/80'
                }`}
              >
                {isCurrent ? 'Current Plan' : isFree ? 'Free Forever' : 'Select Plan'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Additional Info */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
        <p className="text-light/70 text-sm">
          💳 Secure payment • 📧 Invoice via email • 💰 7-day payment window • 🔄 Cancel anytime
        </p>
      </div>
    </div>
  );
}
