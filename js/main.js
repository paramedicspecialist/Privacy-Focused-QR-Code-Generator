// QR Code Generator - Main Module
// Privacy-focused, client-side QR generation

import { getContent } from './modules/templates.js';

const CONFIG = {
  MAX_CACHE_SIZE: 10,
  DEBOUNCE_DELAY: 200,
  STATUS_TIMEOUT: 1000,
  INITIAL_DELAY: 300,
  MAX_FILE_SIZE: 5 * 1024 * 1024
};

const state = {
  canvas: null,
  logo: null,
  debounceTimer: null,
  generating: false,
  cache: new Map(),
  lastConfig: '',
  tooltips: null
};

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// Status management
function showStatus(msg, type = 'processing', duration = null) {
  const status = $('status');
  const text = $('status-text');
  if (!status || !text) return;

  text.innerHTML = msg;
  status.className = `status-indicator show ${type}`;
  
  if (duration) {
    setTimeout(() => hideStatus(), duration);
  }
}

function hideStatus() {
  const status = $('status');
  if (status) status.classList.remove('show');
}

// Template switching
function setActiveTemplate(btn) {
  $$('.template-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-checked', 'false');
  });
  
  $$('.template-input').forEach(i => i.style.display = 'none');
  
  btn.classList.add('active');
  btn.setAttribute('aria-checked', 'true');
  
  const targetId = 'input-' + btn.dataset.template;
  const target = $(targetId);
  if (target) target.style.display = 'block';
  
  debouncedGenerate();
}

// Color pickers
function setupColor(colorId, previewId, hexId) {
  const color = $(colorId);
  const preview = $(previewId);
  const hex = $(hexId);
  
  if (!color || !preview || !hex) return;

  preview.addEventListener('click', () => color.click());
  preview.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') color.click();
  });

  color.addEventListener('input', e => {
    preview.style.backgroundColor = e.target.value;
    hex.value = e.target.value.toUpperCase();
    debouncedGenerate();
  });

  hex.addEventListener('input', e => {
    let value = e.target.value.trim();
    if (!value.startsWith('#')) value = '#' + value;
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      color.value = value;
      preview.style.backgroundColor = value;
      debouncedGenerate();
    }
  });
}

// Range sliders
function setupRangeSliders() {
  const size = $('qr-size');
  const margin = $('margin-size');
  const logo = $('logo-size');

  if (size) {
    size.addEventListener('input', e => {
      $('size-display').textContent = e.target.value;
      debouncedGenerate();
    });
  }

  if (margin) {
    margin.addEventListener('input', e => {
      $('margin-display').textContent = e.target.value;
      debouncedGenerate();
    });
  }

  if (logo) {
    logo.addEventListener('input', e => {
      $('logo-size-display').textContent = e.target.value;
      debouncedGenerate();
    });
  }
}

// Logo upload
function setupLogoUpload() {
  const upload = $('logo-upload');
  const clear = $('clear-logo');
  
  if (!upload) return;

  upload.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showStatus('Please upload an image', 'error');
      return;
    }

    if (file.size > CONFIG.MAX_FILE_SIZE) {
      showStatus('Image too large (max 5MB)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', ev => {
      const img = new Image();
      img.addEventListener('load', () => {
        state.logo = img;
        $('logo-preview').src = ev.target.result;
        $('logo-preview-wrap').style.display = 'block';
        $('error-correction').value = 'H';
        updateErrorCorrectionState(true);
        state.cache.clear();
        debouncedGenerate();
      });
      img.src = ev.target.result;
    });
    reader.readAsDataURL(file);
  });

  if (clear) {
    clear.addEventListener('click', () => {
      state.logo = null;
      upload.value = '';
      $('logo-preview-wrap').style.display = 'none';
      updateErrorCorrectionState(false);
      debouncedGenerate();
    });
  }
}

// Update error correction dropdown state
function updateErrorCorrectionState(hasLogo) {
  const ecSelect = $('error-correction');
  if (!ecSelect) return;
  
  if (hasLogo) {
    // Disable all options except 'H' (High)
    Array.from(ecSelect.options).forEach(option => {
      if (option.value !== 'H') {
        option.disabled = true;
      }
    });
    ecSelect.disabled = false; // Keep dropdown enabled but only H is selectable
    
    // Ensure H is selected if not already
    if (ecSelect.value !== 'H') {
      ecSelect.value = 'H';
    }
  } else {
    // Re-enable all options
    Array.from(ecSelect.options).forEach(option => {
      option.disabled = false;
    });
  }
}

