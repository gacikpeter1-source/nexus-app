// src/components/Navbar.jsx - WITH CLUB MGMT LINK
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isDropdownOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Check if user is manager (admin, trainer, or assistant)
  const isManager = () => {
    return user && (isAdmin() || user.role === 'trainer' || user.role === 'assistant');
  };

  // Don't show navbar on public pages
  const isPublicPage = ['/login', '/register', '/verify-email'].includes(location.pathname);

  if (isPublicPage) {
    return (
      <nav className="bg-dark border-b border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                NEXUS
              </h1>
            </Link>

            {/* Right side - Login/Register buttons */}
            <div className="flex items-center gap-4">
              <Link
                to="/login"
                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-medium"
              >
                LOGIN
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 border border-primary text-primary hover:bg-primary hover:text-white rounded-lg transition font-medium"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Logged in navbar
  if (!user) return null;

  return (
    <nav className="bg-dark border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              NEXUS
            </h1>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className={`text-sm font-medium transition ${
                location.pathname === '/'
                  ? 'text-primary'
                  : 'text-light/80 hover:text-light'
              }`}
            >
              🏠 Dashboard
            </Link>
            {isManager() && (
              <Link
                to="/club-management"
                className={`text-sm font-medium transition ${
                  location.pathname.includes('/club')
                    ? 'text-primary'
                    : 'text-light/80 hover:text-light'
                }`}
              >
                🏢 CLUB MGMT
              </Link>
            )}
            <Link
              to="/calendar"
              className={`text-sm font-medium transition ${
                location.pathname === '/calendar'
                  ? 'text-primary'
                  : 'text-light/80 hover:text-light'
              }`}
            >
              📅 Calendar
            </Link>
            <Link
              to="/teams"
              className={`text-sm font-medium transition ${
                location.pathname === '/teams'
                  ? 'text-primary'
                  : 'text-light/80 hover:text-light'
              }`}
            >
              ⚽ Teams
            </Link>
            {isAdmin() && (
              <Link
                to="/admin"
                className={`text-sm font-medium transition ${
                  location.pathname === '/admin'
                    ? 'text-primary'
                    : 'text-light/80 hover:text-light'
                }`}
              >
                👑 Admin
              </Link>
            )}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            {/* User Info */}
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-light">{user.username || user.email}</p>
              <p className="text-xs text-light/60 capitalize">{user.role}</p>
            </div>

            {/* User Avatar with Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white hover:shadow-lg transition-shadow"
              >
                {(user.username || user.email).charAt(0).toUpperCase()}
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-mid-dark rounded-lg shadow-xl border border-white/10 z-50">
                  <div className="py-2">
                    <Link
                      to="/"
                      onClick={() => setIsDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-light hover:bg-white/5 transition"
                    >
                      🏠 My Clubs
                    </Link>
                    <div className="border-t border-white/10 my-2"></div>
                    <Link
                      to="/profile"
                      onClick={() => setIsDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-light hover:bg-white/5 transition"
                    >
                      👤 Profile
                    </Link>
                    <Link
                      to="/language"
                      onClick={() => setIsDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-light hover:bg-white/5 transition"
                    >
                      🌐 Language
                    </Link>
                    <Link
                      to="/support"
                      onClick={() => setIsDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-light hover:bg-white/5 transition"
                    >
                      💬 Support
                    </Link>
                    <Link
                      to="/feedback"
                      onClick={() => setIsDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-light hover:bg-white/5 transition"
                    >
                      📝 Feedback
                    </Link>
                    <div className="border-t border-white/10 my-2"></div>
                    <Link
                      to="/change-password"
                      onClick={() => setIsDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-yellow-400 hover:bg-white/5 transition"
                    >
                      🔑 Change Password
                    </Link>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 transition"
                    >
                      🚪 Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
