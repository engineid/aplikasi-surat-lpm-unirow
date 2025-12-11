// =====================================================
// DASHBOARD LOGIC
// =====================================================

import { logout } from './auth.js'
import { supabase } from './config.js'  // ← PENTING: Import supabase!
import {
  getJenisSurat,
  getSuratList,
  getSurat,
  createSurat,
  updateSurat,
  deleteSurat,
  checkNomorExists,
  getNextNomorUrut,
  getGapNomor,
  getDashboardStats,
  exportSuratCSV
} from './surat.js'
import { initAutocomplete } from './autocomplete.js'
import {
  formatDate,
  formatDateISO,
  getBulanRomawi,
  getTahun,
  showToast,
  confirmDialog,
  showLoading,
  hideLoading,
  exportToCSV,
  getYearOptions,
  padNumber,
  getNamaBulan,
  debounce,
  copyToClipboard
} from './utils.js'

// Global state
let currentUser = null
let jenisSuratList = []
let currentPage = 1
let currentFilters = {
  tahun: '',
  bulan: '',
  jenis: '',
  search: ''
}
let tujuanAutocomplete = null
let editingId = null

// Chart instances (NEW)
let chartPerBulan = null
let chartPerJenis = null
let deleteId = null

// =====================================================
// CHART FUNCTIONS
// =====================================================

async function loadCharts() {
  try {
    await Promise.all([
      loadChartPerBulan(),
      loadChartPerJenis()
    ])
  } catch (error) {
    console.error('Error loading charts:', error)
  }
}

async function loadChartPerBulan() {
  try {
    const currentYear = new Date().getFullYear()
    
    const { data, error } = await supabase
      .from('surat_keluar')
      .select('tanggal_surat')
      .gte('tanggal_surat', `${currentYear}-01-01`)
      .lte('tanggal_surat', `${currentYear}-12-31`)
    
    if (error) throw error
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 
                    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    const counts = new Array(12).fill(0)
    
    if (data) {
      data.forEach(item => {
        const month = new Date(item.tanggal_surat).getMonth()
        counts[month]++
      })
    }
    
    if (chartPerBulan) chartPerBulan.destroy()
    
    const ctx = document.getElementById('chartPerBulan')
    if (!ctx) return
    
    chartPerBulan = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: 'Jumlah Surat',
          data: counts,
          backgroundColor: '#2563eb',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => 'Jumlah: ' + context.parsed.y + ' surat'
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, precision: 0 }
          }
        }
      }
    })
  } catch (error) {
    console.error('Chart per bulan error:', error)
  }
}

async function loadChartPerJenis() {
  try {
    const { data, error } = await supabase
      .from('surat_keluar')
      .select('jenis_surat')
    
    if (error) throw error
    
    const jenisCounts = {}
    if (data) {
      data.forEach(item => {
        jenisCounts[item.jenis_surat] = (jenisCounts[item.jenis_surat] || 0) + 1
      })
    }
    
    const labels = Object.keys(jenisCounts)
    const values = Object.values(jenisCounts)
    const colors = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#ec4899']
    
    if (chartPerJenis) chartPerJenis.destroy()
    
    const ctx = document.getElementById('chartPerJenis')
    if (!ctx) return
    
    chartPerJenis = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, labels.length)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed
                const total = context.dataset.data.reduce((a, b) => a + b, 0)
                const pct = ((value / total) * 100).toFixed(1)
                return `${context.label}: ${value} surat (${pct}%)`
              }
            }
          }
        }
      }
    })
  } catch (error) {
    console.error('Chart per jenis error:', error)
  }
}

// Initialize dashboard - Wait for Supabase to load
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
  
  console.log('Supabase ready, initializing dashboard...')
  init()
}

async function init() {
  // Check authentication (direct, prevent redirect loop)
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (!session || error) {
      window.location.href = 'index.html'
      return
    }
    
    currentUser = session.user
    console.log('User logged in:', currentUser.email)
    
  } catch (error) {
    console.error('Auth error:', error)
    window.location.href = 'index.html'
    return
  }
  
  // Display user name
  displayUserName()
  
  // Load initial data
  await Promise.all([
    loadJenisSurat(),
    loadDashboardStats(),
    loadCharts(),
    loadSuratList()
  ])
  
  // Setup event listeners
  setupEventListeners()
  
  // Setup filters
  setupFilters()
}

