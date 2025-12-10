import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Register from './pages/Register';
import Login from './pages/Login';
import VerifyEmail from './pages/VerifyEmail';
import CompleteRegistration from './pages/CompleteRegistration';
import ClubsDashboard from './pages/ClubsDashboard';
import ClubManagement from './pages/ClubManagement';
import Calendar from './pages/Calendar';
import NewEvent from './pages/NewEvent';
import EditEvent from './pages/EditEvent';
import Event from './pages/Event';
import Team from './pages/Team';
import Teams from './pages/Teams';
import TeamStatistics from './pages/TeamStatistics';
import Profile from './pages/Profile';
import ChangePassword from './pages/ChangePassword';
import Language from './pages/Language';
import Support from './pages/Support';
import Feedback from './pages/Feedback';
import PendingRequests from './pages/PendingRequests';
import AdminDashboard from './pages/AdminDashboard';
import FirebaseDiagnostic from './components/FirebaseDiagnostic';
import AuthAction from './pages/AuthAction';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import SubscriptionManager from './components/SubscriptionManager';
import VoucherGenerator from './components/VoucherGenerator';
import { ChatProvider } from './contexts/ChatContext';
import Chats from './pages/Chats';
import ChatRoom from './pages/ChatRoom';

function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <LanguageProvider>
          <ToastProvider>  {/* ✅ ADD THIS - Wrap with ToastProvider if not already */}
            <ChatProvider>
              <NotificationProvider>  {/* ✅ ADD THIS - New wrapper for notifications */}
                <div className="min-h-screen bg-gradient-to-br from-dark via-mid-dark to-dark">
                  <Navbar />
                  <main className="relative z-10 container mx-auto px-4 py-8">
                    <Routes>
                      {/* Public Routes */}
                      <Route path="/register" element={<Register />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/verify-email" element={<VerifyEmail />} />
                      <Route path="/complete-registration" element={<CompleteRegistration />} />
                      <Route path="/auth-action" element={<AuthAction />} />

                      {/* Protected Routes */}
                      <Route
                        path="/"
                        element={
                          <ProtectedRoute>
                            <ClubsDashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/club/:clubId"
                        element={
                          <ProtectedRoute>
                            <ClubManagement />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/club-management"
                        element={
                          <ProtectedRoute>
                            <ClubManagement />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/calendar"
                        element={
                          <ProtectedRoute>
                            <Calendar />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/new-event"
                        element={
                          <ProtectedRoute>
                            <NewEvent />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/edit-event/:eventId"
                        element={
                          <ProtectedRoute>
                            <EditEvent />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/event/:eventId"
                        element={
                          <ProtectedRoute>
                            <Event />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/teams"
                        element={
                          <ProtectedRoute>
                            <Teams />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/team/:clubId/:teamId"
                        element={
                          <ProtectedRoute>
                            <Team />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/team/:clubId/:teamId/statistics"
                        element={
                          <ProtectedRoute>
                            <TeamStatistics />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/profile"
                        element={
                          <ProtectedRoute>
                            <Profile />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/change-password"
                        element={
                          <ProtectedRoute>
                            <ChangePassword />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/language"
                        element={
                          <ProtectedRoute>
                            <Language />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/support"
                        element={
                          <ProtectedRoute>
                            <Support />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/feedback"
                        element={
                          <ProtectedRoute>
                            <Feedback />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/pending-requests"
                        element={
                          <ProtectedRoute>
                            <PendingRequests />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin"
                        element={
                          <ProtectedRoute>
                            <AdminDashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/diagnostic"
                        element={
                          <ProtectedRoute>
                            <FirebaseDiagnostic />
                          </ProtectedRoute>
                        }
                      />
                      <Route 
                        path="/admin/subscriptions" 
                        element={
                          <ProtectedRoute requiredRole="admin">
                            <SubscriptionManager />
                          </ProtectedRoute>
                        } 
                      />

                      <Route 
                        path="/admin/vouchers" 
                        element={
                          <ProtectedRoute requiredRole="admin">
                            <VoucherGenerator />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/chats" 
                        element={
                          <ProtectedRoute>
                            <Chats />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/chat/:chatId" 
                        element={
                          <ProtectedRoute>
                            <ChatRoom />
                          </ProtectedRoute>
                        } 
                      />

                      {/* Catch all - redirect to home */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </main>
                </div>
              </NotificationProvider>  {/* ✅ CLOSE NotificationProvider */}
            </ChatProvider>
          </ToastProvider>  {/* ✅ CLOSE ToastProvider */}
        </LanguageProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

export default App;
