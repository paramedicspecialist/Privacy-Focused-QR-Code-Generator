// Network Monitor Module
// Monitors network requests for privacy transparency

export class NetworkMonitor {
  constructor() {
    this.log = document.getElementById('network-log');
    this.outboundStatus = document.getElementById('outbound-status');
    this.requestCount = document.getElementById('request-count');
    this.totalRequests = 0;
    this.outboundCount = 0;
    this.originalFetch = window.fetch;
    this.originalXHROpen = XMLHttpRequest.prototype.open;
    this.originalXHRSend = XMLHttpRequest.prototype.send;
    this.originalBeacon = navigator.sendBeacon;
    this.originalWebSocket = window.WebSocket;
    
    if (!this.log || !this.outboundStatus || !this.requestCount) {
      console.error('NetworkMonitor: Required elements not found');
      return;
    }
    
    this.init();
  }

  init() {
    this.setupPerformanceObserver();
    this.captureInitialResources();
    this.interceptFetch();
    this.interceptXHR();
    this.interceptBeacon();
    this.interceptWebSocket();
  }

  updateCount() {
    this.requestCount.textContent = `${this.totalRequests} req${this.totalRequests !== 1 ? 's' : ''}`;
    if (this.outboundCount > 0) {
      this.requestCount.style.background = '#dc3545';
      this.requestCount.textContent += ` (${this.outboundCount} OUT!)`;
    }
  }

  markOutbound(method, url) {
    this.outboundCount++;
    this.outboundStatus.textContent = `${this.outboundCount} Outbound!`;
    this.outboundStatus.className = 'no-outbound outbound-warning';
    this.updateCount();
  }

  shortenUrl(url) {
    try {
      const u = new URL(url);
      const path = u.pathname.split('/').pop() || u.pathname;
      return `${u.hostname}/${path}`;
    } catch {
      return url.substring(0, 50);
    }
  }

  categorizeResource(url, initiatorType) {
    try {
      const pathname = new URL(url).pathname.toLowerCase();
      
      if (pathname.endsWith('.css')) return 'css';
      if (pathname.endsWith('.woff2') || pathname.endsWith('.woff') || 
          pathname.endsWith('.ttf') || pathname.endsWith('.otf')) return 'font';
      if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) return 'script';
      if (pathname.endsWith('.png') || pathname.endsWith('.jpg') || 
          pathname.endsWith('.jpeg') || pathname.endsWith('.gif') || 
          pathname.endsWith('.svg') || pathname.endsWith('.webp')) return 'img';
      if (pathname.endsWith('.html')) return 'document';
    } catch {
      // Invalid URL
    }
    
    if (initiatorType === 'link') return 'css';
    if (initiatorType === 'css') return 'font';
    return initiatorType || 'script';
  }

  addEntry(method, type, url, status = '✓') {
    this.totalRequests++;
    
    const entry = document.createElement('div');
    entry.className = 'network-entry';
    
    const methodSpan = document.createElement('span');
    methodSpan.className = `method-badge method-${method.toLowerCase()}`;
    methodSpan.textContent = method;
    
    const typeSpan = document.createElement('span');
    typeSpan.className = 'resource-type';
    typeSpan.textContent = type;
    
    const urlSpan = document.createElement('span');
    urlSpan.className = 'resource-url';
    urlSpan.title = url;
    urlSpan.textContent = this.shortenUrl(url);
    urlSpan.style.cursor = 'pointer';
    urlSpan.addEventListener('click', () => window.open(url, '_blank'));
    
    const statusSpan = document.createElement('span');
    statusSpan.className = status === '✓' ? 'status-ok' : 'status-pending';
    statusSpan.textContent = status;
    
    entry.append(methodSpan, typeSpan, urlSpan, statusSpan);
    this.log.insertBefore(entry, this.log.firstChild);
    
    // Limit to 10 entries
    const entries = this.log.querySelectorAll('.network-entry');
    if (entries.length > 10) {
      entries[entries.length - 1].remove();
    }
    
    this.updateCount();
    this.log.scrollTop = 0;
  }

  setupPerformanceObserver() {
    if (!window.PerformanceObserver) return;
    
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          const type = this.categorizeResource(entry.name, entry.initiatorType);
          this.addEntry('GET', type, entry.name);
        }
      }
    });
    
    observer.observe({ entryTypes: ['resource'] });
  }

  captureInitialResources() {
    if (!window.performance || !performance.getEntriesByType) return;
    
    const resources = performance.getEntriesByType('resource');
    this.log.innerHTML = '';
    
    resources.forEach(entry => {
      const type = this.categorizeResource(entry.name, entry.initiatorType);
      this.addEntry('GET', type, entry.name);
    });
  }

  interceptFetch() {
    window.fetch = (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || args[0]);
      const options = args[1] || {};
      const method = (options.method || 'GET').toUpperCase();
      
      this.addEntry(method, 'fetch', url, method === 'GET' ? '✓' : '⚠️');
      
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        this.markOutbound(method, url);
      }
      
      return this.originalFetch.apply(window, args);
    };
  }

  interceptXHR() {
    const self = this;
    
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this._method = method.toUpperCase();
      this._url = url;
      return self.originalXHROpen.apply(this, [method, url, ...rest]);
    };
    
    XMLHttpRequest.prototype.send = function(body) {
      const method = this._method || 'GET';
      const url = this._url || 'unknown';
      
      self.addEntry(method, 'xhr', url, method === 'GET' ? '✓' : '⚠️');
      
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        self.markOutbound(method, url);
      }
      
      return self.originalXHRSend.apply(this, arguments);
    };
  }

  interceptBeacon() {
    if (!navigator.sendBeacon) return;
    
    navigator.sendBeacon = (url, data) => {
      this.addEntry('BEACON', 'beacon', url, '⚠️');
      this.markOutbound('BEACON', url);
      return this.originalBeacon(url, data);
    };
  }

  interceptWebSocket() {
    const self = this;
    window.WebSocket = new Proxy(self.originalWebSocket, {
      construct(target, args) {
        const [url, protocols] = args;
        self.addEntry('WS', 'websocket', url, '🔌');
        self.markOutbound('WS', url);
        return new target(url, protocols);
      }
    });
  }
}