// QR generation
function generate() {
  if (state.generating) return;
  
  const config = getConfigHash();
  if (state.cache.has(config)) {
    displayQRCode(state.cache.get(config));
    showStatus('<i class="bi bi-check-circle-fill"></i> Ready (cached)', 'success', CONFIG.STATUS_TIMEOUT);
    return;
  }
  
  state.generating = true;
  $('qr-container').classList.add('loading');
  
  try {
    const content = getContent();
    const size = parseInt($('qr-size')?.value || '350', 10);
    const fg = $('fg-color')?.value || '#000000';
    const bg = $('bg-color')?.value || '#ffffff';
    const ec = $('error-correction')?.value || 'M';
    const margin = parseInt($('margin-size')?.value || '2', 10);
    const style = $('dot-style')?.value || 'square';
    const logoPercent = parseInt($('logo-size')?.value || '20', 10);
    
    const qr = qrcode(0, ec);
    qr.addData(content);
    qr.make();
    
    const count = qr.getModuleCount();
    const cell = Math.floor(size / (count + margin * 2));
    const actual = cell * (count + margin * 2);
    
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = actual;
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, actual, actual);
    
    // QR modules
    ctx.fillStyle = fg;
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          const x = (c + margin) * cell;
          const y = (r + margin) * cell;
          
          if (style === 'rounded') {
            roundRect(ctx, x, y, cell, cell, cell * 0.3);
          } else if (style === 'dots') {
            ctx.beginPath();
            ctx.arc(x + cell/2, y + cell/2, cell * 0.4, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(x, y, cell, cell);
          }
        }
      }
    }
    
    // Logo
    if (state.logo) {
      const maxSize = actual * (logoPercent / 100);
      const ratio = state.logo.naturalWidth / state.logo.naturalHeight;
      const [w, h] = ratio >= 1 
        ? [maxSize, maxSize / ratio]
        : [maxSize * ratio, maxSize];
      
      const lx = (actual - w) / 2;
      const ly = (actual - h) / 2;
      const pad = Math.max(w, h) * 0.1;
      
      ctx.fillStyle = bg;
      roundRect(ctx, lx - pad, ly - pad, w + pad*2, h + pad*2, pad * 0.5);
      ctx.drawImage(state.logo, lx, ly, w, h);
    }
    
    // Cache
    state.cache.set(config, canvas);
    if (state.cache.size > CONFIG.MAX_CACHE_SIZE) {
      const firstKey = state.cache.keys().next().value;
      state.cache.delete(firstKey);
    }
    
    displayQRCode(canvas);
    
  } catch (err) {
    showStatus(`<i class="bi bi-exclamation-triangle"></i> ${err.message || 'QR generation failed'}`, 'error');
  } finally {
    state.generating = false;
    $('qr-container').classList.remove('loading');
  }
}

