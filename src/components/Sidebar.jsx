// src/components/Sidebar.jsx
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../hooks/usePermissions';
import { useLanguage } from '../contexts/LanguageContext';
import { getUnreadCount } from '../firebase/notifications';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isUserAdmin = useIsAdmin();
  const { t } = useLanguage();
  
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Check if user is manager (admin, trainer, or assistant)
  const isManager = () => {
    if (!user) return false;
    return isUserAdmin || ['trainer', 'assistant'].includes(user.role);
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);
  
  // Load unread notification count
  useEffect(() => {
    const loadUnreadCount = async () => {
      if (user) {
        try {
          const count = await getUnreadCount(user.id);
          setUnreadCount(count);
        } catch (error) {
          console.error('Error loading unread count:', error);
        }
      }
    };
    
    loadUnreadCount();
    
    // Refresh count every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    
    return () => clearInterval(interval);
  }, [user]);

  // Toggle submenu (accordion behavior - only one open at a time)
  const toggleSubmenu = (menuKey) => {
    setExpandedMenu(expandedMenu === menuKey ? null : menuKey);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Don't show sidebar on public pages
  const isPublicPage = ['/login', '/register', '/verify-email', '/complete-registration', '/auth-action'].includes(location.pathname);
  if (isPublicPage || !user) return null;

  // Menu structure
  const menuItems = [
    {
      key: 'dashboard',
      label: t('nav.myClubs'),
      icon: '🏠',
      path: '/',
      active: location.pathname === '/'
    },
    {
      key: 'club-management',
      label: t('nav.clubMgmt'),
      icon: '⚙️',
      path: '/club-management',
      active: location.pathname.includes('/club-management') || location.pathname.includes('/club/'),
      visible: isManager()
    },
    {
      key: 'calendar',
      label: t('nav.calendar'),
      icon: '📅',
      path: '/calendar',
      active: location.pathname === '/calendar'
    },
    {
      key: 'training-library',
      label: t('nav.trainingLibrary'),
      icon: '📚',
      path: '/training-library',
      active: location.pathname.includes('/training-library'),
      visible: isManager()
    },
    {
      key: 'teams',
      label: t('nav.teams'),
      icon: '👥',
      path: '/teams',
      active: location.pathname === '/teams' || location.pathname.includes('/team/')
    },
    {
      key: 'chats',
      label: 'Chats',
      icon: '💬',
      path: '/chats',
      active: location.pathname.includes('/chat')
    },
    {
      key: 'notifications',
      label: 'Notifications',
      icon: '🔔',
      path: '/notifications',
      active: location.pathname === '/notifications',
      badge: unreadCount > 0 ? unreadCount : null
    },
    {
      key: 'profile',
      label: t('userMenu.profile'),
      icon: '👤',
      hasSubmenu: true,
      submenu: [
        { label: 'Profile', path: '/profile', icon: '📋' },
        { label: 'Change Password', path: '/change-password', icon: '🔒' },
        { label: 'Language', path: '/language', icon: '🌐' },
        { label: 'Support', path: '/support', icon: '💬' },
        { label: 'Feedback', path: '/feedback', icon: '📝' }
      ],
      active: ['/profile', '/change-password', '/language', '/support', '/feedback'].includes(location.pathname)
    },
    {
      key: 'pending-requests',
      label: t('nav.joinRequest'),
      icon: '📨',
      path: '/pending-requests',
      active: location.pathname === '/pending-requests',
      visible: isManager()
    },
    {
      key: 'admin',
      label: 'Admin Panel',
      icon: '👑',
      path: '/admin',
      active: location.pathname.includes('/admin'),
      visible: isUserAdmin
    }
  ];

  const visibleMenuItems = menuItems.filter(item => item.visible !== false);

  return (
    <>
      {/* Mobile ONLY: Thin line with circular button (< 768px) */}
      <div className="md:hidden fixed left-0 top-0 bottom-0 z-[60] pointer-events-none">
        {/* Thin vertical line (1-2mm wide) */}
        <div className="w-[6px] h-full bg-gradient-to-b from-primary/70 via-accent/70 to-primary/70"></div>
      </div>
      
      {/* Circular bubble button - small, gentle, ~4mm diameter */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden fixed w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-full shadow-[0_8px_24px_rgba(255,51,102,0.7)] flex items-center justify-center text-white active:scale-90 transition-transform duration-200 z-[65]"
        aria-label="Open menu"
        style={{ 
          top: '50%',
          left: '1px',
          transform: 'translateY(-50%)'
        }}
      >
        <svg 
          className="w-5 h-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          strokeWidth="2.5"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M4 6h16M4 12h16M4 18h16" 
          />
        </svg>
      </button>

      {/* Mobile ONLY: Semi-transparent overlay when menu is open */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] animate-fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar - Slides out on mobile, always visible on desktop */}
      <aside
        className={`
          fixed top-0 bottom-0 z-[50] bg-dark border-r border-white/10
          transition-all duration-300 ease-in-out
          w-64 flex flex-col
          ${isMobileOpen ? 'left-0' : '-left-64'}
          md:left-0
        `}
      >
        {/* Header */}
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-4 flex-shrink-0">
          <Link to="/" className="flex items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              NEXUS
            </h1>
          </Link>
          
          {/* Mobile close button (only on small screens) */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-light transition"
          >
            ✕
          </button>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white text-sm">
              {(user.username || user.email).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-light truncate">{user.username || user.email}</p>
              <p className="text-xs text-light/60 capitalize">{user.role}</p>
            </div>
          </div>
        </div>

        {/* Navigation - Native scroll with custom styling */}
        <nav 
          className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 min-h-0"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain'
          }}
        >
          <div className="space-y-1">
            {visibleMenuItems.map((item) => (
              <div key={item.key}>
                {/* Main menu item */}
                {item.hasSubmenu ? (
                  <button
                    onClick={() => toggleSubmenu(item.key)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2.5 rounded-lg
                      text-sm font-medium transition-all
                      ${item.active
                        ? 'bg-primary text-white'
                        : 'text-light/80 hover:bg-white/10 hover:text-light'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    <span className={`text-xs transition-transform ${expandedMenu === item.key ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </button>
                ) : (
                  <Link
                    to={item.path}
                    className={`
                      flex items-center justify-between px-3 py-2.5 rounded-lg
                      text-sm font-medium transition-all
                      ${item.active
                        ? 'bg-primary text-white'
                        : 'text-light/80 hover:bg-white/10 hover:text-light'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="min-w-[20px] h-5 px-1.5 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </Link>
                )}

                {/* Submenu */}
                {item.hasSubmenu && (
                  <div
                    className={`
                      overflow-hidden transition-all duration-300
                      ${expandedMenu === item.key ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
                    `}
                  >
                    <div className="pl-4 pt-1 space-y-1">
                      {item.submenu.map((subItem) => (
                        <Link
                          key={subItem.path}
                          to={subItem.path}
                          className={`
                            flex items-center gap-3 px-3 py-2 rounded-lg
                            text-sm transition-all
                            ${location.pathname === subItem.path
                              ? 'bg-primary/20 text-primary'
                              : 'text-light/70 hover:bg-white/5 hover:text-light'
                            }
                          `}
                        >
                          <span className="text-base">{subItem.icon}</span>
                          <span>{subItem.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-white/10 flex-shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
              text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
          >
            <span className="text-lg">🚪</span>
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