// Display user name in header
function displayUserName() {
  const userName = currentUser.email.split('@')[0]
  document.getElementById('userName').textContent = userName.charAt(0).toUpperCase() + userName.slice(1)
}

// Load jenis surat for dropdown
async function loadJenisSurat() {
  const result = await getJenisSurat()
  
  if (result.success) {
    jenisSuratList = result.data
    populateJenisSuratDropdown()
  } else {
    showToast('Gagal memuat jenis surat', 'error')
  }
}

// Populate jenis surat dropdown in form and filter
function populateJenisSuratDropdown() {
  // Form dropdown
  const formSelect = document.getElementById('jenisSurat')
  formSelect.innerHTML = '<option value="">Pilih Jenis Surat</option>'
  jenisSuratList.forEach(jenis => {
    const option = document.createElement('option')
    option.value = jenis.kode
    option.textContent = `${jenis.kode} - ${jenis.nama_jenis}`
    formSelect.appendChild(option)
  })
  
  // Filter dropdown
  const filterSelect = document.getElementById('filterJenis')
  jenisSuratList.forEach(jenis => {
    const option = document.createElement('option')
    option.value = jenis.kode
    option.textContent = `${jenis.kode} - ${jenis.nama_jenis}`
    filterSelect.appendChild(option)
  })
}

// Load dashboard statistics
async function loadDashboardStats() {
  const tahun = new Date().getFullYear().toString()
  const result = await getDashboardStats(tahun)
  
  if (result.success) {
    const stats = result.stats
    document.getElementById('totalSurat').textContent = stats.totalSurat || 0
    document.getElementById('suratBulanIni').textContent = stats.suratBulanIni || 0
    document.getElementById('gapNomor').textContent = stats.gapCount || 0
  }
}

// Load surat list with filters
async function loadSuratList(page = 1) {
  try {
    currentPage = page
    showLoading()
    
    // Get filters
    const tahun = document.getElementById('filterTahun').value
    const bulan = document.getElementById('filterBulan').value
    const jenis = document.getElementById('filterJenis').value
    const search = document.getElementById('searchInput').value.trim()
    const tanggalMulai = document.getElementById('filterTanggalMulai')?.value
    const tanggalSelesai = document.getElementById('filterTanggalSelesai')?.value
    
    // Build query
    let query = supabase
      .from('surat_keluar')
      .select('*', { count: 'exact' })
    
    if (tahun) query = query.eq('tahun', tahun)
    if (bulan) query = query.eq('bulan', bulan)
    if (jenis) query = query.eq('jenis_surat', jenis)
    
    // NEW: Date range filtering
    if (tanggalMulai) {
      query = query.gte('tanggal_surat', tanggalMulai)
    }
    if (tanggalSelesai) {
      query = query.lte('tanggal_surat', tanggalSelesai)
    }
    
    if (search) {
      query = query.or(`perihal.ilike.%${search}%,tujuan.ilike.%${search}%`)
    }
    
    // Pagination
    const from = (page - 1) * 20
    const to = from + 19
    query = query.range(from, to)
    
    // Order by date desc
    query = query.order('tanggal_surat', { ascending: false })
    
    const { data, error, count } = await query
    
    hideLoading()
    
    if (error) throw error
    
    const totalPages = Math.ceil((count || 0) / 20)
    
    renderSuratTable(data || [])
    renderPagination(page, totalPages)
    currentPage = page
    
  } catch (error) {
    console.error('Load surat list error:', error)
    hideLoading()
    showToast('Gagal memuat data surat', 'error')
    renderEmptyTable()
  }
}

