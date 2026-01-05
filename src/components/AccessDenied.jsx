// src/components/AccessDenied.jsx
import { useNavigate } from 'react-router-dom';
import { PERMISSION_ERRORS } from '../constants/roles';

export default function AccessDenied({ 
  message = PERMISSION_ERRORS.NOT_AUTHORIZED,
  title = 'Access Denied',
  showBackButton = true,
  icon = '🔒'
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Main Card */}
        <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-2xl p-8 text-center">
          {/* Icon */}
          <div className="text-6xl mb-4 animate-pulse">
            {icon}
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-red-400 mb-3">
            {title}
          </h1>

          {/* Message */}
          <p className="text-light/70 mb-6 leading-relaxed">
            {message}
          </p>

          {/* Divider */}
          <div className="border-t border-white/10 my-6"></div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {showBackButton && (
              <button
                onClick={() => navigate(-1)}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-light rounded-lg transition border border-white/10 font-medium"
              >
                ← Go Back
              </button>
            )}
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-medium"
            >
              Go to Dashboard
            </button>
          </div>

          {/* Help Text */}
          <p className="text-light/40 text-sm mt-6">
            If you believe this is an error, please contact an administrator.
          </p>
        </div>

        {/* Additional Info Card */}
        <div className="mt-4 bg-white/5 border border-white/10 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-light/60 mb-2">💡 Common Reasons:</h3>
          <ul className="text-xs text-light/50 space-y-1">
            <li>• You don't have the required role for this action</li>
            <li>• You're not a member of this club or team</li>
            <li>• Your subscription may have expired</li>
            <li>• The resource you're trying to access doesn't belong to you</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Variants for specific use cases
export function NotAuthenticated() {
  return (
    <AccessDenied
      title="Authentication Required"
      message={PERMISSION_ERRORS.NOT_AUTHENTICATED}
      icon="🔐"
      showBackButton={false}
    />
  );
}

export function NotAdmin() {
  return (
    <AccessDenied
      title="Admin Access Required"
      message={PERMISSION_ERRORS.NOT_ADMIN}
      icon="👑"
    />
  );
}

export function NotClubOwner() {
  return (
    <AccessDenied
      title="Club Owner Access Required"
      message={PERMISSION_ERRORS.NOT_CLUB_OWNER}
      icon="🏢"
    />
  );
}

export function NotTrainer() {
  return (
    <AccessDenied
      title="Trainer Access Required"
      message="Only trainers can perform this action."
      icon="⚽"
    />
  );
}







