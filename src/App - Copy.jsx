import React from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth, ROLES } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import DevHelper from './components/DevHelper';

import Register from './pages/Register';
import Login from './pages/Login';
import CompleteRegistration from './pages/CompleteRegistration';
import ClubsDashboard from './pages/ClubsDashboard';
import ClubManagement from './pages/ClubManagement';
import PendingRequests from './pages/PendingRequests';
import Teams from './pages/Teams';
import Team from './pages/Team';
import TeamStatistics from './pages/TeamStatistics';
import Calendar from './pages/Calendar';
import Event from './pages/Event';
import NewEvent from './pages/NewEvent';
import EditEvent from './pages/EditEvent';
import AdminUsers from './pages/AdminUsers';
import Profile from './pages/Profile';
import ChangePassword from './pages/ChangePassword';
import Support from './pages/Support';
import Feedback from './pages/Feedback';
import Language from './pages/Language';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-dark p-6">
          <div className="bg-red-50 border-2 border-red-200 text-red-800 p-6 rounded-lg max-w-lg">
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <pre className="text-sm bg-red-100 p-3 rounded mt-2 overflow-auto">
              {this.state.error?.message}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// User Dropdown Component
function UserDropdown({ user, logout }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const navigate = useNavigate();
  const dropdownRef = React.useRef(null);
  const { t } = useLanguage();

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLeaveNexus = () => {
    if (window.confirm('Are you sure you want to leave NEXUS? Your account will be deleted permanently.')) {
      // Remove user from all clubs/teams
      const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
      const updatedClubs = clubs.map(club => ({
        ...club,
        members: (club.members || []).filter(id => id !== user.id),
        trainers: (club.trainers || []).filter(id => id !== user.id),
        assistants: (club.assistants || []).filter(id => id !== user.id),
        teams: (club.teams || []).map(team => ({
          ...team,
          members: (team.members || []).filter(id => id !== user.id),
          trainers: (team.trainers || []).filter(id => id !== user.id),
          assistants: (team.assistants || []).filter(id => id !== user.id),
        }))
      }));
      localStorage.setItem('clubs', JSON.stringify(updatedClubs));

      // Remove user from users array
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const updatedUsers = users.filter(u => u.id !== user.id);
      localStorage.setItem('users', JSON.stringify(updatedUsers));

      // Logout and redirect
      logout();
      navigate('/login');
      alert('Your account has been deleted. Goodbye!');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white shadow-lg">
          {(user.displayName || user.username || user.email).charAt(0).toUpperCase()}
        </div>
        
        {/* User Info */}
        <div className="text-left">
          <div className="text-light font-semibold text-sm flex items-center gap-2">
            {user.displayName || user.username || user.email}
            {user.isSuperTrainer && (
              <span className="px-2 py-0.5 bg-gradient-to-r from-secondary to-warning text-dark text-xs font-bold rounded uppercase tracking-wide">
                ⭐ Owner
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs uppercase tracking-wider font-semibold ${
              user.role === ROLES.ADMIN ? 'text-error' :
              user.role === ROLES.TRAINER ? 'text-accent' :
              user.role === ROLES.ASSISTANT ? 'text-secondary' :
              user.role === ROLES.PARENT ? 'text-warning' :
              'text-light/60'
            }`}>
              {user.role === ROLES.ADMIN && '🛡️ '}
              {user.role === ROLES.TRAINER && '👨‍🏫 '}
              {user.role === ROLES.ASSISTANT && '🤝 '}
              {user.role === ROLES.PARENT && '👨‍👩‍👧 '}
              {user.role === ROLES.USER && '👤 '}
              {user.role}
            </span>
          </div>
        </div>

        {/* Dropdown Arrow */}
        <svg
          className={`w-4 h-4 text-light transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-mid-dark border border-white/20 rounded-lg shadow-2xl overflow-hidden z-50 animate-fade-in">
          <div className="py-2">
            {/* Profile */}
            <button
              onClick={() => {
                navigate('/profile');
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors flex items-center gap-3 text-light"
            >
              <span className="text-xl">👤</span>
              <div>
                <div className="font-medium">{t('userMenu.profile')}</div>
                <div className="text-xs text-light/60">{t('userMenu.profileDesc')}</div>
              </div>
            </button>

            {/* Change Password */}
            <button
              onClick={() => {
                navigate('/change-password');
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors flex items-center gap-3 text-light"
            >
              <span className="text-xl">🔒</span>
              <div>
                <div className="font-medium">{t('userMenu.changePassword')}</div>
                <div className="text-xs text-light/60">{t('userMenu.changePasswordDesc')}</div>
              </div>
            </button>

            {/* Language */}
            <button
              onClick={() => {
                navigate('/language');
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors flex items-center gap-3 text-light"
            >
              <span className="text-xl">🌍</span>
              <div>
                <div className="font-medium">{t('userMenu.language')}</div>
                <div className="text-xs text-light/60">{t('userMenu.languageDesc')}</div>
              </div>
            </button>

            <div className="my-1 border-t border-white/10"></div>

            {/* Support */}
            <button
              onClick={() => {
                navigate('/support');
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors flex items-center gap-3 text-light"
            >
              <span className="text-xl">💬</span>
              <div>
                <div className="font-medium">{t('userMenu.support')}</div>
                <div className="text-xs text-light/60">{t('userMenu.supportDesc')}</div>
              </div>
            </button>

            {/* Feedback */}
            <button
              onClick={() => {
                navigate('/feedback');
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors flex items-center gap-3 text-light"
            >
              <span className="text-xl">📝</span>
              <div>
                <div className="font-medium">{t('userMenu.feedback')}</div>
                <div className="text-xs text-light/60">{t('userMenu.feedbackDesc')}</div>
              </div>
            </button>

            <div className="my-1 border-t border-white/10"></div>

            {/* Logout */}
            <button
              onClick={() => {
                logout();
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors flex items-center gap-3 text-light"
            >
              <span className="text-xl">🚪</span>
              <div>
                <div className="font-medium">{t('userMenu.logout')}</div>
                <div className="text-xs text-light/60">{t('userMenu.logoutDesc')}</div>
              </div>
            </button>

            {/* Leave Nexus */}
            <button
              onClick={() => {
                setIsOpen(false);
                handleLeaveNexus();
              }}
              className="w-full text-left px-4 py-3 hover:bg-red-600/20 transition-colors flex items-center gap-3 text-red-400 hover:text-red-300"
            >
              <span className="text-xl">⚠️</span>
              <div>
                <div className="font-medium">{t('userMenu.leaveApp')}</div>
                <div className="text-xs text-red-400/60">{t('userMenu.leaveAppDesc')}</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Navigation() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const canManageClub = user && [ROLES.ADMIN, ROLES.TRAINER, ROLES.ASSISTANT].includes(user.role);

  return (
    <nav className="bg-dark border-b border-white/10 sticky top-0 z-40 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          <Link 
            to="/" 
            className="font-display text-4xl tracking-wider bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent hover:scale-105 transition-transform"
          >
            NEXUS
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {user && (
              <>
                <Link 
                  to="/teams" 
                  className="text-light/80 hover:text-primary font-medium uppercase text-sm tracking-wide transition-colors relative group"
                >
                  {t('nav.teams')}
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300"></span>
                </Link>
                
                <Link 
                  to="/calendar" 
                  className="text-light/80 hover:text-primary font-medium uppercase text-sm tracking-wide transition-colors relative group"
                >
                  {t('nav.calendar')}
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300"></span>
                </Link>

                {canManageClub && (
                  <>
                    <Link 
                      to="/club-management" 
                      className="text-light/80 hover:text-accent font-medium uppercase text-sm tracking-wide transition-colors relative group"
                    >
                      {t('nav.clubMgmt')}
                      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-accent group-hover:w-full transition-all duration-300"></span>
                    </Link>
                    
                    <Link 
                      to="/pending-requests" 
                      className="text-light/80 hover:text-warning font-medium uppercase text-sm tracking-wide transition-colors relative group"
                    >
                      {t('nav.requests')}
                      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-warning group-hover:w-full transition-all duration-300"></span>
                    </Link>
                  </>
                )}

                {user.role === ROLES.ADMIN && (
                  <Link 
                    to="/admin/users" 
                    className="text-light/80 hover:text-secondary font-medium uppercase text-sm tracking-wide transition-colors relative group"
                  >
                    {t('nav.admin')}
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-secondary group-hover:w-full transition-all duration-300"></span>
                  </Link>
                )}
              </>
            )}
          </div>

          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                {/* User Profile Dropdown */}
                <UserDropdown user={user} logout={logout} />
              </>
            ) : (
              <>
                <Link 
                  to="/login" 
                  className="px-5 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-all font-semibold text-sm uppercase tracking-wide"
                >
                  Login
                </Link>
                <Link 
                  to="/register" 
                  className="px-5 py-2 bg-white/5 hover:bg-white/10 text-light rounded-lg transition-colors text-sm font-medium"
                >
                  Register
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-light p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/10 animate-fade-in">
            {user ? (
              <div className="flex flex-col gap-3">
                {/* Mobile User Profile Card */}
                <div className="bg-white/5 rounded-lg p-4 mb-2 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white shadow-lg">
                      {(user.username || user.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-light font-semibold text-base flex items-center gap-2 flex-wrap">
                        {user.username || user.email}
                        {user.isSuperTrainer && (
                          <span className="px-2 py-0.5 bg-gradient-to-r from-secondary to-warning text-dark text-xs font-bold rounded uppercase">
                            ⭐ Owner
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs uppercase tracking-wider font-semibold ${
                          user.role === ROLES.ADMIN ? 'text-error' :
                          user.role === ROLES.TRAINER ? 'text-accent' :
                          user.role === ROLES.ASSISTANT ? 'text-secondary' :
                          user.role === ROLES.PARENT ? 'text-warning' :
                          'text-light/60'
                        }`}>
                          {user.role === ROLES.ADMIN && '🛡️ '}
                          {user.role === ROLES.TRAINER && '👨‍🏫 '}
                          {user.role === ROLES.ASSISTANT && '🤝 '}
                          {user.role === ROLES.PARENT && '👨‍👩‍👧 '}
                          {user.role === ROLES.USER && '👤 '}
                          {user.role}
                        </span>
                        {user.ownedClubIds && user.ownedClubIds.length > 0 && (
                          <span className="text-xs text-light/50">
                            • {user.ownedClubIds.length} {user.ownedClubIds.length === 1 ? 'Club' : 'Clubs'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile Navigation Links */}
                <Link to="/teams" className="text-light py-2 hover:text-primary transition-colors" onClick={() => setMobileMenuOpen(false)}>
                  Teams
                </Link>
                <Link to="/calendar" className="text-light py-2 hover:text-primary transition-colors" onClick={() => setMobileMenuOpen(false)}>
                  Calendar
                </Link>
                {canManageClub && (
                  <>
                    <Link to="/club-management" className="text-light py-2 hover:text-accent transition-colors" onClick={() => setMobileMenuOpen(false)}>
                      Club Management
                    </Link>
                    <Link to="/pending-requests" className="text-light py-2 hover:text-warning transition-colors" onClick={() => setMobileMenuOpen(false)}>
                      Pending Requests
                    </Link>
                  </>
                )}
                {user.role === ROLES.ADMIN && (
                  <Link to="/admin/users" className="text-light py-2 hover:text-secondary transition-colors" onClick={() => setMobileMenuOpen(false)}>
                    Admin Panel
                  </Link>
                )}
                <button onClick={logout} className="text-left text-light py-2 hover:text-red-400 transition-colors">
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Link to="/login" className="btn-primary text-center" onClick={() => setMobileMenuOpen(false)}>
                  Login
                </Link>
                <Link to="/register" className="text-center py-2 bg-white/5 text-light rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                  Register
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

function AppContent() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-dark">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-dark via-mid-dark to-dark"></div>
        <div className="absolute top-[-50%] right-[-50%] w-full h-full bg-primary/10 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-[-50%] left-[-50%] w-full h-full bg-accent/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      <ErrorBoundary>
        <Navigation />
      </ErrorBoundary>

      {user?.role === ROLES.ADMIN && <DevHelper />}

      <main className="relative z-10 container mx-auto px-4 py-8">
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/complete-registration" element={<CompleteRegistration />} />

          <Route path="/" element={<ProtectedRoute><ClubsDashboard /></ProtectedRoute>} />
          <Route path="/club/:id" element={<ProtectedRoute><ClubManagement /></ProtectedRoute>} />
          <Route path="/club-management" element={<ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.TRAINER, ROLES.ASSISTANT]}><ClubManagement /></ProtectedRoute>} />
          <Route path="/pending-requests" element={<ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.TRAINER, ROLES.ASSISTANT]}><PendingRequests /></ProtectedRoute>} />
          
          <Route path="/teams" element={<ProtectedRoute><Teams /></ProtectedRoute>} />
          <Route path="/teams/:id" element={<ProtectedRoute><Team /></ProtectedRoute>} />
          <Route path="/teams/:id/statistics" element={<ProtectedRoute><TeamStatistics /></ProtectedRoute>} />
          
          <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
          <Route path="/events/:id" element={<ProtectedRoute><Event /></ProtectedRoute>} />
          <Route path="/events/:id/edit" element={<ProtectedRoute><EditEvent /></ProtectedRoute>} />
          <Route path="/events/new" element={<ProtectedRoute><NewEvent /></ProtectedRoute>} />
          
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
          <Route path="/language" element={<ProtectedRoute><Language /></ProtectedRoute>} />
          <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
          <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
          
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]}><AdminUsers /></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
