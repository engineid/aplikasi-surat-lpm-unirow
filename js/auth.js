// =====================================================
// AUTHENTICATION MODULE
// =====================================================

import { supabase } from './config.js'

/**
 * Check if user is authenticated
 * Redirect to login if not authenticated
 */
export async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    // Cek apakah sudah di halaman login, jangan redirect lagi
    if (!window.location.pathname.includes('index.html')) {
      window.location.href = 'index.html'
    }
    return null
  }
  
  return session.user
}

/**
 * Login with email and password
 */
export async function login(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })
    
    if (error) throw error
    
    // Update last login
    await updateLastLogin(email)
    
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Logout current user
 */
export async function logout() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    
    localStorage.removeItem('rememberMe')
    window.location.href = 'index.html'
  } catch (error) {
    console.error('Logout error:', error)
    alert('Terjadi kesalahan saat logout')
  }
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * Get current session
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/**
 * Update last login timestamp
 */
async function updateLastLogin(email) {
  try {
    await supabase
      .from('admin')
      .update({ last_login: new Date().toISOString() })
      .eq('email', email)
  } catch (error) {
    console.error('Error updating last login:', error)
  }
}

/**
 * Check if remember me is enabled
 */
export function isRememberMeEnabled() {
  return localStorage.getItem('rememberMe') === 'true'
}

/**
 * Set remember me
 */
export function setRememberMe(value) {
  if (value) {
    localStorage.setItem('rememberMe', 'true')
  } else {
    localStorage.removeItem('rememberMe')
  }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })
}