// Render surat table
function renderSuratTable(data) {
  const tbody = document.getElementById('tableSuratBody')
  
  if (!data || data.length === 0) {
    renderEmptyTable()
    return
  }
  
  tbody.innerHTML = ''
  
  data.forEach((surat, index) => {
    const row = document.createElement('tr')
    const jenisKode = surat.jenis_surat?.kode || surat.jenis_surat
    
    row.innerHTML = `
      <td class="text-center">${(currentPage - 1) * 20 + index + 1}</td>
      <td>
        <span class="nomor-surat-copy" 
              data-nomor="${surat.nomor_lengkap}" 
              data-tanggal="${formatDate(surat.tanggal_surat)}"
              title="Klik untuk copy">
          ${surat.nomor_lengkap}
        </span>
      </td>
      <td>${formatDate(surat.tanggal_surat)}</td>
      <td class="text-center">${jenisKode}</td>
      <td>${surat.perihal}</td>
      <td>${surat.tujuan}</td>
      <td class="text-center">
  <button class="btn-icon btn-edit" 
          data-id="${surat.id}" 
          title="Edit Surat">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  </button>
  <button class="btn-icon btn-delete" 
          data-id="${surat.id}"
          data-nomor="${surat.nomor_lengkap}"
          data-perihal="${surat.perihal}"
          title="Hapus Surat">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <line x1="10" y1="11" x2="10" y2="17"/>
      <line x1="14" y1="11" x2="14" y2="17"/>
    </svg>
  </button>
</td>
    `
    tbody.appendChild(row)
  })
  
  // Add event listeners to action buttons
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => handleEdit(parseInt(e.target.closest('button').dataset.id)))
  })
  
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const button = e.target.closest('button')
      const id = parseInt(button.dataset.id)
      const nomor = button.dataset.nomor
      const perihal = button.dataset.perihal
      handleDeleteClick(id, nomor, perihal)
    })
  })
}

// Render empty table
function renderEmptyTable() {
  const tbody = document.getElementById('tableSuratBody')
  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="text-center">
        <p class="loading-text">Tidak ada data</p>
      </td>
    </tr>
  `
}

// Render pagination
function renderPagination(current, total) {
  const pagination = document.getElementById('pagination')
  
  if (total <= 1) {
    pagination.innerHTML = ''
    return
  }
  
  let html = ''
  
  // Previous button
  html += `<button ${current === 1 ? 'disabled' : ''} data-page="${current - 1}">« Prev</button>`
  
  // Page numbers
  const maxButtons = 5
  let startPage = Math.max(1, current - Math.floor(maxButtons / 2))
  let endPage = Math.min(total, startPage + maxButtons - 1)
  
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1)
  }
  
  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="${i === current ? 'active' : ''}" data-page="${i}">${i}</button>`
  }
  
  // Next button
  html += `<button ${current === total ? 'disabled' : ''} data-page="${current + 1}">Next »</button>`
  
  pagination.innerHTML = html
  
  // Add event listeners
  pagination.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!e.target.disabled) {
        loadSuratList(parseInt(e.target.dataset.page))
      }
    })
  })
}

