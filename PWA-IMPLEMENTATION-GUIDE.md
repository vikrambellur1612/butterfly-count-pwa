# 📱 PWA Implementation Guide & CSS UX Patterns

A comprehensive guide to Progressive Web App implementation and CSS styling patterns used in the Butterfly Count PWA project.

## 📑 Table of Contents

1. [PWA Core Implementation](#pwa-core-implementation)
2. [Service Worker Patterns](#service-worker-patterns)
3. [App Manifest Configuration](#app-manifest-configuration)
4. [CSS UX Design Patterns](#css-ux-design-patterns)
5. [Mobile-First Responsive Design](#mobile-first-responsive-design)
6. [Icon System & Assets](#icon-system--assets)
7. [Offline Strategy](#offline-strategy)
8. [Performance Optimization](#performance-optimization)
9. [Installation & App Shell](#installation--app-shell)
10. [Reusable Components](#reusable-components)

---

## 🔧 PWA Core Implementation

### 1. Service Worker Registration

**File: `js/sw-register.js`**

```javascript
// Service Worker Registration Pattern
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');
      console.log('ServiceWorker registered:', registration.scope);
      
      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Show update notification to user
            showUpdateNotification();
          }
        });
      });
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
    }
  });
}

// Update notification pattern
function showUpdateNotification() {
  const updateBanner = document.getElementById('updateNotification');
  updateBanner.classList.remove('hidden');
  
  document.getElementById('updateBtn').addEventListener('click', () => {
    window.location.reload();
  });
}
```

### 2. PWA Install Banner

```javascript
// PWA Installation Pattern
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  const installBanner = document.getElementById('installBanner');
  installBanner.classList.remove('hidden');
  
  document.getElementById('installBtn').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response: ${outcome}`);
      deferredPrompt = null;
      hideInstallBanner();
    }
  });
}
```

---

## ⚙️ Service Worker Patterns

### Cache Strategy Implementation

```javascript
// Multi-Cache Strategy Pattern
const CACHE_NAME = 'app-v1.6.4';
const STATIC_CACHE = 'app-static-v1.6.4';
const DYNAMIC_CACHE = 'app-dynamic-v1.6.4';

// Cache-First Strategy (Static Assets)
async function cacheFirstStrategy(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return getOfflineFallback(request);
  }
}

// Network-First Strategy (API Calls)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || getOfflineFallback(request);
  }
}

// Stale-While-Revalidate Strategy
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);
  
  return cachedResponse || fetchPromise;
}
```

### Cache Management

```javascript
// Cache Cleanup Pattern
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});
```

---

## 📱 App Manifest Configuration

**File: `manifest.json`**

```json
{
  "name": "Your App Name",
  "short_name": "AppName",
  "description": "App description for store listings",
  "version": "1.6.4",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4CAF50",
  "orientation": "portrait-primary",
  "scope": "./",
  "lang": "en",
  "dir": "ltr",
  "icons": [
    {
      "src": "./icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "./icons/icon-512x512.png",
      "sizes": "512x512", 
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "Quick Action",
      "short_name": "Quick",
      "description": "Quick action description",
      "url": "./?shortcut=quick",
      "icons": [
        {
          "src": "./icons/shortcut-icon.png",
          "sizes": "192x192",
          "type": "image/png"
        }
      ]
    }
  ],
  "categories": ["productivity", "utilities"]
}
```

---

## 🎨 CSS UX Design Patterns

### 1. Modern CSS Variables System

```css
:root {
  /* Color Palette */
  --primary-color: #4CAF50;
  --primary-dark: #388E3C;
  --primary-light: #81C784;
  --secondary-color: #2196F3;
  --accent-color: #FF9800;
  
  /* Neutral Colors */
  --white: #ffffff;
  --gray-50: #f8f9fa;
  --gray-100: #e9ecef;
  --gray-200: #dee2e6;
  --gray-300: #ced4da;
  --gray-400: #adb5bd;
  --gray-500: #6c757d;
  --gray-600: #495057;
  --gray-700: #343a40;
  --gray-800: #212529;
  --gray-900: #0d1117;
  
  /* Status Colors */
  --success-color: #28a745;
  --warning-color: #ffc107;
  --error-color: #dc3545;
  --info-color: #17a2b8;
  
  /* Typography */
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  
  /* Spacing Scale */
  --spacing-xs: 0.25rem;   /* 4px */
  --spacing-sm: 0.5rem;    /* 8px */
  --spacing-md: 0.75rem;   /* 12px */
  --spacing-lg: 1rem;      /* 16px */
  --spacing-xl: 1.5rem;    /* 24px */
  --spacing-2xl: 2rem;     /* 32px */
  --spacing-3xl: 3rem;     /* 48px */
  
  /* Border Radius */
  --radius-sm: 0.25rem;    /* 4px */
  --radius-md: 0.5rem;     /* 8px */
  --radius-lg: 0.75rem;    /* 12px */
  --radius-xl: 1rem;       /* 16px */
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  
  /* Z-Index Scale */
  --z-dropdown: 1000;
  --z-sticky: 1020;
  --z-fixed: 1030;
  --z-modal-backdrop: 1040;
  --z-modal: 1050;
  --z-popover: 1060;
  --z-tooltip: 1070;
  --z-toast: 1080;
}
```

### 2. Button Component System

```css
/* Base Button Styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-xl);
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-family);
  font-size: 0.875rem;
  font-weight: var(--font-weight-medium);
  line-height: 1.25rem;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  min-height: 2.5rem;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Button Variants */
