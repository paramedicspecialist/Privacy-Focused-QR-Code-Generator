/**
 * Network Monitor Module
 * Monitors and logs all network requests for privacy/security transparency
 *
 * @version 1.0.0
 * @author Darkhorse
 * @license MIT
 */

export class NetworkMonitor {
    // Constants for resource types
    static RESOURCE_TYPES = {
        CSS: 'css',
        FONT: 'font',
        SCRIPT: 'script',
        IMAGE: 'img',
        DOCUMENT: 'document',
        FETCH: 'fetch',
        XHR: 'xhr',
        BEACON: 'beacon',
        WEBSOCKET: 'websocket'
    };
    
    // Constants for HTTP methods
    static HTTP_METHODS = {
        GET: 'GET',
        POST: 'POST',
        PUT: 'PUT',
        DELETE: 'DELETE',
        HEAD: 'HEAD',
        OPTIONS: 'OPTIONS',
        BEACON: 'BEACON',
        WEBSOCKET: 'WS'
    };
    
    // Constants for status indicators
    static STATUS = {
        OK: '✓',
        PENDING: '⚠️',
        WEBSOCKET: '🔌'
    };
    
    constructor() {
        this.log = document.getElementById('network-log');
        this.outboundStatus = document.getElementById('outbound-status');
        this.requestCount = document.getElementById('request-count');
        this.totalRequests = 0;
        this.outboundCount = 0;
        this.eventListeners = []; // Track event listeners for cleanup
        this.observers = []; // Track observers for cleanup
        
        // Validate required elements
        if (!this.log || !this.outboundStatus || !this.requestCount) {
            console.error('NetworkMonitor: Required DOM elements not found');
            return;
        }
        
        this.init();
    }

    /**
     * Initialize network monitor
     */
    init() {
        try {
            this.setupPerformanceObserver();
            this.captureInitialResources();
            this.interceptFetch();
            this.interceptXHR();
            this.interceptBeacon();
            this.interceptWebSocket();
        } catch (error) {
            console.error('NetworkMonitor initialization error:', error);
        }
    }
    
    /**
     * Cleanup resources to prevent memory leaks
     */
    cleanup() {
        try {
            // Clear all event listeners
            this.eventListeners.forEach(({ element, event, handler }) => {
                try {
                    if (element && element.removeEventListener) {
                        element.removeEventListener(event, handler);
                    }
                } catch (error) {
                    console.warn(`Failed to remove event listener: ${event}`, error);
                }
            });
            this.eventListeners = [];
            
            // Disconnect observers
            this.observers.forEach(observer => {
                try {
                    if (observer && observer.disconnect) {
                        observer.disconnect();
                    }
                } catch (error) {
                    console.warn('Failed to disconnect observer', error);
                }
            });
            this.observers = [];
        } catch (error) {
            console.error('NetworkMonitor cleanup error:', error);
        }
    }
    
    /**
     * Add event listener with tracking for cleanup
     * @param {HTMLElement} element - DOM element
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    addEventListener(element, event, handler) {
        if (!element || !element.addEventListener) {
            console.warn('Invalid element provided for event listener');
            return;
        }
        
        element.addEventListener(event, handler);
        this.eventListeners.push({ element, event, handler });
    }

    /**
     * Update request count display
     */
    updateCount() {
        try {
            this.requestCount.textContent = `${this.totalRequests} req${this.totalRequests !== 1 ? 's' : ''}`;
            if (this.outboundCount > 0) {
                this.requestCount.style.background = '#dc3545';
                this.requestCount.textContent += ` (${this.outboundCount} OUT!)`;
            }
        } catch (error) {
            console.error('NetworkMonitor updateCount error:', error);
        }
    }

    /**
     * Mark request as outbound
     * @param {string} method - HTTP method
     * @param {string} url - Request URL
     */
    markOutbound(method, url) {
        try {
            this.outboundCount++;
            // Use textContent instead of innerHTML to prevent XSS
            this.outboundStatus.textContent = `${this.outboundCount} Outbound!`;
            this.outboundStatus.className = 'no-outbound outbound-warning';
            this.updateCount();
        } catch (error) {
            console.error('NetworkMonitor markOutbound error:', error);
        }
    }