// Setup event listeners
function setupEventListeners() {
  // Logout button
  const btnLogout = document.getElementById('btnLogout')
  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault()
      logout()
    })
  }
  
  // Tambah surat button
  const btnTambahSurat = document.getElementById('btnTambahSurat')
  if (btnTambahSurat) {
    btnTambahSurat.addEventListener('click', (e) => {
      e.preventDefault()
      openFormModal()
    })
  }
  
  // Export button
  const btnExport = document.getElementById('btnExport')
  if (btnExport) {
    btnExport.addEventListener('click', (e) => {
      e.preventDefault()
      handleExport()
    })
  }
  
  // Form submit
  const formSurat = document.getElementById('formSurat')
  if (formSurat) {
    formSurat.addEventListener('submit', handleFormSubmit)
  }
  
  // Modal close buttons
  const closeModalBtn = document.getElementById('closeModal')
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', (e) => {
      e.preventDefault()
      closeFormModal()
    })
  }
  
  const btnBatal = document.getElementById('btnBatal')
  if (btnBatal) {
    btnBatal.addEventListener('click', (e) => {
      e.preventDefault()
      closeFormModal()
    })
  }
  
  // Click outside modal to close
  const modalFormSurat = document.getElementById('modalFormSurat')
  if (modalFormSurat) {
    modalFormSurat.addEventListener('click', (e) => {
      if (e.target.id === 'modalFormSurat') {
        closeFormModal()
      }
    })
  }
  
  // Nomor urut change - check duplicate
  const nomorUrut = document.getElementById('nomorUrut')
  if (nomorUrut) {
    nomorUrut.addEventListener('input', debounce(checkDuplicate, 500))
    nomorUrut.addEventListener('input', updatePreview)
  }
  
  const suffix = document.getElementById('suffix')
  if (suffix) {
    suffix.addEventListener('input', debounce(checkDuplicate, 500))
    suffix.addEventListener('input', updatePreview)
  }
  
  // Tanggal change - update preview and suggestion
  const tanggalSurat = document.getElementById('tanggalSurat')
  if (tanggalSurat) {
    tanggalSurat.addEventListener('change', updatePreview)
  }
  
  const jenisSurat = document.getElementById('jenisSurat')
  if (jenisSurat) {
    jenisSurat.addEventListener('change', updatePreview)
  }
  
  // Filter changes
  const filterTahun = document.getElementById('filterTahun')
  if (filterTahun) {
    filterTahun.addEventListener('change', handleFilterChange)
  }
  
  const filterBulan = document.getElementById('filterBulan')
  if (filterBulan) {
    filterBulan.addEventListener('change', handleFilterChange)
  }
  
  const filterJenis = document.getElementById('filterJenis')
  if (filterJenis) {
    filterJenis.addEventListener('change', handleFilterChange)
  }
  
  const searchInput = document.getElementById('searchInput')
  if (searchInput) {
    searchInput.addEventListener('input', debounce(handleFilterChange, 500))
  }
  
  // NEW: Date range filters
  const filterTanggalMulai = document.getElementById('filterTanggalMulai')
  if (filterTanggalMulai) {
    filterTanggalMulai.addEventListener('change', () => loadSuratList(1))
  }
  
  const filterTanggalSelesai = document.getElementById('filterTanggalSelesai')
  if (filterTanggalSelesai) {
    filterTanggalSelesai.addEventListener('change', () => loadSuratList(1))
  }
  
  // NEW: Reset filter button
  const btnResetFilter = document.getElementById('btnResetFilter')
  if (btnResetFilter) {
    btnResetFilter.addEventListener('click', resetFilters)
  }
  
  // NEW: Delete modal buttons
  const btnCancelDelete = document.getElementById('btnCancelDelete')
  if (btnCancelDelete) {
    btnCancelDelete.addEventListener('click', closeDeleteModal)
  }
  
  const btnConfirmDelete = document.getElementById('btnConfirmDelete')
  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', confirmDelete)
  }
  
  // NEW: Copy on click (delegate to document)
  document.addEventListener('click', handleCopyClick)
  
  // NEW: Close delete modal on outside click
  window.addEventListener('click', (e) => {
    const modalDeleteConfirm = document.getElementById('modalDeleteConfirm')
    if (e.target === modalDeleteConfirm) {
      closeDeleteModal()
    }
  })
  
  console.log('✓ Event listeners setup complete')
}

// =====================================================
// NEW FUNCTIONS FOR IMPROVEMENTS
// =====================================================

// Reset all filters
function resetFilters() {
  document.getElementById('filterTahun').value = ''
  document.getElementById('filterBulan').value = ''
  document.getElementById('filterJenis').value = ''
  document.getElementById('filterTanggalMulai').value = ''
  document.getElementById('filterTanggalSelesai').value = ''
  document.getElementById('searchInput').value = ''
  currentFilters = { tahun: '', bulan: '', jenis: '', search: '' }
  loadSuratList(1)
}

// Handle copy on click
function handleCopyClick(e) {
  if (e.target.closest('.nomor-surat-copy')) {
    const element = e.target.closest('.nomor-surat-copy')
    const nomor = element.dataset.nomor
    const tanggal = element.dataset.tanggal
    const text = `${nomor}\nTanggal: ${tanggal}`
    copyToClipboard(text, 'Nomor surat tersalin!')
  }
}

// Handle delete button click (show modal)
function handleDeleteClick(id, nomorSurat, perihal) {
  deleteId = id
  
  const deleteDetail = document.getElementById('deleteDetail')
  if (deleteDetail) {
    deleteDetail.innerHTML = `
      <p><strong>Nomor:</strong> ${nomorSurat}</p>
      <p><strong>Perihal:</strong> ${perihal}</p>
    `
  }
  
  const modal = document.getElementById('modalDeleteConfirm')
  if (modal) {
    modal.classList.add('show')
  }
}

// Close delete modal
function closeDeleteModal() {
  const modal = document.getElementById('modalDeleteConfirm')
  if (modal) {
    modal.classList.remove('show')
  }
  deleteId = null
}

