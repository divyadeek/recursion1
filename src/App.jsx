import React, { useState, useEffect, useCallback } from 'react'
import LoginForm from './components/LoginForm.jsx'
import RegisterForm from './components/RegisterForm.jsx'
import GrievanceForm from './components/GrievanceForm.jsx'
import AdminDashboard from './components/AdminDashboard.jsx'
import NotificationToast from './components/NotificationToast.jsx'
import { getMe } from './services/api.js'

export default function App() {
  const [view, setView] = useState(localStorage.getItem('token') ? 'loading' : 'login')
  const [user, setUser] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setView('login')
      return
    }
    getMe()
      .then((res) => {
        setUser(res.data)
        setView(res.data.role === 'admin' ? 'admin' : 'citizen')
      })
      .catch(() => {
        localStorage.removeItem('token')
        setView('login')
      })
  }, [])

  const handleAuthSuccess = (role) => {
    getMe().then((res) => {
      setUser(res.data)
      setView(role === 'admin' ? 'admin' : 'citizen')
    })
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    setUser(null)
    setView('login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-brand-700 text-white px-6 py-4 flex items-center justify-between shadow">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">🏛️ Citizen Grievance Portal</h1>
          <span className="text-xs bg-brand-600 px-2 py-0.5 rounded text-blue-100">AI-Powered</span>
        </div>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-right sm:text-left">
              <span className="opacity-95 font-medium">{user.phone}</span>
              {user.aadhar_number && (
                <span className="text-xs bg-brand-800/80 text-blue-100 px-2 py-0.5 rounded font-mono">
                  🪪 {user.aadhar_number}
                </span>
              )}
              <span className="uppercase font-bold text-[11px] tracking-wider bg-brand-900 text-brand-100 px-2 py-0.5 rounded w-fit self-end sm:self-auto">
                {user.role}
              </span>
            </div>
            <button
              onClick={logout}
              className="bg-brand-600 hover:bg-brand-500 px-3 py-1.5 rounded-lg transition font-medium cursor-pointer shadow-xs"
            >
              Logout
            </button>
          </div>
        )}
      </header>

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {view === 'loading' && <p className="text-center text-gray-500 mt-10">Loading…</p>}

        {view === 'login' && (
          <LoginForm
            onSuccess={handleAuthSuccess}
            onSwitchToRegister={() => setView('register')}
            showToast={showToast}
          />
        )}

        {view === 'register' && (
          <RegisterForm
            onSuccess={handleAuthSuccess}
            onSwitchToLogin={() => setView('login')}
            showToast={showToast}
          />
        )}

        {view === 'citizen' && <GrievanceForm showToast={showToast} />}

        {view === 'admin' && <AdminDashboard showToast={showToast} />}
      </main>

      <NotificationToast toast={toast} />
    </div>
  )
}
