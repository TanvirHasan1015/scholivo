import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { Navbar } from '@/components/common/Navbar'
import { Footer } from '@/components/common/Footer'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

// Public Pages
import Landing from '@/pages/Landing'
import Login from '@/pages/auth/Login'
import StudentSignup from '@/pages/auth/StudentSignup'
import ProfessorSignup from '@/pages/auth/ProfessorSignup'
import Search from '@/pages/search/Search'
import ProfessorProfile from '@/pages/professor/ProfessorProfile'
import NotFound from '@/pages/NotFound'

// Protected Pages
import StudentDashboard from '@/pages/student/StudentDashboard'
import StudentProfile from '@/pages/student/StudentProfile'
import SavedProfessors from '@/pages/student/SavedProfessors'
import Apply from '@/pages/application/Apply'
import ApplicationDetail from '@/pages/application/ApplicationDetail'
import ProfessorDashboard from '@/pages/professor/ProfessorDashboard'
import ManagePositions from '@/pages/professor/ManagePositions'
import ProfessorProfileEdit from '@/pages/professor/ProfessorProfileEdit'
import Messages from '@/pages/messaging/Messages'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-500/20 selection:text-blue-900">
          <Navbar />
          
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup/student" element={<StudentSignup />} />
              <Route path="/signup/professor" element={<ProfessorSignup />} />
              <Route path="/search" element={<Search />} />
              <Route path="/professor/:username" element={<ProfessorProfile />} />

              {/* Student Routes */}
              <Route element={<ProtectedRoute allowedRoles={['student']} />}>
                <Route path="/dashboard/student" element={<StudentDashboard />} />
                <Route path="/profile/student" element={<StudentProfile />} />
                <Route path="/saved" element={<SavedProfessors />} />
                <Route path="/apply/:positionId" element={<Apply />} />
              </Route>

              {/* Professor Routes */}
              <Route element={<ProtectedRoute allowedRoles={['professor']} />}>
                <Route path="/dashboard/professor" element={<ProfessorDashboard />} />
                <Route path="/positions/manage" element={<ManagePositions />} />
                <Route path="/profile/professor/edit" element={<ProfessorProfileEdit />} />
              </Route>

              {/* Shared Protected Routes (both student & professor) */}
              <Route element={<ProtectedRoute allowedRoles={['student', 'professor']} />}>
                <Route path="/applications/:applicationId" element={<ApplicationDetail />} />
                <Route path="/messages" element={<Messages />} />
              </Route>

              {/* 404 Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>

          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
