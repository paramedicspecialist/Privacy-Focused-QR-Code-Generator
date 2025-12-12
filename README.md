# Privacy-First QR Code Generator

A secure, open-source QR code generator that runs entirely in your browser. No data collection, no tracking, no server-side processing.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Privacy: First](https://img.shields.io/badge/Privacy-First-blue.svg)](privacy-policy.html)
[![Security: High](https://img.shields.io/badge/Security-High-green.svg)](privacy-policy.html)

## 🎯 Features

### Privacy & Security
- **100% Client-Side**: All QR codes generated in your browser
- **Zero Data Collection**: No tracking, analytics, or data harvesting
- **Network Monitoring**: Real-time visibility of all network requests
- **XSS Protection**: DOMPurify sanitization on all user inputs
- **CDN Integrity**: All external resources have SRI hashes
- **Open Source**: MIT License - full transparency

### QR Code Types
- **URL/Text**: Simple text or website URLs
- **WiFi**: Share WiFi credentials securely
- **vCard**: Digital business cards
- **MeCard**: Alternative contact format
- **Event**: Calendar events with date/time
- **Bitcoin**: Cryptocurrency payment addresses
- **Geo**: Geographic coordinates
- **Social**: Social media profiles
- **App**: App store download links
- **Email**: Pre-filled email messages
- **SMS**: Pre-composed text messages
- **Phone**: Click-to-call phone numbers

### Customization
- **Colors**: Custom foreground and background colors
- **Size**: Adjustable from 200-1000px
- **Styles**: Square, rounded, or dot modules
- **Error Correction**: Low, Medium, Quartile, or High
- **Logo Embedding**: Upload and embed logos (max 5MB)
- **Margins**: Adjustable white space around QR code
- **Quiet Zone**: Optional additional spacing

### Accessibility
- **Screen Reader Support**: Full ARIA labels and descriptions
- **Keyboard Navigation**: Complete keyboard accessibility
- **High Contrast**: Supports high contrast mode
- **Reduced Motion**: Respects reduced motion preferences
- **Skip Links**: Jump to main content, controls, or preview
- **Focus Indicators**: Clear visual focus indicators

### Themes
- **Light/Dark Mode**: Automatic system preference detection
- **Manual Toggle**: User-controlled theme switching
- **Persistent**: Theme preference saved in browser

## 🚀 Quick Start

### Option 1: Open in Browser
Simply open `index.html` in your web browser. No build process required!

```bash
# On Windows
start index.html

# On macOS
open index.html

# On Linux
xdg-open index.html
```

### Option 2: Local Web Server (Recommended)
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (if you have http-server installed)
npx http-server -p 8000

# Then open http://localhost:8000
```

### Option 3: GitHub Pages
1. Fork this repository
2. Go to Settings > Pages
3. Select main branch and save
4. Your site will be live at `https://yourusername.github.io/Privacy-First-QR-Code-Generator/`

## 🔒 Privacy & Security

### What We Don't Collect
- ❌ Usage analytics or tracking data
- ❌ Personal information (names, emails, phone numbers)
- ❌ IP addresses
- ❌ QR code content
- ❌ Device information
- ❌ Cookies or local storage
- ❌ Network information
- ❌ Behavioral data
- ❌ Error logs or crash data
- ❌ Metadata (timestamps, geolocation)

### How It Works
All QR codes are generated **entirely in your browser** using JavaScript. No data is sent to external servers, stored in databases, or transmitted in any form. This ensures:
- Your data remains on your device
- No risk of data breaches
- All generated data is cleared when you close the page
- Nothing is saved to disk or cloud storage
- QR code generation is isolated from other users

### Network Monitoring
The built-in network monitor provides real-time visibility of all network requests:
- **GET requests**: CDN resources for libraries (Bootstrap, QR code generator, DOMPurify)
- **Outbound detection**: Alerts if any data is sent externally
- **Request logging**: Complete transparency of all network activity

### Third-Party Services
- **GitHub Pages**: Hosting service (see [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement))
- **hop.js CDN**: Content delivery for libraries (see [Bunny.net Privacy Policy](https://bunny.net/privacy/))

**Disclaimer**: We have no control over GitHub's or Bunny.net's data collection practices.

## 🛡️ Security Features

### Input Sanitization
- **DOMPurify Integration**: All user inputs are sanitized
- **HTML Stripping**: Removes HTML tags from all input fields
- **URL Validation**: Validates and normalizes URLs
- **Email Validation**: Checks email format validity
- **Phone Validation**: Validates phone number formats

### Content Security
- **SRI Hashes**: All CDN resources have Subresource Integrity hashes
- **No eval()**: No use of dangerous JavaScript functions
- **Memory Management**: Proper cleanup to prevent memory leaks
- **Canvas Security**: Secure canvas operations with proper disposal

## 📱 Usage Guide

### Basic QR Code Generation
1. Select a template (URL/Text, WiFi, vCard, etc.)
2. Fill in the required fields
3. Customize colors, size, and style
4. Download your QR code (PNG, JPG, or SVG)

### Advanced Features
- **Logo Embedding**: Upload an image to embed in the QR code
- **Error Correction**: Higher levels allow more logo coverage
- **Color Customization**: Choose any foreground/background colors
- **Module Styles**: Square, rounded, or dot patterns

### Keyboard Shortcuts
- **Tab**: Navigate between elements
- **Enter/Space**: Activate buttons and toggles
- **Arrow Keys**: Navigate template buttons
- **Home/End**: Jump to first/last template

## 🎨 Customization Examples

### Brand Colors
```javascript
// Set custom brand colors
fgColor = '#3498db';  // Your brand blue
bgColor = '#ffffff';  // White background
```

### Logo Embedding
1. Upload your logo (PNG, JPG, SVG)
2. Set error correction to "High" for best results
3. Adjust logo size (10-35% of QR code)
4. Download with embedded logo

### Event QR Codes
```javascript
// Create calendar event
Title: "Company Meeting"
Start: "2025-12-15T14:00"
End: "2025-12-15T15:00"
Location: "Conference Room A"
Description: "Quarterly review meeting"
```

## 🔧 Technical Details

### Browser Compatibility
- **Modern Browsers**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **Mobile**: iOS Safari 13+, Chrome Mobile 80+
- **Features**: ES6 modules, Canvas API, File API

### Performance Optimizations
- **Debouncing**: 200ms delay on input to prevent excessive generation
- **Caching**: QR codes cached (max 10 items) for quick regeneration
- **Lazy Loading**: Non-critical modules loaded dynamically
- **Memory Management**: Proper cleanup of canvases and event listeners
- **Canvas Disposal**: Old canvases properly disposed to free memory

### Code Quality
- **ES6 Modules**: Modern JavaScript with proper module structure
- **Error Handling**: Comprehensive try-catch blocks throughout
- **Memory Leak Prevention**: Tracked event listeners and proper cleanup
- **XSS Protection**: DOMPurify integration on all user inputs
- **Accessibility**: WCAG 2.1 AA compliance

## 📊 File Structure
```
Privacy-First QR Code Generator/
├── index.html              # Main application (39.1 KB)
├── privacy-policy.html     # Privacy policy (18.6 KB)
├── LICENSE                 # MIT License (1.1 KB)
├── README.md               # This file
├── css/
│   └── styles.css          # Styles (25.6 KB)
└── js/
    ├── main.js             # Core application (47.7 KB)
    └── modules/
        ├── network-monitor.js    # Network monitoring (15.4 KB)
        └── theme-manager.js      # Theme switching (4.4 KB)
```

**Total Size**: 151.8 KB (very reasonable for a full-featured application)

## 🌐 Deployment Options

### GitHub Pages (Recommended)
1. Fork this repository
2. Enable GitHub Pages in repository settings
3. Select main branch as source
4. Access at `https://yourusername.github.io/repository-name/`

### Netlify
1. Drag and drop the project folder to Netlify
2. Set build command to `none` (static site)
3. Deploy instantly

### Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in project directory
3. Follow prompts to deploy

### Self-Hosted
- Any static web server (Apache, Nginx, etc.)
- No server-side processing required
- No database needed
- No environment variables

## 📝 Legal

### License
MIT License - see [LICENSE](LICENSE) file for details

### Privacy Policy
Comprehensive privacy policy available at [privacy-policy.html](privacy-policy.html)

### Compliance
- **Canadian Privacy Laws**: PIPEDA, PIPA (BC), PIPA (AB), Quebec Privacy Act
- **Accessibility**: WCAG 2.1 AA compliance
- **Security**: OWASP Top 10 mitigation

### Disclaimer
This tool is provided "as is" without warranty. Users are responsible for QR code content and compliance with applicable laws.

## 🤝 Contributing

This is a privacy-first, security-focused project. Contributions should maintain these principles:

1. **Privacy First**: No data collection, tracking, or analytics
2. **Security**: Maintain XSS protection and input sanitization
3. **Accessibility**: Preserve keyboard navigation and screen reader support
4. **Performance**: Keep optimizations and memory management
5. **Transparency**: Document any network requests or external dependencies

### Development Setup
```bash
# No build process required - it's a static site
# Simply open index.html in browser or use a local server

# For development with live reload (optional)
npm install -g live-server
live-server --port=8000
```

### Code Style
- **JavaScript**: ES6 modules, strict mode, comprehensive error handling
- **CSS**: Custom properties, mobile-first, accessibility features
- **HTML**: Semantic markup, ARIA attributes, proper heading structure

## 📞 Support

### Issues
For bugs or feature requests, please open an issue on GitHub.

### Questions
For general questions about the project:
- Check the privacy policy for privacy-related questions
- Review the code for technical implementation details
- Test the network monitor for transparency on network activity

### Security Issues
For security vulnerabilities, please report privately rather than opening a public issue.

## 🙏 Acknowledgments

### Libraries Used
- **Bootstrap 5.3.8**: UI framework and icons
- **qrcode-generator 2.0.4**: QR code generation engine
- **DOMPurify 3.3.1**: XSS protection and input sanitization

### Inspiration
Created out of frustration with commercial QR tools that limit features and harvest user data.

### Design Principles
- Privacy by design
- Security by default
- Accessibility for all
- Transparency in operation

---

**Built with ❤️ by Darkhorse** - Because your data belongs to you.

*Last Updated: December 12, 2025*