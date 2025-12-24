// src/components/Sidebar.jsx
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../hooks/usePermissions';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isUserAdmin = useIsAdmin();
  
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState(null);

  // Check if user is manager (admin, trainer, or assistant)
  const isManager = () => {
    if (!user) return false;
    return isUserAdmin || ['trainer', 'assistant'].includes(user.role);
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

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
      label: 'My Clubs',
      icon: '🏠',
      path: '/',
      active: location.pathname === '/'
    },
    {
      key: 'club-management',
      label: 'Club Management',
      icon: '⚙️',
      path: '/club-management',
      active: location.pathname.includes('/club-management') || location.pathname.includes('/club/'),
      visible: isManager()
    },
    {
      key: 'calendar',
      label: 'Calendar',
      icon: '📅',
      path: '/calendar',
      active: location.pathname === '/calendar'
    },
    {
      key: 'teams',
      label: 'Teams',
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
      key: 'profile',
      label: 'My Account',
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
      label: 'Join Requests',
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
      {/* Mobile: Thin line with bubble button (only on small screens) */}
      <div className="md:hidden fixed left-0 top-0 bottom-0 z-40">
        {/* Thin line */}
        <div className="w-1 h-full bg-gradient-to-b from-primary via-accent to-primary"></div>
        
        {/* Bubble button */}
        <button
          onClick={() => setIsMobileOpen(true)}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 -ml-0.5 bg-gradient-to-br from-primary to-accent rounded-full shadow-lg flex items-center justify-center text-white text-xs transform hover:scale-110 transition-transform"
        >
          ☰
        </button>
      </div>

      {/* Mobile: Overlay (only on small screens) */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 bottom-0 z-50 bg-dark border-r border-white/10
          transition-all duration-300 ease-in-out
          w-64
          ${isMobileOpen ? 'left-0' : '-left-64'}
          md:left-0
        `}
      >
        {/* Header */}
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-4">
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
        <div className="p-4 border-b border-white/10">
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

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
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
                      flex items-center gap-3 px-3 py-2.5 rounded-lg
                      text-sm font-medium transition-all
                      ${item.active
                        ? 'bg-primary text-white'
                        : 'text-light/80 hover:bg-white/10 hover:text-light'
                      }
                    `}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
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
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
              text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
          >
            <span className="text-lg">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

