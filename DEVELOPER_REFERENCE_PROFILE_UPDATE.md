# 🛠️ Developer Reference: Profile Auto-Update Feature

## Quick Overview

This feature extracts business information from a dealership's website and offers to update their profile automatically.

---

## Architecture

```
┌─────────────┐
│   User      │
│   Clicks    │
│   Button    │
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────────┐
│  DealerProfile.tsx                  │
│  - handleAnalyzeWebsite()           │
│  - handleApplyProfileUpdates()      │
└──────┬──────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────┐
│  API Endpoint                       │
│  POST /api/scraping/dealers/:id/    │
│       scrape                        │
└──────┬──────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────┐
│  websiteScrapingService.js          │
│  - scrapeDealershipWebsite()        │
│  - extractProfileData()             │
└──────┬──────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────┐
│  Returns profileData.suggestions    │
│  { description, established_year }  │
└──────┬──────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────┐
│  UI Shows Purple Suggestions Panel  │
│  User clicks "Apply Updates"        │
└──────┬──────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────┐
│  API Endpoint                       │
│  POST /api/scraping/dealers/:id/    │
│       apply-profile-updates         │
└──────┬──────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────┐
│  Database Update                    │
│  UPDATE dealers SET                 │
│    description = ?,                 │
│    established_year = ?             │
└─────────────────────────────────────┘
```

---

## File Structure

```
src/
├── pages/
│   └── DealerProfile.tsx           [Frontend UI]
├── routes/
│   └── websiteScraping.js          [API Routes]
├── lib/
│   └── websiteScrapingService.js   [Scraping Logic]
└── database/
    └── dealer-knowledge-base-migration.sql
```

---

## Key Components

### 1. Frontend: `DealerProfile.tsx`

#### New State Variables

```typescript
const [profileSuggestions, setProfileSuggestions] = useState<any>(null);
const [applyingUpdates, setApplyingUpdates] = useState(false);
```

#### Key Functions

```typescript
// Trigger website analysis
const handleAnalyzeWebsite = async () => {
  setAnalyzingWebsite(true);
  const response = await fetch(
    buildApiUrl(`scraping/dealers/${dealer.id}/scrape`),
    { method: 'POST', headers: {...} }
  );
  const data = await response.json();
  
  // Check for profile suggestions
  if (data.data.profileData?.suggestions) {
    setProfileSuggestions(data.data.profileData.suggestions);
  }
  
  setAnalyzingWebsite(false);
};

// Apply suggestions to profile
const handleApplyProfileUpdates = async () => {
  setApplyingUpdates(true);
  const response = await fetch(
    buildApiUrl(`scraping/dealers/${dealer.id}/apply-profile-updates`),
    {
      method: 'POST',
      headers: {...},
      body: JSON.stringify({
        description: profileSuggestions.description,
        established_year: profileSuggestions.established_year
      })
    }
  );
  const data = await response.json();
  
  // Update local state
  setDealer(prev => ({
    ...prev,
    description: data.data.description,
    established_year: data.data.established_year
  }));
  
  setProfileSuggestions(null);
  setApplyingUpdates(false);
};

// Dismiss suggestions
const handleDismissSuggestions = () => {
  setProfileSuggestions(null);
};
```

#### UI Component

```tsx
{profileSuggestions && (
  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
    <div className="flex items-start gap-3">
      <Sparkles className="h-5 w-5 text-purple-600" />
      <div className="flex-1">
        <p className="font-medium text-purple-800">
          Profile Updates Available
        </p>
        
        {profileSuggestions.description && (
          <div className="bg-white/50 rounded p-3">
            <p className="text-xs font-semibold">Business Description:</p>
            <p className="text-sm">{profileSuggestions.description}</p>
          </div>
        )}
        
        {profileSuggestions.established_year && (
          <div className="bg-white/50 rounded p-3">
            <p className="text-xs font-semibold">Established Year:</p>
            <p className="text-sm">{profileSuggestions.established_year}</p>
          </div>
        )}
        
        <div className="flex gap-2 mt-4">
          <Button onClick={handleApplyProfileUpdates}>
            Apply Updates
          </Button>
          <Button onClick={handleDismissSuggestions} variant="outline">
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  </div>
)}
```

---

### 2. Backend Service: `websiteScrapingService.js`

#### New Method: `extractProfileData()`