// Confirm delete
async function confirmDelete() {
  if (!deleteId) return
  
  const btn = document.getElementById('btnConfirmDelete')
  const originalText = btn.textContent
  btn.disabled = true
  btn.textContent = 'Menghapus...'
  
  try {
    const { error } = await supabase
      .from('surat_keluar')
      .delete()
      .eq('id', deleteId)
    
    if (error) throw error
    
    closeDeleteModal()
    
    // Refresh data
    await Promise.all([
      loadDashboardStats(),
      loadCharts(),
      loadSuratList(currentPage)
    ])
    
    showToast('Surat berhasil dihapus')
    
  } catch (error) {
    console.error('Delete error:', error)
    showToast('Gagal menghapus surat', 'error')
  } finally {
    btn.disabled = false
    btn.textContent = originalText
  }
}

// Setup filter dropdowns
function setupFilters() {
  // Year filter
  const yearSelect = document.getElementById('filterTahun')
  const currentYear = new Date().getFullYear()
  const years = getYearOptions()
  
  years.forEach(year => {
    const option = document.createElement('option')
    option.value = year
    option.textContent = year
    if (year === currentYear) option.selected = true
    yearSelect.appendChild(option)
  })
  
  // Set default filter to current year
  currentFilters.tahun = currentYear.toString()
}

// Handle filter change
function handleFilterChange() {
  currentFilters = {
    tahun: document.getElementById('filterTahun').value,
    bulan: document.getElementById('filterBulan').value,
    jenis: document.getElementById('filterJenis').value,
    search: document.getElementById('searchInput').value.trim()
  }
  
  currentPage = 1
  loadSuratList(1)
  
  // Reload stats if year changed
  if (currentFilters.tahun) {
    loadDashboardStats()
  }
}

// Open form modal (add new)
async function openFormModal() {
  editingId = null
  
  document.getElementById('modalTitle').textContent = 'Tambah Surat Baru'
  document.getElementById('formSurat').reset()
  document.getElementById('suratId').value = ''
  document.getElementById('previewBox').style.display = 'none'
  
  // Set default date to today
  document.getElementById('tanggalSurat').value = formatDateISO(new Date())
  
  // Get suggestion for nomor urut
  await updateNomorSuggestion()
  
  // Initialize autocomplete
  tujuanAutocomplete = initAutocomplete('tujuan')
  
  // Show modal
  document.getElementById('modalFormSurat').classList.add('show')
}

// Open form modal (edit existing)
async function handleEdit(id) {
  editingId = id
  showLoading()
  
  const result = await getSurat(id)
  hideLoading()
  
  if (!result.success) {
    showToast('Gagal memuat data surat', 'error')
    return
  }
  
  const surat = result.data
  
  document.getElementById('modalTitle').textContent = 'Edit Surat'
  document.getElementById('suratId').value = surat.id
  document.getElementById('nomorUrut').value = surat.nomor_urut
  document.getElementById('suffix').value = surat.suffix || ''
  document.getElementById('jenisSurat').value = surat.jenis_surat
  document.getElementById('tanggalSurat').value = surat.tanggal_surat
  document.getElementById('perihal').value = surat.perihal
  document.getElementById('tujuan').value = surat.tujuan
  document.getElementById('keterangan').value = surat.keterangan || ''
  
  // Update preview
  updatePreview()
  
  // Initialize autocomplete
  tujuanAutocomplete = initAutocomplete('tujuan')
  
  // Show modal
  document.getElementById('modalFormSurat').classList.add('show')
}

// Close modal
function closeFormModal() {
  document.getElementById('modalFormSurat').classList.remove('show')
  document.getElementById('formSurat').reset()
  
  // Destroy autocomplete
  if (tujuanAutocomplete) {
    tujuanAutocomplete.destroy()
    tujuanAutocomplete = null
  }
  
  editingId = null
}

// Handle form submit
async function handleFormSubmit(e) {
  e.preventDefault()
  
  const formData = new FormData(e.target)
  const suratData = {
    nomor_urut: formData.get('nomor_urut'),
    suffix: formData.get('suffix') || '',
    jenis_surat: formData.get('jenis_surat'),
    tanggal_surat: formData.get('tanggal_surat'),
    perihal: formData.get('perihal'),
    tujuan: formData.get('tujuan'),
    keterangan: formData.get('keterangan') || ''
  }
  
  // Check duplicate before submit
  const tahun = getTahun(suratData.tanggal_surat)
  const dupCheck = await checkNomorExists(
    suratData.nomor_urut, 
    suratData.suffix, 
    tahun,
    editingId
  )
  
  if (dupCheck.success && dupCheck.exists) {
    showToast('Nomor surat sudah digunakan!', 'error')
    return
  }
  
  showLoading()
  
  let result
  if (editingId) {
    result = await updateSurat(editingId, suratData)
  } else {
    result = await createSurat(suratData)
  }
  
  hideLoading()
  
  if (result.success) {
    showToast(editingId ? 'Surat berhasil diupdate' : 'Surat berhasil ditambahkan', 'success')
    closeFormModal()
    await Promise.all([
      loadSuratList(currentPage),
      loadDashboardStats(),
      loadCharts()
    ])
  } else {
    showToast('Gagal menyimpan surat: ' + result.error, 'error')
  }
}

