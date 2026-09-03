import React from 'react'

export default function NotificationToast({ toast }) {
  if (!toast) return null

  const typeConfig = {
    success: {
      bg: 'bg-emerald-600 border-emerald-700',
      icon: '✅',
    },
    error: {
      bg: 'bg-rose-600 border-rose-700',
      icon: '⚠️',
    },
    info: {
      bg: 'bg-blue-600 border-blue-700',
      icon: '📱',
    },
  }

  const current = typeConfig[toast.type] || typeConfig.info

  return (
    <div
      className={`fixed bottom-6 right-6 text-white px-4 py-3.5 rounded-xl shadow-2xl text-sm max-w-md border transition-all duration-300 z-50 flex items-start gap-2.5 ${current.bg}`}
      role="alert"
    >
      <span className="text-base leading-none">{current.icon}</span>
      <div className="flex-1 font-medium leading-snug">{toast.message}</div>
    </div>
  )
}
