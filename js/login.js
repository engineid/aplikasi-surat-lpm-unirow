// =====================================================
// LOGIN PAGE LOGIC - FIXED
// =====================================================

import { login, setRememberMe } from './auth.js'
import { supabase } from './config.js'

// Wait for Supabase and DOM to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForSupabase)
} else {
  waitForSupabase()
}

function waitForSupabase() {
  // Check if window.supabase is available
  if (typeof window.supabase === 'undefined') {
    console.log('Waiting for Supabase...')
    setTimeout(waitForSupabase, 100)
    return
  }
  
  console.log('Supabase ready, initializing login...')
  initLogin()
}

function initLogin() {
  // Check if already logged in
  checkIfLoggedIn()
  
  // Setup event listeners
  setupLoginListeners()
}

async function checkIfLoggedIn() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session) {
      // Already logged in, redirect
      window.location.href = 'dashboard.html'
      return
    }
  } catch (error) {
    console.log('Not logged in')
  }
}

function setupLoginListeners() {
  // Handle login form submission
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    
    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value
    const remember = document.getElementById('remember').checked
    
    // Validate
    if (!email || !password) {
      showError('Email dan password harus diisi')
      return
    }
    
    // Disable form
    const submitBtn = e.target.querySelector('button[type="submit"]')
    const originalText = submitBtn.textContent
    submitBtn.disabled = true
    submitBtn.textContent = 'Loading...'
    hideError()
    
    try {
      const result = await login(email, password)
      
      if (result.success) {
        // Save remember me
        setRememberMe(remember)
        
        // Redirect to dashboard
        window.location.href = 'dashboard.html'
      } else {
        showError('Login gagal: ' + result.error)
        submitBtn.disabled = false
        submitBtn.textContent = originalText
      }
    } catch (error) {
      showError('Terjadi kesalahan: ' + error.message)
      submitBtn.disabled = false
      submitBtn.textContent = originalText
    }
  })
  
  // Hide error on input
  document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', hideError)
  })
  
  // Handle Enter key
  document.getElementById('password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('loginForm').dispatchEvent(new Event('submit'))
    }
  })
}

// Helper functions
function showError(message) {
  const errorDiv = document.getElementById('errorMessage')
  errorDiv.textContent = message
  errorDiv.style.display = 'block'
}

function hideError() {
  const errorDiv = document.getElementById('errorMessage')
  errorDiv.style.display = 'none'
}
