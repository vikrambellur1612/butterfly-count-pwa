// Clear Cache Script for Development
// Run this in the browser console to force clear all caches

(async function clearAllCaches() {
    console.log('🧹 Starting cache cleanup...');
    
    // Clear Service Worker caches
    if ('caches' in window) {
        const cacheNames = await caches.keys();
        console.log('📦 Found caches:', cacheNames);
        
        for (const cacheName of cacheNames) {
            console.log(`🗑️ Deleting cache: ${cacheName}`);
            await caches.delete(cacheName);
        }
        console.log('✅ Service Worker caches cleared');
    }
    
    // Clear localStorage
    if (localStorage) {
        const itemCount = localStorage.length;
        localStorage.clear();
        console.log(`🗃️ Cleared ${itemCount} localStorage items`);
    }
    
    // Clear sessionStorage
    if (sessionStorage) {
        const itemCount = sessionStorage.length;
        sessionStorage.clear();
        console.log(`📝 Cleared ${itemCount} sessionStorage items`);
    }
    
    // Unregister Service Worker (optional - uncomment if needed)
    /*
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
            console.log('🔄 Unregistering Service Worker...');
            await registration.unregister();
        }
    }
    */
    
    console.log('🎉 Cache cleanup complete! Refresh the page to see changes.');
    console.log('💡 For icon changes, you may also need to:');
    console.log('   1. Clear browser cache manually (Cmd+Shift+R or Ctrl+Shift+R)');
    console.log('   2. Delete and reinstall the PWA on mobile devices');
    
    // Force page reload
    window.location.reload(true);
})();
