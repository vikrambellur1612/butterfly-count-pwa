// Service Worker for Butterfly Count PWA

const CACHE_NAME = 'butterfly-count-v3.3.6';
const STATIC_CACHE = 'butterfly-count-static-v3.3.6';
const DYNAMIC_CACHE = 'butterfly-count-dynamic-v3.3.6';

// Files to cache for offline functionality
const STATIC_FILES = [
  './',
  './index.html',
  './css/styles.css?v=3.3.6',
  './css/mobile.css?v=3.3.6',
  './js/app.js?v=3.3.6',
  './js/sw-register.js?v=3.3.6',
  './js/butterflies-data.js?v=3.3.6',
  './butterflies-data.json',
  './data/locations.json',
  './icons/icon-192x192.png?v=3.3.6',
  './icons/icon-512x512.png?v=3.3.6',
  './icons/favicon.svg?v=3.3.6',
  './icons/favicon.png?v=3.3.6',
  './icons/apple-touch-icon-180x180.png?v=3.3.6',
  './icons/apple-touch-icon-152x152.png?v=3.3.6',
  './icons/apple-touch-icon-144x144.png?v=3.3.6',
  './icons/apple-touch-icon-120x120.png?v=3.3.6',
  './icons/favicon-32x32.png?v=3.3.6',
  './icons/favicon-16x16.png?v=3.3.6',
  './icons/icon-72x72.png?v=3.3.6',
  './icons/icon-96x96.png?v=3.3.6',
  './icons/icon-128x128.png?v=3.3.6',
  './icons/icon-144x144.png?v=3.3.6',
  './icons/icon-152x152.png?v=3.3.6',
  './icons/icon-384x384.png?v=3.3.6',
  './icons/shortcut-count.png?v=3.3.6',
  './icons/shortcut-list.png?v=3.3.6'
];

// Dynamic files that can be cached as needed
const DYNAMIC_FILES = [
  './icons/',
  './css/',
  './js/'
];

// Files that should always be fetched from network
const NETWORK_FIRST = [
  './api/',
  './data/'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Butterfly Count Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Caching static files...');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Static files cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Failed to cache static files:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating - v3.3.6');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete ALL old caches - force complete refresh for v3.3.6
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('All old caches cleaned up for v3.3.6');
        return self.clients.claim();
      })
      .then(() => {
        // Force reload message for v3.3.6 with UI fixes
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'CACHE_UPDATED',
              version: '3.3.6',
              message: 'PWA updated to v3.3.6 - Added 30-minute interval analysis to close confirmation, fixed mobile button alignment, enhanced iPhone icon caching - please refresh'
            });
          });
        });
      })
  );
});

// Fetch event - handle network requests with caching strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests and non-HTTP(S) schemes
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }
  
  // Apply different caching strategies
  if (isStaticFile(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
  } else if (isNetworkFirstFile(url.pathname)) {
    event.respondWith(networkFirstStrategy(request));
  } else if (isDynamicFile(url.pathname)) {
    event.respondWith(staleWhileRevalidateStrategy(request));
  } else {
    event.respondWith(cacheFirstStrategy(request));
  }
});

// Cache First Strategy - Good for static assets
async function cacheFirstStrategy(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Cache First Strategy failed:', error);
    return getOfflineFallback(request);
  }
}

// Network First Strategy - Good for API calls
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

// Stale While Revalidate Strategy - Good for frequently updated content
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

// Helper functions
function isStaticFile(pathname) {
  return STATIC_FILES.some(file => pathname.includes(file.replace('./', ''))) ||
         pathname.endsWith('.css') || pathname.endsWith('.js') || 
         pathname.endsWith('.svg') || pathname.endsWith('.png');
}

function isNetworkFirstFile(pathname) {
  return NETWORK_FIRST.some(path => pathname.startsWith(path));
}

function isDynamicFile(pathname) {
  return DYNAMIC_FILES.some(path => pathname.startsWith(path));
}

async function getOfflineFallback(request) {
  if (request.mode === 'navigate') {
    const cache = await caches.open(STATIC_CACHE);
    return await cache.match('./index.html');
  }
  return new Response('Offline - Butterfly Count', { 
    status: 503,
    statusText: 'Service Unavailable'
  });
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'butterfly-sync') {
    event.waitUntil(handleButterflySync());
  }
});

async function handleButterflySync() {
  console.log('Background sync triggered for butterfly data');
  // Handle offline butterfly observations when back online
  try {
    const butterfliesDB = await openIndexedDB();
    // Sync pending observations
    console.log('Syncing butterfly observations...');
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// IndexedDB helper
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ButterflyCountDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('observations')) {
        const store = db.createObjectStore('observations', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('listId', 'listId', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('lists')) {
        const store = db.createObjectStore('lists', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'close', title: 'Dismiss' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Butterfly Count', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || event.action === '') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === self.location.origin && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('./');
        }
      })
    );
  }
});
