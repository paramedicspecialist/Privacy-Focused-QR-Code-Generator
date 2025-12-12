/**
 * Theme Manager Module
 * Handles dark/light theme switching with system preference detection
 *
 * @version 1.0.0
 * @author Darkhorse
 * @license MIT
 */

export class ThemeManager {
    // Constants for theme names
    static THEMES = {
        LIGHT: 'light',
        DARK: 'dark'
    };
    
    static STORAGE_KEY = 'qr-generator-theme';
    
    constructor() {
        this.themeToggle = document.getElementById('theme-toggle');
        this.themeIconLight = document.getElementById('theme-icon-light');
        this.themeIconDark = document.getElementById('theme-icon-dark');
        this.htmlElement = document.documentElement;
        
        // Validate required elements
        if (!this.themeToggle || !this.themeIconLight || !this.themeIconDark) {
            console.error('ThemeManager: Required DOM elements not found');
            return;
        }
        
        this.init();
    }

    /**
     * Initialize theme manager
     */
    init() {
        try {
            // Check for saved theme preference or default to system preference
            const savedTheme = localStorage.getItem(ThemeManager.STORAGE_KEY);
            const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            
            // Apply initial theme
            const initialTheme = savedTheme || (systemPrefersDark ? ThemeManager.THEMES.DARK : ThemeManager.THEMES.LIGHT);
            this.applyTheme(initialTheme);
            
            // Listen for system theme changes (only if user hasn't set a preference)
            if (window.matchMedia) {
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                mediaQuery.addEventListener('change', (e) => {
                    // Only auto-switch if user hasn't set a manual preference
                    if (!localStorage.getItem(ThemeManager.STORAGE_KEY)) {
                        this.applyTheme(e.matches ? ThemeManager.THEMES.DARK : ThemeManager.THEMES.LIGHT);
                    }
                });
            }
            
            // Theme toggle click handler
            this.themeToggle.addEventListener('click', () => {
                const currentTheme = this.htmlElement.getAttribute('data-theme') || ThemeManager.THEMES.LIGHT;
                const newTheme = currentTheme === ThemeManager.THEMES.LIGHT ? ThemeManager.THEMES.DARK : ThemeManager.THEMES.LIGHT;
                
                this.applyTheme(newTheme);
                // Save user preference
                localStorage.setItem(ThemeManager.STORAGE_KEY, newTheme);
            });
            
            // Keyboard support for theme toggle
            this.themeToggle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.themeToggle.click();
                }
            });
        } catch (error) {
            console.error('ThemeManager initialization error:', error);
        }
    }

    /**
     * Apply theme to the document
     * @param {string} theme - Theme name (light or dark)
     */
    applyTheme(theme) {
        try {
            if (theme === ThemeManager.THEMES.DARK) {
                this.htmlElement.setAttribute('data-theme', ThemeManager.THEMES.DARK);
                this.themeIconLight.style.display = 'none';
                this.themeIconDark.style.display = 'block';
                this.themeToggle.setAttribute('aria-label', 'Switch to light mode');
                this.themeToggle.setAttribute('title', 'Switch to light mode');
            } else {
                this.htmlElement.removeAttribute('data-theme');
                this.themeIconLight.style.display = 'block';
                this.themeIconDark.style.display = 'none';
                this.themeToggle.setAttribute('aria-label', 'Switch to dark mode');
                this.themeToggle.setAttribute('title', 'Switch to dark mode');
            }
            
            // Trigger a custom event for theme change
            const event = new CustomEvent('themeChanged', { detail: { theme } });
            document.dispatchEvent(event);
        } catch (error) {
            console.error('ThemeManager applyTheme error:', error);
        }
    }
}