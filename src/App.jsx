import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import LoadingBar from './components/LoadingBar.jsx'
import Layout from './components/Layout.jsx'
import StaffQueue from './components/StaffQueue.jsx'
import { ConfirmProvider, Loading, ToastProvider } from './components/ui.jsx'
import { FEATURES } from './config.js'
import { AuthProvider, useAuth } from './lib/auth.jsx'
import { RealtimeProvider } from './lib/realtime.jsx'
import Login, { HOME } from './pages/Login.jsx'
const MessagesPage = lazy(() => import('./pages/MessagesPage.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
// student
const StudentAccount = lazy(() => import('./pages/student/Account.jsx'))
const StudentClearance = lazy(() => import('./pages/student/Clearance.jsx'))
const StudentDocuments = lazy(() => import('./pages/student/Documents.jsx'))
const StudentEnrollment = lazy(() => import('./pages/student/Enrollment.jsx'))
const StudentGrades = lazy(() => import('./pages/student/Grades.jsx'))
const StudentHome = lazy(() => import('./pages/student/Home.jsx'))
const StudentQueue = lazy(() => import('./pages/student/Queue.jsx'))
const StudentSchedule = lazy(() => import('./pages/student/Schedule.jsx'))
const StudentSubjects = lazy(() => import('./pages/student/Subjects.jsx'))
const StudentTasks = lazy(() => import('./pages/student/Tasks.jsx'))
const StudentTaskDetail = lazy(() => import('./pages/student/TaskDetail.jsx'))
const StudentTodo = lazy(() => import('./pages/student/Todo.jsx'))
const StudentTracker = lazy(() => import('./pages/student/Tracker.jsx'))
// registrar
const RegistrarClearance = lazy(() => import('./pages/registrar/Clearance.jsx'))
const RegistrarEnrollment = lazy(() => import('./pages/registrar/Enrollment.jsx'))
const RegistrarGrades = lazy(() => import('./pages/registrar/Grades.jsx'))
const RegistrarHome = lazy(() => import('./pages/registrar/Home.jsx'))
const RegistrarReports = lazy(() => import('./pages/registrar/Reports.jsx'))
const RegistrarRequests = lazy(() => import('./pages/registrar/Requests.jsx'))
const RegistrarStudents = lazy(() => import('./pages/registrar/Students.jsx'))
const RegistrarSubjects = lazy(() => import('./pages/registrar/Subjects.jsx'))
// cashier
const CashierDocuments = lazy(() => import('./pages/cashier/Documents.jsx'))
const CashierHome = lazy(() => import('./pages/cashier/Home.jsx'))
const CashierReports = lazy(() => import('./pages/cashier/Reports.jsx'))
const CashierStudents = lazy(() => import('./pages/cashier/Students.jsx'))
// department
const DepartmentClearance = lazy(() => import('./pages/department/Clearance.jsx'))
const DepartmentEnrollment = lazy(() => import('./pages/department/Enrollment.jsx'))
const DepartmentHome = lazy(() => import('./pages/department/Home.jsx'))
const DepartmentStudents = lazy(() => import('./pages/department/Students.jsx'))
// admin
const AdminAnnouncements = lazy(() => import('./pages/admin/Announcements.jsx'))
const AdminLoginAttempts = lazy(() => import('./pages/admin/LoginAttempts.jsx'))
const AdminAudit = lazy(() => import('./pages/admin/Audit.jsx'))
const AdminDepartments = lazy(() => import('./pages/admin/Departments.jsx'))
const AdminHome = lazy(() => import('./pages/admin/Home.jsx'))
const AdminPermissions = lazy(() => import('./pages/admin/Permissions.jsx'))
const AdminReports = lazy(() => import('./pages/admin/Reports.jsx'))
const AdminSystemSettings = lazy(() => import('./pages/admin/SystemSettings.jsx'))
const AdminUsers = lazy(() => import('./pages/admin/Users.jsx'))
// optional LMS extras (ENABLE_LMS)
const TeacherActivities = lazy(() => import('./pages/teacher/Activities.jsx'))
const TeacherActivityDetail = lazy(() => import('./pages/teacher/ActivityDetail.jsx'))
const TeacherHome = lazy(() => import('./pages/teacher/Home.jsx'))

const STUDENT_NAV = [
  { to: '', label: 'Home' },
  { to: 'subjects', label: 'Subjects' },
  { to: 'tasks', label: 'Pending Tasks' },
  { to: 'schedule', label: 'Schedule' },
  { to: 'tracker', label: 'Academic Tracker' },
  { to: 'queue', label: 'Digital Queue' },
  ...(FEATURES.lms ? [{ to: 'messages', label: 'Messages' }] : []),
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
  { to: 'enrollment', label: 'Enrollment' },
  { to: 'students', label: 'Student Records' },
  { to: 'subjects', label: 'Subjects & Schedules' },
  { to: 'grades', label: 'Grades' },
  { to: 'clearance', label: 'Clearance Status' },
  { to: 'reports', label: 'Reports' },
]
const CASHIER_NAV = [
  { to: '', label: 'Home' },
  { to: 'queue', label: 'Queue Management' },
  { to: 'students', label: 'Students & Balances' },
  { to: 'documents', label: 'Document Payments' },
  { to: 'reports', label: 'Reports' },
]
const DEPARTMENT_NAV = [
  { to: '', label: 'Home' },
  { to: 'queue', label: 'Queue Management' },
  { to: 'students', label: 'Students' },
  { to: 'enrollment', label: 'Enrollment Review' },
  { to: 'clearance', label: 'Clearance' },
]
const ADMIN_NAV = [
  { to: '', label: 'Home' },
  { to: 'users', label: 'User Accounts' },
  { to: 'departments', label: 'Departments & Programs' },
  { to: 'announcements', label: 'Announcements' },
  { to: 'reports', label: 'Reports' },
  { to: 'audit', label: 'Audit Log' },
  { to: 'login-attempts', label: 'Login Attempts' },
  { to: 'permissions', label: 'Roles & Permissions' },
  { to: 'system', label: 'System Settings' },
]
const TEACHER_NAV = [
  { to: '', label: 'Home' },
  { to: 'activities', label: 'Activities' },
  { to: 'messages', label: 'Messages' },
]

const LOGIN = { student: '/login', registrar: '/registrar/login', cashier: '/cashier/login', department: '/department/login', admin: '/admin/login', teacher: '/teacher/login' }

function Guard({ role, children }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <Loading />
  if (!user) return <Navigate to={LOGIN[role]} state={{ from: location.pathname + location.search }} replace />
  if (user.role !== role) return <Navigate to={HOME[user.role]} replace />
  return children
}

const moduleRoute = (role, layout, children) => (
  <Route path={HOME[role]} element={<Guard role={role}>{layout}</Guard>}>
    {children}
  </Route>
)

function AppRoutes() {
  return (
    <Routes>
      {['student', 'registrar', 'cashier', 'department', 'admin'].map((role) => (
        <Route key={role} path={LOGIN[role]} element={<Login role={role} />} />
      ))}
      {FEATURES.lms && <Route path="/teacher/login" element={<Login role="teacher" />} />}

      {moduleRoute(
        'student',
        <Layout kind="SIS" brandName="Student Services Information System" base="" nav={STUDENT_NAV} secondaryNav={STUDENT_NAV_2} />,
        <>
          <Route index element={<StudentHome />} />
          <Route path="subjects" element={<StudentSubjects />} />
          <Route path="tasks" element={FEATURES.lms ? <StudentTasks /> : <StudentTodo />} />
          {FEATURES.lms && <Route path="tasks/:id" element={<StudentTaskDetail />} />}
          {FEATURES.lms && <Route path="messages" element={<MessagesPage />} />}
          <Route path="schedule" element={<StudentSchedule />} />
          <Route path="tracker" element={<StudentTracker />} />
          <Route path="queue" element={<StudentQueue />} />
          <Route path="grades" element={<StudentGrades />} />
          <Route path="enrollment" element={<StudentEnrollment />} />
          <Route path="clearance" element={<StudentClearance />} />
          <Route path="documents" element={<StudentDocuments />} />
          <Route path="account" element={<StudentAccount />} />
          <Route path="settings" element={<Settings />} />
        </>,
      )}

      {moduleRoute(
        'registrar',
        <Layout kind="RIS" brandName={'Registrar and Records\nInformation System'} base="/registrar" nav={REGISTRAR_NAV} />,
        <>
          <Route index element={<RegistrarHome />} />
          <Route path="queue" element={<StaffQueue />} />
          <Route path="requests" element={<RegistrarRequests />} />
          <Route path="enrollment" element={<RegistrarEnrollment />} />
          <Route path="students" element={<RegistrarStudents />} />
          <Route path="subjects" element={<RegistrarSubjects />} />
          <Route path="grades" element={<RegistrarGrades />} />
          <Route path="clearance" element={<RegistrarClearance />} />
          <Route path="reports" element={<RegistrarReports />} />
          <Route path="settings" element={<Settings />} />
        </>,
      )}

      {moduleRoute(
        'cashier',
        <Layout kind="SIS" logoClass="logo-tint-cashier" brandName="Cashier Module" base="/cashier" nav={CASHIER_NAV} />,
        <>
          <Route index element={<CashierHome />} />
          <Route path="queue" element={<StaffQueue />} />
          <Route path="students" element={<CashierStudents />} />
          <Route path="documents" element={<CashierDocuments />} />
          <Route path="reports" element={<CashierReports />} />
          <Route path="settings" element={<Settings />} />
        </>,
      )}

      {moduleRoute(
        'department',
        <Layout kind="SIS" logoClass="logo-tint-department" brandName="Department Module" base="/department" nav={DEPARTMENT_NAV} />,
        <>
          <Route index element={<DepartmentHome />} />
          <Route path="queue" element={<StaffQueue />} />
          <Route path="students" element={<DepartmentStudents />} />
          <Route path="enrollment" element={<DepartmentEnrollment />} />
          <Route path="clearance" element={<DepartmentClearance />} />
          <Route path="settings" element={<Settings />} />
        </>,
      )}

      {moduleRoute(
        'admin',
        <Layout kind="SIS" logoClass="logo-tint-admin" brandName="Admin Module" base="/admin" nav={ADMIN_NAV} />,
        <>
          <Route index element={<AdminHome />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="departments" element={<AdminDepartments />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="login-attempts" element={<AdminLoginAttempts />} />
          <Route path="permissions" element={<AdminPermissions />} />
          <Route path="system" element={<AdminSystemSettings />} />
          <Route path="settings" element={<Settings />} />
        </>,
      )}

      {FEATURES.lms &&
        moduleRoute(
          'teacher',
          <Layout kind="SIS" logoClass="logo-tint-fis" brandName="Faculty Portal" base="/teacher" nav={TEACHER_NAV} />,
          <>
            <Route index element={<TeacherHome />} />
            <Route path="activities" element={<TeacherActivities />} />
            <Route path="activities/:id" element={<TeacherActivityDetail />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="settings" element={<Settings />} />
          </>,
        )}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RealtimeProvider>
          <ToastProvider>
            <ConfirmProvider>
              <LoadingBar />
              <AppRoutes />
            </ConfirmProvider>
          </ToastProvider>
        </RealtimeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
