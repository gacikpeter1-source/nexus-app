// src/components/Sidebar.jsx
import { useState, useEffect, useRef } from 'react';
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
  
  // Drag-to-scroll state
  const [menuOffset, setMenuOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [dragVelocity, setDragVelocity] = useState(0);
  const [lastMoveTime, setLastMoveTime] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  
  // Refs for drag-to-scroll
  const navContainerRef = useRef(null);
  const navContentRef = useRef(null);

  // Check if user is manager (admin, trainer, or assistant)
  const isManager = () => {
    if (!user) return false;
    return isUserAdmin || ['trainer', 'assistant'].includes(user.role);
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Calculate container and content heights for drag boundaries
  useEffect(() => {
    const updateHeights = () => {
      if (navContainerRef.current && navContentRef.current) {
        const container = navContainerRef.current.clientHeight;
        const content = navContentRef.current.scrollHeight;
        setContainerHeight(container);
        setContentHeight(content);
      }
    };
    
    updateHeights();
    window.addEventListener('resize', updateHeights);
    
    // Also update when menu items change (expand/collapse)
    const timer = setTimeout(updateHeights, 300);
    
    return () => {
      window.removeEventListener('resize', updateHeights);
      clearTimeout(timer);
    };
  }, [expandedMenu]);

  // Calculate max scroll distance
  const maxScroll = Math.max(0, contentHeight - containerHeight);

  // Touch/Mouse start handler
  const handleDragStart = (clientY) => {
    setIsDragging(true);
    setStartY(clientY);
    setLastMoveTime(Date.now());
  };

  // Touch/Mouse move handler
  const handleDragMove = (clientY) => {
    if (!isDragging) return;
    
    const currentTime = Date.now();
    const deltaY = clientY - startY;
    const timeDelta = currentTime - lastMoveTime;
    
    // Calculate velocity for momentum
    if (timeDelta > 0) {
      setDragVelocity(deltaY / timeDelta);
    }
    
    let newOffset = menuOffset + deltaY;
    
    // Add resistance when dragging beyond boundaries
    if (newOffset > 0) {
      newOffset = newOffset * 0.3; // Resistance at top
    } else if (newOffset < -maxScroll) {
      newOffset = -maxScroll + (newOffset + maxScroll) * 0.3; // Resistance at bottom
    }
    
    setMenuOffset(newOffset);
    setStartY(clientY);
    setLastMoveTime(currentTime);
  };

  // Touch/Mouse end handler
  const handleDragEnd = () => {
    setIsDragging(false);
    
    // Apply momentum if dragging fast enough
    if (Math.abs(dragVelocity) > 0.5) {
      const momentumOffset = menuOffset + (dragVelocity * 100);
      const boundedOffset = Math.max(Math.min(momentumOffset, 0), -maxScroll);
      setMenuOffset(boundedOffset);
    } else {
      // Snap back to boundaries if over-scrolled
      if (menuOffset > 0) {
        setMenuOffset(0);
      } else if (menuOffset < -maxScroll) {
        setMenuOffset(-maxScroll);
      }
    }
    
    setDragVelocity(0);
  };

  // Touch event handlers
  const handleTouchStart = (e) => {
    // Only handle if touching the nav area, not on buttons
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
    handleDragStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    e.preventDefault(); // Prevent default scroll
    handleDragMove(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Mouse event handlers (desktop support)
  const handleMouseDown = (e) => {
    // Only handle if clicking the nav area, not on buttons
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
    handleDragStart(e.clientY);
  };

  // Global mouse event listeners (for drag)
  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e) => {
        if (!isDragging) return;
        handleDragMove(e.clientY);
      };

      const handleMouseUp = () => {
        handleDragEnd();
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, menuOffset]);

  // Mouse wheel scroll support (desktop)
  useEffect(() => {
    const navContainer = navContainerRef.current;
    if (!navContainer) return;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const scrollAmount = e.deltaY;
      const maxScroll = Math.max(0, contentHeight - containerHeight);
      
      setMenuOffset(prevOffset => {
        let newOffset = prevOffset - scrollAmount;
        newOffset = Math.max(Math.min(newOffset, 0), -maxScroll);
        return newOffset;
      });
    };

    navContainer.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      navContainer.removeEventListener('wheel', handleWheel);
    };
  }, [contentHeight, containerHeight]);

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
      key: 'training-library',
      label: 'Training Library',
      icon: '📚',
      path: '/training-library',
      active: location.pathname.includes('/training-library'),
      visible: isManager()
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

        {/* Navigation - Drag-to-scroll (mobile) + Mouse wheel (desktop) */}
        <div className="flex-1 relative overflow-hidden">
          {/* Scroll indicator - Top fade */}
          {menuOffset < 0 && (
            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-dark to-transparent pointer-events-none z-10" />
          )}
          
          <nav 
            ref={navContainerRef}
            className="h-full overflow-hidden py-4 px-2"
            style={{ 
              cursor: isDragging ? 'grabbing' : 'default',
              userSelect: isDragging ? 'none' : 'auto'
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
          >
            <div 
              ref={navContentRef}
              className="space-y-1 transition-transform"
              style={{ 
                transform: `translateY(${menuOffset}px)`,
                transition: isDragging ? 'none' : 'transform 0.3s ease-out'
              }}
            >
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
        
        {/* Scroll indicator - Bottom fade */}
        {menuOffset > -(Math.max(0, contentHeight - containerHeight)) && contentHeight > containerHeight && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-dark to-transparent pointer-events-none z-10" />
        )}
      </div>

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