function displayQRCode(canvas) {
  const container = $('qrcode');
  const placeholder = $('placeholder');
  const download = $('download-section');
  
  if (!container) return;
  
  container.innerHTML = '';
  if (placeholder) placeholder.style.display = 'none';
  $('qr-container').classList.add('has-qr');
  
  container.appendChild(canvas);
  if (download) download.style.display = 'block';
  
  // Update QR dimensions display
  updateQRDimensions();
  
  state.canvas = canvas;
  showStatus('<i class="bi bi-check-circle-fill"></i> Ready', 'success', CONFIG.STATUS_TIMEOUT);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

// Debounced generation
function debouncedGenerate() {
  if (state.debounceTimer) {
    clearTimeout(state.debounceTimer);
  }
  
  state.debounceTimer = setTimeout(() => {
    if (!state.generating) generate();
    state.debounceTimer = null;
  }, CONFIG.DEBOUNCE_DELAY);
}

// Config hash
function getConfigHash() {
  return JSON.stringify({
    content: getContent(),
    size: $('qr-size').value,
    fg: $('fg-color').value,
    bg: $('bg-color').value,
    ec: $('error-correction').value,
    margin: $('margin-size').value,
    style: $('dot-style').value,
    logoPercent: $('logo-size').value,
    logo: state.logo ? 'present' : 'absent'
  });
}

// Downloads
function download(format) {
  if (!state.canvas) {
    showStatus('Generate a QR code first', 'error');
    return;
  }
  
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  
  if (format === 'svg') {
    link.href = URL.createObjectURL(new Blob([generateSVG()], {type: 'image/svg+xml'}));
    link.download = `qrcode-${date}.svg`;
  } else if (format === 'jpg') {
    const tmp = document.createElement('canvas');
    tmp.width = state.canvas.width;
    tmp.height = state.canvas.height;
    const ctx = tmp.getContext('2d');
    ctx.fillStyle = $('bg-color').value;
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(state.canvas, 0, 0);
    link.href = tmp.toDataURL('image/jpeg', 0.95);
    link.download = `qrcode-${date}.jpg`;
  } else {
    link.href = state.canvas.toDataURL('image/png');
    link.download = `qrcode-${date}.png`;
  }
  
  link.click();
  if (format === 'svg') URL.revokeObjectURL(link.href);
  
  showStatus(`<i class="bi bi-check"></i> Downloaded ${format.toUpperCase()}`, 'success');
  setTimeout(hideStatus, 1500);
}

function generateSVG() {
  const content = getContent();
  const size = +$('qr-size').value;
  const fg = $('fg-color').value;
  const bg = $('bg-color').value;
  const ec = $('error-correction').value;
  const margin = +$('margin-size').value;
  const style = $('dot-style').value;
  
  const qr = qrcode(0, ec);
  qr.addData(content);
  qr.make();
  
  const count = qr.getModuleCount();
  const cell = size / (count + margin * 2);
  
  let paths = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        const x = (c + margin) * cell;
        const y = (r + margin) * cell;
        
        if (style === 'dots') {
          paths += `<circle cx="${x + cell/2}" cy="${y + cell/2}" r="${cell*0.4}" fill="${fg}"/>`;
        } else if (style === 'rounded') {
          paths += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="${cell*0.3}" fill="${fg}"/>`;
        } else {
          paths += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${fg}"/>`;
        }
      }
    }
  }
  
  const svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="100%" height="100%" fill="${bg}"/>${paths}</svg>`;
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
}

// Event listeners
function setupEventListeners() {
  // Template buttons
  $$('.template-btn').forEach(btn => {
    btn.addEventListener('click', () => setActiveTemplate(btn));
  });

  // Quick action buttons
  const clearAllBtn = $('clear-all-btn');
  const randomizeColorsBtn = $('randomize-colors-btn');

  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAllSettings);
  }

  if (randomizeColorsBtn) {
    randomizeColorsBtn.addEventListener('click', randomizeColors);
  }

  // Character count
  const textContent = $('text-content');
  if (textContent) {
    textContent.addEventListener('input', updateCharCount);
  }

  // Social/app previews
  const socialPlatform = $('social-platform');
  const socialUsername = $('social-username');
  const appPlatform = $('app-platform');
  const appId = $('app-id');

  if (socialPlatform) {
    socialPlatform.addEventListener('change', () => {
      updateSocialPreview();
      debouncedGenerate();
    });
  }

  if (socialUsername) {
    socialUsername.addEventListener('input', () => {
      updateSocialPreview();
      debouncedGenerate();
    });
  }

  if (appPlatform) {
    appPlatform.addEventListener('change', () => {
      updateAppPreview();
      debouncedGenerate();
    });
  }

  if (appId) {
    appId.addEventListener('input', () => {
      updateAppPreview();
      debouncedGenerate();
    });
  }

  // Download buttons
  $$('.download-btn').forEach(btn => {
    btn.addEventListener('click', () => download(btn.dataset.format));
  });

  // Auto-generate on input
  $$('.qr-input').forEach(input => {
    input.addEventListener('input', debouncedGenerate);
    input.addEventListener('change', debouncedGenerate);
    
    // Add validation for email inputs
    if (input.type === 'email') {
      input.addEventListener('blur', () => {
        if (input.value && !input.value.includes('@')) {
          input.classList.add('is-invalid');
          const feedback = input.parentNode.querySelector('.invalid-feedback');
          if (feedback) feedback.textContent = 'Please enter a valid email address';
        } else {
          input.classList.remove('is-invalid');
        }
      });
    }
    
    // Add validation for URL inputs
    if (input.type === 'url') {
      input.addEventListener('blur', () => {
        if (input.value && !input.value.startsWith('http')) {
          input.classList.add('is-invalid');
          const feedback = input.parentNode.querySelector('.invalid-feedback');
          if (feedback) feedback.textContent = 'Please enter a valid URL starting with http:// or https://';
        } else {
          input.classList.remove('is-invalid');
        }
      });
    }
    
    // Add validation for phone inputs
    if (input.type === 'tel') {
      input.addEventListener('blur', () => {
        if (input.value && !input.value.match(/^\+?[\d\s\-\(\)]+$/)) {
          input.classList.add('is-invalid');
          const feedback = input.parentNode.querySelector('.invalid-feedback');
          if (feedback) feedback.textContent = 'Please enter a valid phone number';
        } else {
          input.classList.remove('is-invalid');
        }
      });
    }
  });
}

function updateSocialPreview() {
  const platform = $('social-platform').value;
  const username = $('social-username').value;
  const preview = $('social-preview-url');
  
  if (platform === 'custom') {
    preview.textContent = username || 'https://example.com';
  } else {
    const urls = {
      facebook: `https://facebook.com/${username}`,
      twitter: `https://twitter.com/${username}`,
      instagram: `https://instagram.com/${username}`,
      linkedin: `https://linkedin.com/in/${username}`,
      youtube: `https://youtube.com/@${username}`,
      tiktok: `https://tiktok.com/@${username}`,
      github: `https://github.com/${username}`
    };
    preview.textContent = urls[platform] || `https://${platform}.com/${username}`;
  }
}

