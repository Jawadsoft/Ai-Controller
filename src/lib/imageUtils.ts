/**
 * Utility functions for handling vehicle images
 */

/**
 * Parse photo_url_list from various formats (PostgreSQL arrays, comma-separated strings, etc.)
 * @param photoUrlList - The photo URL list from the database
 * @returns Array of valid image URLs
 */
export const parsePhotoUrlList = (photoUrlList: string[] | string | null | undefined): string[] => {
  if (!photoUrlList) return [];
  
  if (Array.isArray(photoUrlList)) {
    return photoUrlList.filter(url => url && typeof url === 'string');
  }
  
  if (typeof photoUrlList === 'string') {
    // Handle PostgreSQL array string format: {"url1","url2","url3"}
    if (photoUrlList.startsWith('{') && photoUrlList.endsWith('}')) {
      const content = photoUrlList.slice(1, -1); // Remove { and }
      return content.split(',').map(url => url.trim().replace(/"/g, '')).filter(url => url);
    }
    // Handle comma-separated string
    if (photoUrlList.includes(',')) {
      return photoUrlList.split(',').map(url => url.trim()).filter(url => url);
    }
    // Handle single URL string
    return photoUrlList.trim() ? [photoUrlList.trim()] : [];
  }
  
  return [];
};

/**
 * Check if a photo URL list has any images
 * @param photoUrlList - The photo URL list from the database
 * @returns True if there are images available
 */
export const hasImages = (photoUrlList?: string[] | string | null): boolean => {
  const images = parsePhotoUrlList(photoUrlList);
  return images.length > 0;
};

/**
 * Check if a photo URL list has external images (HTTP/HTTPS URLs)
 * @param photoUrlList - The photo URL list from the database
 * @returns True if there are external images
 */
export const hasExternalImages = (photoUrlList?: string[] | string | null): boolean => {
  const images = parsePhotoUrlList(photoUrlList);
  if (images.length === 0) return false;
  return images.some(img => img.startsWith('http://') || img.startsWith('https://'));
};

/**
 * Generate an SVG placeholder for broken images
 * @param text - Text to display in the placeholder
 * @param width - Width of the placeholder
 * @param height - Height of the placeholder
 * @returns Data URL for the SVG placeholder
 */
export const generateImagePlaceholder = (
  text: string = 'Image Error',
  width: number = 200,
  height: number = 200
): string => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="#f3f4f6"/>
      <text x="${width/2}" y="${height/2}" text-anchor="middle" dy=".3em" fill="#374151" font-family="Arial, sans-serif" font-size="14">
        ${text}
      </text>
    </svg>
  `;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

/**
 * Handle image load error by replacing with placeholder
 * @param event - The error event from the image element
 * @param placeholderText - Text to show in the placeholder
 */
export const handleImageError = (
  event: React.SyntheticEvent<HTMLImageElement, Event>,
  placeholderText: string = 'Image Error'
) => {
  const target = event.target as HTMLImageElement;
  target.src = generateImagePlaceholder(placeholderText);
  target.alt = 'Image failed to load';
};