.primary-btn {
  background-color: var(--primary-color);
  color: var(--white);
  box-shadow: var(--shadow-sm);
}

.primary-btn:hover:not(:disabled) {
  background-color: var(--primary-dark);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.secondary-btn {
  background-color: var(--gray-100);
  color: var(--gray-800);
  border: 1px solid var(--gray-300);
}

.secondary-btn:hover:not(:disabled) {
  background-color: var(--gray-200);
  border-color: var(--gray-400);
}

.icon-btn {
  padding: var(--spacing-md);
  min-width: 2.5rem;
  background-color: transparent;
  color: var(--gray-600);
  border-radius: var(--radius-full);
}

.icon-btn:hover:not(:disabled) {
  background-color: var(--gray-100);
  color: var(--gray-800);
}

/* Button Sizes */
.btn-sm {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: 0.75rem;
  min-height: 2rem;
}

.btn-lg {
  padding: var(--spacing-lg) var(--spacing-2xl);
  font-size: 1rem;
  min-height: 3rem;
}

.full-width {
  width: 100%;
}
```

### 3. Card Component System

```css
/* Base Card Styles */
.card {
  background-color: var(--white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--gray-200);
  overflow: hidden;
  transition: all 0.2s ease-in-out;
}

.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.card-header {
  padding: var(--spacing-lg) var(--spacing-xl);
  border-bottom: 1px solid var(--gray-200);
  background-color: var(--gray-50);
}

.card-body {
  padding: var(--spacing-xl);
}

.card-footer {
  padding: var(--spacing-lg) var(--spacing-xl);
  border-top: 1px solid var(--gray-200);
  background-color: var(--gray-50);
}

/* Interactive Cards */
.card-clickable {
  cursor: pointer;
  user-select: none;
}

.card-clickable:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-4px);
}

.card-clickable:active {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
```

### 4. Form Input System

```css
/* Form Groups */
.form-group {
  margin-bottom: var(--spacing-xl);
}

.form-group label {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-weight: var(--font-weight-medium);
  color: var(--gray-700);
  font-size: 0.875rem;
}

/* Input Base Styles */
.form-input {
  width: 100%;
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-family: var(--font-family);
  background-color: var(--white);
  transition: all 0.2s ease-in-out;
  min-height: 2.5rem;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
}

.form-input:disabled {
  background-color: var(--gray-100);
  color: var(--gray-500);
  cursor: not-allowed;
}

/* Input Variants */
.search-input {
  padding-left: 2.5rem;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z'/%3e%3c/svg%3e");
  background-position: left var(--spacing-md) center;
  background-repeat: no-repeat;
  background-size: 1rem 1rem;
}

/* Select Styles */
select.form-input {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
  background-position: right var(--spacing-md) center;
  background-repeat: no-repeat;
  background-size: 1rem 1rem;
  padding-right: 2.5rem;
  appearance: none;
}
```

### 5. Modal System

```css
/* Modal Backdrop */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease-in-out;
  padding: var(--spacing-lg);
}