function updateAppPreview() {
  const platform = $('app-platform').value;
  const appId = $('app-id').value;
  const preview = $('app-preview-url');
  
  if (platform === 'custom') {
    preview.textContent = appId || 'https://example.com/app';
  } else {
    const urls = {
      ios: `https://apps.apple.com/app/id${appId}`,
      android: `https://play.google.com/store/apps/details?id=${appId}`,
      windows: `https://www.microsoft.com/store/apps/${appId}`,
      amazon: `https://www.amazon.com/gp/product/${appId}`
    };
    preview.textContent = urls[platform] || `https://store.${platform}.com/app/${appId}`;
  }
}

// Clear all settings
function clearAllSettings() {
  // Get current template
  const activeTemplate = document.querySelector('.template-btn.active');
  const currentTemplate = activeTemplate ? activeTemplate.dataset.template : 'text';
  
  // Clear content based on current template
  switch (currentTemplate) {
    case 'text':
      $('text-content').value = '';
      break;
    case 'wifi':
      $('wifi-ssid').value = '';
      $('wifi-password').value = '';
      $('wifi-encryption').value = 'WPA';
      $('wifi-hidden').checked = false;
      break;
    case 'vcard':
      $('vcard-name').value = '';
      $('vcard-org').value = '';
      $('vcard-title').value = '';
      $('vcard-phone').value = '';
      $('vcard-email').value = '';
      $('vcard-url').value = '';
      $('vcard-address').value = '';
      break;
    case 'email':
      $('email-to').value = '';
      $('email-subject').value = '';
      $('email-body').value = '';
      break;
    case 'sms':
      $('sms-phone').value = '';
      $('sms-message').value = '';
      break;
    case 'phone':
      $('phone-number').value = '';
      break;
    case 'mecard':
      $('mecard-name').value = '';
      $('mecard-phone').value = '';
      $('mecard-email').value = '';
      $('mecard-url').value = '';
      $('mecard-address').value = '';
      $('mecard-birthday').value = '';
      $('mecard-note').value = '';
      break;
    case 'event':
      $('event-title').value = '';
      $('event-start').value = '';
      $('event-end').value = '';
      $('event-location').value = '';
      $('event-description').value = '';
      $('event-timezone').value = 'UTC';
      break;
    case 'bitcoin':
      $('bitcoin-address').value = '';
      $('bitcoin-amount').value = '';
      $('bitcoin-label').value = '';
      $('bitcoin-message').value = '';
      break;
    case 'geo':
      $('geo-latitude').value = '';
      $('geo-longitude').value = '';
      $('geo-altitude').value = '';
      $('geo-query').value = '';
      break;
    case 'social':
      $('social-platform').value = 'facebook';
      $('social-username').value = '';
      break;
    case 'app':
      $('app-platform').value = 'ios';
      $('app-id').value = '';
      break;
  }
  
  // Reset design settings
  $('qr-size').value = '350';
  $('size-display').textContent = '350';
  $('margin-size').value = '2';
  $('margin-display').textContent = '2';
  $('fg-color').value = '#000000';
  $('fg-hex').value = '#000000';
  $('fg-preview').style.backgroundColor = '#000000';
  $('bg-color').value = '#ffffff';
  $('bg-hex').value = '#ffffff';
  $('bg-preview').style.backgroundColor = '#ffffff';
  $('dot-style').value = 'square';
  $('error-correction').value = 'M';
  $('logo-size').value = '20';
  $('logo-size-display').textContent = '20';
  
  // Clear logo
  state.logo = null;
  $('logo-upload').value = '';
  $('logo-preview-wrap').style.display = 'none';
  updateErrorCorrectionState(false);
  
  // Clear cache
  state.cache.clear();
  
  // Update character count
  updateCharCount();
  
  // Regenerate
  debouncedGenerate();
  
  showStatus('<i class="bi bi-check-circle-fill"></i> Settings cleared', 'success');
}

