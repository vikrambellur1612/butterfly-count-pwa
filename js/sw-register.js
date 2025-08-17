// Service Worker Registration for Butterfly Count PWA

// PWA Install handling
let deferredPrompt;

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('Butterfly Count ServiceWorker registered:', registration.scope);
        
        // Check for updates periodically
        setInterval(() => registration.update(), 60000);
        
        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                showUpdateNotification();
              }
            }
          });
        });
      })
      .catch((err) => {
        console.log('ServiceWorker registration failed:', err);
      });
      
    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'CACHE_UPDATED') {
        console.log('Cache updated:', event.data);
        showCacheUpdateNotification(event.data.message);
      }
    });
  });
}

// PWA Install Banner
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

window.addEventListener('appinstalled', () => {
  console.log('Butterfly Count PWA was installed');
  hideInstallBanner();
  deferredPrompt = null;
});

function showInstallBanner() {
  const installBanner = document.getElementById('installBanner');
  if (installBanner) {
    installBanner.classList.remove('hidden');
    
    const installBtn = document.getElementById('installBtn');
    const dismissBtn = document.getElementById('dismissBtn');
    
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Install prompt outcome: ${outcome}`);
        
        if (outcome === 'accepted') {
          hideInstallBanner();
        }
        deferredPrompt = null;
      }
    });
    
    dismissBtn.addEventListener('click', () => {
      hideInstallBanner();
      // Remember user dismissed, don't show again for a while
      localStorage.setItem('installBannerDismissed', Date.now());
    });
  }
}

function hideInstallBanner() {
  const installBanner = document.getElementById('installBanner');
  if (installBanner) {
    installBanner.classList.add('hidden');
  }
}

// Check if install banner was recently dismissed
function shouldShowInstallBanner() {
  const dismissed = localStorage.getItem('installBannerDismissed');
  if (!dismissed) return true;
  
  const dismissedTime = parseInt(dismissed);
  const dayInMs = 24 * 60 * 60 * 1000;
  const weekInMs = 7 * dayInMs;
  
  return (Date.now() - dismissedTime) > weekInMs;
}

// Show update notification
function showUpdateNotification() {
  const updateNotification = document.getElementById('updateNotification');
  if (updateNotification) {
    updateNotification.classList.remove('hidden');
    
    const updateBtn = document.getElementById('updateBtn');
    const dismissUpdate = document.getElementById('dismissUpdate');
    
    updateBtn.addEventListener('click', () => {
      window.location.reload();
    });
    
    dismissUpdate.addEventListener('click', () => {
      updateNotification.classList.add('hidden');
    });
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      updateNotification.classList.add('hidden');
    }, 10000);
  }
}

// Show cache update notification for icons
function showCacheUpdateNotification(message) {
  if (typeof showToast === 'function') {
    showToast('App updated! Fresh icons loaded. Reinstall PWA for best experience.', 'success', 8000);
  } else {
    console.log('Cache update:', message);
    // Fallback notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Butterfly Count Updated', {
        body: 'Fresh icons loaded! Please reinstall the PWA for the best experience.',
        icon: './icons/icon-192x192.png?v=1.6.9'
      });
    }
  }
}

// Network status detection
let isOnline = navigator.onLine;

window.addEventListener('online', () => {
  isOnline = true;
  hideOfflineIndicator();
  console.log('App is back online');
  
  // Trigger background sync if available
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready
      .then((registration) => registration.sync.register('butterfly-sync'))
      .catch((error) => console.error('Background sync registration failed:', error));
  }
});

window.addEventListener('offline', () => {
  isOnline = false;
  showOfflineIndicator();
  console.log('App is offline');
});

function showOfflineIndicator() {
  const offlineIndicator = document.getElementById('offlineIndicator');
  if (offlineIndicator) {
    offlineIndicator.classList.remove('hidden');
  }
}

function hideOfflineIndicator() {
  const offlineIndicator = document.getElementById('offlineIndicator');
  if (offlineIndicator) {
    offlineIndicator.classList.add('hidden');
  }
}

// Background sync registration
function registerBackgroundSync(tag) {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready
      .then((registration) => registration.sync.register(tag))
      .then(() => console.log('Background sync registered:', tag))
      .catch((error) => console.error('Background sync failed:', error));
  }
}

// Push notifications
async function requestNotificationPermission() {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

// Share functionality
function shareContent(data) {
  if (navigator.share) {
    navigator.share({
      title: data.title,
      text: data.text,
      url: data.url
    }).then(() => console.log('Shared successfully'))
      .catch((error) => console.error('Share failed:', error));
  } else {
    // Fallback to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(data.text || data.url)
        .then(() => {
          console.log('Copied to clipboard');
          // Show a toast notification
          showToast('Copied to clipboard!');
        })
        .catch((error) => console.error('Copy failed:', error));
    }
  }
}

// Vibration feedback
function vibrate(pattern = [200]) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

// Screen Wake Lock
let wakeLock = null;

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Screen wake lock active');
    } catch (error) {
      console.error('Wake lock failed:', error);
    }
  }
}

async function releaseWakeLock() {
  if (wakeLock) {
    await wakeLock.release();
    wakeLock = null;
    console.log('Screen wake lock released');
  }
}

// Battery status monitoring
if ('getBattery' in navigator) {
  navigator.getBattery().then((battery) => {
    console.log('Battery level:', Math.round(battery.level * 100) + '%');
    
    // Warn user about low battery
    if (battery.level < 0.15 && !battery.charging) {
      showToast('Low battery! Consider saving your work.', 'warning');
    }
    
    // Listen for battery changes
    battery.addEventListener('levelchange', () => {
      const level = Math.round(battery.level * 100);
      console.log('Battery level changed:', level + '%');
    });
    
    battery.addEventListener('chargingchange', () => {
      console.log('Battery charging:', battery.charging);
    });
  });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  // Check if we should show install banner
  if (!shouldShowInstallBanner()) {
    hideInstallBanner();
  }
  
  // Set initial online status
  if (isOnline) {
    hideOfflineIndicator();
  } else {
    showOfflineIndicator();
  }
});

// Handle URL shortcuts from manifest
function handleShortcuts() {
  const urlParams = new URLSearchParams(window.location.search);
  const shortcut = urlParams.get('shortcut');
  
  switch (shortcut) {
    case 'count':
      // Navigate to count view
      if (typeof switchView === 'function') {
        switchView('count');
      }
      break;
    case 'newlist':
      // Open new list modal
      if (typeof showModal === 'function') {
        showModal('createListModal');
      }
      break;
  }
}

// Call on page load
window.addEventListener('load', handleShortcuts);
