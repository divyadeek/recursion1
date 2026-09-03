// src/utils/validators.js
export function isValidPhone(phone) {
  return /^\+?[0-9]{10,15}$/.test(phone)
}

export function isValidAadhar(aadhar) {
  if (!aadhar) return false
  const cleaned = aadhar.replace(/[\s-]/g, '')
  return /^[0-9]{12}$/.test(cleaned)
}

export function formatAadhar(value) {
  const digits = value.replace(/\D/g, '').slice(0, 12)
  const parts = []
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4))
  }
  return parts.join(' ')
}

export function isValidPassword(password) {
  return password.length >= 8
}

export function isValidComplaintText(text) {
  const trimmed = text.trim()
  return trimmed.length >= 20 && trimmed.length <= 2000
}

export const VALID_COMPLAINT_EXAMPLE =
  'There has been a broken water pipe on MG Road near the bus stop for 3 days, causing flooding.'

export const INVALID_COMPLAINT_EXAMPLES = [
  'water problem',
  'fix it',
  'My neighbor stole my bicycle yesterday.',
]
