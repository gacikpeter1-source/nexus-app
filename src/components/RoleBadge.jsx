// src/components/RoleBadge.jsx
import { ROLES } from '../constants/roles';

export default function RoleBadge({ role, isSuperAdmin = false, size = 'md', showIcon = true }) {
  // Handle SuperAdmin override
  if (isSuperAdmin) {
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg ${getSizeClasses(size)}`}>
        {showIcon && <span>👑</span>}
        <span>SUPER ADMIN</span>
      </span>
    );
  }

  const config = getRoleConfig(role);

  return (
    <span 
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold ${config.bgClass} ${config.textClass} ${getSizeClasses(size)}`}
      title={config.description}
    >
      {showIcon && <span>{config.icon}</span>}
      <span>{config.label}</span>
    </span>
  );
}

function getRoleConfig(role) {
  switch (role) {
    case ROLES.ADMIN:
      return {
        label: 'ADMIN',
        icon: '👑',
        bgClass: 'bg-purple-600',
        textClass: 'text-white',
        description: 'System Administrator - Full access'
      };
    case ROLES.CLUB_OWNER:
      return {
        label: 'OWNER',
        icon: '🏢',
        bgClass: 'bg-blue-600',
        textClass: 'text-white',
        description: 'Club Owner - Manages club'
      };
    case ROLES.TRAINER:
      return {
        label: 'TRAINER',
        icon: '⚽',
        bgClass: 'bg-green-600',
        textClass: 'text-white',
        description: 'Trainer - Manages teams'
      };
    case ROLES.ASSISTANT:
      return {
        label: 'ASSISTANT',
        icon: '🤝',
        bgClass: 'bg-teal-600',
        textClass: 'text-white',
        description: 'Assistant - Helps manage teams'
      };
    case 'parent':
      return {
        label: 'PARENT',
        icon: '👤',
        bgClass: 'bg-yellow-600',
        textClass: 'text-white',
        description: 'Parent - Manages family members'
      };
    case ROLES.USER:
    default:
      return {
        label: 'MEMBER',
        icon: '👥',
        bgClass: 'bg-gray-600',
        textClass: 'text-white',
        description: 'Regular Member'
      };
  }
}

function getSizeClasses(size) {
  switch (size) {
    case 'sm':
      return 'text-xs px-2 py-0.5';
    case 'lg':
      return 'text-base px-4 py-2';
    case 'md':
    default:
      return 'text-sm px-3 py-1';
  }
}

// Compact version for inline display
export function RoleBadgeCompact({ role, isSuperAdmin = false }) {
  return <RoleBadge role={role} isSuperAdmin={isSuperAdmin} size="sm" showIcon={true} />;
}

// Icon-only version
export function RoleIcon({ role, isSuperAdmin = false, size = 'md' }) {
  const config = isSuperAdmin ? { icon: '👑' } : getRoleConfig(role);
  
  const sizeClass = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-3xl' : 'text-xl';
  
  return (
    <span className={sizeClass} title={config.description || 'Super Admin'}>
      {config.icon}
    </span>
  );
}

// Multiple roles display (for users with roles in multiple clubs)
export function MultiRoleBadge({ roles = [], isSuperAdmin = false }) {
  if (isSuperAdmin) {
    return <RoleBadge role={ROLES.ADMIN} isSuperAdmin={true} size="sm" />;
  }

  // Remove duplicates and sort by priority
  const uniqueRoles = [...new Set(roles)];
  const sortedRoles = uniqueRoles.sort((a, b) => {
    const priority = {
      [ROLES.ADMIN]: 5,
      [ROLES.CLUB_OWNER]: 4,
      [ROLES.TRAINER]: 3,
      [ROLES.ASSISTANT]: 2,
      [ROLES.USER]: 1
    };
    return (priority[b] || 0) - (priority[a] || 0);
  });

  return (
    <div className="flex flex-wrap gap-1">
      {sortedRoles.map((role, index) => (
        <RoleBadge key={index} role={role} size="sm" />
      ))}
    </div>
  );
}







