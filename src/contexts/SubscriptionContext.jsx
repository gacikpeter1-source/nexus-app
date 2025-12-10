// src/contexts/SubscriptionContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { 
  getUserSubscription, 
  getClubSubscription,
  createSubscription,
  updateSubscription,
  createInvoice,
  getInvoice
} from '../firebase/firestore';

const SubscriptionContext = createContext();

export const SUBSCRIPTION_PLANS = {
  FREE: 'free',
  USER: 'user',
  CLUB: 'club',
  FULL: 'full',
  TRIAL: 'trial'
};

export const BILLING_CYCLES = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly'
};

// Pricing in EUR
export const PLAN_PRICING = {
  [SUBSCRIPTION_PLANS.FREE]: { monthly: 0, yearly: 0 },
  [SUBSCRIPTION_PLANS.USER]: { monthly: 9.99, yearly: 99.99 },
  [SUBSCRIPTION_PLANS.CLUB]: { monthly: 49.99, yearly: 499.99 },
  [SUBSCRIPTION_PLANS.FULL]: { monthly: 99.99, yearly: 999.99 },
  [SUBSCRIPTION_PLANS.TRIAL]: { monthly: 0, yearly: 0 }
};

export const PLAN_FEATURES = {
  [SUBSCRIPTION_PLANS.FREE]: {
    name: 'Free Account',
    shortDesc: 'Basic features',
    maxTeamSize: 0,
    maxTeams: 0,
    canCreateClub: false,
    canCreateEvents: true,
    canViewCalendar: true,
    canRespondToEvents: true,
    hasNotifications: false,
    hasStatistics: false,
    hasLibrary: false,
    hasChat: false,
    canCustomizeTheme: false,
    canExportData: false,
    hasSMSService: false,
    hasPublicEvents: false,
    description: 'Basic features for individual users',
    features: [
      'View calendar',
      'Respond to events',
      'Basic profile'
    ]
  },
  [SUBSCRIPTION_PLANS.USER]: {
    name: 'User Subscription',
    shortDesc: 'Small teams',
    maxTeamSize: 10,
    maxTeams: 1,
    canCreateClub: false,
    canCreateEvents: true,
    canViewCalendar: true,
    canRespondToEvents: true,
    hasNotifications: true,
    hasStatistics: true,
    hasLibrary: true,
    hasChat: true,
    canCustomizeTheme: true,
    canExportData: false,
    hasSMSService: false,
    hasPublicEvents: false,
    description: 'Perfect for small teams and personal training',
    features: [
      '1 team (max 10 members)',
      'Push notifications',
      'Statistics & reports',
      'Library access',
      'Chat messaging',
      'Custom themes'
    ]
  },
  [SUBSCRIPTION_PLANS.CLUB]: {
    name: 'Club/Company Subscription',
    shortDesc: 'Mid-sized clubs',
    maxTeamSize: Infinity,
    maxTeams: Infinity,
    canCreateClub: true,
    canCreateEvents: true,
    canViewCalendar: true,
    canRespondToEvents: true,
    hasNotifications: true,
    hasStatistics: true,
    hasLibrary: true,
    hasChat: true,
    canCustomizeTheme: true,
    canExportData: true,
    hasSMSService: false,
    hasPublicEvents: false,
    description: 'Full club management with unlimited teams',
    features: [
      'Unlimited teams',
      'Unlimited members',
      'Create clubs',
      'Advanced statistics',
      'Data export',
      'All User features'
    ]
  },
  [SUBSCRIPTION_PLANS.FULL]: {
    name: 'Full Subscription',
    shortDesc: 'Enterprise',
    maxTeamSize: Infinity,
    maxTeams: Infinity,
    canCreateClub: true,
    canCreateEvents: true,
    canViewCalendar: true,
    canRespondToEvents: true,
    hasNotifications: true,
    hasStatistics: true,
    hasLibrary: true,
    hasChat: true,
    canCustomizeTheme: true,
    canExportData: true,
    hasSMSService: true,
    hasPublicEvents: true,
    description: 'Enterprise features with social media integration',
    features: [
      'SMS notifications',
      'Public events',
      'Social media integration',
      'Priority support',
      'All Club features'
    ]
  },
  [SUBSCRIPTION_PLANS.TRIAL]: {
    name: 'Trial Subscription',
    shortDesc: 'Trial access',
    maxTeamSize: Infinity,
    maxTeams: Infinity,
    canCreateClub: true,
    canCreateEvents: true,
    canViewCalendar: true,
    canRespondToEvents: true,
    hasNotifications: true,
    hasStatistics: true,
    hasLibrary: true,
    hasChat: true,
    canCustomizeTheme: true,
    canExportData: true,
    hasSMSService: true,
    hasPublicEvents: true,
    description: 'Full access trial period',
    features: [
      'All features unlocked',
      'Time-limited access',
      'Full platform trial'
    ]
  }
};

