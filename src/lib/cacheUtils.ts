import { useToast } from "@/hooks/use-toast";

export const clearBrowserCache = async (toast: any, refreshData?: () => Promise<void>) => {
  try {
    // Clear browser cache for images and files
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }

    // Clear localStorage if needed
    const keysToKeep = ['auth_token', 'user_preferences'];
    const keysToRemove = Object.keys(localStorage).filter(key => 
      !keysToKeep.includes(key) && (key.includes('cache') || key.includes('temp'))
    );
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Force reload of images by adding timestamp
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      if (img.src.includes('/uploads/')) {
        img.src = img.src + (img.src.includes('?') ? '&' : '?') + 't=' + Date.now();
      }
    });

    // Clear sessionStorage for temporary data
    const sessionKeysToRemove = Object.keys(sessionStorage).filter(key => 
      key.includes('cache') || key.includes('temp') || key.includes('upload')
    );
    sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));

    toast({
      title: "Cache Cleared",
      description: "Browser cache and temporary files have been cleared",
    });

    // Refresh data if callback provided
    if (refreshData) {
      await refreshData();
    }
  } catch (error) {
    console.error("Error clearing cache:", error);
    toast({
      title: "Cache Clear Error",
      description: "Failed to clear cache completely",
      variant: "destructive",
    });
  }
};

export const useClearCache = (refreshData?: () => Promise<void>) => {
  const { toast } = useToast();
  
  return () => clearBrowserCache(toast, refreshData);
}; 