// Handle delete
async function handleDelete(id) {
  if (!confirmDialog('Yakin ingin menghapus surat ini?')) {
    return
  }
  
  showLoading()
  const result = await deleteSurat(id)
  hideLoading()
  
  if (result.success) {
    showToast('Surat berhasil dihapus', 'success')
    loadSuratList(currentPage)
    loadDashboardStats()
  } else {
    showToast('Gagal menghapus surat: ' + result.error, 'error')
  }
}

// Handle export to CSV
async function handleExport() {
  showLoading()
  
  const result = await exportSuratCSV(currentFilters)
  
  hideLoading()
  
  if (result.success) {
    const filename = `surat-lpm-${new Date().toISOString().split('T')[0]}.csv`
    exportToCSV(result.data, filename)
    showToast('Data berhasil di-export', 'success')
  } else {
    showToast('Gagal export data: ' + result.error, 'error')
  }
}

// Update nomor suggestion based on tanggal
async function updateNomorSuggestion() {
  const tanggal = document.getElementById('tanggalSurat').value
  if (!tanggal) return
  
  const tahun = getTahun(tanggal)
  const result = await getNextNomorUrut(tahun)
  
  if (result.success) {
    const suggestionEl = document.getElementById('nomorSuggestion')
    suggestionEl.textContent = `💡 Saran nomor berikutnya: ${result.nextNomor}`
    
    // Auto-fill if empty
    if (!document.getElementById('nomorUrut').value) {
      document.getElementById('nomorUrut').value = result.nextNomor
    }
    
    // Show gap info
    const gapResult = await getGapNomor(tahun)
    if (gapResult.success && gapResult.gaps.length > 0) {
      const gaps = gapResult.gaps.slice(0, 5).join(', ')
      suggestionEl.textContent += ` | ⚠️ Gap: ${gaps}${gapResult.gaps.length > 5 ? '...' : ''}`
    }
  }
}

// Check duplicate nomor
async function checkDuplicate() {
  const nomorUrut = document.getElementById('nomorUrut').value
  const suffix = document.getElementById('suffix').value
  const tanggal = document.getElementById('tanggalSurat').value
  
  if (!nomorUrut || !tanggal) return
  
  const tahun = getTahun(tanggal)
  const result = await checkNomorExists(nomorUrut, suffix, tahun, editingId)
  
  const warningEl = document.getElementById('nomorWarning')
  
  if (result.success && result.exists) {
    warningEl.textContent = '⚠️ Nomor ini sudah digunakan!'
    warningEl.style.display = 'block'
  } else {
    warningEl.style.display = 'none'
  }
}

// Update preview nomor lengkap
function updatePreview() {
  const nomorUrut = document.getElementById('nomorUrut').value
  const suffix = document.getElementById('suffix').value || ''
  const jenis = document.getElementById('jenisSurat').value
  const tanggal = document.getElementById('tanggalSurat').value
  
  if (!nomorUrut || !jenis || !tanggal) {
    document.getElementById('previewBox').style.display = 'none'
    return
  }
  
  const bulan = getBulanRomawi(tanggal)
  const tahun = getTahun(tanggal)
  
  const nomorLengkap = `${padNumber(nomorUrut)}${suffix}/071073/LPM/${jenis}/${bulan}/${tahun}`
  
  document.getElementById('nomorPreview').textContent = nomorLengkap
  document.getElementById('previewBox').style.display = 'block'
  
  // Update tanggal info
  const tanggalInfo = document.getElementById('tanggalInfo')
  tanggalInfo.textContent = `Bulan: ${getNamaBulan(bulan)}, Tahun: ${tahun}`
  
  // Update nomor suggestion when date changes
  if (!editingId) {
    updateNomorSuggestion()
  }
}
