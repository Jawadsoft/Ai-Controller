// Browser Console Cache Clear Script
// Copy and paste this into your browser console during development

(function() {
  console.log('🧹 Browser Cache Clear Script');
  console.log('==============================');

  async function clearAllCache() {
    try {
      // Clear browser cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        console.log('🗑️ Clearing browser caches:', cacheNames);
        
        await Promise.all(
          cacheNames.map(cacheName => {
            console.log(`Deleting cache: ${cacheName}`);
            return caches.delete(cacheName);
          })
        );
        console.log('✅ Browser caches cleared');
      }

      // Clear localStorage (keep essential items)
      const keysToKeep = ['auth_token', 'user_preferences', 'theme'];
      const keysToRemove = Object.keys(localStorage).filter(key => 
        !keysToKeep.includes(key)
      );
      
      console.log('🗑️ Clearing localStorage keys:', keysToRemove);
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`Removed: ${key}`);
      });
      console.log('✅ localStorage cleared');

      // Clear sessionStorage
      const sessionKeys = Object.keys(sessionStorage);
      console.log('🗑️ Clearing sessionStorage keys:', sessionKeys);
      sessionKeys.forEach(key => {
        sessionStorage.removeItem(key);
        console.log(`Removed: ${key}`);
      });
      console.log('✅ sessionStorage cleared');

      // Force reload of all images and scripts
      const images = document.querySelectorAll('img');
      const scripts = document.querySelectorAll('script[src]');
      
      console.log('🔄 Reloading images and scripts...');
      
      images.forEach(img => {
        if (img.src.includes('/uploads/') || img.src.includes('localhost')) {
          const originalSrc = img.src;
          img.src = originalSrc + (originalSrc.includes('?') ? '&' : '?') + 't=' + Date.now();
          console.log(`Reloaded image: ${originalSrc}`);
        }
      });

      scripts.forEach(script => {
        if (script.src.includes('localhost')) {
          const originalSrc = script.src;
          script.src = originalSrc + (originalSrc.includes('?') ? '&' : '?') + 't=' + Date.now();
          console.log(`Reloaded script: ${originalSrc}`);
        }
      });

      // Clear service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log('🗑️ Unregistering service workers:', registrations.length);
        
        for (const registration of registrations) {
          await registration.unregister();
          console.log('Unregistered service worker');
        }
      }

      console.log('✅ All cache cleared successfully!');
      console.log('🔄 Reloading page to apply changes...');
      
      // Reload the page
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('❌ Error clearing cache:', error);
    }
  }

  // Execute the cache clear
  clearAllCache();
})(); 