```javascript
async extractProfileData($, dealerId, sourceUrl) {
  const profileData = {
    suggestions: {
      description: null,
      established_year: null
    }
  };

  // Extract description
  const descriptionSelectors = [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'section[class*="about"] p',
    'div[class*="about"] p'
  ];

  for (const selector of descriptionSelectors) {
    let description = '';
    
    if (selector.startsWith('meta')) {
      description = $(selector).attr('content') || '';
    } else {
      const paragraphs = $(selector).slice(0, 3)
        .map((i, el) => $(el).text().trim())
        .get();
      description = paragraphs.join(' ');
    }

    if (description.length > 50 && description.length < 1000) {
      profileData.suggestions.description = description;
      break;
    }
  }

  // Extract established year
  const pageText = $('body').text();
  const yearPatterns = [
    /established (?:in )?(\d{4})/i,
    /since (\d{4})/i,
    /founded (?:in )?(\d{4})/i,
    /serving (?:since|for) (\d{4})/i,
    /in business since (\d{4})/i,
    /(\d{4})[\s-]+present/i,
    /over (\d{2})\+ years/i
  ];

  for (const pattern of yearPatterns) {
    const match = pageText.match(pattern);
    if (match) {
      let year = parseInt(match[1]);
      
      // Calculate from "X+ years" pattern
      if (pattern.toString().includes('years')) {
        year = new Date().getFullYear() - year;
      }
      
      // Validate year
      if (year >= 1900 && year <= new Date().getFullYear()) {
        profileData.suggestions.established_year = year;
        break;
      }
    }
  }

  return profileData;
}
```

#### Integration in `scrapeDealershipWebsite()`

```javascript
async scrapeDealershipWebsite(dealerId, websiteUrl) {
  // ... existing extraction code ...
  
  // Extract profile data
  results.profileData = await this.extractProfileData($, dealerId, websiteUrl);
  
  return results;
}
```

---

### 3. API Routes: `websiteScraping.js`

#### New Endpoint: Apply Profile Updates

```javascript
router.post(
  '/dealers/:dealerId/apply-profile-updates',
  authenticateToken,
  requirePermission('daive_settings_management'),
  async (req, res) => {
    try {
      const { dealerId } = req.params;
      const { description, established_year } = req.body;

      // Build dynamic update query
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (description !== undefined && description !== null) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }

      if (established_year !== undefined && established_year !== null) {
        updates.push(`established_year = $${paramIndex++}`);
        values.push(established_year);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid fields to update'
        });
      }

      updates.push(`updated_at = NOW()`);
      values.push(dealerId);

      const query = `
        UPDATE dealers
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, business_name, description, established_year
      `;

      const result = await pool.query(query, values);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error applying profile updates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to apply profile updates',
        message: error.message
      });
    }
  }
);
```

---

## Data Flow

### Request Flow: Analyze Website

```
Client Request:
POST /api/scraping/dealers/123/scrape
Headers: Authorization: Bearer <token>

↓

Server Processing:
1. Authenticate user
2. Check permissions
3. Validate dealer ID
4. Fetch dealer website URL
5. Call websiteScrapingService.scrapeDealershipWebsite()
6. Extract knowledge (existing)
7. Extract profile data (NEW)
8. Store in database
9. Return results

↓

Server Response:
{
  "success": true,
  "data": {
    "dealerId": "123",
    "entriesStored": 15,
    "categoriesFound": ["about", "services"],
    "profileData": {                    // NEW
      "suggestions": {
        "description": "Business desc...",
        "established_year": 1995
      }
    }
  }
}

↓

Client Processing:
1. Update analysisResults state
2. Check for profileData.suggestions
3. If found, set profileSuggestions state
4. UI renders purple panel
```

### Request Flow: Apply Updates

```
Client Request:
POST /api/scraping/dealers/123/apply-profile-updates
Headers: Authorization: Bearer <token>
Body: {
  "description": "New description",
  "established_year": 1995
}

↓

Server Processing:
1. Authenticate user
2. Check permissions
3. Validate input
4. Build dynamic SQL UPDATE
5. Execute query
6. Return updated profile

↓

Server Response:
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "123",
    "business_name": "Dealer Name",
    "description": "New description",
    "established_year": 1995
  }
}

↓

Client Processing:
1. Update local dealer state
2. Clear profileSuggestions
3. Show success toast
4. UI re-renders with new data
```

---

## Database Schema

### Existing Table: `dealers`

```sql
-- Fields we're updating
description TEXT,
established_year INTEGER,
updated_at TIMESTAMP DEFAULT NOW()
```

### Query: Apply Profile Updates

```sql
UPDATE dealers
SET 
  description = $1,
  established_year = $2,
  updated_at = NOW()
WHERE id = $3
RETURNING id, business_name, description, established_year;
```

---

## Configuration

### Description Extraction

```javascript
// Selectors tried in order
const descriptionSelectors = [
  'meta[name="description"]',           // Meta tag
  'meta[property="og:description"]',    // OpenGraph
  'section[class*="about"] p',          // About section
  'div[class*="about"] p',              // About div
  '.about-section p',                   // Class selector
  '[id*="about"] p'                     // ID selector
];

// Validation
MIN_LENGTH = 50 characters
MAX_LENGTH = 1000 characters
```

