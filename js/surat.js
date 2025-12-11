// =====================================================
// SURAT CRUD OPERATIONS
// =====================================================

import { supabase } from './config.js'
import { getBulanRomawi, getTahun } from './utils.js'

/**
 * Get all jenis surat
 */
export async function getJenisSurat() {
  try {
    const { data, error } = await supabase
      .from('jenis_surat')
      .select('*')
      .order('nama_jenis')
    
    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Error getting jenis surat:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get surat list with pagination and filters
 */
export async function getSuratList(options = {}) {
  try {
    const {
      page = 1,
      limit = 20,
      tahun = null,
      bulan = null,
      jenis = null,
      search = null
    } = options
    
    let query = supabase
      .from('surat_keluar')
      .select(`
        *,
        jenis_surat!inner(nama_jenis, kode)
      `, { count: 'exact' })
    
    // Apply filters
    if (tahun) {
      query = query.eq('tahun', tahun)
    }
    
    if (bulan) {
      query = query.eq('kode_bulan', bulan)
    }
    
    if (jenis) {
      query = query.eq('jenis_surat', jenis)
    }
    
    if (search) {
      query = query.or(`perihal.ilike.%${search}%,tujuan.ilike.%${search}%`)
    }
    
    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    
    query = query
      .order('created_at', { ascending: false })
      .range(from, to)
    
    const { data, error, count } = await query
    
    if (error) throw error
    
    return {
      success: true,
      data,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    }
  } catch (error) {
    console.error('Error getting surat list:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get single surat by ID
 */
export async function getSurat(id) {
  try {
    const { data, error } = await supabase
      .from('surat_keluar')
      .select(`
        *,
        jenis_surat(nama_jenis, kode)
      `)
      .eq('id', id)
      .single()
    
    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Error getting surat:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Create new surat
 */
export async function createSurat(suratData) {
  try {
    // Auto-generate kode_bulan and tahun from tanggal_surat
    const kodeBulan = getBulanRomawi(suratData.tanggal_surat)
    const tahun = getTahun(suratData.tanggal_surat)
    
    const newSurat = {
      nomor_urut: parseInt(suratData.nomor_urut),
      suffix: suratData.suffix || '',
      jenis_surat: suratData.jenis_surat,
      kode_bulan: kodeBulan,
      tahun: tahun,
      tanggal_surat: suratData.tanggal_surat,
      perihal: suratData.perihal,
      tujuan: suratData.tujuan,
      keterangan: suratData.keterangan || null
    }
    
    const { data, error } = await supabase
      .from('surat_keluar')
      .insert([newSurat])
      .select()
      .single()
    
    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Error creating surat:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update existing surat
 */
export async function updateSurat(id, suratData) {
  try {
    // Auto-generate kode_bulan and tahun from tanggal_surat if changed
    const kodeBulan = getBulanRomawi(suratData.tanggal_surat)
    const tahun = getTahun(suratData.tanggal_surat)
    
    const updatedSurat = {
      nomor_urut: parseInt(suratData.nomor_urut),
      suffix: suratData.suffix || '',
      jenis_surat: suratData.jenis_surat,
      kode_bulan: kodeBulan,
      tahun: tahun,
      tanggal_surat: suratData.tanggal_surat,
      perihal: suratData.perihal,
      tujuan: suratData.tujuan,
      keterangan: suratData.keterangan || null
    }
    
    const { data, error } = await supabase
      .from('surat_keluar')
      .update(updatedSurat)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Error updating surat:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete surat
 */
export async function deleteSurat(id) {
  try {
    const { error } = await supabase
      .from('surat_keluar')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error deleting surat:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Check if nomor surat already exists
 */
export async function checkNomorExists(nomorUrut, suffix, tahun, excludeId = null) {
  try {
    let query = supabase
      .from('surat_keluar')
      .select('id')
      .eq('nomor_urut', parseInt(nomorUrut))
      .eq('suffix', suffix || '')
      .eq('tahun', tahun)
    
    if (excludeId) {
      query = query.neq('id', excludeId)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return { success: true, exists: data.length > 0 }
  } catch (error) {
    console.error('Error checking nomor:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get next nomor urut suggestion
 */
export async function getNextNomorUrut(tahun) {
  try {
    const { data, error } = await supabase
      .rpc('get_next_nomor_urut', { p_tahun: tahun })
    
    if (error) throw error
    return { success: true, nextNomor: data }
  } catch (error) {
    console.error('Error getting next nomor:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get gap nomor (missing numbers)
 */
export async function getGapNomor(tahun) {
  try {
    const { data, error } = await supabase
      .rpc('get_gap_nomor', { p_tahun: tahun })
    
    if (error) throw error
    return { success: true, gaps: data.map(item => item.nomor_urut) }
  } catch (error) {
    console.error('Error getting gap nomor:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(tahun) {
  try {
    // Total surat tahun ini
    const { count: totalSurat, error: error1 } = await supabase
      .from('surat_keluar')
      .select('*', { count: 'exact', head: true })
      .eq('tahun', tahun)
    
    if (error1) throw error1
    
    // Surat bulan ini
    const currentMonth = getBulanRomawi(new Date())
    const { count: suratBulanIni, error: error2 } = await supabase
      .from('surat_keluar')
      .select('*', { count: 'exact', head: true })
      .eq('tahun', tahun)
      .eq('kode_bulan', currentMonth)
    
    if (error2) throw error2
    
    // Gap nomor
    const gapResult = await getGapNomor(tahun)
    const gapCount = gapResult.success ? gapResult.gaps.length : 0
    
    // Surat per jenis
    const { data: suratPerJenis, error: error3 } = await supabase
      .from('surat_keluar')
      .select('jenis_surat, jenis_surat(nama_jenis)')
      .eq('tahun', tahun)
    
    if (error3) throw error3
    
    // Count per jenis
    const jenisCount = {}
    suratPerJenis.forEach(surat => {
      const jenis = surat.jenis_surat
      if (!jenisCount[jenis]) {
        jenisCount[jenis] = {
          kode: jenis,
          nama: surat.jenis_surat?.nama_jenis || jenis,
          count: 0
        }
      }
      jenisCount[jenis].count++
    })
    
    return {
      success: true,
      stats: {
        totalSurat,
        suratBulanIni,
        gapCount,
        suratPerJenis: Object.values(jenisCount).sort((a, b) => b.count - a.count)
      }
    }
  } catch (error) {
    console.error('Error getting dashboard stats:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Search tujuan for autocomplete
 */
export async function searchTujuan(searchTerm, limit = 10) {
  try {
    const { data, error } = await supabase
      .rpc('search_tujuan_surat', {
        search_term: searchTerm,
        limit_count: limit
      })
    
    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Error searching tujuan:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get recent tujuan for autocomplete
 */
export async function getRecentTujuan(limit = 5) {
  try {
    const { data, error } = await supabase
      .rpc('get_recent_tujuan', {
        limit_count: limit
      })
    
    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Error getting recent tujuan:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Export surat to CSV
 */
export async function exportSuratCSV(filters = {}) {
  try {
    let query = supabase
      .from('surat_keluar')
      .select(`
        nomor_lengkap,
        tanggal_surat,
        jenis_surat(nama_jenis),
        perihal,
        tujuan,
        keterangan
      `)
      .order('tanggal_surat', { ascending: false })
    
    // Apply filters
    if (filters.tahun) {
      query = query.eq('tahun', filters.tahun)
    }
    if (filters.bulan) {
      query = query.eq('kode_bulan', filters.bulan)
    }
    if (filters.jenis) {
      query = query.eq('jenis_surat', filters.jenis)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    
    // Format data for CSV
    const formattedData = data.map(surat => ({
      'Nomor Surat': surat.nomor_lengkap,
      'Tanggal': surat.tanggal_surat,
      'Jenis': surat.jenis_surat?.nama_jenis || '',
      'Perihal': surat.perihal,
      'Tujuan': surat.tujuan,
      'Keterangan': surat.keterangan || ''
    }))
    
    return { success: true, data: formattedData }
  } catch (error) {
    console.error('Error exporting surat:', error)
    return { success: false, error: error.message }
  }
}