    /**
     * Shorten URL for display
     * @param {string} url - Full URL
     * @returns {string} Shortened URL
     */
    shortenUrl(url) {
        try {
            const u = new URL(url);
            const path = u.pathname.split('/').pop() || u.pathname;
            return `${u.hostname}/${path}`;
        } catch {
            return url.substring(0, 50);
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Categorize resource type based on URL and initiator
     * @param {string} url - Resource URL
     * @param {string} initiatorType - Initiator type
     * @returns {string} Resource type
     */
    categorizeResource(url, initiatorType) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();
            
            // Check file extensions first
            if (pathname.endsWith('.css')) {
                return NetworkMonitor.RESOURCE_TYPES.CSS;
            }
            if (pathname.endsWith('.woff2') || pathname.endsWith('.woff') ||
                pathname.endsWith('.ttf') || pathname.endsWith('.otf')) {
                return NetworkMonitor.RESOURCE_TYPES.FONT;
            }
            if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) {
                return NetworkMonitor.RESOURCE_TYPES.SCRIPT;
            }
            if (pathname.endsWith('.png') || pathname.endsWith('.jpg') ||
                pathname.endsWith('.jpeg') || pathname.endsWith('.gif') ||
                pathname.endsWith('.svg') || pathname.endsWith('.webp')) {
                return NetworkMonitor.RESOURCE_TYPES.IMAGE;
            }
            if (pathname.endsWith('.html')) {
                return NetworkMonitor.RESOURCE_TYPES.DOCUMENT;
            }
        } catch (e) {
            // Invalid URL, fall back to initiatorType
        }
        
        // If no extension match, use initiatorType but normalize it
        if (initiatorType === 'link') {
            return NetworkMonitor.RESOURCE_TYPES.CSS; // CSS files loaded via <link> tags
        }
        if (initiatorType === 'css') {
            return NetworkMonitor.RESOURCE_TYPES.FONT; // Fonts loaded via CSS @font-face
        }
        