export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const [userSubscription, setUserSubscription] = useState(null);
  const [clubSubscriptions, setClubSubscriptions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSubscriptions();
    } else {
      setUserSubscription(null);
      setClubSubscriptions({});
      setLoading(false);
    }
  }, [user]);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      
      // Load user subscription
      const userSub = await getUserSubscription(user.id);
      setUserSubscription(userSub);

      // Load club subscriptions for user's clubs
      if (user.clubIds && user.clubIds.length > 0) {
        const clubSubs = {};
        for (const clubId of user.clubIds) {
          const clubSub = await getClubSubscription(clubId);
          if (clubSub) {
            clubSubs[clubId] = clubSub;
          }
        }
        setClubSubscriptions(clubSubs);
      }
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if user has a specific feature
  const hasFeature = (feature, clubId = null) => {
    // ADMIN/SUPERADMIN BYPASS - Always grant full access
    if (user && (user.isSuperAdmin || user.role === 'admin')) {
      return true;
    }
    
    // Check club subscription first if clubId provided
    if (clubId && clubSubscriptions[clubId]) {
      const clubSub = clubSubscriptions[clubId];
      if (clubSub.status === 'active') {
        const clubFeatures = PLAN_FEATURES[clubSub.plan];
        if (clubFeatures && clubFeatures[feature]) {
          return true;
        }
      }
    }

    // Check user subscription
    if (userSubscription && userSubscription.status === 'active') {
      const userFeatures = PLAN_FEATURES[userSubscription.plan];
      return userFeatures && userFeatures[feature];
    }

    // Default to free plan
    const freeFeatures = PLAN_FEATURES[SUBSCRIPTION_PLANS.FREE];
    return freeFeatures && freeFeatures[feature];
  };

  // Get current plan level
  const getCurrentPlan = (clubId = null) => {
    // ADMIN/SUPERADMIN BYPASS - Show as "Full" plan
    if (user && (user.isSuperAdmin || user.role === 'admin')) {
      return SUBSCRIPTION_PLANS.FULL;
    }
    
    if (clubId && clubSubscriptions[clubId]) {
      const clubSub = clubSubscriptions[clubId];
      if (clubSub.status === 'active') {
        return clubSub.plan;
      }
    }

    if (userSubscription && userSubscription.status === 'active') {
      return userSubscription.plan;
    }

    return SUBSCRIPTION_PLANS.FREE;
  };

  // Check if subscription is active
  const isSubscriptionActive = (clubId = null) => {
    if (clubId && clubSubscriptions[clubId]) {
      return clubSubscriptions[clubId].status === 'active';
    }

    if (userSubscription) {
      return userSubscription.status === 'active';
    }

    return false;
  };

  // Get subscription expiry date
  const getExpiryDate = (clubId = null) => {
    if (clubId && clubSubscriptions[clubId]) {
      return clubSubscriptions[clubId].endDate;
    }

    if (userSubscription) {
      return userSubscription.endDate;
    }

    return null;
  };

  // Create new subscription
  const subscribe = async (plan, billingCycle, clubId = null, voucher = null) => {
    try {
      // Handle voucher subscriptions
      if (voucher) {
        const subscriptionData = {
          userId: user.id,
          clubId: clubId || null,
          plan: voucher.plan,
          billingCycle: 'custom',
          status: 'active', // Voucher subscriptions are active immediately
          amount: 0,
          currency: 'EUR',
          voucherCode: voucher.code,
          voucherId: voucher.id,
          startDate: new Date().toISOString(),
          endDate: voucher.expirationDate,
          createdAt: new Date().toISOString()
        };

        const subscription = await createSubscription(subscriptionData);
        await loadSubscriptions();
        return { subscription, invoice: null };
      }
      
      // Regular subscription flow
      const pricing = PLAN_PRICING[plan];
      const amount = billingCycle === BILLING_CYCLES.YEARLY ? pricing.yearly : pricing.monthly;
      
      // Calculate end date
      const startDate = new Date();
      const endDate = new Date(startDate);
      if (billingCycle === BILLING_CYCLES.YEARLY) {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      // Create subscription
      const subscriptionData = {
        userId: user.id,
        clubId: clubId || null,
        plan,
        billingCycle,
        status: 'pending',
        amount,
        currency: 'EUR',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        createdAt: new Date().toISOString()
      };

      const subscription = await createSubscription(subscriptionData);

      // Create invoice
      const invoiceData = {
        subscriptionId: subscription.id,
        userId: user.id,
        clubId: clubId || null,
        amount,
        currency: 'EUR',
        status: 'pending',
        plan,
        billingCycle,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        createdAt: new Date().toISOString()
      };

      const invoice = await createInvoice(invoiceData);

      // Reload subscriptions
      await loadSubscriptions();

      return { subscription, invoice };
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  };

  const value = {
    userSubscription,
    clubSubscriptions,
    loading,
    hasFeature,
    getCurrentPlan,
    isSubscriptionActive,
    getExpiryDate,
    subscribe,
    refreshSubscriptions: loadSubscriptions,
    SUBSCRIPTION_PLANS,
    BILLING_CYCLES,
    PLAN_PRICING,
    PLAN_FEATURES
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
}