### Year Extraction

```javascript
// Patterns
const yearPatterns = [
  /established (?:in )?(\d{4})/i,       // "Established in 1995"
  /since (\d{4})/i,                     // "Since 1998"
  /founded (?:in )?(\d{4})/i,           // "Founded in 2000"
  /serving (?:since|for) (\d{4})/i,    // "Serving since 1985"
  /in business since (\d{4})/i,         // "In business since 1990"
  /(\d{4})[\s-]+present/i,              // "1995 - present"
  /over (\d{2})\+ years/i               // "Over 25+ years"
];

// Validation
MIN_YEAR = 1900
MAX_YEAR = new Date().getFullYear()
```

---

## Error Handling

### Frontend Errors

```typescript
try {
  // API call
} catch (error: any) {
  console.error('Error:', error);
  toast({
    title: "Error Title",
    description: error.message || "Default message",
    variant: "destructive",
  });
} finally {
  setLoading(false);
}
```

### Backend Errors

```javascript
try {
  // Processing
  res.json({ success: true, data: result });
} catch (error) {
  console.error('Error:', error);
  res.status(500).json({
    success: false,
    error: 'User-friendly error',
    message: error.message
  });
}
```

---

## Security Considerations

### Authentication & Authorization

```javascript
// Middleware chain
router.post(
  '/dealers/:dealerId/apply-profile-updates',
  authenticateToken,                    // JWT verification
  requirePermission('daive_settings_management'),  // Permission check
  async (req, res) => { ... }
);
```

### Input Validation

```javascript
// Validate description
if (description !== undefined && description !== null) {
  if (typeof description !== 'string') {
    return res.status(400).json({ error: 'Invalid description type' });
  }
  if (description.length < 10 || description.length > 2000) {
    return res.status(400).json({ error: 'Description length invalid' });
  }
}

// Validate year
if (established_year !== undefined && established_year !== null) {
  const year = parseInt(established_year);
  if (isNaN(year) || year < 1900 || year > new Date().getFullYear()) {
    return res.status(400).json({ error: 'Invalid year' });
  }
}
```

### SQL Injection Prevention

```javascript
// GOOD: Parameterized queries
const query = `
  UPDATE dealers
  SET description = $1, established_year = $2
  WHERE id = $3
`;
await pool.query(query, [description, year, dealerId]);

// BAD: String concatenation (NEVER DO THIS)
const query = `UPDATE dealers SET description = '${description}'`;
```

---

## Testing Utilities

### Mock Data

```javascript
const mockProfileData = {
  suggestions: {
    description: "Family-owned dealership serving the Dallas area since 1995.",
    established_year: 1995
  }
};

const mockApiResponse = {
  success: true,
  data: {
    entriesStored: 15,
    categoriesFound: ['about', 'services'],
    profileData: mockProfileData
  }
};
```

### Test Helpers

```javascript
// Frontend test helper
const simulateAnalyze = async (dealerId: string) => {
  const response = await fetch(`/api/scraping/dealers/${dealerId}/scrape`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${testToken}`,
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
};

// Backend test helper
const testProfileUpdate = async (dealerId, updates) => {
  const query = 'UPDATE dealers SET description = $1 WHERE id = $2 RETURNING *';
  const result = await pool.query(query, [updates.description, dealerId]);
  return result.rows[0];
};
```

---

## Performance Considerations

### Frontend Optimization

```typescript
// Debounce rapid clicks
const [isAnalyzing, setIsAnalyzing] = useState(false);

