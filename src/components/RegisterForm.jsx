import React, { useState } from 'react'
import { sendOtp, verifyOtp, register } from '../services/api.js'
import { isValidPhone, isValidPassword, isValidAadhar, formatAadhar } from '../utils/validators.js'

// Three-step flow: (1) enter phone -> send OTP, (2) verify OTP, (3) set password -> register.
export default function RegisterForm({ onSuccess, onSwitchToLogin, showToast }) {
  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [aadhar, setAadhar] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    if (!isValidPhone(phone)) {
      setError('Enter a valid phone number (10-15 digits).')
      return
    }
    setLoading(true)
    try {
      await sendOtp(phone)
      showToast('OTP sent to your phone')
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not send OTP.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    if (otp.length !== 6) {
      setError('OTP must be 6 digits.')
      return
    }
    setLoading(true)
    try {
      await verifyOtp(phone, otp)
      showToast('Phone verified successfully')
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.detail || 'OTP verification failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')

    if (aadhar && !isValidAadhar(aadhar)) {
      setError('Please enter a valid 12-digit Aadhaar number, or leave it blank.')
      return
    }
    if (!isValidPassword(password)) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const res = await register(phone, password, aadhar)
      localStorage.setItem('token', res.data.access_token)
      localStorage.setItem('role', res.data.role)
      showToast('Account created successfully')
      onSuccess(res.data.role)
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8 sm:mt-12 bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Create an account</h2>
      <p className="text-sm text-gray-500 mb-6 font-medium">Step {step} of 3</p>

      {step === 1 && (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white shadow-xs"
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition cursor-pointer shadow-xs text-sm"
          >
            {loading ? 'Sending…' : 'Send OTP'}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 font-medium">
            ℹ️ In demo mode, use OTP <span className="font-bold">123456</span>.
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Enter 6-Digit OTP</label>
            <input
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 tracking-widest text-center focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono text-xl bg-white shadow-xs"
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition cursor-pointer shadow-xs text-sm"
          >
            {loading ? 'Verifying…' : 'Verify OTP'}
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              12-Digit Aadhaar Number <span className="text-xs font-normal text-gray-400">(Optional)</span>
            </label>
            <input
              type="text"
              value={aadhar}
              onChange={(e) => setAadhar(formatAadhar(e.target.value))}
              placeholder="XXXX XXXX XXXX"
              maxLength={14}
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono tracking-wider bg-white shadow-xs"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white shadow-xs"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white shadow-xs"
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition cursor-pointer shadow-xs text-sm"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      )}

      <p className="text-sm text-gray-500 mt-5 text-center">
        Already have an account?{' '}
        <button onClick={onSwitchToLogin} className="text-brand-600 font-semibold hover:underline">
          Sign in
        </button>
      </p>
    </div>
  )
}
