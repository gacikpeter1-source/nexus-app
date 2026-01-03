import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';

// Page imports
import Register from './pages/Register';
import Login from './pages/Login';
import VerifyEmail from './pages/VerifyEmail';
import CompleteRegistration from './pages/CompleteRegistration';
import AuthAction from './pages/AuthAction';
import ClubsDashboard from './pages/ClubsDashboard';
import ClubManagement from './pages/ClubManagement';
import Calendar from './pages/Calendar';
import NewEvent from './pages/NewEvent';
import EditEvent from './pages/EditEvent';
import Event from './pages/Event';
import TrainingLibrary from './pages/TrainingLibrary';
import TrainingForm from './pages/TrainingForm';
import TrainingDetail from './pages/TrainingDetail';
import Team from './pages/Team';
import Teams from './pages/Teams';
import TeamStatistics from './pages/TeamStatistics';
import TeamAttendance from './pages/TeamAttendance';
import Profile from './pages/Profile';
import ChangePassword from './pages/ChangePassword';
import Language from './pages/Language';
import Support from './pages/Support';
import Feedback from './pages/Feedback';
import PendingRequests from './pages/PendingRequests';
import AdminDashboard from './pages/AdminDashboard';
import Chats from './pages/Chats';
import ChatRoom from './pages/ChatRoom';
import AttendanceEntry from './pages/AttendanceEntry';
import ParentDashboard from './pages/ParentDashboard';
import SubscriptionApprovals from './pages/SubscriptionApprovals';
import Notifications from './pages/Notifications';

// Component imports
import FirebaseDiagnostic from './components/FirebaseDiagnostic';
import SubscriptionManager from './components/SubscriptionManager';
import VoucherGenerator from './components/VoucherGenerator';
import PermissionTest from './pages/PermissionTest';

function App() {
  // ✅ NO PROVIDERS HERE - They're all in main.jsx now
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-mid-dark to-dark">
      <Sidebar />
      {/* Main content with padding for sidebar */}
      <main className="relative z-10 md:ml-64 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 ml-4 md:ml-0">
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
                        path="/training-library"
                        element={
                          <ProtectedRoute>
                            <TrainingLibrary />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/training-library/new"
                        element={
                          <ProtectedRoute>
                            <TrainingForm />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/training-library/:id"
                        element={
                          <ProtectedRoute>
                            <TrainingDetail />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/training-library/:id/edit"
                        element={
                          <ProtectedRoute>
                            <TrainingForm />
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
                        path="/team/:clubId/:teamId/attendance"
                        element={
                          <ProtectedRoute>
                            <AttendanceEntry />
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
                        path="/team/:clubId/:teamId/attendance-stats"
                        element={
                          <ProtectedRoute>
                            <TeamAttendance />
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
                        path="/parent-dashboard"
                        element={
                          <ProtectedRoute>
                            <ParentDashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/subscription-approvals"
                        element={
                          <ProtectedRoute>
                            <SubscriptionApprovals />
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
                        path="/test-permissions"
                        element={
                          <ProtectedRoute>
                            <PermissionTest />
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
                      <Route 
                        path="/notifications" 
                        element={
                          <ProtectedRoute>
                            <Notifications />
                          </ProtectedRoute>
                        } 
                      />

                  {/* Catch all - redirect to home */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
