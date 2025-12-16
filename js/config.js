const SUPABASE_CONFIG = {
  url: 'https://avqvxwonvxaaypwswnhn.supabase.co',        // ← GANTI INI
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cXZ4d29udnhhYXlwd3N3bmhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0Mzk2NzksImV4cCI6MjA4MTAxNTY3OX0.k5Jbf5FY-j3oT2m6afVzyxFBloUtwcsmbHv-ofcoxkY' // ← GANTI INI
}

const { createClient } = window.supabase
export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)

export const APP_CONFIG = {
  name: 'Aplikasi Surat LPM UNIROW',
  version: '1.0.0',
  itemsPerPage: 20,
  minSearchChars: 2,
  debounceDelay: 300,
  recentTujuanLimit: 5,
  searchTujuanLimit: 10
}

export const BULAN_ROMAWI = {
  1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI',
  7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII'
}

export const BULAN_INDONESIA = {
  'I': 'Januari', 'II': 'Februari', 'III': 'Maret', 'IV': 'April',
  'V': 'Mei', 'VI': 'Juni', 'VII': 'Juli', 'VIII': 'Agustus',
  'IX': 'September', 'X': 'Oktober', 'XI': 'November', 'XII': 'Desember'
}

export default { supabase, APP_CONFIG, BULAN_ROMAWI, BULAN_INDONESIA }
