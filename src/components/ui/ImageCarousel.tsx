import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Car } from 'lucide-react';
import { BASE_URL } from '@/lib/config';

interface ImageCarouselProps {
  images: string[];
  alt: string;
  className?: string;
}

// Helper function to clean corrupted image URLs
const cleanImageUrl = (url: string): string => {
  if (!url || typeof url !== 'string') return url;
  
  // Remove @ symbol at the beginning
  let cleanedUrl = url.startsWith('@') ? url.slice(1) : url;
  
  // Remove any base URL prefix if present (dynamic approach)
  try {
    const baseUrl = new URL(BASE_URL);
    const baseUrlString = `${baseUrl.protocol}//${baseUrl.host}`;
    
    if (cleanedUrl.includes(baseUrlString + '/')) {
      // Extract the actual URL after the base URL prefix
      const parts = cleanedUrl.split(baseUrlString + '/');
      if (parts.length > 1) {
        cleanedUrl = parts[1];
      }
    }
  } catch (e) {
    // If BASE_URL is not a valid URL, fall back to checking for common patterns
    console.warn('Invalid BASE_URL, falling back to pattern matching:', BASE_URL);
    
    // Check for common URL patterns that might be prefixed
    const urlPatterns = [
      /https?:\/\/[^\/]+\/(.+)/,  // Match any domain followed by path
      /app\.[^\/]+\/(.+)/,        // Match app.domain.com/pattern
    ];
    
    for (const pattern of urlPatterns) {
      const match = cleanedUrl.match(pattern);
      if (match && match[1]) {
        cleanedUrl = match[1];
        break;
      }
    }
  }
  
  // Decode URL encoding
  try {
    cleanedUrl = decodeURIComponent(cleanedUrl);
  } catch (e) {
    // If decoding fails, keep the original
    console.warn('Failed to decode URL:', cleanedUrl);
  }
  
  // Remove any remaining curly braces that might be left
  cleanedUrl = cleanedUrl.replace(/^\{|\}$/g, '');
  
  // Ensure it's a valid URL
  if (cleanedUrl.startsWith('http://') || cleanedUrl.startsWith('https://')) {
    return cleanedUrl;
  }
  
  // If it doesn't start with http, it might be a relative path
  return cleanedUrl;
};

// Helper function to clean image URLs array
const cleanImageUrls = (urls: string[]): string[] => {
  return urls
    .map(url => cleanImageUrl(url))
    .filter(url => url); // Remove any empty URLs after cleaning
};

