# API Base URL Migration Summary

## Overview
This document summarizes the migration from hardcoded `http://localhost:3000/api` URLs to a centralized, environment-based API configuration system.

## What Was Changed

### 1. Configuration Files Created/Updated

#### `src/lib/config.ts` (NEW)
- Centralized configuration for API base URLs
- Environment-based URL resolution
- Helper functions for building API and asset URLs
- Support for `VITE_API_BASE_URL` environment variable

#### `src/lib/api.ts` (UPDATED)
- Now imports configuration from `config.ts`
- Removed duplicate base URL logic
- Uses centralized `API_BASE_URL` configuration

#### `env.example` (UPDATED)
- Added `VITE_API_BASE_URL` configuration option
- Example: `VITE_API_BASE_URL=https://your-production-domain.com/api`

### 2. Components Updated

#### `src/pages/AIBotPage.tsx`
- Added import: `import { buildApiUrl, buildAssetUrl } from '../lib/config';`
- Updated 25+ hardcoded localhost URLs to use `buildApiUrl()`
- Updated 4+ audio URLs to use `buildAssetUrl()`

#### `src/components/daive/DAIVESettings.tsx`
- Added import: `import { buildApiUrl } from '../../lib/config';`
- Updated 15+ hardcoded localhost URLs to use `buildApiUrl()`

#### `src/components/daive/DAIVEChat.tsx`
- Added import: `import { buildApiUrl, buildAssetUrl } from '../../lib/config';`
- Updated 5+ hardcoded localhost URLs to use `buildApiUrl()`
- Updated 1+ audio URL to use `buildAssetUrl()`

#### `src/components/daive/DAIVEAnalytics.tsx`
- Added import: `import { buildApiUrl } from '../../lib/config';`
- Updated 3+ hardcoded localhost URLs to use `buildApiUrl()`

#### `src/components/import/ImportConfiguration.tsx`
- Added import: `import { buildApiUrl } from '@/lib/config';`
- Updated 20+ hardcoded localhost URLs to use `buildApiUrl()`

#### `src/components/import/CSVAnalysisModal.tsx`
- Added import: `import { buildApiUrl } from '@/lib/config';`
- Updated 2+ hardcoded localhost URLs to use `buildApiUrl()`

#### `src/components/import/CSVUploadWithMapping.tsx`
- Added import: `import { buildApiUrl } from '@/lib/config';`
- Updated 1+ hardcoded localhost URL to use `buildApiUrl()`

#### `src/pages/VehicleDetail.tsx`
- Added import: `import { buildApiUrl, buildAssetUrl } from '@/lib/config';`
- Updated 6+ hardcoded localhost URLs to use `buildApiUrl()`
- Updated 1+ audio URL to use `buildAssetUrl()`

## How the New System Works

### Environment Variable Priority
1. **Explicit**: `VITE_API_BASE_URL` (highest priority)
2. **Production**: `window.location.origin + '/api` (fallback)
3. **Development**: `http://localhost:3000/api` (default)

### Helper Functions

#### `buildApiUrl(endpoint: string)`
- Builds full API URLs
- Automatically handles leading slashes
- Example: `buildApiUrl('daive/chat')` → `https://your-domain.com/api/daive/chat`

#### `buildAssetUrl(path: string)`
- Builds full asset URLs (for audio, images, etc.)
- Automatically handles leading slashes
- Example: `buildAssetUrl('/uploads/audio.mp3')` → `https://your-domain.com/uploads/audio.mp3`

## Benefits

### 1. Environment Flexibility
- **Development**: Uses localhost automatically
- **Production**: Uses current domain automatically
- **Custom**: Override with environment variable

### 2. Maintainability
- Single source of truth for API configuration
- Easy to update all endpoints at once
- Consistent URL building across components

### 3. Deployment Ready
- No more hardcoded localhost URLs
- Automatic production URL detection
- Environment-specific configuration support

## Usage Examples

### Before (Hardcoded)
```typescript
const response = await fetch('http://localhost:3000/api/daive/chat', {
  // ... options
});
```

### After (Centralized)
```typescript
import { buildApiUrl } from '@/lib/config';

const response = await fetch(buildApiUrl('daive/chat'), {
  // ... options
});
```

### Environment Configuration
```bash
# Development (default)
# No environment variable needed

# Production (automatic)
# Uses current domain automatically

# Custom domain
VITE_API_BASE_URL=https://api.myapp.com/api
```

## Migration Checklist

- [x] Created centralized configuration system
- [x] Updated all component imports
- [x] Replaced hardcoded localhost URLs
- [x] Updated audio/asset URL handling
- [x] Added environment variable support
- [x] Updated documentation

## Testing

### Development
- URLs should resolve to `http://localhost:3000/api`
- All API calls should work as before

### Production
- URLs should resolve to `https://your-domain.com/api`
- No localhost references should remain

### Custom Configuration
- Set `VITE_API_BASE_URL` to test custom domains
- Verify all endpoints use the custom base URL

## Future Considerations

1. **Monitoring**: Add logging for URL resolution
2. **Validation**: Add URL format validation
3. **Fallbacks**: Add more robust fallback strategies
4. **Caching**: Consider caching resolved URLs for performance

## Notes

- All changes maintain backward compatibility
- No breaking changes to existing functionality
- Components now use consistent URL building patterns
- Easy to switch between environments without code changes
