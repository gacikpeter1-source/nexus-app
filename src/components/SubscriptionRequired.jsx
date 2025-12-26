// src/components/SubscriptionRequired.jsx
import { useNavigate } from 'react-router-dom';

export default function SubscriptionRequired({ 
  message = 'A CLUB subscription is required to access this feature.',
  title = 'Subscription Required',
  ctaText = 'View Subscription Plans',
  ctaLink = '/subscriptions',
  icon = '💳'
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Main Card */}
        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 rounded-2xl p-8 text-center">
          {/* Icon */}
          <div className="text-6xl mb-4">
            {icon}
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-yellow-400 mb-3">
            {title}
          </h1>

          {/* Message */}
          <p className="text-light/70 mb-6 leading-relaxed">
            {message}
          </p>

          {/* Features List */}
          <div className="bg-dark/50 rounded-lg p-4 mb-6 text-left">
            <h3 className="text-sm font-semibold text-light/80 mb-3">✨ With a subscription you can:</h3>
            <ul className="space-y-2 text-sm text-light/60">
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Create and manage unlimited clubs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Add unlimited teams and members</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Schedule unlimited events</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Access advanced analytics</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Priority support</span>
              </li>
            </ul>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 my-6"></div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-light rounded-lg transition border border-white/10 font-medium"
            >
              ← Go Back
            </button>
            <button
              onClick={() => navigate(ctaLink)}
              className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white rounded-lg transition font-medium shadow-lg"
            >
              {ctaText}
            </button>
          </div>
        </div>

        {/* Trial Info */}
        <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-center">
          <p className="text-blue-400 text-sm font-medium">
            🎁 New clubs get a 30-day free trial!
          </p>
        </div>
      </div>
    </div>
  );
}

// Variant for expired subscriptions
export function SubscriptionExpired() {
  return (
    <SubscriptionRequired
      title="Subscription Expired"
      message="Your subscription has expired. Renew now to continue managing your club."
      icon="⏰"
      ctaText="Renew Subscription"
      ctaLink="/subscriptions"
    />
  );
}

// Variant for feature-specific paywall
export function FeatureLocked({ featureName = 'this feature' }) {
  return (
    <SubscriptionRequired
      title="Premium Feature"
      message={`${featureName} is only available with a CLUB subscription. Upgrade to unlock this feature.`}
      icon="🔓"
      ctaText="Upgrade Now"
      ctaLink="/subscriptions"
    />
  );
}




