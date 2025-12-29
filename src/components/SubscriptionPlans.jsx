// src/components/SubscriptionPlans.jsx
import { useState } from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';


export default function SubscriptionPlans({ onSelectPlan, clubId = null, showFreePlan = false }) {
  const { SUBSCRIPTION_PLANS, BILLING_CYCLES, PLAN_PRICING, PLAN_FEATURES, getCurrentPlan } = useSubscription();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [selectedCycle, setSelectedCycle] = useState(BILLING_CYCLES.MONTHLY);
  const { t } = useLanguage();
  const currentPlan = getCurrentPlan(clubId);

  const plans = [
    ...(showFreePlan ? [SUBSCRIPTION_PLANS.FREE] : []),
    SUBSCRIPTION_PLANS.USER,
    SUBSCRIPTION_PLANS.CLUB,
    SUBSCRIPTION_PLANS.FULL
  ];

  const handleSelectPlan = (plan) => {
    if (plan === SUBSCRIPTION_PLANS.FREE) {
      showToast(t('subscriptionplan.alreadyOnFreePlan'), 'info');
      return;
    }

    if (onSelectPlan) {
      onSelectPlan(plan, selectedCycle);
    }
  };

  const getPlanBadge = (plan) => {
    if (plan === currentPlan) {
      return <span className="absolute top-4 right-4 px-3 py-1 bg-success text-white text-xs font-bold rounded-full">{t('subscriptionplan.currentPlan')}</span>;
    }
    if (plan === SUBSCRIPTION_PLANS.FULL) {
      return <span className="absolute top-4 right-4 px-3 py-1 bg-gradient-to-r from-accent to-primary text-white text-xs font-bold rounded-full">{t('subscriptionplan.popular')}</span>;
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

    if (features.canCreateClub) items.push(t('subscriptionplan.createUnlimitedClubsTeams'));
    else if (features.maxTeams > 0) items.push(t('subscriptionplan.createSmallTeam').replace('${features.maxTeamSize}', features.maxTeamSize));
    
    if (features.hasNotifications) items.push(t('subscriptionplan.pushEmailNotifications'));
    if (features.hasStatistics) items.push(t('subscriptionplan.statisticsAnalytics'));
    if (features.hasLibrary) items.push(t('subscriptionplan.personalLibrary'));
    if (features.hasChat) items.push(t('subscriptionplan.teamChat'));
    if (features.canCustomizeTheme) items.push(t('subscriptionplan.customThemesBackgrounds'));
    if (features.canExportData) items.push(t('subscriptionplan.exportToExcel'));
    if (features.hasSMSService) items.push(t('subscriptionplan.smsService'));
    if (features.hasPublicEvents) items.push(t('subscriptionplan.publicEventsSocialMedia'));

    // Free plan features
    if (plan === SUBSCRIPTION_PLANS.FREE) {
      items.push(t('subscriptionplan.viewCalendar'));
      items.push(t('subscriptionplan.respondToEvents'));
      items.push(t('subscriptionplan.createPersonalEvents'));
      items.push(t('subscriptionplan.requestToJoinClubs'));
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
            {t('subscriptionplan.monthly')}
          </button>
          <button
            onClick={() => setSelectedCycle(BILLING_CYCLES.YEARLY)}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              selectedCycle === BILLING_CYCLES.YEARLY
                ? 'bg-primary text-white'
                : 'text-light/70 hover:text-light'
            }`}
          >
            {t('subscriptionplan.yearly')}
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
                {isCurrent ? t('subscriptionplan.currentPlan') : isFree ? t('subscriptionplan.freeForever') : t('subscriptionplan.selectPlan')}
              </button>
            </div>
          );
        })}
      </div>

      {/* Additional Info */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
        <p className="text-light/70 text-sm">
          💳 {t('subscriptionplan.securePayment')} • 📧 {t('subscriptionplan.invoiceViaEmail')} • 💰 {t('subscriptionplan.sevenDayPaymentWindow')} • 🔄 {t('subscriptionplan.cancelAnytime')}
        </p>
      </div>
    </div>
  );
  function MyComponent() {
    const { getPlanFeatures, SUBSCRIPTION_PLANS } = useSubscription();
    const { t } = useLanguage();
    
    // Get translated features
    const translatedFeatures = getPlanFeatures(t);
    
    // Use them
    const freePlan = translatedFeatures[SUBSCRIPTION_PLANS.FREE];
    console.log(freePlan.name); // "Free Account" in current language
  }

}