        return initiatorType || NetworkMonitor.RESOURCE_TYPES.SCRIPT;
    }

    /**
     * Add entry to network log
     * @param {string} method - HTTP method
     * @param {string} type - Resource type
     * @param {string} url - Request URL
     * @param {string} status - Status indicator
     */
    addEntry(method, type, url, status = NetworkMonitor.STATUS.OK) {
        try {
            this.totalRequests++;
            const methodClass = `method-${method.toLowerCase()}`;
            const statusClass = status === NetworkMonitor.STATUS.OK ? 'status-ok' : 'status-pending';
            
            // Create new entry
            const entry = document.createElement('div');
            entry.className = 'network-entry';
            
            // Use textContent instead of innerHTML to prevent XSS
            const methodSpan = document.createElement('span');
            methodSpan.className = `method-badge ${methodClass}`;
            methodSpan.textContent = method;
            
            const typeSpan = document.createElement('span');
            typeSpan.className = 'resource-type';
            typeSpan.textContent = type;
            
            const urlSpan = document.createElement('span');
            urlSpan.className = 'resource-url';
            urlSpan.title = url; // Use original URL for title
            urlSpan.textContent = this.shortenUrl(url);
            urlSpan.style.cursor = 'pointer';
            
            const statusSpan = document.createElement('span');
            statusSpan.className = statusClass;
            statusSpan.textContent = status;
            
            // Append all spans to entry
            entry.appendChild(methodSpan);
            entry.appendChild(typeSpan);
            entry.appendChild(urlSpan);
            entry.appendChild(statusSpan);
            
            // Add clickable URL functionality
            this.addEventListener(urlSpan, 'click', () => {
                window.open(url, '_blank');
            });
            
            // Insert at the beginning to show most recent at top
            this.log.insertBefore(entry, this.log.firstChild);
            
            // Limit to 10 entries
            const entries = this.log.querySelectorAll('.network-entry');
            if (entries.length > 10) {
                entries[entries.length - 1].remove();
            }
            
            this.updateCount();
            // Keep scroll at top to show newest entries
            this.log.scrollTop = 0;
        } catch (error) {
            console.error('NetworkMonitor addEntry error:', error);
        }
    }

    /**
     * Setup PerformanceObserver to monitor resource loads
     */
    setupPerformanceObserver() {
        // PerformanceObserver - Monitors all resource loads (scripts, css, images, fonts)
        if (window.PerformanceObserver) {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'resource') {
                        const resourceType = this.categorizeResource(entry.name, entry.initiatorType);
                        this.addEntry(NetworkMonitor.HTTP_METHODS.GET, resourceType, entry.name);
                    }
                }
            });
            observer.observe({ entryTypes: ['resource'] });
            this.observers.push(observer); // Track for cleanup
        }
    }

    /**
     * Capture resources loaded before our script ran
     */
    captureInitialResources() {
        try {
            if (window.performance && performance.getEntriesByType) {
                const resources = performance.getEntriesByType('resource');
                this.log.innerHTML = ''; // Clear placeholder
                resources.forEach(entry => {
                    const resourceType = this.categorizeResource(entry.name, entry.initiatorType);
                    this.addEntry(NetworkMonitor.HTTP_METHODS.GET, resourceType, entry.name);
                });
            }
        } catch (error) {
            console.error('NetworkMonitor captureInitialResources error:', error);
        }
    }

    /**
     * Intercept fetch() API calls
     */
    interceptFetch() {
        // Intercept fetch() API - This catches ALL fetch calls including POST/PUT/DELETE
        const originalFetch = window.fetch;
        window.fetch = (...args) => {
            const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || args[0]);
            const options = args[1] || {};
            const method = (options.method || NetworkMonitor.HTTP_METHODS.GET).toUpperCase();
            
            this.addEntry(method, NetworkMonitor.RESOURCE_TYPES.FETCH, url, method === NetworkMonitor.HTTP_METHODS.GET ? NetworkMonitor.STATUS.OK : NetworkMonitor.STATUS.PENDING);
            
            if (method !== NetworkMonitor.HTTP_METHODS.GET && method !== NetworkMonitor.HTTP_METHODS.HEAD && method !== NetworkMonitor.HTTP_METHODS.OPTIONS) {
                this.markOutbound(method, url);
            }
            
            return originalFetch.apply(this, args);
        };
    }

    /**
     * Intercept XMLHttpRequest calls
     */
    interceptXHR() {
        // Intercept XMLHttpRequest - Catches AJAX calls
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._method = method.toUpperCase();
            this._url = url;
            return originalXHROpen.apply(this, [method, url, ...rest]);
        };
        
        XMLHttpRequest.prototype.send = (body) => {
            const method = this._method || NetworkMonitor.HTTP_METHODS.GET;
            const url = this._url || 'unknown';
            
            this.addEntry(method, NetworkMonitor.RESOURCE_TYPES.XHR, url, method === NetworkMonitor.HTTP_METHODS.GET ? NetworkMonitor.STATUS.OK : NetworkMonitor.STATUS.PENDING);
            
            if (method !== NetworkMonitor.HTTP_METHODS.GET && method !== NetworkMonitor.HTTP_METHODS.HEAD && method !== NetworkMonitor.HTTP_METHODS.OPTIONS) {
                this.markOutbound(method, url);
            }
            
            return originalXHRSend.apply(this, arguments);
        };
    }

    /**
     * Intercept navigator.sendBeacon calls
     */
    interceptBeacon() {
        // Intercept sendBeacon - Often used for analytics
        if (navigator.sendBeacon) {
            const originalBeacon = navigator.sendBeacon.bind(navigator);
            navigator.sendBeacon = (url, data) => {
                this.addEntry(NetworkMonitor.HTTP_METHODS.BEACON, NetworkMonitor.RESOURCE_TYPES.BEACON, url, NetworkMonitor.STATUS.PENDING);
                this.markOutbound(NetworkMonitor.HTTP_METHODS.BEACON, url);
                return originalBeacon(url, data);
            };
        }
    }

    /**
     * Intercept WebSocket connections
     */
    interceptWebSocket() {
        // Intercept WebSocket connections
        const OriginalWebSocket = window.WebSocket;
        window.WebSocket = (url, protocols) => {
            this.addEntry(NetworkMonitor.HTTP_METHODS.WEBSOCKET, NetworkMonitor.RESOURCE_TYPES.WEBSOCKET, url, NetworkMonitor.STATUS.WEBSOCKET);
            // WebSockets are bidirectional, so flag them
            this.markOutbound(NetworkMonitor.HTTP_METHODS.WEBSOCKET, url);
            return new OriginalWebSocket(url, protocols);
        };
    }
}

// Cleanup on page unload to prevent memory leaks
window.addEventListener('beforeunload', () => {
    if (window.networkMonitor) {
        window.networkMonitor.cleanup();
    }
});