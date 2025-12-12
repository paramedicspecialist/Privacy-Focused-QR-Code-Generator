/**
 * QR Code Generator - Main Module
 * Core functionality with dynamic imports for non-critical features
 *
 * @version 1.0.0
 * @author Darkhorse
 * @license MIT
 */

(function() {
    'use strict';
    
    // ===== Constants =====
    const CONSTANTS = {
        MAX_CACHE_SIZE: 10, // Increased cache size for better performance
        DEBOUNCE_DELAY: 200, // Debounce delay in milliseconds
        STATUS_TIMEOUT: 1000, // Status message timeout
        INITIAL_GENERATION_DELAY: 300, // Initial QR generation delay
        MODULE_LOAD_TIMEOUT: 5000 // Module loading timeout
    };
    
    // ===== State Management =====
    const state = {
        canvas: null,
        logo: null,
        debounceTimer: null,
        generating: false,
        networkMonitor: null,
        themeManager: null,
        eventListeners: new Map(), // Use Map for better tracking
        qrCache: new Map(),
        lastGeneratedConfig: '',
        isInitialized: false
    };
    
    // ===== DOM Elements =====
    const dom = {
        $: (id) => {
            const element = document.getElementById(id);
            if (!element) {
                console.warn(`DOM element with id '${id}' not found`);
            }
            return element;
        },
        $$: (sel) => document.querySelectorAll(sel)
    };
    
    // ===== Memory Management =====
    /**
     * Comprehensive cleanup function to prevent memory leaks
     * Disposes of all resources, event listeners, and cached elements
     */
    function cleanup() {
        try {
            // Clear all event listeners with error handling
            state.eventListeners.forEach((handlers, element) => {
                handlers.forEach(({ event, handler }) => {
                    try {
                        if (element && element.removeEventListener) {
                            element.removeEventListener(event, handler);
                        }
                    } catch (error) {
                        console.warn(`Failed to remove event listener: ${event}`, error);
                    }
                });
            });
            state.eventListeners.clear();
            
            // Clear cache and dispose of canvas elements
            state.qrCache.forEach((cachedCanvas, key) => {
                try {
                    if (cachedCanvas) {
                        cachedCanvas.width = 0;
                        cachedCanvas.height = 0;
                    }
                } catch (error) {
                    console.warn(`Failed to dispose cached canvas: ${key}`, error);
                }
            });
            state.qrCache.clear();
            
            // Clear timers
            if (state.debounceTimer) {
                clearTimeout(state.debounceTimer);
                state.debounceTimer = null;
            }
            
            // Dispose of logo image
            if (state.logo) {
                try {
                    state.logo.src = '';
                    state.logo = null;
                } catch (error) {
                    console.warn('Failed to dispose logo image', error);
                }
            }
            
            // Dispose of canvas
            if (state.canvas) {
                try {
                    state.canvas.width = 0;
                    state.canvas.height = 0;
                    state.canvas = null;
                } catch (error) {
                    console.warn('Failed to dispose canvas', error);
                }
            }
            
            // Cleanup modules if they exist
            if (state.networkMonitor && typeof state.networkMonitor.cleanup === 'function') {
                state.networkMonitor.cleanup();
            }
            
            state.isInitialized = false;
            
        } catch (error) {
            console.error('Critical error during cleanup:', error);
        }
    }
    
    /**
     * Add event listener with proper tracking for cleanup
     * @param {HTMLElement} element - DOM element
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    function addTrackedEventListener(element, event, handler, options = {}) {
        if (!element || !element.addEventListener) {
            console.warn('Invalid element provided for event listener');
            return;
        }
        
        element.addEventListener(event, handler, options);
        
        if (!state.eventListeners.has(element)) {
            state.eventListeners.set(element, []);
        }
        state.eventListeners.get(element).push({ event, handler, options });
    }
    
    // ===== Status Management =====
    /**
     * Safely display status messages with XSS protection
     * Uses DOM manipulation instead of innerHTML for security
     * @param {string} msg - Status message
     * @param {string} type - Status type: 'processing', 'success', 'error'
     * @param {number} duration - Optional duration in milliseconds
     */
    function showStatus(msg, type = 'processing', duration = null) {
        const statusElement = dom.$('status');
        const statusText = dom.$('status-text');
        
        if (!statusElement || !statusText) {
            console.error('Status elements not found');
            return;
        }
        
        // Clear previous content
        statusText.innerHTML = '';
        
        // Create icon element if message contains icon class
        const iconMatch = msg.match(/<i class="([^"]+)"><\/i>/);
        if (iconMatch) {
            const icon = document.createElement('i');
            icon.className = iconMatch[1];
            icon.setAttribute('aria-hidden', 'true');
            statusText.appendChild(icon);
            
            // Add space after icon
            statusText.appendChild(document.createTextNode(' '));
            
            // Remove icon from message and add remaining text
            const remainingText = msg.replace(/<i class="[^"]+"><\/i>/, '').trim();
            if (remainingText) {
                statusText.appendChild(document.createTextNode(remainingText));
            }
        } else {
            // No icon, just text content
            statusText.textContent = msg;
        }
        
        // Apply styling
        statusElement.className = `status-indicator show ${type}`;
        
        // Auto-hide after duration if provided
        if (duration && typeof duration === 'number') {
            setTimeout(() => hideStatus(), duration);
        }
    }
    
    /**
     * Hide status indicator
     */
    function hideStatus() {
        const statusElement = dom.$('status');
        if (statusElement) {
            statusElement.classList.remove('show');
        }
    }
    
    // ===== Template Switching =====
    /**
     * Set the active template and hide/show corresponding input fields
     * @param {HTMLElement} activeBtn - The active template button
     */
    function setActiveTemplate(activeBtn) {
        const templateButtons = dom.$$('.template-btn');
        const templateInputs = dom.$$('.template-input');
        
        templateButtons.forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-checked', 'false');
        });
        
        activeBtn.classList.add('active');
        activeBtn.setAttribute('aria-checked', 'true');
        
        templateInputs.forEach(input => {
            input.style.display = 'none';
        });
        
        const targetInput = dom.$(`input-${activeBtn.dataset.template}`);
        if (targetInput) {
            targetInput.style.display = 'block';
        }
        
        // Dispatch template-switched event to re-attach event listeners
        window.dispatchEvent(new CustomEvent('template-switched'));
        
        debouncedGenerate();
    }
    
    // ===== Color Pickers =====
    /**
     * Setup color picker with preview and hex input
     * @param {string} colorId - Color input ID
     * @param {string} previewId - Preview element ID
     * @param {string} hexId - Hex input ID
     */
    function setupColor(colorId, previewId, hexId) {
        const colorInput = dom.$(colorId);
        const preview = dom.$(previewId);
        const hexInput = dom.$(hexId);
        
        if (!colorInput || !preview || !hexInput) {
            console.error(`Color picker elements not found: ${colorId}, ${previewId}, ${hexId}`);
            return;
        }
        
        // Click handler for preview
        addTrackedEventListener(preview, 'click', () => {
            colorInput.click();
        });
        
        // Keyboard handler for preview
        addTrackedEventListener(preview, 'keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                colorInput.click();
            }
        });
        
        // Color input handler
        addTrackedEventListener(colorInput, 'input', (e) => {
            const color = e.target.value;
            preview.style.backgroundColor = color;
            hexInput.value = color.toUpperCase();
            debouncedGenerate();
        });
        
        // Hex input handler
        addTrackedEventListener(hexInput, 'input', (e) => {
            let value = e.target.value.trim();
            if (!value.startsWith('#')) value = '#' + value;
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                colorInput.value = value;
                preview.style.backgroundColor = value;
                debouncedGenerate();
            }
        });
    }
    
    // ===== Range Sliders =====
    /**
     * Setup range sliders with value display
     */
    function setupRangeSliders() {
        const sizeSlider = dom.$('qr-size');
        const marginSlider = dom.$('margin-size');
        const logoSlider = dom.$('logo-size');
        
        if (sizeSlider) {
            addTrackedEventListener(sizeSlider, 'input', (e) => {
                const display = dom.$('size-display');
                if (display) display.textContent = e.target.value;
                debouncedGenerate();
            });
        }
        
        if (marginSlider) {
            addTrackedEventListener(marginSlider, 'input', (e) => {
                const display = dom.$('margin-display');
                if (display) display.textContent = e.target.value;
                debouncedGenerate();
            });
        }
        
        if (logoSlider) {
            addTrackedEventListener(logoSlider, 'input', (e) => {
                const display = dom.$('logo-size-display');
                if (display) display.textContent = e.target.value;
                debouncedGenerate();
            });
        }
    }
    
    // ===== Logo Upload =====
    /**
     * Setup logo upload with validation and preview
     */
    function setupLogoUpload() {
        const logoUpload = dom.$('logo-upload');
        const clearLogoBtn = dom.$('clear-logo');
        
        if (!logoUpload) {
            console.error('Logo upload element not found');
            return;
        }
        
        addTrackedEventListener(logoUpload, 'change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!file.type.startsWith('image/')) {
                showStatus('Please upload an image', 'error');
                return;
            }
            
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showStatus('Image file too large (max 5MB)', 'error');
                return;
            }
            
            const reader = new FileReader();
            
            addTrackedEventListener(reader, 'load', (ev) => {
                const img = new Image();
                
                addTrackedEventListener(img, 'load', () => {
                    state.logo = img;
                    const preview = dom.$('logo-preview');
                    const wrap = dom.$('logo-preview-wrap');
                    const errorCorrection = dom.$('error-correction');
                    
                    if (preview) preview.src = ev.target.result;
                    if (wrap) wrap.style.display = 'block';
                    if (errorCorrection) errorCorrection.value = 'H'; // Auto high EC for logos
                    
                    debouncedGenerate();
                });
                
                img.src = ev.target.result;
            });
            
            reader.readAsDataURL(file);
        });
        
        if (clearLogoBtn) {
            addTrackedEventListener(clearLogoBtn, 'click', () => {
                state.logo = null;
                logoUpload.value = '';
                const wrap = dom.$('logo-preview-wrap');
                if (wrap) wrap.style.display = 'none';
                debouncedGenerate();
            });
        }
    }
    
    // ===== XSS Sanitization =====
    function sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        // Use DOMPurify to sanitize user input
        return DOMPurify.sanitize(input, {
            ALLOWED_TAGS: [],
            ALLOWED_ATTR: [],
            KEEP_CONTENT: true // Keep the text content but remove HTML
        });
    }
    
    // ===== QR Content Generation =====
    function getContent() {
        const tmpl = document.querySelector('.template-btn.active').dataset.template;
        
        switch(tmpl) {
            case 'text': return sanitizeInput(dom.$('text-content').value) || 'https://github.com';
            
            case 'wifi': {
                const ssid = sanitizeInput(dom.$('wifi-ssid').value) || 'WiFi';
                const pass = sanitizeInput(dom.$('wifi-password').value);
                const enc = sanitizeInput(dom.$('wifi-encryption').value);
                const hidden = dom.$('wifi-hidden').checked;
                let s = `WIFI:T:${enc};S:${esc(ssid)};`;
                if (pass && enc !== 'nopass') s += `P:${esc(pass)};`;
                if (hidden) s += 'H:true;';
                return s + ';';
            }
            
            case 'vcard': {
                const n = sanitizeInput(dom.$('vcard-name').value) || 'John Doe';
                const parts = n.split(' '), last = parts.length > 1 ? parts.pop() : '', first = parts.join(' ') || n;
                let v = `BEGIN:VCARD\nVERSION:3.0\nN:${esc(last)};${esc(first)};;;\nFN:${esc(n)}\n`;
                if (dom.$('vcard-org').value) v += `ORG:${esc(sanitizeInput(dom.$('vcard-org').value))}\n`;
                if (dom.$('vcard-title').value) v += `TITLE:${esc(sanitizeInput(dom.$('vcard-title').value))}\n`;
                if (dom.$('vcard-phone').value) v += `TEL:${esc(sanitizeInput(dom.$('vcard-phone').value))}\n`;
                if (dom.$('vcard-email').value) v += `EMAIL:${esc(sanitizeInput(dom.$('vcard-email').value))}\n`;
                if (dom.$('vcard-url').value) v += `URL:${esc(sanitizeInput(dom.$('vcard-url').value))}\n`;
                if (dom.$('vcard-address').value) v += `ADR:;;${esc(sanitizeInput(dom.$('vcard-address').value))};;;;\n`;
                return v + 'END:VCARD';
            }
            
            case 'mecard': {
                let m = 'MECARD:';
                const fields = [];
                if (dom.$('mecard-name').value) fields.push(`N:${esc(sanitizeInput(dom.$('mecard-name').value))}`);
                if (dom.$('mecard-phone').value) fields.push(`TEL:${esc(sanitizeInput(dom.$('mecard-phone').value))}`);
                if (dom.$('mecard-email').value) fields.push(`EMAIL:${esc(sanitizeInput(dom.$('mecard-email').value))}`);
                if (dom.$('mecard-url').value) fields.push(`URL:${esc(sanitizeInput(dom.$('mecard-url').value))}`);
                if (dom.$('mecard-address').value) fields.push(`ADR:${esc(sanitizeInput(dom.$('mecard-address').value))}`);
                if (dom.$('mecard-birthday').value) fields.push(`BDAY:${esc(sanitizeInput(dom.$('mecard-birthday').value))}`);
                if (dom.$('mecard-note').value) fields.push(`NOTE:${esc(sanitizeInput(dom.$('mecard-note').value))}`);
                return m + fields.join(';') + ';';
            }
            
            case 'event': {
                const title = sanitizeInput(dom.$('event-title').value) || 'Event';
                const start = dom.$('event-start').value;
                const end = dom.$('event-end').value;
                const location = sanitizeInput(dom.$('event-location').value);
                const description = sanitizeInput(dom.$('event-description').value);
                const timezone = sanitizeInput(dom.$('event-timezone').value);
                
                let v = `BEGIN:VEVENT\nSUMMARY:${esc(title)}\n`;
                if (start) {
                    const startDate = new Date(start);
                    v += `DTSTART:${formatDateForVCalendar(startDate, timezone)}\n`;
                }
                if (end) {
                    const endDate = new Date(end);
                    v += `DTEND:${formatDateForVCalendar(endDate, timezone)}\n`;
                }
                if (location) v += `LOCATION:${esc(location)}\n`;
                if (description) v += `DESCRIPTION:${esc(description)}\n`;
                v += 'END:VEVENT';
                return v;
            }
            
            case 'bitcoin': {
                const address = sanitizeInput(dom.$('bitcoin-address').value);
                const amount = sanitizeInput(dom.$('bitcoin-amount').value);
                const label = sanitizeInput(dom.$('bitcoin-label').value);
                const message = sanitizeInput(dom.$('bitcoin-message').value);
                
                let uri = 'bitcoin:';
                if (address) uri += address;
                const params = [];
                if (amount) params.push(`amount=${amount}`);
                if (label) params.push(`label=${encodeURIComponent(label)}`);
                if (message) params.push(`message=${encodeURIComponent(message)}`);
                if (params.length) uri += '?' + params.join('&');
                return uri;
            }
            
            case 'geo': {
                const lat = sanitizeInput(dom.$('geo-latitude').value);
                const lng = sanitizeInput(dom.$('geo-longitude').value);
                const alt = sanitizeInput(dom.$('geo-altitude').value);
                const query = sanitizeInput(dom.$('geo-query').value);
                
                if (!lat || !lng) return 'geo:0,0';
                
                let uri = `geo:${lat},${lng}`;
                if (alt) uri += `,${alt}`;
                if (query) uri += `?q=${encodeURIComponent(query)}`;
                return uri;
            }
            
            case 'social': {
                const platform = sanitizeInput(dom.$('social-platform').value);
                const username = sanitizeInput(dom.$('social-username').value);
                
                if (platform === 'custom') {
                    return username || 'https://example.com';
                }
                
                const urls = {
                    facebook: `https://facebook.com/${username}`,
                    twitter: `https://twitter.com/${username}`,
                    instagram: `https://instagram.com/${username}`,
                    linkedin: `https://linkedin.com/in/${username}`,
                    youtube: `https://youtube.com/@${username}`,
                    tiktok: `https://tiktok.com/@${username}`,
                    github: `https://github.com/${username}`
                };
                
                return urls[platform] || `https://${platform}.com/${username}`;
            }
            
            case 'app': {
                const platform = sanitizeInput(dom.$('app-platform').value);
                const appId = sanitizeInput(dom.$('app-id').value);
                
                if (platform === 'custom') {
                    return appId || 'https://example.com/app';
                }
                
                const urls = {
                    ios: `https://apps.apple.com/app/id${appId}`,
                    android: `https://play.google.com/store/apps/details?id=${appId}`,
                    windows: `https://www.microsoft.com/store/apps/${appId}`,
                    amazon: `https://www.amazon.com/gp/product/${appId}`
                };
                
                return urls[platform] || `https://store.${platform}.com/app/${appId}`;
            }
            
            case 'email': {
                const to = sanitizeInput(dom.$('email-to').value) || 'test@example.com';
                let m = `mailto:${to}`;
                const p = [];
                if (dom.$('email-subject').value) p.push(`subject=${encodeURIComponent(sanitizeInput(dom.$('email-subject').value))}`);
                if (dom.$('email-body').value) p.push(`body=${encodeURIComponent(sanitizeInput(dom.$('email-body').value))}`);
                return p.length ? m + '?' + p.join('&') : m;
            }
            
            case 'sms': {
                const ph = sanitizeInput(dom.$('sms-phone').value) || '+1234567890';
                const msg = sanitizeInput(dom.$('sms-message').value);
                return msg ? `sms:${ph}?body=${encodeURIComponent(msg)}` : `sms:${ph}`;
            }
            
            case 'phone': return `tel:${sanitizeInput(dom.$('phone-number').value) || '+1234567890'}`;
            
            default: return 'https://github.com';
        }
    }
    
    function formatDateForVCalendar(date, timezone) {
        // Format date for vCalendar (YYYYMMDDTHHMMSSZ)
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');
        return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
    }
    
    function esc(s) { return s.replace(/([\\;,:"'])/g, '\\$1'); }
    
    // ===== Template Preview Updates =====
    function updateSocialPreview() {
        const platform = dom.$('social-platform').value;
        const username = dom.$('social-username').value;
        const preview = dom.$('social-preview-url');
        
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
        const platform = dom.$('app-platform').value;
        const appId = dom.$('app-id').value;
        const preview = dom.$('app-preview-url');
        
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
    
    // ===== QR Generation =====
    /**
     * Generate QR code with caching and error handling
     */
    function generate() {
        if (state.generating) return;
        
        const configHash = getConfigHash();
        
        // Check cache first
        if (state.qrCache.has(configHash)) {
            const cached = state.qrCache.get(configHash);
            displayQRCode(cached);
            showStatus('<i class="bi bi-check-circle-fill"></i> Ready (cached)', 'success', CONSTANTS.STATUS_TIMEOUT);
            return;
        }
        
        state.generating = true;
        
        // Show loading state
        const qrContainer = dom.$('qr-container');
        if (qrContainer) {
            qrContainer.classList.add('loading');
        }
        
        try {
            const content = getContent();
            const size = parseInt(dom.$('qr-size')?.value || '400', 10);
            const fg = dom.$('fg-color')?.value || '#000000';
            const bg = dom.$('bg-color')?.value || '#ffffff';
            const ec = dom.$('error-correction')?.value || 'M';
            const margin = parseInt(dom.$('margin-size')?.value || '2', 10);
            const style = dom.$('dot-style')?.value || 'square';
            const logoPercent = parseInt(dom.$('logo-size')?.value || '20', 10);
            
            const qr = qrcode(0, ec);
            qr.addData(content);
            qr.make();
            
            const count = qr.getModuleCount();
            const cell = Math.floor(size / (count + margin * 2));
            const actual = cell * (count + margin * 2);
            
            const cvs = document.createElement('canvas');
            cvs.width = cvs.height = actual;
            const ctx = cvs.getContext('2d');
            
            if (!ctx) {
                throw new Error('Failed to get canvas context');
            }
            
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
            
            // Logo (aspect ratio preserved)
            if (state.logo) {
                const maxSize = actual * (logoPercent / 100);
                const ratio = state.logo.naturalWidth / state.logo.naturalHeight;
                let w, h;
                if (ratio >= 1) { w = maxSize; h = maxSize / ratio; }
                else { h = maxSize; w = maxSize * ratio; }
                
                const lx = (actual - w) / 2;
                const ly = (actual - h) / 2;
                const pad = Math.max(w, h) * 0.1;
                
                // Background
                ctx.fillStyle = bg;
                roundRect(ctx, lx - pad, ly - pad, w + pad*2, h + pad*2, pad * 0.5);
                
                // Logo
                ctx.drawImage(state.logo, lx, ly, w, h);
            }
            
            // Cache the result
            state.qrCache.set(configHash, cvs);
            
            // Limit cache size using MAX_CACHE_SIZE constant
            if (state.qrCache.size > CONSTANTS.MAX_CACHE_SIZE) {
                const firstKey = state.qrCache.keys().next().value;
                const oldCanvas = state.qrCache.get(firstKey);
                if (oldCanvas) {
                    oldCanvas.width = 0;
                    oldCanvas.height = 0;
                }
                state.qrCache.delete(firstKey);
            }
            
            displayQRCode(cvs);
            
        } catch (err) {
            console.error('QR generation error:', err);
            showStatus(`<i class="bi bi-exclamation-triangle"></i> ${err.message || 'QR generation failed'}`, 'error');
        } finally {
            state.generating = false;
            if (qrContainer) {
                qrContainer.classList.remove('loading');
            }
        }
    }
    
    /**
     * Display QR code with proper memory management
     * @param {HTMLCanvasElement} qrCanvas - The QR code canvas
     */
    function displayQRCode(qrCanvas) {
        const qrcodeDiv = dom.$('qrcode');
        const placeholder = dom.$('placeholder');
        const qrContainer = dom.$('qr-container');
        const downloadSection = dom.$('download-section');
        
        if (!qrcodeDiv) {
            console.error('QR code container not found');
            return;
        }
        
        // Clear previous QR code properly to prevent memory leaks
        while (qrcodeDiv.firstChild) {
            const child = qrcodeDiv.firstChild;
            if (child.tagName === 'CANVAS') {
                child.width = 0;
                child.height = 0;
            }
            qrcodeDiv.removeChild(child);
        }
        
        if (placeholder) placeholder.style.display = 'none';
        if (qrContainer) qrContainer.classList.add('has-qr');
        
        qrcodeDiv.appendChild(qrCanvas);
        
        if (downloadSection) downloadSection.style.display = 'block';
        
        state.canvas = qrCanvas;
        showStatus('<i class="bi bi-check-circle-fill"></i> Ready', 'success', CONSTANTS.STATUS_TIMEOUT);
    }
    
    /**
     * Draw rounded rectangle on canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} w - Width
     * @param {number} h - Height
     * @param {number} r - Corner radius
     */
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
    
    /**
     * Debounced QR generation to prevent excessive calls
     */
    function debouncedGenerate() {
        if (state.debounceTimer) {
            clearTimeout(state.debounceTimer);
        }
        state.debounceTimer = setTimeout(() => {
            state.debounceTimer = null;
            generate();
        }, CONSTANTS.DEBOUNCE_DELAY);
    }
    
    // ===== Input Validation =====
    function validateInput(input) {
        const value = input.value.trim();
        const type = input.type;
        let isValid = true;
        let message = '';
        
        // Remove existing validation classes
        input.classList.remove('is-valid', 'is-invalid');
        
        switch(type) {
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (value && !emailRegex.test(value)) {
                    isValid = false;
                    message = 'Please enter a valid email address';
                }
                break;
                
            case 'url':
                try {
                    if (value && !value.startsWith('http')) {
                        // Auto-prefix with https:// if missing
                        input.value = 'https://' + value;
                    }
                    if (value) new URL(input.value);
                } catch {
                    isValid = false;
                    message = 'Please enter a valid URL';
                }
                break;
                
            case 'tel':
                const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
                if (value && !phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''))) {
                    isValid = false;
                    message = 'Please enter a valid phone number';
                }
                break;
        }
        
        // Custom validation for specific fields
        if (input.id === 'wifi-ssid' && !value) {
            isValid = false;
            message = 'Network name is required';
        }
        
        if (input.id === 'vcard-name' && !value) {
            isValid = false;
            message = 'Name is required for vCard';
        }
        
        // Apply validation styling
        if (value) {
            input.classList.add(isValid ? 'is-valid' : 'is-invalid');
            if (!isValid) {
                showValidationMessage(input, message);
            } else {
                clearValidationMessage(input);
            }
        }
        
        return isValid;
    }
    
    function showValidationMessage(input, message) {
        clearValidationMessage(input);
        const feedback = document.createElement('div');
        feedback.className = 'invalid-feedback';
        feedback.textContent = message;
        feedback.id = input.id + '-feedback';
        input.parentNode.appendChild(feedback);
    }
    
    function clearValidationMessage(input) {
        const feedback = document.getElementById(input.id + '-feedback');
        if (feedback) feedback.remove();
    }
    
    // ===== Progressive Disclosure =====
    function setupProgressiveDisclosure() {
        // Advanced options toggle
        const advancedSection = document.createElement('div');
        advancedSection.className = 'control-section';
        advancedSection.innerHTML = `
            <h6><i class="bi bi-gear" aria-hidden="true"></i> Advanced Options</h6>
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="show-advanced">
                <label class="form-check-label small" for="show-advanced">Show advanced settings</label>
            </div>
            <div id="advanced-options" style="display: none;">
                <div class="row g-2">
                    <div class="col-6">
                        <label for="quiet-zone" class="form-label small">Quiet Zone</label>
                        <select class="form-select form-select-sm qr-input" id="quiet-zone">
                            <option value="0">None</option>
                            <option value="1">Small</option>
                            <option value="2" selected>Medium</option>
                            <option value="4">Large</option>
                        </select>
                    </div>
                    <div class="col-6">
                        <label for="version" class="form-label small">QR Version</label>
                        <select class="form-select form-select-sm qr-input" id="version">
                            <option value="0" selected>Auto</option>
                            <option value="1">Version 1 (21x21)</option>
                            <option value="2">Version 2 (25x25)</option>
                            <option value="3">Version 3 (29x29)</option>
                            <option value="4">Version 4 (33x33)</option>
                            <option value="5">Version 5 (37x37)</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
        
        // Insert before the logo section
        const logoSection = document.querySelector('section[aria-labelledby="logo-heading"]');
        logoSection.parentNode.insertBefore(advancedSection, logoSection);
        
        // Toggle advanced options
        document.getElementById('show-advanced').addEventListener('change', function() {
            const advanced = document.getElementById('advanced-options');
            advanced.style.display = this.checked ? 'block' : 'none';
        });
    }
    
    function getConfigHash() {
        const config = {
            content: getContent(),
            size: dom.$('qr-size').value,
            fg: dom.$('fg-color').value,
            bg: dom.$('bg-color').value,
            ec: dom.$('error-correction').value,
            margin: dom.$('margin-size').value,
            style: dom.$('dot-style').value,
            logoPercent: dom.$('logo-size').value,
            logo: state.logo ? 'present' : 'absent'
        };
        return JSON.stringify(config);
    }
    
    // ===== User Guidance =====
    function showUserGuidance() {
        // Show tips for first-time users
        if (!localStorage.getItem('qr-studio-visited')) {
            setTimeout(() => {
                showStatus('<i class="bi bi-lightbulb"></i> Tip: Try different templates and customize colors!', 'success');
                setTimeout(hideStatus, 3000);
                localStorage.setItem('qr-studio-visited', 'true');
            }, 2000);
        }
    }
    
    // ===== Downloads =====
    function download(fmt) {
        if (!state.canvas) return showStatus('Generate a QR code first', 'error');
        
        const link = document.createElement('a');
        const date = new Date().toISOString().slice(0,10);
        
        if (fmt === 'svg') {
            link.href = URL.createObjectURL(new Blob([generateSVG()], {type: 'image/svg+xml'}));
            link.download = `qrcode-${date}.svg`;
        } else if (fmt === 'jpg') {
            const tmp = document.createElement('canvas');
            tmp.width = state.canvas.width; tmp.height = state.canvas.height;
            const ctx = tmp.getContext('2d');
            ctx.fillStyle = dom.$('bg-color').value;
            ctx.fillRect(0, 0, tmp.width, tmp.height);
            ctx.drawImage(state.canvas, 0, 0);
            link.href = tmp.toDataURL('image/jpeg', 0.95);
            link.download = `qrcode-${date}.jpg`;
        } else {
            link.href = state.canvas.toDataURL('image/png');
            link.download = `qrcode-${date}.png`;
        }
        
        link.click();
        if (fmt === 'svg') URL.revokeObjectURL(link.href);
        showStatus(`<i class="bi bi-check"></i> Downloaded ${fmt.toUpperCase()}`, 'success');
        setTimeout(hideStatus, 1500);
    }
    
    function generateSVG() {
        const content = getContent();
        const size = +dom.$('qr-size').value;
        const fg = dom.$('fg-color').value;
        const bg = dom.$('bg-color').value;
        const ec = dom.$('error-correction').value;
        const margin = +dom.$('margin-size').value;
        const style = dom.$('dot-style').value;
        
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
        
        // Sanitize the SVG content to prevent XSS
        const svgContent = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="100%" height="100%" fill="${bg}"/>${paths}</svg>`;
        return DOMPurify.sanitize(svgContent, {
            USE_PROFILES: { svg: true, svgFilters: true }
        });
    }
    
    // ===== Event Listeners =====
    /**
     * Setup all event listeners with proper tracking
     */
    function setupEventListeners() {
        const templateButtons = dom.$$('.template-btn');
        
        // Template buttons
        templateButtons.forEach((btn, index) => {
            addTrackedEventListener(btn, 'click', function() {
                setActiveTemplate(this);
            });
            
            // Keyboard navigation for template buttons
            addTrackedEventListener(btn, 'keydown', function(e) {
                const buttons = dom.$$('.template-btn');
                const currentIndex = Array.from(buttons).indexOf(this);
                let nextIndex;
                
                switch(e.key) {
                    case 'ArrowRight':
                    case 'ArrowDown':
                        e.preventDefault();
                        nextIndex = (currentIndex + 1) % buttons.length;
                        buttons[nextIndex].focus();
                        break;
                    case 'ArrowLeft':
                    case 'ArrowUp':
                        e.preventDefault();
                        nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
                        buttons[nextIndex].focus();
                        break;
                    case 'Home':
                        e.preventDefault();
                        buttons[0].focus();
                        break;
                    case 'End':
                        e.preventDefault();
                        buttons[buttons.length - 1].focus();
                        break;
                    case ' ':
                    case 'Enter':
                        e.preventDefault();
                        setActiveTemplate(this);
                        break;
                }
            });
        });
        
        // Template-specific event listeners
        const socialPlatform = dom.$('social-platform');
        const socialUsername = dom.$('social-username');
        const appPlatform = dom.$('app-platform');
        const appId = dom.$('app-id');
        
        if (socialPlatform) {
            addTrackedEventListener(socialPlatform, 'change', () => {
                updateSocialPreview();
                debouncedGenerate();
            });
        }
        
        if (socialUsername) {
            addTrackedEventListener(socialUsername, 'input', () => {
                updateSocialPreview();
                debouncedGenerate();
            });
        }
        
        if (appPlatform) {
            addTrackedEventListener(appPlatform, 'change', () => {
                updateAppPreview();
                debouncedGenerate();
            });
        }
        
        if (appId) {
            addTrackedEventListener(appId, 'input', () => {
                updateAppPreview();
                debouncedGenerate();
            });
        }
        
        // Download buttons
        const downloadPng = dom.$('dl-png');
        const downloadJpg = dom.$('dl-jpg');
        const downloadSvg = dom.$('dl-svg');
        
        if (downloadPng) {
            addTrackedEventListener(downloadPng, 'click', () => download('png'));
        }
        if (downloadJpg) {
            addTrackedEventListener(downloadJpg, 'click', () => download('jpg'));
        }
        if (downloadSvg) {
            addTrackedEventListener(downloadSvg, 'click', () => download('svg'));
        }
        
        // Auto-generate on input - only for text inputs and textareas
        const attachInputListeners = () => {
            dom.$$('.qr-input').forEach(el => {
                // Skip if already has input listener
                if (el.dataset.hasInputListener === 'true') return;
                
                if ((el.tagName === 'INPUT' && el.type !== 'file') || el.tagName === 'TEXTAREA') {
                    // Use input event for real-time updates on text fields
                    addTrackedEventListener(el, 'input', () => {
                        validateInput(el);
                        debouncedGenerate();
                    });
                    el.dataset.hasInputListener = 'true';
                } else if (el.tagName === 'SELECT' || el.type === 'checkbox') {
                    // Use change event for select dropdowns and checkboxes
                    addTrackedEventListener(el, 'change', () => {
                        validateInput(el);
                        debouncedGenerate();
                    });
                    el.dataset.hasInputListener = 'true';
                }
            });
        };
        
        // Initial attachment
        attachInputListeners();
        
        // Re-attach listeners when templates switch (some inputs may become visible)
        window.addEventListener('template-switched', attachInputListeners);
    }
    
    // ===== Initialization =====
    /**
     * Initialize the application with error handling
     */
    async function init() {
        try {
            // Load non-critical modules dynamically
            const [{ NetworkMonitor }, { ThemeManager }] = await Promise.all([
                import('./modules/network-monitor.js'),
                import('./modules/theme-manager.js')
            ]);
            
            // Initialize modules
            state.networkMonitor = new NetworkMonitor();
            state.themeManager = new ThemeManager();
            
            // Setup core functionality
            setupColor('fg-color', 'fg-preview', 'fg-hex');
            setupColor('bg-color', 'bg-preview', 'bg-hex');
            setupRangeSliders();
            setupLogoUpload();
            setupEventListeners();
            setupProgressiveDisclosure();
            showUserGuidance();
            
            // Generate initial QR code
            setTimeout(() => generate(), CONSTANTS.INITIAL_GENERATION_DELAY);
            
            showStatus('<i class="bi bi-check-circle-fill"></i> Application loaded successfully', 'success', CONSTANTS.STATUS_TIMEOUT * 2);
            
            state.isInitialized = true;
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            showStatus('<i class="bi bi-exclamation-triangle"></i> Failed to load some features', 'error');
            
            // Fallback: initialize core functionality without modules
            setupColor('fg-color', 'fg-preview', 'fg-hex');
            setupColor('bg-color', 'bg-preview', 'bg-hex');
            setupRangeSliders();
            setupLogoUpload();
            setupEventListeners();
            setupProgressiveDisclosure();
            showUserGuidance();
            
            setTimeout(() => generate(), CONSTANTS.INITIAL_GENERATION_DELAY);
        }
    }
    
    // Start the application
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Cleanup on page unload to prevent memory leaks
    window.addEventListener('beforeunload', cleanup);
    
})();