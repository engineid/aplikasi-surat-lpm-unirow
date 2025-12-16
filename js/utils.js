// =====================================================
// UTILITY FUNCTIONS
// =====================================================

import { BULAN_ROMAWI, BULAN_INDONESIA } from './config.js'

/**
 * Format date to Indonesian format (DD/MM/YYYY)
 */
export function formatDate(dateString) {
  if (!dateString) return '-'
  
  const date = new Date(dateString)
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date) {
  if (!date) return ''
  
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * Get bulan romawi from date
 */
export function getBulanRomawi(date) {
  const d = new Date(date)
  const month = d.getMonth() + 1
  return BULAN_ROMAWI[month]
}

/**
 * Get tahun from date
 */
export function getTahun(date) {
  const d = new Date(date)
  return d.getFullYear().toString()
}

/**
 * Format time ago (relative time)
 */
export function formatTimeAgo(timestamp) {
  if (!timestamp) return '-'
  
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Baru saja'
  if (diffMins < 60) return `${diffMins} menit lalu`
  if (diffHours < 24) return `${diffHours} jam lalu`
  if (diffDays < 7) return `${diffDays} hari lalu`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu lalu`
  
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Highlight search term in text
 */
export function highlightText(text, search) {
  if (!search) return escapeHtml(text)
  
  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escapedSearch})`, 'gi')
  return escapeHtml(text).replace(regex, '<strong>$1</strong>')
}

/**
 * Show toast notification
 */
export function showToast(message, type = 'info') {
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.textContent = message
  
  document.body.appendChild(toast)
  
  // Animate in
  setTimeout(() => toast.classList.add('show'), 10)
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

/**
 * Confirm dialog
 */
export function confirmDialog(message) {
  return confirm(message)
}

/**
 * Show loading overlay
 */
export function showLoading() {
  const loading = document.createElement('div')
  loading.id = 'loading-overlay'
  loading.className = 'loading-overlay'
  loading.innerHTML = `
    <div class="loading-spinner"></div>
    <p>Memuat...</p>
  `
  document.body.appendChild(loading)
}

/**
 * Hide loading overlay
 */
export function hideLoading() {
  const loading = document.getElementById('loading-overlay')
  if (loading) {
    loading.remove()
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

/**
 * Generate range array
 */
export function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

/**
 * Get year options for filter (last 5 years)
 */
export function getYearOptions() {
  const currentYear = new Date().getFullYear()
  return range(currentYear - 4, currentYear).reverse()
}

/**
 * Export table to CSV
 */
export function exportToCSV(data, filename = 'export.csv') {
  if (!data || data.length === 0) {
    alert('Tidak ada data untuk di-export')
    return
  }
  
  // Get headers from first object
  const headers = Object.keys(data[0])
  
  // Create CSV content
  let csv = headers.join(',') + '\n'
  
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header] ?? ''
      // Escape quotes and wrap in quotes if contains comma
      return typeof value === 'string' && value.includes(',') 
        ? `"${value.replace(/"/g, '""')}"` 
        : value
    })
    csv += values.join(',') + '\n'
  })
  
  // Create download link
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Format number to Indonesian locale
 */
export function formatNumber(number) {
  return new Intl.NumberFormat('id-ID').format(number)
}

/**
 * Pad number with leading zeros
 */
export function padNumber(num, size = 3) {
  return String(num).padStart(size, '0')
}

/**
 * Get nama bulan from kode romawi
 */
export function getNamaBulan(kodeRomawi) {
  return BULAN_INDONESIA[kodeRomawi] || kodeRomawi
}

// =====================================================
// COPY TO CLIPBOARD (NEW)
// =====================================================

/**
 * Copy text to clipboard with notification
 */
export async function copyToClipboard(text, notificationText) {
  try {
    await navigator.clipboard.writeText(text)
    showCopyNotification(notificationText || 'Tersalin!')
    return true
  } catch (error) {
    console.error('Copy failed:', error)
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    showCopyNotification(notificationText || 'Tersalin!')
    return true
  }
}

/**
 * Show copy notification
 */
function showCopyNotification(text) {
  // Remove existing notification
  const existing = document.querySelector('.copy-notification')
  if (existing) existing.remove()
  
  // Create notification
  const notification = document.createElement('div')
  notification.className = 'copy-notification'
  notification.textContent = `✓ ${text}`
  document.body.appendChild(notification)
  
  // Show
  setTimeout(() => notification.classList.add('show'), 10)
  
  // Hide and remove
  setTimeout(() => {
    notification.classList.remove('show')
    setTimeout(() => notification.remove(), 300)
  }, 2000)
}