.modal:not(.hidden) {
  opacity: 1;
  visibility: visible;
}

/* Modal Content */
.modal-content {
  background-color: var(--white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  width: 100%;
  max-width: 32rem;
  max-height: 90vh;
  overflow: hidden;
  transform: scale(0.95) translateY(1rem);
  transition: transform 0.3s ease-in-out;
}

.modal:not(.hidden) .modal-content {
  transform: scale(1) translateY(0);
}

.modal-header {
  padding: var(--spacing-xl);
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: var(--font-weight-semibold);
  color: var(--gray-900);
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--gray-400);
  cursor: pointer;
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  line-height: 1;
}

.modal-close:hover {
  color: var(--gray-600);
  background-color: var(--gray-100);
}

.modal-body {
  padding: var(--spacing-xl);
  overflow-y: auto;
  max-height: calc(90vh - 8rem);
}

.modal-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
  margin-top: var(--spacing-xl);
}
```

### 6. Navigation Patterns

```css
/* Bottom Navigation */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--white);
  border-top: 1px solid var(--gray-200);
  display: flex;
  padding: var(--spacing-sm) 0;
  z-index: var(--z-fixed);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-sm);
  background: none;
  border: none;
  color: var(--gray-500);
  font-size: 0.75rem;
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  text-decoration: none;
  gap: var(--spacing-xs);
}

.nav-item:hover,
.nav-item.active {
  color: var(--primary-color);
  background-color: rgba(76, 175, 80, 0.1);
  border-radius: var(--radius-md);
}

.nav-item svg {
  width: 1.5rem;
  height: 1.5rem;
  transition: transform 0.2s ease-in-out;
}

.nav-item.active svg {
  transform: scale(1.1);
}

/* Header Navigation */
.app-header {
  position: sticky;
  top: 0;
  background-color: var(--white);
  border-bottom: 1px solid var(--gray-200);
  z-index: var(--z-sticky);
  box-shadow: var(--shadow-sm);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg) var(--spacing-xl);
  max-width: 1200px;
  margin: 0 auto;
}

.app-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: var(--font-weight-bold);
  color: var(--gray-900);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
```

### 7. Loading States & Animations

```css
/* Loading Spinner */
.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--gray-200);
  border-top: 2px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Loading Screen */
.loading-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--white);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  gap: var(--spacing-lg);
}

/* Skeleton Loaders */
.skeleton {
  background: linear-gradient(90deg, var(--gray-200) 25%, var(--gray-100) 50%, var(--gray-200) 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: var(--radius-sm);
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-text {
  height: 1rem;
  margin-bottom: var(--spacing-sm);
}

.skeleton-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-full);
}

/* Fade In Animation */
.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(0.5rem); }
  to { opacity: 1; transform: translateY(0); }
}

