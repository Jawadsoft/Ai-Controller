import { useToast } from "@/hooks/use-toast";

// Development cache clearing utilities
export const clearDevCache = async (toast: any) => {
  try {
    console.log('🧹 Clearing development cache...');
    
    // Clear browser cache for all resources
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          console.log(`🗑️ Deleting cache: ${cacheName}`);
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
    keysToRemove.forEach(key => {
      console.log(`🗑️ Removing localStorage key: ${key}`);
      localStorage.removeItem(key);
    });
    console.log('✅ localStorage cleared');

    // Clear sessionStorage
    const sessionKeysToRemove = Object.keys(sessionStorage);
    sessionKeysToRemove.forEach(key => {
      console.log(`🗑️ Removing sessionStorage key: ${key}`);
      sessionStorage.removeItem(key);
    });
    console.log('✅ sessionStorage cleared');

    // Force reload of all images and scripts
    const images = document.querySelectorAll('img');
    const scripts = document.querySelectorAll('script[src]');
    
    images.forEach(img => {
      if (img.src.includes('/uploads/') || img.src.includes('localhost')) {
        const originalSrc = img.src;
        img.src = originalSrc + (originalSrc.includes('?') ? '&' : '?') + 't=' + Date.now();
        console.log(`🔄 Reloading image: ${originalSrc}`);
      }
    });

    scripts.forEach(script => {
      if (script.src.includes('localhost')) {
        const originalSrc = script.src;
        script.src = originalSrc + (originalSrc.includes('?') ? '&' : '?') + 't=' + Date.now();
        console.log(`🔄 Reloading script: ${originalSrc}`);
      }
    });

    // Clear any service worker caches
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log('🗑️ Unregistered service worker');
      }
    }

    toast({
      title: "Development Cache Cleared",
      description: "All caches cleared for development. Changes should now be visible.",
    });

    console.log('✅ Development cache clearing completed');
    
  } catch (error) {
    console.error("Error clearing development cache:", error);
    toast({
      title: "Cache Clear Error",
      description: "Failed to clear cache completely",
      variant: "destructive",
    });
  }
};

// Auto-clear cache on development mode
export const setupDevCacheClearing = () => {
  if (process.env.NODE_ENV === 'development') {
    // Clear cache on page load in development
    if (typeof window !== 'undefined') {
      // Clear cache every 5 minutes in development
      setInterval(() => {
        console.log('🔄 Auto-clearing development cache...');
        clearDevCache({
          title: "Auto Cache Clear",
          description: "Development cache auto-cleared",
        });
      }, 5 * 60 * 1000); // 5 minutes
    }
  }
};

// Manual cache clear with confirmation
export const manualDevCacheClear = async (toast: any) => {
  if (confirm('Clear all development cache? This will reload all resources.')) {
    await clearDevCache(toast);
    // Force page reload to ensure all changes are applied
    window.location.reload();
  }
}; 