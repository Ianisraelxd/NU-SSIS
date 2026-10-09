import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import { Loading, ToastProvider } from './components/ui.jsx'
import { AuthProvider, useAuth } from './lib/auth.jsx'
import Login from './pages/Login.jsx'
import Settings from './pages/Settings.jsx'
import StudentAccount from './pages/student/Account.jsx'
import StudentClearance from './pages/student/Clearance.jsx'
import StudentDocuments from './pages/student/Documents.jsx'
import StudentEnrollment from './pages/student/Enrollment.jsx'
import StudentGrades from './pages/student/Grades.jsx'
import StudentHome from './pages/student/Home.jsx'
import StudentSchedule from './pages/student/Schedule.jsx'
import StudentSubjects from './pages/student/Subjects.jsx'
import StudentTasks from './pages/student/Tasks.jsx'
import StudentTracker from './pages/student/Tracker.jsx'
import RegistrarClearance from './pages/registrar/Clearance.jsx'
import RegistrarHome from './pages/registrar/Home.jsx'
import RegistrarQueue from './pages/registrar/Queue.jsx'
import RegistrarReports from './pages/registrar/Reports.jsx'
import RegistrarRequests from './pages/registrar/Requests.jsx'

const STUDENT_NAV = [
  { to: '', label: 'Home' },
  { to: 'subjects', label: 'Subjects' },
  { to: 'tasks', label: 'Pending Tasks' },
  { to: 'schedule', label: 'Schedule' },
  { to: 'tracker', label: 'Academic Tracker' },
]
const STUDENT_NAV_2 = [
  { to: 'grades', label: 'Grades per Semester' },
  { to: 'enrollment', label: 'Enrollment' },
  { to: 'clearance', label: 'E-Clearance' },
  { to: 'documents', label: 'Documents and Forms' },
  { to: 'account', label: 'Account Summary' },
]
const REGISTRAR_NAV = [
  { to: '', label: 'Home' },
  { to: 'queue', label: 'Queue Management' },
  { to: 'requests', label: 'Document Requests' },
  { to: 'clearance', label: 'Clearance Status' },
  { to: 'reports', label: 'Reports' },
]

function Guard({ role, children }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <Loading />
  if (!user) return <Navigate to={role === 'registrar' ? '/registrar/login' : '/login'} state={{ from: location.pathname }} replace />
  if (user.role !== role) return <Navigate to={user.role === 'registrar' ? '/registrar' : '/'} replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login role="student" />} />
      <Route path="/registrar/login" element={<Login role="registrar" />} />

      <Route
        path="/"
        element={
          <Guard role="student">
            <Layout kind="SIS" brandName="Student Information System" base="" nav={STUDENT_NAV} secondaryNav={STUDENT_NAV_2} />
          </Guard>
        }
      >
        <Route index element={<StudentHome />} />
        <Route path="subjects" element={<StudentSubjects />} />
        <Route path="tasks" element={<StudentTasks />} />
        <Route path="schedule" element={<StudentSchedule />} />
        <Route path="tracker" element={<StudentTracker />} />
        <Route path="grades" element={<StudentGrades />} />
        <Route path="enrollment" element={<StudentEnrollment />} />
        <Route path="clearance" element={<StudentClearance />} />
        <Route path="documents" element={<StudentDocuments />} />
        <Route path="account" element={<StudentAccount />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route
        path="/registrar"
        element={
          <Guard role="registrar">
            <Layout kind="RIS" brandName={'Registrar and Records\nInformation System'} base="/registrar" nav={REGISTRAR_NAV} />
          </Guard>
        }
      >
        <Route index element={<RegistrarHome />} />
        <Route path="queue" element={<RegistrarQueue />} />
        <Route path="requests" element={<RegistrarRequests />} />
        <Route path="clearance" element={<RegistrarClearance />} />
        <Route path="reports" element={<RegistrarReports />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
