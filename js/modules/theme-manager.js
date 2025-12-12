// Theme Manager Module
// Handles dark/light theme switching

export class ThemeManager {
  constructor() {
    this.toggle = document.getElementById('theme-toggle');
    this.iconLight = document.getElementById('theme-icon-light');
    this.iconDark = document.getElementById('theme-icon-dark');
    this.html = document.documentElement;
    this.isToggling = false;
    
    if (!this.toggle || !this.iconLight || !this.iconDark) {
      console.error('ThemeManager: Required elements not found');
      return;
    }
    
    this.init();
  }

  init() {
    // Load saved theme or use system preference
    const saved = localStorage.getItem('qr-generator-theme');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = saved || (systemPrefersDark ? 'dark' : 'light');
    
    this.applyTheme(initialTheme);
    
    // Listen for system theme changes (only if user hasn't set preference)
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', e => {
        if (!localStorage.getItem('qr-generator-theme')) {
          this.applyTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
    
    // Toggle click handler
    this.toggle.addEventListener('click', () => {
      if (this.isToggling) return;
      
      this.isToggling = true;
      const current = this.html.getAttribute('data-theme') || 'light';
      const newTheme = current === 'light' ? 'dark' : 'light';
      
      this.applyTheme(newTheme);
      localStorage.setItem('qr-generator-theme', newTheme);
      
      setTimeout(() => {
        this.isToggling = false;
      }, 100);
    });
    
    // Keyboard support
    this.toggle.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggle.click();
      }
    });
  }

  applyTheme(theme) {
    if (theme === 'dark') {
      this.html.setAttribute('data-theme', 'dark');
      this.iconLight.style.display = 'none';
      this.iconDark.style.display = 'block';
      this.toggle.setAttribute('aria-label', 'Switch to light mode');
      this.toggle.setAttribute('title', 'Switch to light mode');
    } else {
      this.html.removeAttribute('data-theme');
      this.iconLight.style.display = 'block';
      this.iconDark.style.display = 'none';
      this.toggle.setAttribute('aria-label', 'Switch to dark mode');
      this.toggle.setAttribute('title', 'Switch to dark mode');
    }
    
    // Trigger theme change event
    document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
  }
}