// Randomize colors with good contrast
function randomizeColors() {
  // Generate random colors
  const hue1 = Math.floor(Math.random() * 360);
  const hue2 = (hue1 + 180) % 360; // Complementary color for contrast
  
  const fgColor = `hsl(${hue1}, 70%, 30%)`;
  const bgColor = `hsl(${hue2}, 70%, 90%)`;
  
  // Convert to hex
  const fgHex = hslToHex(hue1, 70, 30);
  const bgHex = hslToHex(hue2, 70, 90);
  
  // Apply colors
  $('fg-color').value = fgHex;
  $('fg-hex').value = fgHex;
  $('fg-preview').style.backgroundColor = fgHex;
  $('bg-color').value = bgHex;
  $('bg-hex').value = bgHex;
  $('bg-preview').style.backgroundColor = bgHex;
  
  // Regenerate
  debouncedGenerate();
  
  showStatus('<i class="bi bi-palette2"></i> Colors randomized', 'success');
}

// Convert HSL to HEX
function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}


// Update character count
function updateCharCount() {
  const textContent = $('text-content');
  const charCountValue = $('char-count-value');
  if (!textContent || !charCountValue) return;
  
  const count = textContent.value.length;
  charCountValue.textContent = count;
}

// Update QR code dimensions display
function updateQRDimensions() {
  const size = parseInt($('qr-size')?.value || '350', 10);
  const dimensionsContainer = $('qr-dimensions');
  const dimensionsValue = dimensionsContainer?.querySelectorAll('.qr-dimensions-value');
  
  if (!dimensionsContainer || !dimensionsValue) return;
  
  // Show dimensions when QR code is displayed
  if ($('qrcode').children.length > 0) {
    dimensionsContainer.style.display = 'block';
    dimensionsValue.forEach(span => span.textContent = size);
  } else {
    dimensionsContainer.style.display = 'none';
  }
}

// Initialization
async function init() {
  try {
    // Load modules
    const [{ NetworkMonitor }, { ThemeManager }] = await Promise.all([
      import('./modules/network-monitor.js'),
      import('./modules/theme-manager.js')
    ]);
    
    new NetworkMonitor();
    new ThemeManager();
    
    // Setup UI
    setupColor('fg-color', 'fg-preview', 'fg-hex');
    setupColor('bg-color', 'bg-preview', 'bg-hex');
    setupRangeSliders();
    setupLogoUpload();
    setupEventListeners();
    
    // Initialize tooltips
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
      state.tooltips = new bootstrap.Tooltip(document.body, {
        selector: '[data-bs-toggle="tooltip"]'
      });
    }
    
    // Initialize character count
    updateCharCount();
    
    // Initial generation
    setTimeout(() => generate(), CONFIG.INITIAL_DELAY);
    
    showStatus('<i class="bi bi-check-circle-fill"></i> Ready', 'success', CONFIG.STATUS_TIMEOUT * 2);
    
  } catch (err) {
    console.error('Failed to load modules:', err);
    showStatus('<i class="bi bi-exclamation-triangle"></i> Some features unavailable', 'error');
    
    // Fallback: initialize core functionality
    setupColor('fg-color', 'fg-preview', 'fg-hex');
    setupColor('bg-color', 'bg-preview', 'bg-hex');
    setupRangeSliders();
    setupLogoUpload();
    setupEventListeners();
    
    // Initialize tooltips (fallback)
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
      state.tooltips = new bootstrap.Tooltip(document.body, {
        selector: '[data-bs-toggle="tooltip"]'
      });
    }
    
    // Initialize character count
    updateCharCount();
    
    setTimeout(() => generate(), CONFIG.INITIAL_DELAY);
  }
}

// Start the application
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}