/* Slide Up Animation */
.slide-up {
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(1rem); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

---

## 📱 Mobile-First Responsive Design

### Breakpoint System

```css
/* Mobile-First Breakpoints */
/* Default: Mobile (0-639px) */

/* Small tablets and large phones */
@media (min-width: 640px) {
  .sm\:hidden { display: none; }
  .sm\:block { display: block; }
  .sm\:flex { display: flex; }
  .sm\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* Tablets */
@media (min-width: 768px) {
  .md\:hidden { display: none; }
  .md\:block { display: block; }
  .md\:flex { display: flex; }
  .md\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .md\:px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
}

/* Small laptops */
@media (min-width: 1024px) {
  .lg\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .lg\:px-8 { padding-left: 2rem; padding-right: 2rem; }
}

/* Large screens */
@media (min-width: 1280px) {
  .xl\:grid-cols-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .xl\:max-w-7xl { max-width: 80rem; }
}
```

### Touch-Friendly Design

```css
/* Touch Target Sizing */
.touch-target {
  min-height: 44px; /* iOS minimum */
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Touch Interactions */
.touch-feedback {
  position: relative;
  overflow: hidden;
}

.touch-feedback::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.5);
  transform: translate(-50%, -50%);
  transition: width 0.3s, height 0.3s;
}

.touch-feedback:active::before {
  width: 300px;
  height: 300px;
}

/* Swipe Gestures */
.swipeable {
  touch-action: pan-y;
  user-select: none;
}

/* Scroll Optimization */
.smooth-scroll {
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}
```

---

## 🎯 Icon System & Assets

### SVG Icon System

```css
/* Icon Base Class */
.icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  stroke-width: 0;
  stroke: currentColor;
  fill: currentColor;
  vertical-align: middle;
}

/* Icon Sizes */
.icon-xs { width: 0.75rem; height: 0.75rem; }
.icon-sm { width: 1rem; height: 1rem; }
.icon-md { width: 1.25rem; height: 1.25rem; }
.icon-lg { width: 1.5rem; height: 1.5rem; }
.icon-xl { width: 2rem; height: 2rem; }

/* Icon Colors */
.icon-primary { color: var(--primary-color); }
.icon-secondary { color: var(--secondary-color); }
.icon-success { color: var(--success-color); }
.icon-warning { color: var(--warning-color); }
.icon-error { color: var(--error-color); }
```

### Required PWA Icons

```
icons/
├── favicon.svg                  # Modern favicon
├── favicon.png                  # Fallback favicon
├── favicon-16x16.png           # Browser tab
├── favicon-32x32.png           # Browser tab
├── apple-touch-icon.png        # iOS default
├── apple-touch-icon-180x180.png # iOS retina
├── icon-192x192.png            # Android homescreen
├── icon-512x512.png            # Android splash
├── mstile-144x144.png          # Windows tile
└── shortcut-*.png              # App shortcuts
```

---

## 🔄 Offline Strategy

### IndexedDB Pattern

```javascript
// Database Setup
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AppDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores
      if (!db.objectStoreNames.contains('data')) {
        const store = db.createObjectStore('data', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

// Data Operations
async function saveData(data) {
  const db = await openIndexedDB();
  const transaction = db.transaction(['data'], 'readwrite');
  const store = transaction.objectStore('data');
  return store.add({ ...data, timestamp: Date.now() });
}

async function getData() {
  const db = await openIndexedDB();
  const transaction = db.transaction(['data'], 'readonly');
  const store = transaction.objectStore('data');
  return store.getAll();
}
```

### Background Sync

```javascript
// Background Sync Registration
if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
  navigator.serviceWorker.ready.then((registration) => {
    registration.sync.register('background-sync');
  });
}

// Service Worker Sync Handler
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  // Sync offline data when online
  const pendingData = await getPendingData();
  for (const item of pendingData) {
    try {
      await syncToServer(item);
      await markAsSynced(item.id);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }
}
```

---

## ⚡ Performance Optimization

### Critical CSS Pattern

```html
<!-- Inline critical CSS -->
<style>
  /* Critical above-the-fold styles */
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
  .loading-screen { /* loading styles */ }
  .app-header { /* header styles */ }
</style>

<!-- Preload non-critical CSS -->
<link rel="preload" href="./css/styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="./css/styles.css"></noscript>
```

### Resource Hints

```html
<!-- DNS prefetch for external resources -->
<link rel="dns-prefetch" href="//fonts.googleapis.com">

<!-- Preload critical resources -->
<link rel="preload" href="./js/app.js" as="script">
<link rel="preload" href="./data/essential.json" as="fetch" crossorigin>

<!-- Prefetch likely next resources -->
<link rel="prefetch" href="./js/features.js">
```

---

## 🏠 Installation & App Shell

### App Shell CSS

```css
/* App Shell Layout */
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--gray-50);
}

.app-header {
  flex-shrink: 0;
  /* header styles */
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
  padding-bottom: calc(var(--spacing-lg) + 4rem); /* Bottom nav space */
}

.app-footer {
  flex-shrink: 0;
  /* bottom nav styles */
}

/* View Management */
.view {
  display: none;
  animation: fadeIn 0.3s ease-in-out;
}

.view.active {
  display: block;
}

/* Safe Area Support (iPhone X+) */
.app-shell {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

.bottom-nav {
  padding-bottom: calc(var(--spacing-sm) + env(safe-area-inset-bottom));
}
```

### Install Prompt Styles

```css
/* Install Banner */
.install-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
  color: var(--white);
  padding: var(--spacing-lg);
  z-index: var(--z-toast);
  transform: translateY(-100%);
  transition: transform 0.3s ease-in-out;
}

.install-banner:not(.hidden) {
  transform: translateY(0);
}

.banner-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  max-width: 1200px;
  margin: 0 auto;
}

.install-btn {
  background-color: var(--white);
  color: var(--primary-color);
  border: none;
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  white-space: nowrap;
}

.dismiss-btn {
  background: none;
  border: none;
  color: var(--white);
  font-size: 1.5rem;
  cursor: pointer;
  padding: var(--spacing-xs);
  border-radius: var(--radius-sm);
  line-height: 1;
  opacity: 0.8;
}

.dismiss-btn:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.1);
}
```

---

## 🧩 Reusable Components

### Notification System

```css
/* Toast Notifications */
.toast {
  position: fixed;
  top: var(--spacing-lg);
  right: var(--spacing-lg);
  background-color: var(--white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--gray-200);
  padding: var(--spacing-lg);
  max-width: 24rem;
  z-index: var(--z-toast);
  transform: translateX(100%);
  transition: transform 0.3s ease-in-out;
}

.toast.show {
  transform: translateX(0);
}

.toast-success {
  border-left: 4px solid var(--success-color);
}

.toast-error {
  border-left: 4px solid var(--error-color);
}

.toast-warning {
  border-left: 4px solid var(--warning-color);
}

.toast-info {
  border-left: 4px solid var(--info-color);
}
```

### Search Component

```css
/* Search Container */
.search-container {
  position: relative;
  margin-bottom: var(--spacing-xl);
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: var(--white);
  border: 1px solid var(--gray-200);
  border-top: none;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  box-shadow: var(--shadow-lg);
  max-height: 20rem;
  overflow-y: auto;
  z-index: var(--z-dropdown);
}

.search-result-item {
  padding: var(--spacing-md) var(--spacing-lg);
  cursor: pointer;
  border-bottom: 1px solid var(--gray-100);
  transition: background-color 0.2s ease-in-out;
}

.search-result-item:hover,
.search-result-item:focus {
  background-color: var(--gray-50);
}

.search-result-item:last-child {
  border-bottom: none;
}

/* Suggestions */
.suggestions {
  background-color: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  max-height: 16rem;
  overflow-y: auto;
}

.suggestion-item {
  padding: var(--spacing-md) var(--spacing-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  transition: background-color 0.2s ease-in-out;
}

.suggestion-item:hover {
  background-color: var(--primary-color);
  color: var(--white);
}
```

---

## 🔧 Utility Classes

### Layout Utilities

```css
/* Display */
.hidden { display: none !important; }
.block { display: block; }
.inline-block { display: inline-block; }
.flex { display: flex; }
.inline-flex { display: inline-flex; }
.grid { display: grid; }

/* Flexbox */
.flex-col { flex-direction: column; }
.flex-row { flex-direction: row; }
.items-center { align-items: center; }
.items-start { align-items: flex-start; }
.items-end { align-items: flex-end; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.justify-around { justify-content: space-around; }
.justify-start { justify-content: flex-start; }
.justify-end { justify-content: flex-end; }

/* Grid */
.grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.grid-cols-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }

.gap-1 { gap: var(--spacing-xs); }
.gap-2 { gap: var(--spacing-sm); }
.gap-3 { gap: var(--spacing-md); }
.gap-4 { gap: var(--spacing-lg); }
.gap-6 { gap: var(--spacing-xl); }
.gap-8 { gap: var(--spacing-2xl); }

/* Spacing */
.p-0 { padding: 0; }
.p-1 { padding: var(--spacing-xs); }
.p-2 { padding: var(--spacing-sm); }
.p-3 { padding: var(--spacing-md); }
.p-4 { padding: var(--spacing-lg); }
.p-6 { padding: var(--spacing-xl); }
.p-8 { padding: var(--spacing-2xl); }

.m-0 { margin: 0; }
.m-1 { margin: var(--spacing-xs); }
.m-2 { margin: var(--spacing-sm); }
.m-3 { margin: var(--spacing-md); }
.m-4 { margin: var(--spacing-lg); }
.m-6 { margin: var(--spacing-xl); }
.m-8 { margin: var(--spacing-2xl); }

/* Text */
.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.875rem; }
.text-base { font-size: 1rem; }
.text-lg { font-size: 1.125rem; }
.text-xl { font-size: 1.25rem; }
.text-2xl { font-size: 1.5rem; }

.font-normal { font-weight: var(--font-weight-normal); }
.font-medium { font-weight: var(--font-weight-medium); }
.font-semibold { font-weight: var(--font-weight-semibold); }
.font-bold { font-weight: var(--font-weight-bold); }

.text-left { text-align: left; }
.text-center { text-align: center; }
.text-right { text-align: right; }

/* Colors */
.text-gray-500 { color: var(--gray-500); }
.text-gray-700 { color: var(--gray-700); }
.text-gray-900 { color: var(--gray-900); }
.text-primary { color: var(--primary-color); }
.text-success { color: var(--success-color); }
.text-error { color: var(--error-color); }

.bg-white { background-color: var(--white); }
.bg-gray-50 { background-color: var(--gray-50); }
.bg-gray-100 { background-color: var(--gray-100); }
.bg-primary { background-color: var(--primary-color); }

/* Borders */
.border { border: 1px solid var(--gray-200); }
.border-t { border-top: 1px solid var(--gray-200); }
.border-b { border-bottom: 1px solid var(--gray-200); }
.border-l { border-left: 1px solid var(--gray-200); }
.border-r { border-right: 1px solid var(--gray-200); }

.rounded { border-radius: var(--radius-md); }
.rounded-sm { border-radius: var(--radius-sm); }
.rounded-lg { border-radius: var(--radius-lg); }
.rounded-xl { border-radius: var(--radius-xl); }
.rounded-full { border-radius: var(--radius-full); }

/* Shadows */
.shadow-sm { box-shadow: var(--shadow-sm); }
.shadow-md { box-shadow: var(--shadow-md); }
.shadow-lg { box-shadow: var(--shadow-lg); }
.shadow-xl { box-shadow: var(--shadow-xl); }

/* Positioning */
.relative { position: relative; }
.absolute { position: absolute; }
.fixed { position: fixed; }
.sticky { position: sticky; }

.top-0 { top: 0; }
.bottom-0 { bottom: 0; }
.left-0 { left: 0; }
.right-0 { right: 0; }

/* Width & Height */
.w-full { width: 100%; }
.w-auto { width: auto; }
.h-full { height: 100%; }
.h-auto { height: auto; }
.min-h-screen { min-height: 100vh; }

/* Z-Index */
.z-10 { z-index: 10; }
.z-20 { z-index: 20; }
.z-30 { z-index: 30; }
.z-40 { z-index: 40; }
.z-50 { z-index: 50; }
```

---

## 📋 Implementation Checklist

### PWA Requirements ✅
- [ ] Service Worker implemented
- [ ] Web App Manifest configured
- [ ] HTTPS deployment
- [ ] Responsive design
- [ ] Offline functionality
- [ ] Install prompts
- [ ] App icons (all sizes)
- [ ] Loading states
- [ ] Error handling

### Performance Optimization ✅
- [ ] Critical CSS inlined
- [ ] Resource preloading
- [ ] Image optimization
- [ ] Cache strategies
- [ ] Bundle splitting
- [ ] Lazy loading
- [ ] Compression enabled

### Accessibility ✅
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Color contrast ratios
- [ ] Focus management
- [ ] ARIA labels
- [ ] Semantic HTML
- [ ] Touch target sizing

### Browser Support ✅
- [ ] Chrome/Chromium 88+
- [ ] Firefox 85+
- [ ] Safari 14+
- [ ] Edge 88+
- [ ] Mobile browsers

---

## 🚀 Quick Start Template

Use this as a starting point for new PWA projects:

```bash
# Project Structure
my-pwa/
├── index.html
├── manifest.json
├── sw.js
├── css/
│   ├── styles.css
│   └── mobile.css
├── js/
│   ├── app.js
│   └── sw-register.js
├── icons/
│   ├── favicon.svg
│   ├── icon-192x192.png
│   └── icon-512x512.png
└── netlify.toml
```

Copy the patterns from this guide and adapt them to your specific use case. This documentation serves as a comprehensive reference for building modern, performant PWAs with excellent UX.

---

**Built with ❤️ for the developer community**