const ImageCarousel: React.FC<ImageCarouselProps> = ({ 
  images, 
  alt, 
  className = "" 
}) => {
  // Clean the image URLs to remove any corruption
  const cleanedImages = cleanImageUrls(images);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  // Auto-play functionality
  useEffect(() => {
    if (cleanedImages.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        let nextIndex = prevIndex + 1;
        // Skip images that have errors
        while (nextIndex < cleanedImages.length && imageErrors.has(nextIndex)) {
          nextIndex++;
        }
        // If we've reached the end, go back to start
        if (nextIndex >= cleanedImages.length) {
          nextIndex = 0;
          // Skip images with errors from the start too
          while (nextIndex < cleanedImages.length && imageErrors.has(nextIndex)) {
            nextIndex++;
          }
        }
        return nextIndex;
      });
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(interval);
  }, [cleanedImages.length, imageErrors]);

  const handleImageError = (index: number) => {
    setImageErrors(prev => new Set([...prev, index]));
    setIsLoading(false);
    
    // If current image failed, try to move to next available image
    if (index === currentIndex) {
      const nextAvailableIndex = findNextAvailableImage(currentIndex);
      if (nextAvailableIndex !== -1) {
        setCurrentIndex(nextAvailableIndex);
      }
    }
  };

  const findNextAvailableImage = (startIndex: number): number => {
    for (let i = startIndex + 1; i < cleanedImages.length; i++) {
      if (!imageErrors.has(i)) {
        return i;
      }
    }
    // If no image found after startIndex, check from beginning
    for (let i = 0; i < startIndex; i++) {
      if (!imageErrors.has(i)) {
        return i;
      }
    }
    return -1; // No available images
  };

  const goToPrevious = () => {
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) prevIndex = cleanedImages.length - 1;
    
    // Skip images with errors
    while (imageErrors.has(prevIndex) && prevIndex !== currentIndex) {
      prevIndex--;
      if (prevIndex < 0) prevIndex = cleanedImages.length - 1;
    }
    
    setCurrentIndex(prevIndex);
  };

  const goToNext = () => {
    let nextIndex = currentIndex + 1;
    if (nextIndex >= cleanedImages.length) nextIndex = 0;
    
    // Skip images with errors
    while (imageErrors.has(nextIndex) && nextIndex !== currentIndex) {
      nextIndex++;
      if (nextIndex >= cleanedImages.length) nextIndex = 0;
    }
    
    setCurrentIndex(nextIndex);
  };

  const goToSlide = (index: number) => {
    if (!imageErrors.has(index)) {
      setCurrentIndex(index);
    }
  };

  const openFullscreen = () => {
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isFullscreen) return;
      
      switch (event.key) {
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'Escape':
          closeFullscreen();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, currentIndex, cleanedImages.length]);

  if (cleanedImages.length === 0) {
    return (
      <div className={`aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center ${className}`}>
        <div className="text-center">
          <Car className="h-24 w-24 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No images available</p>
        </div>
      </div>
    );
  }

  // Check if all images have errors
  const availableImages = cleanedImages.filter((_, index) => !imageErrors.has(index));
  if (availableImages.length === 0) {
    return (
      <div className={`aspect-square bg-red-50 rounded-lg overflow-hidden flex items-center justify-center border border-red-200 ${className}`}>
        <div className="text-center">
          <Car className="h-24 w-24 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 font-medium">All images failed to load</p>
          <p className="text-red-500 text-sm mt-1">Please check image URLs</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Main Carousel */}
      <div className={`relative group ${className}`}>
        {/* Main Image */}
        <div className="aspect-square bg-muted rounded-lg overflow-hidden relative">
          <img
            src={cleanedImages[currentIndex]}
            alt={`${alt} - Image ${currentIndex + 1}`}
            className="w-full h-full object-cover transition-opacity duration-300"
            onLoad={() => setIsLoading(false)}
            onError={() => handleImageError(currentIndex)}
          />
          
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-muted flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {/* Navigation Arrows */}
          {availableImages.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                onClick={goToPrevious}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                onClick={goToNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Zoom Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            onClick={openFullscreen}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          {/* Image Counter */}
          {availableImages.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
              {currentIndex + 1} / {availableImages.length}
            </div>
          )}
        </div>

        {/* Thumbnail Navigation */}
        {cleanedImages.length > 1 && (
          <div className="flex space-x-2 mt-4 overflow-x-auto pb-2">
            {cleanedImages.map((image, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                disabled={imageErrors.has(index)}
                className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                  imageErrors.has(index)
                    ? 'border-red-300 bg-red-50 opacity-50 cursor-not-allowed'
                    : currentIndex === index 
                    ? 'border-primary ring-2 ring-primary/20' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {imageErrors.has(index) ? (
                  <div className="w-full h-full flex items-center justify-center bg-red-50">
                    <Car className="h-6 w-6 text-red-400" />
                  </div>
                ) : (
                  <img
                    src={image}
                    alt={`${alt} - Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(index)}
                  />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Dots Indicator */}
        {cleanedImages.length > 1 && (
          <div className="flex justify-center space-x-2 mt-4">
            {cleanedImages.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                disabled={imageErrors.has(index)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  imageErrors.has(index)
                    ? 'bg-red-300 cursor-not-allowed'
                    : currentIndex === index 
                    ? 'bg-primary' 
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white z-10"
              onClick={closeFullscreen}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Fullscreen Image */}
            <div className="relative max-w-full max-h-full">
              <img
                src={cleanedImages[currentIndex]}
                alt={`${alt} - Fullscreen ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain"
                onError={() => handleImageError(currentIndex)}
              />
            </div>

            {/* Fullscreen Navigation */}
            {availableImages.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={goToPrevious}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={goToNext}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>

                {/* Fullscreen Dots */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                  {cleanedImages.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToSlide(index)}
                      disabled={imageErrors.has(index)}
                      className={`w-3 h-3 rounded-full transition-all duration-200 ${
                        imageErrors.has(index)
                          ? 'bg-red-500/50 cursor-not-allowed'
                          : currentIndex === index 
                          ? 'bg-white' 
                          : 'bg-white/30 hover:bg-white/50'
                      }`}
                    />
                  ))}
                </div>

                {/* Fullscreen Counter */}
                <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded text-sm">
                  {currentIndex + 1} / {availableImages.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ImageCarousel;
