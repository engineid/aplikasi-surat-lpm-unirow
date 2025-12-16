// =====================================================
// AUTOCOMPLETE INPUT MODULE
// =====================================================

import { searchTujuan, getRecentTujuan } from './surat.js'
import { formatTimeAgo, escapeHtml, highlightText } from './utils.js'
import { APP_CONFIG } from './config.js'

export class AutocompleteInput {
  constructor(inputElement, options = {}) {
    this.input = inputElement
    this.listElement = null
    this.currentFocus = -1
    this.debounceTimer = null
    this.recentLimit = options.recentLimit || APP_CONFIG.recentTujuanLimit
    this.searchLimit = options.searchLimit || APP_CONFIG.searchTujuanLimit
    this.minChars = options.minChars || APP_CONFIG.minSearchChars
    
    this.init()
  }
  
  init() {
    // Create autocomplete list element
    this.listElement = document.getElementById('autocomplete-list') || 
                       this.createListElement()
    
    // Event listeners
    this.input.addEventListener('input', (e) => this.handleInput(e))
    this.input.addEventListener('keydown', (e) => this.handleKeyDown(e))
    this.input.addEventListener('focus', (e) => this.handleFocus(e))
    this.input.addEventListener('blur', (e) => this.handleBlur(e))
    
    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!this.input.parentNode.contains(e.target)) {
        this.closeList()
      }
    })
  }
  
  createListElement() {
    const list = document.createElement('div')
    list.id = 'autocomplete-list'
    list.className = 'autocomplete-items'
    this.input.parentNode.appendChild(list)
    return list
  }
  
  handleInput(e) {
    const value = e.target.value.trim()
    
    // Clear previous timer
    clearTimeout(this.debounceTimer)
    
    // If empty, show recent
    if (value.length === 0) {
      this.showRecent()
      return
    }
    
    if (value.length < this.minChars) {
      this.closeList()
      return
    }
    
    // Show loading
    this.showLoading()
    
    // Debounce search
    this.debounceTimer = setTimeout(() => {
      this.search(value)
    }, APP_CONFIG.debounceDelay)
  }
  
  async handleFocus(e) {
    const value = e.target.value.trim()
    
    if (value.length === 0) {
      await this.showRecent()
    } else if (value.length >= this.minChars) {
      await this.search(value)
    }
  }
  
  handleBlur(e) {
    // Delay closing to allow click on items
    setTimeout(() => {
      if (!this.listElement.matches(':hover')) {
        this.closeList()
      }
    }, 200)
  }
  
  async showRecent() {
    try {
      const result = await getRecentTujuan(this.recentLimit)
      
      if (!result.success || !result.data || result.data.length === 0) {
        this.showNoResults('Belum ada riwayat tujuan surat')
        return
      }
      
      this.displayRecent(result.data)
      
    } catch (error) {
      console.error('Error loading recent:', error)
      this.closeList()
    }
  }
  
  async search(searchTerm) {
    try {
      const result = await searchTujuan(searchTerm, this.searchLimit)
      
      if (!result.success || !result.data || result.data.length === 0) {
        this.showNoResults('Tidak ada hasil ditemukan')
        return
      }
      
      this.displaySearchResults(result.data, searchTerm)
      
    } catch (error) {
      console.error('Error searching:', error)
      this.showNoResults('Terjadi kesalahan saat mencari')
    }
  }
  
  displayRecent(results) {
    this.closeList()
    this.currentFocus = -1
    this.listElement.classList.add('show')
    
    // Section header
    const header = document.createElement('div')
    header.className = 'autocomplete-section-header'
    header.innerHTML = '🕐 Tujuan Terakhir'
    this.listElement.appendChild(header)
    
    // Recent items
    results.forEach((item) => {
      const div = document.createElement('div')
      div.className = 'autocomplete-item'
      div.innerHTML = `
        <span class="item-text">${escapeHtml(item.tujuan)}</span>
        <span class="item-meta">
          <span class="last-used">${formatTimeAgo(item.last_used)}</span>
        </span>
      `
      
      div.addEventListener('mousedown', (e) => {
        e.preventDefault()
        this.selectItem(item.tujuan)
      })
      
      this.listElement.appendChild(div)
    })
  }
  
  displaySearchResults(results, searchTerm) {
    this.closeList()
    this.currentFocus = -1
    this.listElement.classList.add('show')
    
    // Section header
    const header = document.createElement('div')
    header.className = 'autocomplete-section-header'
    header.innerHTML = `🔍 Hasil Pencarian (${results.length})`
    this.listElement.appendChild(header)
    
    // Search results
    results.forEach((item) => {
      const div = document.createElement('div')
      div.className = 'autocomplete-item'
      div.innerHTML = `
        <span class="item-text">
          ${highlightText(item.tujuan, searchTerm)}
        </span>
        <span class="item-meta">
          <span class="frequency">${item.frequency}x</span>
          <span class="last-used">${formatTimeAgo(item.last_used)}</span>
        </span>
      `
      
      div.addEventListener('mousedown', (e) => {
        e.preventDefault()
        this.selectItem(item.tujuan)
      })
      
      this.listElement.appendChild(div)
    })
  }
  
  showLoading() {
    this.closeList()
    this.listElement.classList.add('show')
    this.listElement.innerHTML = `
      <div class="autocomplete-loading">
        Mencari...
      </div>
    `
  }
  
  showNoResults(message = 'Tidak ada hasil') {
    this.closeList()
    this.listElement.classList.add('show')
    this.listElement.innerHTML = `
      <div class="autocomplete-no-results">
        ${message}
      </div>
    `
  }
  
  selectItem(value) {
    this.input.value = value
    this.closeList()
    
    // Trigger change event
    this.input.dispatchEvent(new Event('change', { bubbles: true }))
    this.input.dispatchEvent(new Event('input', { bubbles: true }))
  }
  
  handleKeyDown(e) {
    const items = this.listElement.querySelectorAll('.autocomplete-item')
    
    if (e.keyCode === 40) { // Arrow Down
      e.preventDefault()
      this.currentFocus++
      this.setActive(items)
    } else if (e.keyCode === 38) { // Arrow Up
      e.preventDefault()
      this.currentFocus--
      this.setActive(items)
    } else if (e.keyCode === 13) { // Enter
      e.preventDefault()
      if (this.currentFocus > -1 && items[this.currentFocus]) {
        items[this.currentFocus].click()
      }
    } else if (e.keyCode === 27) { // Escape
      this.closeList()
      this.input.blur()
    }
  }
  
  setActive(items) {
    if (!items || items.length === 0) return
    
    // Remove active class from all
    items.forEach(item => item.classList.remove('active'))
    
    // Handle boundaries
    if (this.currentFocus >= items.length) this.currentFocus = 0
    if (this.currentFocus < 0) this.currentFocus = items.length - 1
    
    // Add active class to current
    items[this.currentFocus].classList.add('active')
    items[this.currentFocus].scrollIntoView({ 
      block: 'nearest',
      behavior: 'smooth'
    })
  }
  
  closeList() {
    this.listElement.innerHTML = ''
    this.listElement.classList.remove('show')
    this.currentFocus = -1
  }
  
  destroy() {
    // Clean up event listeners
    this.input.removeEventListener('input', this.handleInput)
    this.input.removeEventListener('keydown', this.handleKeyDown)
    this.input.removeEventListener('focus', this.handleFocus)
    this.input.removeEventListener('blur', this.handleBlur)
    
    // Remove list element
    if (this.listElement && this.listElement.parentNode) {
      this.listElement.parentNode.removeChild(this.listElement)
    }
  }
}

/**
 * Initialize autocomplete for an input element
 */
export function initAutocomplete(inputId, options = {}) {
  const input = document.getElementById(inputId)
  if (input) {
    return new AutocompleteInput(input, options)
  }
  return null
}
