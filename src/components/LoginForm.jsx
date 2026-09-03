import React, { useState } from 'react'
import { login } from '../services/api.js'
import { isValidPhone, isValidAadhar, formatAadhar } from '../utils/validators.js'

export default function LoginForm({ onSuccess, onSwitchToRegister, showToast }) {
  const [loginMethod, setLoginMethod] = useState('phone') // 'phone' | 'aadhar'
  const [phone, setPhone] = useState('')
  const [aadhar, setAadhar] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAadharChange = (e) => {
    const formatted = formatAadhar(e.target.value)
    setAadhar(formatted)
  }

  const handleDemoFill = (demoPhone, demoAadhar, demoPass) => {
    if (loginMethod === 'phone') {
      setPhone(demoPhone)
    } else {
      setAadhar(demoAadhar)
    }
    setPassword(demoPass)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (loginMethod === 'phone') {
      if (!isValidPhone(phone)) {
        setError('Please enter a valid phone number (10-15 digits).')
        return
      }
    } else {
      if (!isValidAadhar(aadhar)) {
        setError('Please enter a valid 12-digit Aadhaar number.')
        return
      }
    }

    if (!password) {
      setError('Password is required.')
      return
    }

    setLoading(true)
    try {
      const payload = loginMethod === 'phone' ? { phone, password } : { aadhar, password }
      const res = await login(payload)
      localStorage.setItem('token', res.data.access_token)
      localStorage.setItem('role', res.data.role)
      showToast('Logged in successfully')
      onSuccess(res.data.role)
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8 sm:mt-12 bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Sign in</h2>
        <p className="text-sm text-gray-500 mt-1">Citizen & Administrator Portal</p>
      </div>

      {/* Dual Login Options: Aadhaar vs Phone Number */}
      <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
        <button
          type="button"
          onClick={() => {
            setLoginMethod('phone')
            setError('')
          }}
          className={`flex-1 py-2.5 px-3 text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
            loginMethod === 'phone'
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span>📱</span>
          <span>Phone Number</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setLoginMethod('aadhar')
            setError('')
          }}
          className={`flex-1 py-2.5 px-3 text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
            loginMethod === 'aadhar'
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span>🪪</span>
          <span>Aadhaar Number</span>
        </button>
      </div>

      {/* Quick Demo Fill Buttons for Preview Testing */}
      <div className="bg-brand-50/70 border border-brand-200 rounded-xl p-3.5 mb-6 text-xs text-brand-950">
        <p className="font-semibold mb-2 flex items-center justify-between">
          <span>Seed Accounts (Pass: Password123)</span>
          <span className="text-[11px] text-brand-700 font-medium">Click to fill</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleDemoFill('+919876543220', '9999 8888 7777', 'Password123')}
            className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-medium transition cursor-pointer"
          >
            👮 Admin {loginMethod === 'phone' ? '(+919876543220)' : '(9999 8888 7777)'}
          </button>
          <button
            type="button"
            onClick={() => handleDemoFill('+919876543210', '2345 6789 0123', 'Password123')}
            className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium transition cursor-pointer"
          >
            👤 Priya {loginMethod === 'phone' ? '(+919876543210)' : '(2345 6789 0123)'}
          </button>
          <button
            type="button"
            onClick={() => handleDemoFill('+919876543211', '3456 7890 1234', 'Password123')}
            className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium transition cursor-pointer"
          >
            👤 Arun {loginMethod === 'phone' ? '(+919876543211)' : '(3456 7890 1234)'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {loginMethod === 'phone' ? (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white shadow-xs"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              12-Digit Aadhaar Number
            </label>
            <input
              type="text"
              value={aadhar}
              onChange={handleAadharChange}
              placeholder="XXXX XXXX XXXX (e.g. 2345 6789 0123)"
              maxLength={14}
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white shadow-xs tracking-wider font-mono"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white shadow-xs"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition cursor-pointer shadow-xs text-sm mt-2"
        >
          {loading ? 'Signing in…' : loginMethod === 'phone' ? 'Sign in with Phone' : 'Sign in with Aadhaar'}
        </button>
      </form>

      <p className="text-sm text-gray-500 mt-5 text-center">
        Don't have an account?{' '}
        <button onClick={onSwitchToRegister} className="text-brand-600 font-semibold hover:underline">
          Register
        </button>
      </p>
    </div>
  )
}