const handleAnalyze = async () => {
  if (isAnalyzing) return; // Prevent duplicate requests
  setIsAnalyzing(true);
  try {
    await analyzeWebsite();
  } finally {
    setIsAnalyzing(false);
  }
};
```

### Backend Optimization

```javascript
// Use connection pooling (already configured)
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// Optimize query
CREATE INDEX IF NOT EXISTS idx_dealers_id ON dealers(id);
```

---

## Monitoring & Logging

### Frontend Logs

```typescript
console.log('Starting website analysis for dealer:', dealerId);
console.log('Analysis results:', analysisResults);
console.log('Profile suggestions:', profileSuggestions);
console.error('Error analyzing website:', error);
```

### Backend Logs

```javascript
console.log(`📋 Extracting profile data for dealer ${dealerId}`);
console.log(`✓ Found description (${description.length} chars)`);
console.log(`✓ Found established year: ${year}`);
console.error('Error extracting profile data:', error.message);
```

---

## Extending the Feature

### Adding New Profile Fields

1. **Update `extractProfileData()` in `websiteScrapingService.js`**:

```javascript
// Extract phone number
const phonePattern = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
const phoneMatch = pageText.match(phonePattern);
if (phoneMatch) {
  profileData.suggestions.phone = phoneMatch[0];
}
```

2. **Update API endpoint** in `websiteScraping.js`:

```javascript
if (phone !== undefined && phone !== null) {
  updates.push(`phone = $${paramIndex++}`);
  values.push(phone);
}
```

3. **Update UI** in `DealerProfile.tsx`:

```tsx
{profileSuggestions.phone && (
  <div className="bg-white/50 rounded p-3">
    <p className="text-xs font-semibold">Phone:</p>
    <p className="text-sm">{profileSuggestions.phone}</p>
  </div>
)}
```

### Adding New Extraction Patterns

```javascript
// In extractProfileData()
const newYearPattern = /operating since (\d{4})/i;
yearPatterns.push(newYearPattern);
```

---

## Troubleshooting

### Issue: Suggestions not appearing

**Debug Steps**:
1. Check browser console for errors
2. Verify `profileData` in API response
3. Check `profileSuggestions` state in React DevTools
4. Verify extraction patterns match website content

**Debug Code**:
```typescript
console.log('API Response:', data);
console.log('Profile Data:', data.data?.profileData);
console.log('Suggestions:', data.data?.profileData?.suggestions);
```

### Issue: Apply fails silently

**Debug Steps**:
1. Check network tab for API response
2. Verify authentication token
3. Check permissions
4. Review backend logs

**Debug Code**:
```javascript
// Add to API endpoint
console.log('Update values:', { description, established_year, dealerId });
console.log('SQL query:', query);
console.log('Query result:', result.rows);
```

---

## Dependencies

### Frontend

```json
{
  "lucide-react": "^0.x.x",      // Icons (Sparkles, X, etc.)
  "react": "^18.x.x",
  "@radix-ui/react-*": "^1.x.x"  // UI components
}
```

### Backend

```json
{
  "puppeteer": "^21.x.x",        // Web scraping
  "cheerio": "^1.x.x",           // HTML parsing
  "pg": "^8.x.x"                 // PostgreSQL client
}
```

---

## Code Style Guidelines

### TypeScript/React

```typescript
// Use descriptive variable names
const [profileSuggestions, setProfileSuggestions] = useState<any>(null);

// Use async/await (not .then)
const handleApply = async () => {
  try {
    const response = await fetch(...);
    const data = await response.json();
  } catch (error) {
    console.error(error);
  }
};

// Destructure props
const { description, established_year } = profileSuggestions;
```

### JavaScript/Node

```javascript
// Use async/await
async extractProfileData($, dealerId, sourceUrl) {
  const data = await fetchData();
  return data;
}

// Use template literals
console.log(`Extracted data for dealer ${dealerId}`);

// Use array methods
const years = matches.map(m => parseInt(m[1]));
```

---

## Useful Commands

### Development

```bash
# Start dev server
npm run dev

# Check for TypeScript errors
npx tsc --noEmit

# Run linter
npm run lint

# Format code
npm run format
```

### Database

```sql
-- Check profile updates
SELECT id, business_name, description, established_year, updated_at
FROM dealers
WHERE id = 'dealer-id'
ORDER BY updated_at DESC;

-- View recent scraping activity
SELECT dealer_id, category, data_key, created_at
FROM dealer_knowledge_base
WHERE dealer_id = 'dealer-id'
ORDER BY created_at DESC
LIMIT 20;
```

---

## API Documentation

### POST `/api/scraping/dealers/:dealerId/scrape`

**Description**: Analyzes dealer website and extracts knowledge + profile data

**Headers**:
- `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "dealerId": "uuid",
    "entriesStored": 15,
    "categoriesFound": ["about", "services", "hours"],
    "profileData": {
      "suggestions": {
        "description": "string | null",
        "established_year": "number | null"
      }
    }
  }
}
```

### POST `/api/scraping/dealers/:dealerId/apply-profile-updates`

**Description**: Applies extracted profile suggestions to dealer profile

**Headers**:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body**:
```json
{
  "description": "string (optional)",
  "established_year": "number (optional)"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "uuid",
    "business_name": "string",
    "description": "string",
    "established_year": "number"
  }
}
```

---

## Quick Reference

### Key Files
- `src/pages/DealerProfile.tsx` - UI
- `src/routes/websiteScraping.js` - API
- `src/lib/websiteScrapingService.js` - Logic

### Key Functions
- `extractProfileData()` - Extracts data
- `handleAnalyzeWebsite()` - Triggers analysis
- `handleApplyProfileUpdates()` - Applies updates

### Key State
- `profileSuggestions` - Stores suggestions
- `applyingUpdates` - Loading state

### Key Endpoints
- `POST /api/scraping/dealers/:id/scrape`
- `POST /api/scraping/dealers/:id/apply-profile-updates`

---

**Document Version**: 1.0  
**Last Updated**: August 7, 2026  
**Maintainer**: Development Team
