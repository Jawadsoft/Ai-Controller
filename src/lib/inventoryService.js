/**
 * Inventory Service - Real-time Vehicle Availability
 * Provides actual inventory data for the AI system to use
 */

class InventoryService {
  constructor() {
    this.inventory = new Map();
    this.dealerInventories = new Map();
    this.lastUpdate = null;
    // Cache for smart slot questions
    this.dealerCache = new Map(); // dealerId -> { makes, modelsByMake, lastCacheUpdate }
    
    // PERFORMANCE OPTIMIZATION: Search result caching
    this.searchCache = new Map(); // criteria hash -> { results, timestamp, ttl }
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    
    // PERFORMANCE OPTIMIZATION: Initialization caching (prevents redundant DB queries)
    this._initCache = {}; // dealerId -> { timestamp }
    
    // PERFORMANCE OPTIMIZATION: In-memory search indexes
    this.searchIndexes = {
      byMake: new Map(),      // make -> Set of vehicle IDs
      byModel: new Map(),     // model -> Set of vehicle IDs  
      byType: new Map(),      // type -> Set of vehicle IDs
      byPriceRange: new Map(), // price range -> Set of vehicle IDs
      byYear: new Map(),      // year -> Set of vehicle IDs
      byDealer: new Map()     // dealerId -> Set of vehicle IDs
    };
    
    // PERFORMANCE OPTIMIZATION: Pre-computed feature mappings
    this.featureIndex = new Map(); // feature -> Set of vehicle IDs
    this.colorIndex = new Map();   // color category -> Set of vehicle IDs
    
    // Brand options by vehicle type (no DB calls needed)
    this.brandOptionsByType = new Map();
    this.initializeBrandOptions();
  }

  /**
   * ✅ NEW: Ensure vehicle features are always clean arrays
   */
  ensureCleanFeatures(vehicle) {
    if (!vehicle.features) {
      vehicle.features = [];
      return vehicle;
    }

    if (Array.isArray(vehicle.features)) {
      // Already clean array - clean up any corrupted strings within the array
      const originalFeatures = [...vehicle.features];
      vehicle.features = vehicle.features.map(feature => this.cleanFeatureString(feature)).filter(Boolean);
      
      // Log if features were cleaned
      if (originalFeatures.length !== vehicle.features.length) {
        console.log(`🧹 Cleaned features for ${vehicle.make} ${vehicle.model}:`, {
          original: originalFeatures,
          cleaned: vehicle.features
        });
      }
      return vehicle;
    }

    if (typeof vehicle.features === 'string') {
      const originalFeatures = vehicle.features;
      vehicle.features = this.extractCleanFeaturesFromString(vehicle.features);
      
      // Log the cleaning process
      console.log(`🧹 Extracted clean features for ${vehicle.make} ${vehicle.model}:`, {
        original: originalFeatures,
        cleaned: vehicle.features
      });
    } else {
      vehicle.features = [];
    }

    return vehicle;
  }

  /**
   * ✅ NEW: Clean individual feature strings
   */
  cleanFeatureString(feature) {
    if (!feature || typeof feature !== 'string') return null;
    
    // Remove JSON artifacts and clean up the string
    let cleaned = feature
      .replace(/^[{\"]+/, '')  // Remove leading { and "
      .replace(/[\"}]+$/, '')  // Remove trailing " and }
      .replace(/\\/g, '')      // Remove backslashes
      .trim();
    
    // Skip empty or very short features
    if (cleaned.length < 2) return null;
    
    return cleaned;
  }

  /**
   * ✅ NEW: Extract clean features from corrupted string
   */
  extractCleanFeaturesFromString(featuresString) {
    // Handle already-parsed arrays directly
    if (Array.isArray(featuresString)) {
      return featuresString.map(f => this.cleanFeatureString(f)).filter(Boolean);
    }
    if (!featuresString || typeof featuresString !== 'string') return [];
    
    try {
      // Try to parse as JSON first
      if (featuresString.includes('{') || featuresString.includes('[')) {
        const parsed = JSON.parse(featuresString);
        if (Array.isArray(parsed)) {
          return parsed.map(feature => this.cleanFeatureString(feature)).filter(Boolean);
        }
      }
      
      // Handle comma-separated strings
      if (featuresString.includes(',')) {
        return featuresString.split(',')
          .map(feature => this.cleanFeatureString(feature))
          .filter(Boolean);
      }
      
      // Single feature string
      const cleaned = this.cleanFeatureString(featuresString);
      return cleaned ? [cleaned] : [];
      
    } catch (error) {
      console.log('⚠️ Failed to parse features string:', featuresString);
      return [];
    }
  }

  /**
   * Initialize brand options by vehicle type (no DB calls needed)
   */
  initializeBrandOptions() {
    console.log('🏷️ Initializing brand options by vehicle type...');
    
    // SUV options
    this.brandOptionsByType.set('SUV', [
      {
        year: 2023,
        make: 'Toyota',
        model: 'RAV4',
        trim: 'XLE',
        description: 'Reliable, fuel-efficient, and loaded with safety tech.'
      },
      {
        year: 2022,
        make: 'Honda',
        model: 'CR-V',
        trim: 'Touring',
        description: 'Smooth ride, leather seats, and panoramic sunroof.'
      },
      {
        year: 2023,
        make: 'Ford',
        model: 'Explorer',
        trim: 'Limited',
        description: 'Bigger size, 3-row seating, and strong towing capacity.'
      },
      {
        year: 2021,
        make: 'Chevrolet',
        model: 'Tahoe',
        trim: 'LT',
        description: 'Full-size SUV, perfect if you need extra cargo and family room.'
      }
    ]);

    // Sedan options
    this.brandOptionsByType.set('sedan', [
      {
        year: 2023,
        make: 'Toyota',
        model: 'Camry',
        trim: 'LE',
        description: 'Reliable, fuel-efficient, and comfortable for daily commuting.'
      },
      {
        year: 2022,
        make: 'Honda',
        model: 'Accord',
        trim: 'Sport',
        description: 'Smooth ride, spacious interior, and excellent fuel economy.'
      },
      {
        year: 2023,
        make: 'Hyundai',
        model: 'Elantra',
        trim: 'SEL',
        description: 'Great value, modern features, and comprehensive warranty.'
      },
      {
        year: 2022,
        make: 'Nissan',
        model: 'Altima',
        trim: 'SV',
        description: 'Comfortable ride, advanced safety features, and good fuel efficiency.'
      }
    ]);

    // Truck options
    this.brandOptionsByType.set('truck', [
      {
        year: 2023,
        make: 'Ford',
        model: 'F-150',
        trim: 'XLT',
        description: 'Powerful engine, spacious cab, and excellent towing capacity.'
      },
      {
        year: 2022,
        make: 'Chevrolet',
        model: 'Silverado',
        trim: 'LT',
        description: 'Strong performance, comfortable interior, and advanced technology.'
      },
      {
        year: 2023,
        make: 'Ram',
        model: '1500',
        trim: 'Big Horn',
        description: 'Luxurious interior, smooth ride, and impressive towing capabilities.'
      },
      {
        year: 2022,
        make: 'GMC',
        model: 'Sierra',
        trim: 'SLE',
        description: 'Premium features, strong build quality, and excellent resale value.'
      }
    ]);

    console.log('✅ Brand options initialized for:', Array.from(this.brandOptionsByType.keys()));
  }

  /**
   * Get brand options for a specific vehicle type
   */
  getBrandOptionsByType(vehicleType) {
    const normalizedType = vehicleType?.toLowerCase();
    return this.brandOptionsByType.get(normalizedType) || [];
  }

  /**
   * UNIFIED STRATEGY: Search vehicles using conversationContext as single source of truth
   * This method extracts search criteria from conversationContext and calls the optimized search
   */
  async searchVehiclesFromContext(conversationContext, dealerId = null, limit = null, rejectedVehicleIds = null) {
    console.log('🔍 UNIFIED SEARCH: Using conversationContext as single source of truth');
    
    // Extract search criteria from conversationContext
    const searchCriteria = this.extractSearchCriteriaFromContext(conversationContext);
    
    console.log('🔍 Extracted search criteria from conversationContext:', searchCriteria);
    
    // Call the optimized search with extracted criteria
    return await this.searchVehiclesOptimized(searchCriteria, dealerId, limit, rejectedVehicleIds);
  }
  
  /**
   * Extract search criteria from conversationContext
   * This method consolidates all data sources into a single criteria object
   */
  extractSearchCriteriaFromContext(conversationContext) {
    const criteria = {};
    
    // Extract vehicle information
    if (conversationContext.make) {
      criteria.make = conversationContext.make;
    } else if (conversationContext.Daivesteps?.['Step 3 - Vehicle']?.slots?.['vehicle Selection']?.make) {
      criteria.make = conversationContext.Daivesteps['Step 3 - Vehicle'].slots['vehicle Selection'].make;
    } else if (conversationContext.Daivesteps?.['Step 3 - Vehicle']?.slots?.customerPreferences?.preferred_make?.[0]) {
      criteria.make = conversationContext.Daivesteps['Step 3 - Vehicle'].slots.customerPreferences.preferred_make[0];
    }
    if (conversationContext.makes && Array.isArray(conversationContext.makes)) {
      criteria.makes = conversationContext.makes;
    }
    if (conversationContext.model) {
      criteria.model = conversationContext.model;
    } else if (conversationContext.Daivesteps?.['Step 3 - Vehicle']?.slots?.['vehicle Selection']?.model) {
      criteria.model = conversationContext.Daivesteps['Step 3 - Vehicle'].slots['vehicle Selection'].model;
    } else if (conversationContext.Daivesteps?.['Step 3 - Vehicle']?.slots?.customerPreferences?.preferred_models?.[0]) {
      criteria.model = conversationContext.Daivesteps['Step 3 - Vehicle'].slots.customerPreferences.preferred_models[0];
    }
    if (conversationContext.models && Array.isArray(conversationContext.models)) {
      criteria.models = conversationContext.models;
    }
    if (conversationContext.vehicle_type || conversationContext.vehicleType) {
      criteria.vehicleType = conversationContext.vehicle_type || conversationContext.vehicleType;
    } else if (conversationContext.Daivesteps?.['Step 3 - Vehicle']?.slots?.['vehicle Selection']?.type) {
      criteria.vehicleType = conversationContext.Daivesteps['Step 3 - Vehicle'].slots['vehicle Selection'].type;
    } else if (conversationContext.Daivesteps?.['Step 3 - Vehicle']?.slots?.customerPreferences?.preferred_type?.[0]) {
      criteria.vehicleType = conversationContext.Daivesteps['Step 3 - Vehicle'].slots.customerPreferences.preferred_type[0];
    }
    
    // Extract budget information
    if (conversationContext.budget?.target_price || conversationContext.budget?.max_price) {
      criteria.budget = conversationContext.budget.target_price || conversationContext.budget.max_price;
    } else if (conversationContext.Daivesteps?.['Step 2 - Lead Capture']?.budget?.target_price || 
               conversationContext.Daivesteps?.['Step 2 - Lead Capture']?.budget?.max_price) {
      criteria.budget = conversationContext.Daivesteps['Step 2 - Lead Capture'].budget.target_price || 
                       conversationContext.Daivesteps['Step 2 - Lead Capture'].budget.max_price;
    } else if (conversationContext.preferences?.budgetAmount) {
      criteria.budget = conversationContext.preferences.budgetAmount;
    }
    
    // Extract color information
    if (conversationContext.vehicle?.color_tone || conversationContext.color_tone) {
      criteria.color = conversationContext.vehicle?.color_tone || conversationContext.color_tone;
    } else if (conversationContext.Daivesteps?.['Step 3 - Vehicle']?.slots?.['vehicle Selection']?.color_tone) {
      criteria.color = conversationContext.Daivesteps['Step 3 - Vehicle'].slots['vehicle Selection'].color_tone;
    } else if (conversationContext.Daivesteps?.['Step 3 - Vehicle']?.slots?.customerPreferences?.preferred_color_tone?.[0]) {
      criteria.color = conversationContext.Daivesteps['Step 3 - Vehicle'].slots.customerPreferences.preferred_color_tone[0];
    }
    
    // Extract condition information
    if (conversationContext.vehicle?.condition || conversationContext.vehicle_condition) {
      criteria.condition = conversationContext.vehicle?.condition || conversationContext.vehicle_condition;
    } else if (conversationContext.Daivesteps?.['Step 3 - Vehicle']?.slots?.['vehicle Selection']?.condition) {
      criteria.condition = conversationContext.Daivesteps['Step 3 - Vehicle'].slots['vehicle Selection'].condition;
    } else if (conversationContext.Daivesteps?.['Step 3 - Vehicle']?.slots?.customerPreferences?.preferred_condition?.[0]) {
      criteria.condition = conversationContext.Daivesteps['Step 3 - Vehicle'].slots.customerPreferences.preferred_condition[0];
    }
    
    // Extract features from multiple sources (new and old structure)
    let features = [];
    
    // 1. Direct features in conversationContext
    if (conversationContext.features && Array.isArray(conversationContext.features)) {
      features.push(...conversationContext.features);
    }
    
    // 2. New Daivesteps structure (numeric keys)
    const step1 = conversationContext.Daivesteps?.[1] || {};
    const step3 = conversationContext.Daivesteps?.[3] || {};
    
    if (step1.features && Array.isArray(step1.features)) {
      features.push(...step1.features);
    }
    if (step1.slots?.features && Array.isArray(step1.slots.features)) {
      features.push(...step1.slots.features);
    }
    if (step3.slots?.features && Array.isArray(step3.slots.features)) {
      features.push(...step3.slots.features);
    }
    if (step3.slots?.VehicleSelection?.features && Array.isArray(step3.slots.VehicleSelection.features)) {
      features.push(...step3.slots.VehicleSelection.features);
    }
    if (step3.slots?.customerPreferences?.preferred_features && Array.isArray(step3.slots.customerPreferences.preferred_features)) {
      features.push(...step3.slots.customerPreferences.preferred_features);
    }
    
    // 3. Old Daivesteps structure (string keys) - for backward compatibility
    if (conversationContext.Daivesteps?.['Step 3 - Vehicle']?.slots?.['vehicle Selection']?.features && 
        Array.isArray(conversationContext.Daivesteps['Step 3 - Vehicle'].slots['vehicle Selection'].features)) {
      features.push(...conversationContext.Daivesteps['Step 3 - Vehicle'].slots['vehicle Selection'].features);
    }
    if (conversationContext.Daivesteps?.['Step 3 - Vehicle']?.slots?.customerPreferences?.preferred_features && 
        Array.isArray(conversationContext.Daivesteps['Step 3 - Vehicle'].slots.customerPreferences.preferred_features)) {
      features.push(...conversationContext.Daivesteps['Step 3 - Vehicle'].slots.customerPreferences.preferred_features);
    }
    
    // 4. Preferences object
    if (conversationContext.preferences?.features && Array.isArray(conversationContext.preferences.features)) {
      features.push(...conversationContext.preferences.features);
    }
    
    // 5. ✅ CRITICAL: Convert seating requirements to features
    const seating = step3.slots?.customerPreferences?.requirements?.seating || 
                    conversationContext.Daivesteps?.['Step 3 - Vehicle']?.slots?.customerPreferences?.requirements?.seating ||
                    conversationContext.preferences?.seatingCapacity ||
                    null;
    
    if (seating) {
      if (seating === 7 || seating >= 7) {
        if (!features.some(f => f && (f.includes('7-seater') || f.includes('7 seat') || f.includes('third row')))) {
          features.push('7-seater');
          console.log('✅ Converted seating requirement (7) to 7-seater feature');
        }
      } else if (seating === 5 || seating <= 5) {
        if (!features.some(f => f && (f.includes('5-seater') || f.includes('5 seat')))) {
          features.push('5-seater');
          console.log('✅ Converted seating requirement (5) to 5-seater feature');
        }
      }
    }
    
    // Normalize and deduplicate features
    const normalizedFeatures = features
      .map(f => {
        if (typeof f !== 'string') return null;
        let normalized = f.toLowerCase().trim();
        // Normalize seating capacity
        if (normalized === '7-seater' || normalized === '7 seats' || normalized === 'seven seats' || normalized.includes('7 seat')) return '7-seater';
        if (normalized === '5-seater' || normalized === '5 seats' || normalized === 'five seats' || normalized.includes('5 seat')) return '5-seater';
        if (normalized.includes('third row') || normalized.includes('3rd row')) return '7-seater';
        return normalized;
      })
      .filter(f => f && f.length > 0);
    
    const uniqueFeatures = [...new Set(normalizedFeatures)];
    
    if (uniqueFeatures.length > 0) {
      criteria.features = uniqueFeatures;
      console.log('✅ Extracted features from context:', uniqueFeatures);
    }
    
    // Extract year information
    if (conversationContext.minYear) {
      criteria.minYear = conversationContext.minYear;
    }
    if (conversationContext.maxYear) {
      criteria.maxYear = conversationContext.maxYear;
    }
    
    // Extract mileage information
    if (conversationContext.maxMileage) {
      criteria.maxMileage = conversationContext.maxMileage;
    }
    if (conversationContext.minMileage) {
      criteria.minMileage = conversationContext.minMileage;
    }
    
    console.log('🔍 Final extracted criteria:', criteria);
    return criteria;
  }

  /**
   * PERFORMANCE OPTIMIZATION: Build search indexes for fast lookups
   */
  buildSearchIndexes() {
    console.log('🔧 Building search indexes for performance optimization...');
    const startTime = performance.now();
    
    // Clear existing indexes
    Object.values(this.searchIndexes).forEach(index => index.clear());
    this.featureIndex.clear();
    this.colorIndex.clear();
    
    let indexedCount = 0;
    
    for (const [vehicleId, vehicle] of this.inventory) {
      if (!vehicle.inStock) continue;
      
      // Index by make
      if (vehicle.make) {
        const make = vehicle.make.toLowerCase();
        if (!this.searchIndexes.byMake.has(make)) {
          this.searchIndexes.byMake.set(make, new Set());
        }
        this.searchIndexes.byMake.get(make).add(vehicleId);
      }
      
      // Index by model
      if (vehicle.model) {
        const model = vehicle.model.toLowerCase();
        if (!this.searchIndexes.byModel.has(model)) {
          this.searchIndexes.byModel.set(model, new Set());
        }
        this.searchIndexes.byModel.get(model).add(vehicleId);
      }
      
      // Index by type
      if (vehicle.type) {
        const type = vehicle.type.toLowerCase();
        if (!this.searchIndexes.byType.has(type)) {
          this.searchIndexes.byType.set(type, new Set());
        }
        this.searchIndexes.byType.get(type).add(vehicleId);
      }
      
      // Index by price range (10k increments)
      if (vehicle.price) {
        const priceRange = Math.floor(vehicle.price / 10000) * 10000;
        if (!this.searchIndexes.byPriceRange.has(priceRange)) {
          this.searchIndexes.byPriceRange.set(priceRange, new Set());
        }
        this.searchIndexes.byPriceRange.get(priceRange).add(vehicleId);
      }
      
      // Index by year
      if (vehicle.year) {
        if (!this.searchIndexes.byYear.has(vehicle.year)) {
          this.searchIndexes.byYear.set(vehicle.year, new Set());
        }
        this.searchIndexes.byYear.get(vehicle.year).add(vehicleId);
      }
      
      // Index by dealer
      if (vehicle.dealerId) {
        if (!this.searchIndexes.byDealer.has(vehicle.dealerId)) {
          this.searchIndexes.byDealer.set(vehicle.dealerId, new Set());
        }
        this.searchIndexes.byDealer.get(vehicle.dealerId).add(vehicleId);
      }
      
      // Index by features
      const features = this.extractVehicleFeatures(vehicle);
      features.forEach(feature => {
        if (!this.featureIndex.has(feature)) {
          this.featureIndex.set(feature, new Set());
        }
        this.featureIndex.get(feature).add(vehicleId);
      });
      
      // Index by color category using optimized color categorization
      const colorCategory = this.categorizeColorOptimized(vehicle.color || vehicle.colors?.[0]) || 'light';
      if (colorCategory) {
        if (!this.colorIndex.has(colorCategory)) {
          this.colorIndex.set(colorCategory, new Set());
        }
        this.colorIndex.get(colorCategory).add(vehicleId);
      }
      
      indexedCount++;
    }
    
    const buildTime = performance.now() - startTime;
    console.log(`✅ Search indexes built in ${buildTime.toFixed(2)}ms for ${indexedCount} vehicles`);
    console.log('📊 Index sizes:', {
      makes: this.searchIndexes.byMake.size,
      models: this.searchIndexes.byModel.size,
      types: this.searchIndexes.byType.size,
      priceRanges: this.searchIndexes.byPriceRange.size,
      years: this.searchIndexes.byYear.size,
      dealers: this.searchIndexes.byDealer.size,
      features: this.featureIndex.size,
      colors: this.colorIndex.size
    });
  }

  /**
   * PERFORMANCE OPTIMIZATION: Generate cache key for search criteria
   */
  generateSearchCacheKey(criteria, dealerId) {
    const normalized = {
      make: criteria.make?.toLowerCase(),
      model: criteria.model?.toLowerCase(),
      vehicleType: criteria.vehicleType?.toLowerCase(),
      budget: criteria.budget,
      minYear: criteria.minYear,
      features: criteria.features?.sort(),
      color: criteria.color?.toLowerCase(),
      dealerId: dealerId,
      limit: criteria.limit
    };
    return JSON.stringify(normalized);
  }

  /**
   * PERFORMANCE OPTIMIZATION: Check if search result is cached
   */
  getCachedSearchResult(criteria, dealerId) {
    const cacheKey = this.generateSearchCacheKey(criteria, dealerId);
    return this.getCachedSearchResultByKey(cacheKey);
  }
  
  /**
   * Get cached search result by key
   */
  getCachedSearchResultByKey(cacheKey) {
    const cached = this.searchCache.get(cacheKey);
    
    if (cached) {
      const now = Date.now();
      const age = now - cached.timestamp;
      
      if (age < this.cacheTTL) {
        console.log(`🚀 Cache hit for search criteria (age: ${Math.round(age / 1000)}s)`);
        return cached.results;
      } else {
        console.log(`⏰ Cache expired for search criteria (age: ${Math.round(age / 1000)}s)`);
        this.searchCache.delete(cacheKey);
      }
    }
    
    return null;
  }
  
  /**
   * Generate cache key including rejected vehicles
   */
  getSearchCacheKey(searchCriteria, dealerId, rejectedVehicleIds = null) {
    const baseKey = this.generateSearchCacheKey(searchCriteria, dealerId);
    if (rejectedVehicleIds && rejectedVehicleIds.size > 0) {
      const rejectedIds = Array.from(rejectedVehicleIds).sort().join(',');
      return `${baseKey}_rejected:${rejectedIds}`;
    }
    return baseKey;
  }

  /**
   * PERFORMANCE OPTIMIZATION: Cache search result
   */
  cacheSearchResult(criteria, dealerId, results, rejectedVehicleIds = null) {
    const cacheKey = this.getSearchCacheKey(criteria, dealerId, rejectedVehicleIds);
    this.searchCache.set(cacheKey, {
      results: results,
      timestamp: Date.now(),
      ttl: this.cacheTTL
    });
    
    // Clean up expired cache entries periodically
    if (this.searchCache.size > 100) {
      this.cleanupExpiredCache();
    }
  }

  /**
   * PERFORMANCE OPTIMIZATION: Clean up expired cache entries
   */
  cleanupExpiredCache() {
    const now = Date.now();
    for (const [key, cached] of this.searchCache) {
      if (now - cached.timestamp > this.cacheTTL) {
        this.searchCache.delete(key);
      }
    }
  }

  /**
   * Get cached makes and models for smart slot questions
   */
  async getCachedMakesAndModels(dealerId, customerType = null, forceRefresh = false) {
    const now = new Date();
    const cacheKey = dealerId || 'default';
    const cached = this.dealerCache.get(cacheKey);
    
    // Check if cache is valid (less than 24 hours old) and not forcing refresh
    if (!forceRefresh && cached && cached.lastCacheUpdate) {
      const cacheAge = now - new Date(cached.lastCacheUpdate);
      const hours24 = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      if (cacheAge < hours24) {
        console.log(`📋 Using cached makes/models for dealer ${dealerId} (age: ${Math.round(cacheAge / (60 * 60 * 1000))} hours)`);
        return cached;
      }
    }
    
    // Cache is stale, doesn't exist, or force refresh requested
    console.log(`🔄 Refreshing makes/models cache for dealer ${dealerId}${forceRefresh ? ' (forced refresh)' : ''}`);
    return await this.refreshMakesAndModelsCache(dealerId, customerType);
  }

  /**
   * Refresh makes and models cache from database
   */
  async refreshMakesAndModelsCache(dealerId, customerType = null) {
    try {
      // Validate UUID format for dealerId
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(dealerId)) {
        console.warn(`⚠️ Invalid UUID format for dealerId: ${dealerId}, using fallback cache`);
        this.makesAndModelsCache = {
          makes: ['Hyundai', 'Honda', 'Toyota', 'Ford', 'Chevrolet'],
          models: ['Tucson', 'Santa Fe', 'Sonata', 'Elantra', 'Palisade'],
          lastUpdate: new Date()
        };
        return this.makesAndModelsCache;
      }
      
      const { pool } = await import('../database/connection.js');
      const client = await pool.connect();
      
      // Build customer type filtering conditions
      let customerTypeFilter = '';
      const queryParams = [dealerId];
      
      // Only apply customer type filtering for specific customer types that should be filtered
      // Skip filtering for budget_shopper to avoid excluding makes when user asks about them
      if (customerType && customerType !== 'budget_shopper') {
        const customerPreferences = this.getCustomerTypePreferences(customerType);
        if (customerPreferences.makeFilter && customerPreferences.makeFilter.length > 0) {
          const makePlaceholders = customerPreferences.makeFilter.map((_, index) => `$${index + 2}`).join(',');
          customerTypeFilter = ` AND make IN (${makePlaceholders})`;
          queryParams.push(...customerPreferences.makeFilter);
        }
      }
      
      // Define the query — include vehicle_type and body_style so we can build
      // a model→type map used by the NLP to auto-infer type from model name.
      const query = `
        SELECT make, model, vehicle_type, body_style, COUNT(*) as popularity_count
        FROM vehicles 
        WHERE dealer_id = $1 
          AND status = 'available'
          AND price > 0 
          AND price IS NOT NULL
          AND make IS NOT NULL 
          AND model IS NOT NULL
          ${customerTypeFilter}
        GROUP BY make, model, vehicle_type, body_style
        ORDER BY popularity_count DESC, make, model
      `;
      
      // First try with customer type filtering
      let result = await client.query(query, queryParams);
      
      // If no results with customer type filtering, try without it
      if (result.rows.length === 0 && customerTypeFilter) {
        console.log('⚠️ No results with customer type filtering, trying without filter...');
        const fallbackQuery = `
          SELECT make, model, vehicle_type, body_style, COUNT(*) as popularity_count
          FROM vehicles 
          WHERE dealer_id = $1 
            AND status = 'available'
            AND price > 0 
            AND price IS NOT NULL
            AND make IS NOT NULL 
            AND model IS NOT NULL
          GROUP BY make, model, vehicle_type, body_style
          ORDER BY popularity_count DESC, make, model
        `;
        result = await client.query(fallbackQuery, [dealerId]);
        console.log('📊 Fallback query results:', {
          rowCount: result.rows.length,
          sampleRows: result.rows.slice(0, 3)
        });
      }
      
      console.log('🔍 Executing makes/models query with params:', queryParams);
      console.log('📝 Query:', query);
      
      console.log('📊 Query results:', {
        rowCount: result.rows.length,
        sampleRows: result.rows.slice(0, 3),
        totalRows: result.rows.length
      });
      
      client.release();
      
      // Process results with popularity data
      const makeCounts = new Map();
      const modelCountsByMake = new Map();
      // model (lowercase) → mapped vehicle type string (e.g. 'SUV', 'sedan')
      const typeByModelMap = {};
      
      if (result.rows.length === 0) {
        console.log('⚠️ No vehicles found in database for dealer:', dealerId);
        // Return default makes if no data available
        const defaultMakes = ['hyundai', 'honda', 'toyota', 'kia', 'mazda', 'nissan', 'ford', 'chevrolet'];
        const defaultModelsByMake = {
          'hyundai': ['tucson', 'santa fe', 'elantra', 'sonata', 'kona'],
          'honda': ['cr-v', 'pilot', 'accord', 'civic', 'hr-v'],
          'toyota': ['rav4', 'highlander', 'camry', 'corolla', 'prius']
        };
        
        const cacheData = {
          makes: defaultMakes,
          modelsByMake: defaultModelsByMake,
          typeByModel: {},
          lastCacheUpdate: new Date().toISOString()
        };
        
        this.dealerCache.set(dealerId || 'default', cacheData);
        console.log('✅ Using default makes/models due to no database data');
        return cacheData;
      }
      
      result.rows.forEach(row => {
        const make = row.make.toLowerCase();
        const model = row.model.toLowerCase();
        const popularityCount = parseInt(row.popularity_count);
        
        // Track make popularity
        makeCounts.set(make, (makeCounts.get(make) || 0) + popularityCount);
        
        // Track model popularity by make
        if (!modelCountsByMake.has(make)) {
          modelCountsByMake.set(make, new Map());
        }
        modelCountsByMake.get(make).set(model, popularityCount);

        // Build model→type map (first seen wins; DB rows are ordered by popularity DESC)
        if (!typeByModelMap[model]) {
          const mappedType = this.mapVehicleType(row.vehicle_type, row.body_style);
          if (mappedType) {
            typeByModelMap[model] = mappedType;
          }
        }
      });
      
      // Convert to arrays sorted by popularity (descending)
      const makesArray = Array.from(makeCounts.entries())
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .map(([make, count]) => make);
      
      const modelsByMakeObj = {};
      modelCountsByMake.forEach((modelCounts, make) => {
        modelsByMakeObj[make] = Array.from(modelCounts.entries())
          .sort((a, b) => b[1] - a[1]) // Sort by count descending
          .map(([model, count]) => model);
      });
      
      console.log(`📋 typeByModel built: ${Object.keys(typeByModelMap).length} models mapped`, typeByModelMap);

      const cacheData = {
        makes: makesArray,
        modelsByMake: modelsByMakeObj,
        typeByModel: typeByModelMap,
        lastCacheUpdate: new Date().toISOString()
      };
      
      console.log('📋 Processed cache data:', {
        makesCount: makesArray.length,
        topMakes: makesArray.slice(0, 5),
        modelsByMakeSample: Object.keys(modelsByMakeObj).slice(0, 3).reduce((acc, make) => {
          acc[make] = modelsByMakeObj[make].slice(0, 3);
          return acc;
        }, {}),
        customerType: customerType
      });
      
      this.dealerCache.set(dealerId || 'default', cacheData);
      console.log(`✅ Cached ${makesArray.length} makes and models for dealer ${dealerId}`);
      
      return cacheData;
    } catch (error) {
      console.error('❌ Error refreshing makes/models cache:', error);
      return { makes: [], modelsByMake: {}, lastCacheUpdate: new Date().toISOString() };
    }
  }

  /**
   * Get customer type preferences for filtering makes and models
   */
  getCustomerTypePreferences(customerType) {
    const preferences = {
      // Default preferences
      makeFilter: [],
      priceRange: null,
      vehicleTypes: []
    };

    switch (customerType) {
      case 'first_time_buyer':
        preferences.makeFilter = ['hyundai', 'honda', 'toyota', 'kia', 'mazda'];
        preferences.priceRange = { min: 15000, max: 35000 };
        preferences.vehicleTypes = ['sedan', 'suv'];
        break;
      case 'luxury_buyer':
        preferences.makeFilter = ['bmw', 'mercedes-benz', 'audi', 'lexus', 'acura', 'infiniti'];
        preferences.priceRange = { min: 40000, max: 100000 };
        preferences.vehicleTypes = ['sedan', 'suv', 'coupe'];
        break;
      case 'budget_shopper':
        preferences.makeFilter = ['hyundai', 'kia', 'nissan', 'mitsubishi', 'suzuki'];
        preferences.priceRange = { min: 10000, max: 25000 };
        preferences.vehicleTypes = ['sedan', 'hatchback', 'suv'];
        break;
      case 'family_buyer':
        preferences.makeFilter = ['honda', 'toyota', 'hyundai', 'kia', 'mazda', 'subaru'];
        preferences.priceRange = { min: 20000, max: 50000 };
        preferences.vehicleTypes = ['suv', 'minivan', 'sedan'];
        break;
      case 'business_fleet':
        preferences.makeFilter = ['ford', 'chevrolet', 'gmc', 'ram', 'nissan'];
        preferences.priceRange = { min: 25000, max: 60000 };
        preferences.vehicleTypes = ['truck', 'van', 'suv'];
        break;
      case 'college_student':
        preferences.makeFilter = ['hyundai', 'kia', 'honda', 'toyota', 'nissan'];
        preferences.priceRange = { min: 8000, max: 20000 };
        preferences.vehicleTypes = ['sedan', 'hatchback'];
        break;
      default:
        // No filtering for unknown customer types
        break;
    }

    return preferences;
  }

  /**
   * Initialize inventory service with real database data
   */
  async initialize(dealerId = null) {
    // PERFORMANCE: Check if already initialized for this dealer (with 5-minute TTL)
    const cacheKey = dealerId || 'global';
    const now = Date.now();
    const cacheExpiry = 5 * 60 * 1000; // 5 minutes
    
    if (this._initCache && this._initCache[cacheKey]) {
      const cacheAge = now - this._initCache[cacheKey].timestamp;
      if (cacheAge < cacheExpiry && this.inventory && this.inventory.size > 0) {
        console.log(`⚡ Using cached inventory for dealer: ${dealerId || 'global'} (age: ${Math.round(cacheAge/1000)}s)`);
        return;
      }
    }
    
    console.log('🗄️ Initializing Inventory Service...');
    
    try {
      // Validate UUID format for dealerId if provided
      if (dealerId) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(dealerId)) {
          console.warn(`⚠️ Invalid UUID format for dealerId: ${dealerId}, using fallback mode`);
          this.inventory = new Map();
          this.lastUpdate = new Date();
          console.log('🔄 Inventory Service initialized in fallback mode (invalid dealerId)');
          return;
        }
      }
      
      // Check if database connection is available
      let pool, client;
      try {
        const dbModule = await import('../database/connection.js');
        pool = dbModule.pool;
        
        if (!pool) {
          throw new Error('Database pool not available');
        }
        
        client = await pool.connect();
        console.log('✅ Database connection established');
      } catch (dbError) {
        console.warn('⚠️ Database connection failed, using fallback mode:', dbError.message);
        this.inventory = new Map();
        this.lastUpdate = new Date();
        console.log('🔄 Inventory Service initialized in fallback mode (no database)');
        return;
      }
      
      // Use correct column names from your actual database
      const query = `
       SELECT 
    v.id, v.make, v.model, v.trim, v.year, v.price, v.msrp, 
    v.status, v.dealer_id, v.features, v.color, v.body_style,
    v.vehicle_type, v.stock_number, v.mileage, v.odometer, v.new_used,
    v.photo_url_list,
    cr.accident_count,
    cr.service_records,
    cr.owners,
    cr.title_issues,
    cr.structural_damage,
    cr.flood_damage,
    cr.previous_rental,
    cr.previous_fleet,
    cr.previous_lease,
    cr.certified_pre_owned,
    cr.summary as carfax_summary
FROM vehicles v
LEFT JOIN LATERAL (
    SELECT * FROM carfax_reports 
    WHERE vehicle_id = v.id 
    ORDER BY uploaded_at DESC 
    LIMIT 1
) cr ON true
WHERE v.dealer_id = $1 
  AND v.status = 'available'
  AND v.price > 0 
  AND v.price IS NOT NULL
ORDER BY v.year ASC, v.price DESC
      `;
      
      // CRITICAL FIX: Handle dealer ID properly
      let targetDealerId = dealerId;
      
      if (!targetDealerId) {
        // Try to get the dealer with the most vehicles from the database
        try {
          const dealerQuery = `
            SELECT d.id, COUNT(v.id) as vehicle_count
            FROM dealers d
            LEFT JOIN vehicles v ON d.id = v.dealer_id 
              AND v.status = 'available'
              AND v.price > 0 
              AND v.price IS NOT NULL
            WHERE d.subscription_status = 'active'
            GROUP BY d.id
            ORDER BY vehicle_count DESC
            LIMIT 1
          `;
          const dealerResult = await client.query(dealerQuery);
          if (dealerResult.rows.length > 0) {
            targetDealerId = dealerResult.rows[0].id;
            const vehicleCount = dealerResult.rows[0].vehicle_count;
            console.log(`🔍 Found dealer with most vehicles: ${targetDealerId} (${vehicleCount} vehicles)`);
          } else {
            // Last resort: use the hardcoded fallback
            targetDealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
            console.log('⚠️ No active dealers found, using fallback dealer ID:', targetDealerId);
          }
        } catch (error) {
          console.error('❌ Failed to get dealer ID from database:', error);
          targetDealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
          console.log('⚠️ Using fallback dealer ID due to error:', targetDealerId);
        }
      } else {
        console.log(`🏢 Using provided dealer ID: ${targetDealerId}`);
      }
      
      console.log('🏢 Loading inventory for dealer:', targetDealerId);
      const result = await client.query(query, [targetDealerId]);
      
      // Load real inventory from database
      for (const vehicle of result.rows) {
        // Transform database data to match expected format
        const transformedVehicle = {
          id: vehicle.id,
          name: `${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}`,
          make: vehicle.make,
          model: vehicle.model,
          trim: vehicle.trim || vehicle.vehicle_type,
          // Map your database categories to standard types
          type: this.mapVehicleType(vehicle.vehicle_type, vehicle.body_style),
          year: vehicle.year,
          price: parseFloat(vehicle.price) || 0,
          msrp: parseFloat(vehicle.msrp) || parseFloat(vehicle.price) || 0,
          inStock: vehicle.status === 'available',
          quantity: 1, // Default to 1 since your DB doesn't have quantity
          dealerId: vehicle.dealer_id,
          features: vehicle.features || [], // Will be cleaned by ensureCleanFeatures
          colors: vehicle.color ? [vehicle.color] : ['Not specified'],
          stock_number: vehicle.stock_number || null, // Add stock_number field
          location: vehicle.stock_number ? `Stock #${vehicle.stock_number}` : 'Main Lot',
          mileage: vehicle.mileage || vehicle.odometer || 0,
          condition: vehicle.new_used, // Map new_used field to condition
          // Add CARFAX fields that customers commonly ask about
          accident_count: vehicle.accident_count,
          service_records: vehicle.service_records,
          owners: vehicle.owners,
          title_issues: vehicle.title_issues,
          structural_damage: vehicle.structural_damage,
          flood_damage: vehicle.flood_damage,
          previous_rental: vehicle.previous_rental,
          previous_fleet: vehicle.previous_fleet,
          previous_lease: vehicle.previous_lease,
          certified_pre_owned: vehicle.certified_pre_owned,
          carfax_summary: vehicle.carfax_summary,
          photo_url_list: vehicle.photo_url_list || null
        };

        // ✅ CLEAN FEATURES: Ensure features are always a simple array
        this.ensureCleanFeatures(transformedVehicle);
        
        // Debug logging for Toyota RAV4s
        // if (vehicle.make.toLowerCase() === 'toyota' && vehicle.model.toLowerCase() === 'rav4') {
        //   console.log(`🚗 Toyota RAV4 found: Type mapped to "${transformedVehicle.type}" from DB: "${vehicle.vehicle_type || vehicle.body_style}"`);
        //   console.log(`   Status: "${vehicle.status}" -> inStock: ${transformedVehicle.inStock}`);
        //   console.log(`   Price: "${vehicle.price}" -> parsed: ${transformedVehicle.price}`);
        // }
        
        this.inventory.set(vehicle.id, transformedVehicle);
      }
      
      client.release();
      console.log(`✅ Inventory Service initialized with ${this.inventory.size} real vehicles from database`);
      
      // Generate conversation starters based on loaded inventory
      this.generateConversationStarters();
      
      // PERFORMANCE OPTIMIZATION: Build search indexes after loading inventory
      this.buildSearchIndexes();
      
      // Mark as cached for future calls
      if (!this._initCache) this._initCache = {};
      this._initCache[cacheKey] = { timestamp: now };
      
    } catch (error) {
      console.error('❌ Failed to load real inventory:', error);
      // Policy: never use sample inventory
    }
  }

  /**
   * Generate conversation starters based on loaded inventory
   * Helps AI proactively offer filters and options to clients
   */
  generateConversationStarters() {
    try {
      const vehicles = Array.from(this.inventory.values());
      
      // Budget ranges
      const prices = vehicles.map(v => v.price).filter(p => p > 0).sort((a, b) => a - b);
      const budgetRanges = {
        under25k: prices.filter(p => p < 25000).length,
        '25k-35k': prices.filter(p => p >= 25000 && p < 35000).length,
        '35k-50k': prices.filter(p => p >= 35000 && p < 50000).length,
        over50k: prices.filter(p => p >= 50000).length
      };

      // Vehicle types
      const typeCounts = {};
      vehicles.forEach(v => {
        typeCounts[v.type] = (typeCounts[v.type] || 0) + 1;
      });

      // Popular features
      const featureCounts = {};
      vehicles.forEach(v => {
        if (v.features && Array.isArray(v.features)) {
          v.features.forEach(feature => {
            featureCounts[feature] = (featureCounts[feature] || 0) + 1;
          });
        }
      });

      // Popular makes
      const makeCounts = {};
      vehicles.forEach(v => {
        makeCounts[v.make] = (makeCounts[v.make] || 0) + 1;
      });

      // Store conversation starters
      this.conversationStarters = {
        budgetRanges,
        typeCounts,
        featureCounts,
        makeCounts,
        totalVehicles: vehicles.length,
        priceRange: {
          min: Math.min(...prices),
          max: Math.max(...prices),
          average: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
        }
      };

      console.log('🎯 Conversation starters generated:', {
        totalVehicles: this.conversationStarters.totalVehicles,
        priceRange: `${this.conversationStarters.priceRange.min.toLocaleString()}-${this.conversationStarters.priceRange.max.toLocaleString()}`,
        topTypes: Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3),
        topMakes: Object.entries(makeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
      });

    } catch (error) {
      console.error('❌ Error generating conversation starters:', error);
    }
  }

  /**
   * Get proactive conversation starter based on inventory
   */
  // getConversationStarter() {
  //   if (!this.conversationStarters) {
  //     return null;
  //   }

  //   const { budgetRanges, typeCounts, makeCounts, priceRange } = this.conversationStarters;
    
  //   // Find most popular options
  //   const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  //   const topMakes = Object.entries(makeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    
  //   return {
  //     message: `Welcome! I can help you find the perfect vehicle. We have ${this.conversationStarters.totalVehicles} vehicles available.`,
  //     filters: {
  //       budget: [
  //         { range: 'Under $25,000', count: budgetRanges.under25k, description: 'Great value options' },
  //         { range: '$25,000 - $35,000', count: budgetRanges['25k-35k'], description: 'Popular mid-range' },
  //         { range: '$35,000 - $50,000', count: budgetRanges['35k-50k'], description: 'Premium selection' },
  //         { range: 'Over $50,000', count: budgetRanges.over50k, description: 'Luxury vehicles' }
  //       ],
  //       types: topTypes.map(([type, count]) => ({
  //         type,
  //         count,
  //         description: `${count} ${type}s available`
  //       })),
  //       makes: topMakes.map(([make, count]) => ({
  //         make,
  //         count,
  //         description: `${count} ${make} vehicles`
  //       }))
  //     },
  //     suggestions: [
  //       'What\'s your budget range?',
  //       'What type of vehicle are you looking for?',
  //       'Do you have a preferred make or model?',
  //       'Any specific features you need?'
  //     ]
  //   };
  // }

  /**
   * Get filtered vehicles based on multiple criteria
   */
  getVehiclesByMultipleFilters(filters) {
    try {
      const { budget, type, make, model, features, year } = filters;
      let vehicles = Array.from(this.inventory.values());

      // Apply filters
      if (budget) {
        vehicles = vehicles.filter(v => v.price <= budget);
      }
      
      if (type) {
        vehicles = vehicles.filter(v => v.type.toLowerCase() === type.toLowerCase());
      }
      
      if (make) {
        vehicles = vehicles.filter(v => v.make.toLowerCase() === make.toLowerCase());
      }
      
      if (model) {
        vehicles = vehicles.filter(v => v.model.toLowerCase().includes(model.toLowerCase()));
      }
      
      if (features && features.length > 0) {
        vehicles = vehicles.filter(v => 
          v.features && features.some(f => 
            v.features.some(vf => vf.toLowerCase().includes(f.toLowerCase()))
          )
        );
      }
      
      if (year) {
        vehicles = vehicles.filter(v => v.year >= year);
      }

      // Only include in-stock vehicles
      vehicles = vehicles.filter(v => v.inStock);
      
      // Sort by price (lowest first)
      vehicles.sort((a, b) => a.price - b.price);
      
      return vehicles;

    } catch (error) {
      console.error('❌ Error filtering vehicles:', error);
      return [];
    }
  }

  /**
   * Get proactive conversation suggestions based on user input
   */
  // getConversationSuggestions(userInput) {
  //   try {
  //     const input = userInput.toLowerCase();
  //     const suggestions = [];

  //     // Check if user mentioned budget
  //     if (input.includes('budget') || input.includes('price') || input.includes('cost')) {
  //       suggestions.push({
  //         type: 'budget',
  //         message: 'What\'s your budget range?',
  //         options: this.conversationStarters.budgetRanges
  //       });
  //     }

  //     // Check if user mentioned vehicle type
  //     if (input.includes('suv') || input.includes('sedan') || input.includes('truck') || 
  //         input.includes('car') || input.includes('vehicle')) {
  //       suggestions.push({
  //         type: 'vehicle_type',
  //         message: 'What type of vehicle are you looking for?',
  //         options: this.conversationStarters.typeCounts
  //       });
  //     }

  //     // Check if user mentioned specific make
  //     const makes = Object.keys(this.conversationStarters.makeCounts);
  //     const mentionedMake = makes.find(make => input.includes(make.toLowerCase()));
  //     if (mentionedMake) {
  //       suggestions.push({
  //         type: 'make_specific',
  //         message: `Great choice! We have ${this.conversationStarters.makeCounts[mentionedMake]} ${mentionedMake} vehicles.`,
  //         options: this.getVehiclesByMakeModel(mentionedMake, '', 100000, null, 5)
  //       });
  //     }

  //     // Check if user mentioned features
  //     const features = Object.keys(this.conversationStarters.featureCounts);
  //     const mentionedFeatures = features.filter(feature => input.includes(feature.toLowerCase()));
  //     if (mentionedFeatures.length > 0) {
  //       suggestions.push({
  //         type: 'features',
  //         message: `You mentioned ${mentionedFeatures.join(', ')}. Let me show you vehicles with these features.`,
  //         options: this.getVehiclesByMultipleFilters({ features: mentionedFeatures })
  //       });
  //     }

  //     // If no specific suggestions, offer general help
  //     if (suggestions.length === 0) {
  //       suggestions.push({
  //         type: 'general',
  //         message: 'I can help you find the perfect vehicle. What are you looking for?',
  //         options: {
  //           budget: this.conversationStarters.budgetRanges,
  //           types: this.conversationStarters.typeCounts,
  //           makes: this.conversationStarters.makeCounts
  //         }
  //       });
  //     }

  //     return suggestions;

  //   } catch (error) {
  //     console.error('❌ Error generating conversation suggestions:', error);
  //     return [];
  //   }
  // }

  /**
   * Get inventory summary for proactive suggestions
   */
  // getInventorySummary() {
  //   if (!this.conversationStarters) {
  //     return null;
  //   }

  //   const { budgetRanges, typeCounts, makeCounts, priceRange } = this.conversationStarters;
    
  //   return {
  //     total: this.conversationStarters.totalVehicles,
  //     priceRange: `${priceRange.min.toLocaleString()}-${priceRange.max.toLocaleString()}`,
  //     averagePrice: priceRange.average.toLocaleString(),
  //     budgetBreakdown: budgetRanges,
  //     typeBreakdown: typeCounts,
  //     makeBreakdown: makeCounts,
  //     topRecommendations: this.getTopRecommendations()
  //   };
  // }

  /**
   * Get top vehicle recommendations based on inventory
   */
  // getTopRecommendations() {
  //   try {
  //     const vehicles = Array.from(this.inventory.values()).filter(v => v.inStock);
      
  //     // Best value (lowest price, good features)
  //     const bestValue = vehicles
  //       .filter(v => v.price < 30000 && v.features && v.features.length > 2)
  //       .sort((a, b) => a.price - b.price)
  //       .slice(0, 3);

  //     // Popular models (most common)
  //     const popularModels = {};
  //     vehicles.forEach(v => {
  //       const key = `${v.make} ${v.model}`;
  //       popularModels[key] = (popularModels[key] || 0) + 1;
  //     });
      
  //     const topModels = Object.entries(popularModels)
  //       .sort((a, b) => b[1] - a[1])
  //       .slice(0, 3)
  //       .map(([model, count]) => ({
  //         model,
  //         count,
  //         vehicles: vehicles.filter(v => `${v.make} ${v.model}` === model).slice(0, 2)
  //       }));

  //     return {
  //       bestValue,
  //       topModels,
  //       newest: vehicles.sort((a, b) => b.year - a.year).slice(0, 3)
  //     };

  //   } catch (error) {
  //     console.error('❌ Error getting top recommendations:', error);
  //     return null;
  //   }
  // }

  /**
   * Map database vehicle types to standard categories
   */
  mapVehicleType(vehicleType, bodyStyle) {
    const type = (vehicleType || bodyStyle || '').toLowerCase();
    
    // Map your specific database categories
    if (type.includes('sport utility') || type.includes('suv')) return 'SUV';
    if (type.includes('sedan')) return 'sedan';
    if (type.includes('coupe')) return 'coupe';
    if (type.includes('hatchback')) return 'hatchback';
    if (type.includes('convertible')) return 'convertible';
    if (type.includes('truck')) return 'truck'; // ✅ FIX: Add direct truck mapping
    if (type.includes('crew cab') || type.includes('supercrew')) return 'truck';
    if (type.includes('standard cab')) return 'truck';
    if (type.includes('passenger van')) return 'van';
    
    // Default mapping
    return 'sedan';
  }

  /**
   * Fallback to sample inventory data if database fails
   */
  loadSampleInventory() { /* disabled by policy */ }

  /**
   * Check if a specific vehicle is in stock
   */
  async checkVehicleAvailability(vehicleQuery, dealerId = null) {
    try {
      const query = vehicleQuery.toLowerCase();
      let matches = [];

      // Search through inventory
      for (const [key, vehicle] of this.inventory) {
        const searchText = `${vehicle.make} ${vehicle.model} ${vehicle.trim}`.toLowerCase();
        if (searchText.includes(query)) {
          matches.push(vehicle);
        }
      }

      if (matches.length === 0) {
        return {
          found: false,
          message: `No vehicles found matching "${vehicleQuery}"`,
          alternatives: this.findAlternatives(query, dealerId)
        };
      }

      // Check availability
      const available = matches.filter(v => v.inStock);
      const unavailable = matches.filter(v => !v.inStock);

      return {
        found: true,
        exactMatches: matches,
        available: available,
        unavailable: unavailable,
        alternatives: this.findAlternatives(query, dealerId, matches[0].type)
      };

    } catch (error) {
      console.error('❌ Error checking vehicle availability:', error);
      return {
        found: false,
        error: 'Failed to check inventory',
        alternatives: []
      };
    }
  }

  /**
   * Find alternative vehicles
   */
  findAlternatives(query, dealerId = null, vehicleType = null) {
    try {
      let alternatives = [];
      const queryLower = query.toLowerCase();

      for (const [key, vehicle] of this.inventory) {
        // Skip the exact vehicle being searched
        if (vehicle.name.toLowerCase().includes(queryLower)) {
          continue;
        }

        // Filter by type if specified
        if (vehicleType && vehicle.type !== vehicleType) {
          continue;
        }

        // Filter by dealer if specified
        if (dealerId && vehicle.dealerId !== dealerId) {
          continue;
        }

        // Only include in-stock vehicles
        if (vehicle.inStock) {
          alternatives.push(vehicle);
        }
      }

      // Sort by relevance (similar price, type, features)
      alternatives.sort((a, b) => {
        // Prioritize same type
        if (a.type === vehicleType && b.type !== vehicleType) return -1;
        if (b.type === vehicleType && a.type !== vehicleType) return 1;
        
        // Then by price difference
        return Math.abs(a.price - 30000) - Math.abs(b.price - 30000);
      });

      return alternatives.slice(0, 5); // Return top 5 alternatives

    } catch (error) {
      console.error('❌ Error finding alternatives:', error);
      return [];
    }
  }

  /**
   * Get vehicles by make and model
   */
  async getVehiclesByMakeModel(make, model, budget, dealerId = null, limit = null) {
    try {
      const vehicles = [];
      console.log(`🔍 Searching for ${make} ${model} vehicles under $${budget}...`);
      console.log(`📊 Total inventory size: ${this.inventory.size}`);
      
      for (const [key, vehicle] of this.inventory) {
        // Debug logging for Toyota RAV4 specifically
        if (vehicle.make.toLowerCase() === 'toyota' && vehicle.model.toLowerCase().includes('rav4')) {
          // console.log(`🔍 TOYOTA RAV4 FOUND: Make: "${vehicle.make}" vs "${make}", Model: "${vehicle.model}" vs "${model}", Price: $${vehicle.price}, InStock: ${vehicle.inStock}`);
        }
        
        // Debug logging for first few vehicles
        if (vehicles.length < 3) {
          // console.log(`   Checking: ${vehicle.make} ${vehicle.model} - Make: "${vehicle.make}" vs "${make}", Model: "${vehicle.model}" vs "${model}"`);
        }
        
        // Check make match (case-insensitive)
        // Handle case where make is an array
        const makeToCheck = Array.isArray(make) ? make[0] : make;
        if (vehicle.make.toLowerCase() !== makeToCheck.toLowerCase()) {
          continue;
        }
        
        // Check model match (case-insensitive, partial match)
        if (!vehicle.model.toLowerCase().includes(model.toLowerCase())) {
          continue;
        }
        
        // Check budget
        if (vehicle.price > budget) {
          if (vehicle.make.toLowerCase() === 'toyota' && vehicle.model.toLowerCase().includes('rav4')) {
            console.log(`   ❌ Budget check failed: ${vehicle.make} ${vehicle.model} - Price: $${vehicle.price} > Budget: $${budget}`);
          }
          continue;
        }
        
        // Check dealer
        if (dealerId && vehicle.dealerId !== dealerId) {
          if (vehicle.make.toLowerCase() === 'toyota' && vehicle.model.toLowerCase().includes('rav4')) {
            console.log(`   ❌ Dealer check failed: ${vehicle.make} ${vehicle.model} - Dealer: ${vehicle.dealerId} vs ${dealerId}`);
          }
          continue;
        }
        
        // Only include in-stock vehicles
        if (vehicle.inStock) {
          if (vehicle.make.toLowerCase() === 'toyota' && vehicle.model.toLowerCase().includes('rav4')) {
            console.log(`   ✅ Adding Toyota RAV4: ${vehicle.make} ${vehicle.model} - Price: $${vehicle.price}, Dealer: ${vehicle.dealerId}`);
          }
          vehicles.push(vehicle);
        } else {
          if (vehicle.make.toLowerCase() === 'toyota' && vehicle.model.toLowerCase().includes('rav4')) {
            console.log(`   ❌ InStock check failed: ${vehicle.make} ${vehicle.model} - InStock: ${vehicle.inStock}`);
          }
        }
      }
      
      // Sort by price (lowest first)
      vehicles.sort((a, b) => a.price - b.price);
      
      // Apply limit
      if (limit && vehicles.length > limit) {
        vehicles.splice(limit);
      }
      
      const makeDisplay = Array.isArray(make) ? make[0] : make;
      console.log(`✅ Found ${vehicles.length} ${makeDisplay} ${model} vehicles under $${budget}`);
      
      // ✅ CLEAN FEATURES: Ensure all returned vehicles have clean features
      vehicles.forEach(vehicle => this.ensureCleanFeatures(vehicle));
      
      return vehicles;
      
    } catch (error) {
      console.error('❌ Error in getVehiclesByMakeModel:', error);
      return [];
    }
  }

  /**
   * ENHANCED: Get vehicles by make and model with budget increase strategy
   * This method keeps make and model criteria but increases budget to show available options
   * ✅ NEW: Also considers vehicle type when provided
   */
  async getVehiclesByMakeModelEnhanced(make, model, budget, dealerId = null, limit = null, vehicleType = null) {
    try {
      console.log(`🔍 ENHANCED SEARCH: ${make} ${model} vehicles under $${budget}${vehicleType ? ` (type: ${vehicleType})` : ''}...`);
      
      // First try exact match with original budget
      let vehicles = await this.getVehiclesByMakeModel(make, model, budget, dealerId, limit);
      
      // ✅ NEW: Apply vehicle type filter if provided
      if (vehicleType && vehicles.length > 0) {
        const originalCount = vehicles.length;
        vehicles = vehicles.filter(vehicle => {
          const typeMatches = vehicle.type.toLowerCase() === vehicleType.toLowerCase();
          if (!typeMatches) {
            console.log(`   ❌ Vehicle type mismatch: ${vehicle.make} ${vehicle.model} - Type: ${vehicle.type} vs Required: ${vehicleType}`);
          }
          return typeMatches;
        });
        
        if (vehicles.length === 0) {
          console.log(`❌ No ${make} ${model} vehicles found with type ${vehicleType} (filtered from ${originalCount} vehicles)`);
          return [];
        } else {
          console.log(`✅ Found ${vehicles.length} ${make} ${model} ${vehicleType} vehicles (filtered from ${originalCount} vehicles)`);
        }
      }
      
      if (vehicles.length > 0) {
        console.log(`✅ Found ${vehicles.length} vehicles with exact match`);
        return vehicles;
      }
      
      console.log(`⚠️ No exact matches found with budget $${budget}, trying budget increase strategy...`);
      
      // Strategy: Keep make and model criteria, but increase budget to show available options
      const budgetIncreaseSteps = [5000, 10000, 15000, 25000]; // Progressive budget increases
      let currentBudget = budget;
      
      for (const increase of budgetIncreaseSteps) {
        currentBudget = budget + increase;
        console.log(`🔍 Trying ${make} ${model} with increased budget: $${currentBudget}`);
        
        vehicles = await this.getVehiclesByMakeModel(make, model, currentBudget, dealerId, limit);
        
        // ✅ NEW: Apply vehicle type filter if provided
        if (vehicleType && vehicles.length > 0) {
          const originalCount = vehicles.length;
          vehicles = vehicles.filter(vehicle => {
            const typeMatches = vehicle.type.toLowerCase() === vehicleType.toLowerCase();
            if (!typeMatches) {
              console.log(`   ❌ Vehicle type mismatch: ${vehicle.make} ${vehicle.model} - Type: ${vehicle.type} vs Required: ${vehicleType}`);
            }
            return typeMatches;
          });
          
          if (vehicles.length === 0) {
            console.log(`❌ No ${make} ${model} vehicles found with type ${vehicleType} (filtered from ${originalCount} vehicles) at budget $${currentBudget}`);
            continue; // Try next budget increase
          } else {
            console.log(`✅ Found ${vehicles.length} ${make} ${model} ${vehicleType} vehicles (filtered from ${originalCount} vehicles) at budget $${currentBudget}`);
          }
        }
        
        if (vehicles.length > 0) {
          console.log(`✅ Found ${vehicles.length} ${make} ${model} vehicles with increased budget $${currentBudget}`);
          
          // Add budget increase info to vehicles for context
          vehicles.forEach(vehicle => {
            vehicle.budgetIncreased = true;
            vehicle.originalBudget = budget;
            vehicle.currentBudget = currentBudget;
            vehicle.budgetIncrease = increase;
          });
          
          // ✅ CLEAN FEATURES: Ensure all returned vehicles have clean features
          vehicles.forEach(vehicle => this.ensureCleanFeatures(vehicle));
          
          return vehicles;
        }
      }
      
      // If still no matches after budget increases, try flexible model matching with highest budget
      console.log(`⚠️ No ${make} ${model} vehicles found even with increased budget, trying flexible model matching...`);
      
      vehicles = [];
      const makeLower = Array.isArray(make) ? make[0].toLowerCase() : make.toLowerCase();
      const modelLower = model ? model.toLowerCase() : null;
      // Space-normalised form — "santafe" and "santa fe" both become "santafe" for comparison
      const modelNorm = modelLower ? modelLower.replace(/\s+/g, '') : null;
      
      for (const [key, vehicle] of this.inventory) {
        // Exact make match (keep this strict)
        if (vehicle.make.toLowerCase() !== makeLower) continue;
        
        // Flexible model matching
        const _vModelLower = vehicle.model.toLowerCase();
        const _vModelNorm  = _vModelLower.replace(/\s+/g, '');
        const modelMatches = !modelLower || // If no model specified, match any
                            _vModelLower === modelLower ||
                            _vModelLower.includes(modelLower) ||
                            modelLower.includes(_vModelLower) ||
                            // Space-normalised comparison — "santafe" matches "santa fe"
                            (_vModelNorm === modelNorm) ||
                            (_vModelNorm.includes(modelNorm) || modelNorm.includes(_vModelNorm));
        
        if (!modelMatches) continue;
        
        // Use highest budget tried
        if (vehicle.price > currentBudget) continue;
        
        // Dealer check
        if (dealerId && vehicle.dealerId !== dealerId) continue;
        
        // Stock check
        if (!vehicle.inStock) continue;
        
        vehicles.push(vehicle);
        console.log(`   ✅ Flexible match: ${vehicle.make} ${vehicle.model} - $${vehicle.price}`);
      }
      
      // Sort and limit
      vehicles.sort((a, b) => a.price - b.price);
      if (limit && vehicles.length > limit) {
        vehicles.splice(limit);
      }
      
      console.log(`✅ Flexible search found ${vehicles.length} vehicles`);
      
      // ✅ CLEAN FEATURES: Ensure all returned vehicles have clean features
      vehicles.forEach(vehicle => this.ensureCleanFeatures(vehicle));
      
      return vehicles;
      
    } catch (error) {
      console.error('❌ Error in enhanced make/model search:', error);
      return [];
    }
  }

  /**
   * Get vehicles by type and budget
   */
  async getVehiclesByTypeAndBudget(vehicleType, budget, dealerId = null, limit = null) {
    try {
      const vehicles = [];
      console.log(`🔍 Searching for ${vehicleType} vehicles under $${budget}...`);
      console.log(`📊 Total inventory size: ${this.inventory.size}`);
      
      for (const [key, vehicle] of this.inventory) {
        // Debug logging for first few vehicles
        if (vehicles.length < 3) {
          // console.log(`   Checking: ${vehicle.make} ${vehicle.model} - Type: ${vehicle.type}, Price: $${vehicle.price}, InStock: ${vehicle.inStock}`);
        }
        
        // Check type match (case-insensitive)
        if (vehicle.type.toLowerCase() !== vehicleType.toLowerCase()) {
          continue;
        }

        // Check budget
        if (vehicle.price > budget) {
          continue;
        }

        // Check dealer
        if (dealerId && vehicle.dealerId !== dealerId) {
          continue;
        }

        // Only include in-stock vehicles
        if (vehicle.inStock) {
          // DEBUG: Check what we're adding
          console.log(`   ✅ Adding: ${vehicle.make} ${vehicle.model} - Price: $${vehicle.price} (${typeof vehicle.price})`);
          vehicles.push(vehicle);
        }
      }

      console.log(`✅ Found ${vehicles.length} matching vehicles`);

      // Sort by price (lowest first)
      vehicles.sort((a, b) => a.price - b.price);

      // OPTIMIZATION: Apply limit for faster responses
      if (limit && vehicles.length > limit) {
        vehicles.splice(limit);
      }
      
      // DEBUG: Show what we're returning
      console.log(`🚗 Returning ${vehicles.length} vehicles after limit:`);
      vehicles.slice(0, 3).forEach((vehicle, index) => {
        console.log(`   ${index + 1}. ${vehicle.make} ${vehicle.model} - Price: $${vehicle.price} (${typeof vehicle.price}), InStock: ${vehicle.inStock} (${typeof vehicle.inStock})`);
      });

      return vehicles;

    } catch (error) {
      console.error('❌ Error getting vehicles by type and budget:', error);
      return [];
    }
  }

  /**
   * NEW: Get vehicles by type, budget, and features (MULTI-CRITERIA SEARCH)
   * This is the method that should be used for comprehensive searches
   */
  async getVehiclesByTypeBudgetAndFeatures(vehicleType, budget, features = [], dealerId = null, limit = null) {
    try {
      const vehicles = [];
      // console.log(`🔍 MULTI-CRITERIA SEARCH: ${vehicleType} vehicles under $${budget} with features: [${features.join(', ')}]`);
      console.log(`📊 Total inventory size: ${this.inventory.size}`);
      
      for (const [key, vehicle] of this.inventory) {
        // Debug logging for first few vehicles
        if (vehicles.length < 3) {
          // console.log(`   Checking: ${vehicle.make} ${vehicle.model} - Type: ${vehicle.type}, Price: $${vehicle.price}, InStock: ${vehicle.inStock}`);
        }
        
        // Check type match (case-insensitive) - handle family car mapping
        let typeMatches = false;
        if (vehicleType.toLowerCase() === 'family car') {
          // Family car can be SUV, minivan, or large sedan
          typeMatches = ['suv', 'minivan', 'sedan'].includes(vehicle.type.toLowerCase());
        } else {
          typeMatches = vehicle.type.toLowerCase() === vehicleType.toLowerCase();
        }
        
        if (!typeMatches) {
          continue;
        }

        // Check budget
        if (vehicle.price > budget) {
          continue;
        }

        // Check dealer
        if (dealerId && vehicle.dealerId !== dealerId) {
          continue;
        }

        // Check features using category-grouped AND/OR logic:
        // Features in the same semantic category satisfy each other (OR within group),
        // features across different categories all need to be satisfied (AND across groups).
        if (features.length > 0) {
          const vehicleFeatures = this.extractVehicleFeatures(vehicle);

          const FEATURE_CATEGORIES = {
            fuel_type:    ['hybrid', 'electric', 'fuel-efficient', 'plug-in hybrid', 'gas', 'diesel', 'ev'],
            drivetrain:   ['awd', '4wd', 'all-wheel', 'four-wheel', 'fwd', 'rwd'],
            seating:      ['7-seater', '5-seater', 'third row', '3rd row'],
            tech:         ['apple carplay', 'android auto', 'navigation', 'bluetooth', 'wireless charging', 'head-up display', '360 camera'],
            safety:       ['backup camera', 'backup sensors', 'blind spot', 'lane assist', 'forward collision', 'automatic emergency braking', 'safety features'],
            sunroof:      ['sunroof', 'moonroof', 'panoramic', 'power moonroof', 'power sunroof', 'panoramic sunroof', 'panoramic moonroof'],
            heated_seats: ['heated seats', 'heated front seats', 'heated driver', 'heated passenger'],
            leather:      ['leather seats', 'leather', 'leather-trimmed', 'leatherette'],
            ventilated:   ['ventilated', 'cooled seats', 'ventilated seats'],
            audio:        ['premium sound', 'bose', 'harman kardon'],
          };

          const getFeatureCategory = (f) => {
            const fl = f.toLowerCase();
            for (const [cat, keywords] of Object.entries(FEATURE_CATEGORIES)) {
              if (keywords.some(k => fl.includes(k) || k.includes(fl))) return cat;
            }
            return `other_${fl}`;
          };

          // Group requested features by category
          const grouped = {};
          for (const f of features) {
            const cat = getFeatureCategory(f);
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(f);
          }

          // Vehicle must satisfy at least one feature in EVERY category group
          const hasRequiredFeatures = Object.values(grouped).every(group =>
            group.some(feature => this.featureMatches(vehicleFeatures, feature))
          );

          if (!hasRequiredFeatures) {
            continue;
          }
        }

        // Only include in-stock vehicles
        if (vehicle.inStock) {
          console.log(`   ✅ Adding: ${vehicle.make} ${vehicle.model} - Price: $${vehicle.price}, Type: ${vehicle.type}`);
          vehicles.push(vehicle);
        }
      }

      console.log(`✅ Found ${vehicles.length} vehicles matching ALL criteria`);

      // Sort by price (lowest first)
      vehicles.sort((a, b) => a.price - b.price);

      // Apply limit
      if (limit && vehicles.length > limit) {
        vehicles.splice(limit);
      }
      
      console.log(`🚗 Returning ${vehicles.length} vehicles after limit:`);
      vehicles.slice(0, 3).forEach((vehicle, index) => {
        console.log(`   ${index + 1}. ${vehicle.make} ${vehicle.model} - Price: $${vehicle.price}, Type: ${vehicle.type}`);
      });

      return vehicles;

    } catch (error) {
      console.error('❌ Error in multi-criteria search:', error);
      return [];
    }
  }

  /**
   * PERFORMANCE OPTIMIZED: Fast search using indexes with early exit
   * This is the new main method that should be used for all searches
   */
  async searchVehiclesOptimized(searchCriteria, dealerId = null, limit = null, rejectedVehicleIds = null) {
    // Use the proven searchVehiclesComprehensive method that works perfectly
    return await this.searchVehiclesComprehensive(searchCriteria, dealerId, limit, rejectedVehicleIds);
  }
  
  // Legacy commented implementation below (kept for reference)
  // async searchVehiclesOptimized(searchCriteria, dealerId = null, limit = null, rejectedVehicleIds = null) {
  //   const startTime = performance.now();
    
  //   try {
  //     console.log(`🚀 OPTIMIZED SEARCH with criteria:`, searchCriteria);
  //     if (rejectedVehicleIds && rejectedVehicleIds.size > 0) {
  //       console.log(`🚫 Excluding ${rejectedVehicleIds.size} rejected vehicles from search`);
  //     }
      
  //     // Check if inventory is available
  //     if (!this.inventory || this.inventory.size === 0) {
  //       console.warn('⚠️ No inventory data available, returning empty results');
  //       return [];
  //     }
      
  //     // Check cache first (but invalidate if rejected vehicles changed)
  //     const cacheKey = this.getSearchCacheKey(searchCriteria, dealerId, rejectedVehicleIds);
  //     const cachedResult = this.getCachedSearchResultByKey(cacheKey);
  //     if (cachedResult) {
  //       const cacheTime = performance.now() - startTime;
  //       console.log(`⚡ Cache hit - search completed in ${cacheTime.toFixed(2)}ms`);
  //       return cachedResult;
  //     }
      
  //     const { 
  //       make, 
  //       makes,
  //       model, 
  //       models,
  //       vehicleType, 
  //       budget, 
  //       features,
  //       vehicleOptions,
  //       minYear,
  //       color
  //     } = searchCriteria;
      
  //     let candidateIds = new Set();
  //     let results = [];
      
  //     // Strategy 1: Most specific search first (exact make + model)
  //     if (make && model) {
  //       console.log(`🎯 Strategy 1: Exact make/model search for ${make} ${model}`);
  //       const makeIds = this.searchIndexes.byMake.get(make?.toLowerCase()) || new Set();
  //       const modelIds = this.searchIndexes.byModel.get(model?.toLowerCase()) || new Set();
  //       candidateIds = new Set([...makeIds].filter(id => modelIds.has(id)));
        
  //       if (candidateIds.size > 0) {
  //         results = this.getVehiclesByIds(candidateIds, { budget, minYear, color, features, dealerId, limit, rejectedVehicleIds });
  //         if (results.length > 0) {
  //           console.log(`✅ Strategy 1 successful: Found ${results.length} vehicles in ${(performance.now() - startTime).toFixed(2)}ms`);
  //           this.cacheSearchResult(searchCriteria, dealerId, results, rejectedVehicleIds);
  //           return results;
  //         }
  //       }
  //     }
      
  //     // Strategy 1.5: Multiple makes with models search
  //     if (makes && Array.isArray(makes) && makes.length > 0 && models && Array.isArray(models) && models.length > 0) {
  //       console.log(`🎯 Strategy 1.5: Multiple makes with models search for [${makes.join(', ')}] [${models.join(', ')}]`);
  //       candidateIds = new Set();
        
  //       for (const makeItem of makes) {
  //         for (const modelItem of models) {
  //           const makeIds = this.searchIndexes.byMake.get(makeItem?.toLowerCase()) || new Set();
  //           const modelIds = this.searchIndexes.byModel.get(modelItem?.toLowerCase()) || new Set();
  //           const intersection = new Set([...makeIds].filter(id => modelIds.has(id)));
  //           intersection.forEach(id => candidateIds.add(id));
  //         }
  //       }
        
  //       if (candidateIds.size > 0) {
  //         results = this.getVehiclesByIds(candidateIds, { budget, minYear, color, features, vehicleType, dealerId, limit, rejectedVehicleIds });
  //         if (results.length > 0) {
  //           console.log(`✅ Strategy 1.5 successful: Found ${results.length} vehicles in ${(performance.now() - startTime).toFixed(2)}ms`);
  //           this.cacheSearchResult(searchCriteria, dealerId, results, rejectedVehicleIds);
  //           return results;
  //         }
  //       }
  //     }
      
  //     // Strategy 1.6: Multiple makes only search
  //     if (makes && Array.isArray(makes) && makes.length > 0 && (!models || models.length === 0)) {
  //       console.log(`🎯 Strategy 1.6: Multiple makes only search for [${makes.join(', ')}]`);
  //       candidateIds = new Set();
        
  //       for (const makeItem of makes) {
  //         const makeIds = this.searchIndexes.byMake.get(makeItem?.toLowerCase()) || new Set();
  //         makeIds.forEach(id => candidateIds.add(id));
  //       }
        
  //       if (candidateIds.size > 0) {
  //         results = this.getVehiclesByIds(candidateIds, { budget, minYear, color, features, vehicleType, dealerId, limit, rejectedVehicleIds });
  //         if (results.length > 0) {
  //           console.log(`✅ Strategy 1.6 successful: Found ${results.length} vehicles in ${(performance.now() - startTime).toFixed(2)}ms`);
  //           this.cacheSearchResult(searchCriteria, dealerId, results, rejectedVehicleIds);
  //           return results;
  //         }
  //       }
  //     }
      
  //     // Strategy 2: Make only (broader search)
  //     if (make && !model) {
  //       console.log(`🎯 Strategy 2: Make-only search for ${make}`);
  //       candidateIds = this.searchIndexes.byMake.get(make?.toLowerCase()) || new Set();
        
  //       if (candidateIds.size > 0) {
  //         results = this.getVehiclesByIds(candidateIds, { budget, minYear, color, features, vehicleType, dealerId, limit, rejectedVehicleIds });
  //         if (results.length > 0) {
  //           console.log(`✅ Strategy 2 successful: Found ${results.length} vehicles in ${(performance.now() - startTime).toFixed(2)}ms`);
  //           this.cacheSearchResult(searchCriteria, dealerId, results, rejectedVehicleIds);
  //           return results;
  //         }
  //       }
  //     }
      
  //     // Strategy 3: Type + budget (common search)
  //     if (vehicleType) {
  //       console.log(`🎯 Strategy 3: Type + budget search for ${vehicleType}`);
  //       candidateIds = this.searchIndexes.byType.get(vehicleType?.toLowerCase()) || new Set();
        
  //       if (candidateIds.size > 0) {
  //         results = this.getVehiclesByIds(candidateIds, { budget, minYear, color, features, dealerId, limit });
  //         if (results.length > 0) {
  //           console.log(`✅ Strategy 3 successful: Found ${results.length} vehicles in ${(performance.now() - startTime).toFixed(2)}ms`);
  //           this.cacheSearchResult(searchCriteria, dealerId, results, rejectedVehicleIds);
  //           return results;
  //         }
  //       }
  //     }
      
  //     // Strategy 4: Features search
  //     if (features && features.length > 0) {
  //       console.log(`🎯 Strategy 4: Features search for [${features.join(', ')}]`);
  //       const featureIds = features.map(f => this.featureIndex.get(f?.toLowerCase()) || new Set());
  //       if (featureIds.length > 0) {
  //         candidateIds = new Set(featureIds[0]);
  //         for (let i = 1; i < featureIds.length; i++) {
  //           candidateIds = new Set([...candidateIds].filter(id => featureIds[i].has(id)));
  //         }
          
  //         if (candidateIds.size > 0) {
  //           results = this.getVehiclesByIds(candidateIds, { budget, minYear, color, vehicleType, dealerId, limit });
  //           if (results.length > 0) {
  //             console.log(`✅ Strategy 4 successful: Found ${results.length} vehicles in ${(performance.now() - startTime).toFixed(2)}ms`);
  //             this.cacheSearchResult(searchCriteria, dealerId, results, rejectedVehicleIds);
  //             return results;
  //           }
  //         }
  //       }
  //     }
      
  //     // Strategy 5: Fallback to comprehensive search (only if needed)
  //     console.log(`🎯 Strategy 5: Fallback to comprehensive search`);
  //     results = await this.searchVehiclesComprehensive(searchCriteria, dealerId, limit, rejectedVehicleIds);
      
  //     const totalTime = performance.now() - startTime;
  //     console.log(`✅ Optimized search completed in ${totalTime.toFixed(2)}ms with ${results.length} results`);
      
  //     this.cacheSearchResult(searchCriteria, dealerId, results);
  //     return results;
      
  //   } catch (error) {
  //     console.error('❌ Error in optimized search:', error);
  //     return [];
  //   }
  // }

  /**
   * PERFORMANCE OPTIMIZATION: Get vehicles by IDs with filtering
   */
  getVehiclesByIds(vehicleIds, filters = {}) {
    const { budget, minYear, color, features, vehicleType, dealerId, limit = 10, rejectedVehicleIds } = filters;
    const results = [];
    
    for (const vehicleId of vehicleIds) {
      const vehicle = this.inventory.get(vehicleId);
      if (!vehicle || !vehicle.inStock) continue;
      
      // Skip rejected vehicles
      if (rejectedVehicleIds && rejectedVehicleIds.has(vehicleId)) {
        console.log(`🚫 Skipping rejected vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicleId})`);
        continue;
      }
      
      // Apply filters
      if (dealerId && vehicle.dealerId !== dealerId) continue;
      if (budget && vehicle.price > budget) continue;
      if (minYear && vehicle.year < minYear) continue;
      if (vehicleType && vehicle.type?.toLowerCase() !== vehicleType.toLowerCase()) continue;
      
      // Color filter using optimized color categorization
      if (color) {
        const vehicleColor = vehicle.color || vehicle.colors?.[0];
        const colorCategory = this.categorizeColorOptimized(vehicleColor) || 'light';
        if (colorCategory !== color) continue;
      }
      
      // Features filter
      if (features && features.length > 0) {
        const vehicleFeatures = this.extractVehicleFeatures(vehicle);
        const hasAllFeatures = features.every(f => 
          vehicleFeatures.some(vf => vf.includes(f.toLowerCase()) || f.toLowerCase().includes(vf))
        );
        if (!hasAllFeatures) continue;
      }
      
      // Apply limit
      if (results.length >= limit) break;
      
      results.push(vehicle);
      
      // Early exit if limit reached
      if (results.length >= limit) break;
    }
    
    // Sort by price
    results.sort((a, b) => (a.price || 0) - (b.price || 0));
    
    return results;
  }

  /**
   * COMPREHENSIVE: Smart search that tries multiple strategies (LEGACY - kept for fallback)
   * This is the main method that should be used for all searches
   */
  async searchVehiclesComprehensive(searchCriteria, dealerId = null, limit = null, rejectedVehicleIds = null) {
    try {
      console.log(`🔍 COMPREHENSIVE SEARCH with criteria:`, searchCriteria);

      // ── CACHE HIT CHECK ────────────────────────────────────────────────────
      // Skip on searches that include rejected vehicles — those are per-session
      // and must not be served from a shared cache.
      if (!rejectedVehicleIds || rejectedVehicleIds.size === 0) {
        const _hit = this.getCachedSearchResult(searchCriteria, dealerId);
        if (_hit) {
          console.log(`⚡ Cache hit — returning ${_hit.length} cached vehicles`);
          return _hit;
        }
      }
      // Helper: cache a non-empty result and return it
      const _cacheAndReturn = (results) => {
        if (results && results.length > 0 && (!rejectedVehicleIds || rejectedVehicleIds.size === 0)) {
          this.cacheSearchResult(searchCriteria, dealerId, results, rejectedVehicleIds);
        }
        return results;
      };
      // ── END CACHE SETUP ────────────────────────────────────────────────────

      const { 
        make, 
        makes, // NEW: Support multiple makes array
        model, 
        models, // NEW: Support multiple models array
        vehicleType, 
        budget, 
        features,
        vehicleOptions, // NEW: Support journey tracker vehicle options
        condition, // NEW: Support vehicle condition filtering
        color, // NEW: Support color tone filtering
        trim, // Support trim level filtering (SE, SEL, Limited, N-Line, etc.)
        minYear, // NEW: Support year filtering
        maxYear, // NEW: Support year range filtering
        maxMileage, // NEW: Support max mileage filtering
        minMileage  // NEW: Support min mileage filtering
      } = searchCriteria;
      let vehicles = [];
      
      // Helper function to apply condition, color, year, and features filters
      // Color, year, and features are OPTIONAL - if no matches found, show alternatives
      const applyAdditionalFilters = (vehicleList) => {
        let filtered = [...vehicleList];
        let originalCount = filtered.length;
        
        // Apply condition filter (OPTIONAL - prefer if specified, but don't exclude if no matches)
        if (condition) {
          const conditionFiltered = filtered.filter(v => {
            if (condition === 'new') {
              return v.condition === 'N' || v.condition === 'new';
            } else if (condition === 'pre-owned' || condition === 'used') {
              return v.condition === 'U' || v.condition === 'used' || v.condition === 'pre-owned';
            }
            return true;
          });
          
          // Only apply condition filter if it returns results, otherwise keep original results
          if (conditionFiltered.length > 0) {
            filtered = conditionFiltered;
            console.log(`🔍 Condition filter (${condition}) applied: ${filtered.length} vehicles remaining`);
          } else {
            console.log(`⚠️ No ${condition} vehicles found - keeping all ${filtered.length} vehicles (condition treated as optional)`);
          }
        }
        
        // Apply OPTIONAL color filter - if no matches, keep original results
        if (color && filtered.length > 0) {
          const colorFiltered = filtered.filter(v => {
            const vehicleColor = v.color || v.colors?.[0];
            const colorCategory = this.categorizeColorOptimized(vehicleColor);
            return color === 'light' ? colorCategory === 'light' : 
                   color === 'dark' ? colorCategory === 'dark' : 
                   vehicleColor?.toLowerCase().includes(color.toLowerCase());
          });
          
          if (colorFiltered.length > 0) {
            filtered = colorFiltered;
            console.log(`🔍 Color filter (${color}) applied: ${filtered.length} vehicles remaining`);
          } else {
            console.log(`🔍 Color filter (${color}) found no matches, showing all available colors`);
          }
        }
        
        // Apply OPTIONAL year filters - if no matches, keep original results
        if (minYear && filtered.length > 0) {
          const yearFiltered = filtered.filter(v => typeof v.year === 'number' && v.year >= minYear);
          if (yearFiltered.length > 0) {
            filtered = yearFiltered;
            console.log(`🔍 MinYear filter (${minYear}) applied: ${filtered.length} vehicles remaining`);
          } else {
            console.log(`🔍 MinYear filter (${minYear}) found no matches, showing all available years`);
          }
        }
        
        if (maxYear && filtered.length > 0) {
          const yearFiltered = filtered.filter(v => typeof v.year === 'number' && v.year <= maxYear);
          if (yearFiltered.length > 0) {
            filtered = yearFiltered;
            console.log(`🔍 MaxYear filter (${maxYear}) applied: ${filtered.length} vehicles remaining`);
          } else {
            console.log(`🔍 MaxYear filter (${maxYear}) found no matches, showing all available years`);
          }
        }

        // Apply OPTIONAL mileage filters - if no matches, keep original results
        if (maxMileage && filtered.length > 0) {
          const mileageFiltered = filtered.filter(v => !v.mileage || v.mileage <= maxMileage);
          if (mileageFiltered.length > 0) {
            filtered = mileageFiltered;
            console.log(`🔍 MaxMileage filter (${maxMileage.toLocaleString()}) applied: ${filtered.length} vehicles remaining`);
          } else {
            console.log(`🔍 MaxMileage filter (${maxMileage.toLocaleString()}) found no matches, showing all mileages`);
          }
        }

        if (minMileage && filtered.length > 0) {
          const mileageFiltered = filtered.filter(v => v.mileage && v.mileage >= minMileage);
          if (mileageFiltered.length > 0) {
            filtered = mileageFiltered;
            console.log(`🔍 MinMileage filter (${minMileage.toLocaleString()}) applied: ${filtered.length} vehicles remaining`);
          } else {
            console.log(`🔍 MinMileage filter (${minMileage.toLocaleString()}) found no matches, showing all mileages`);
          }
        }

        // Apply features filter
        // Features within the same semantic category use OR logic (selecting "hybrid" + "fuel-efficient"
        // should not require a vehicle to match both — they overlap). Features across different categories
        // use AND logic (selecting "hybrid" + "sunroof" requires both).
        if (features && features.length > 0 && filtered.length > 0) {
          const isSeatingCapacityFeature = features.some(f => 
            f && (f.toLowerCase().includes('seater') || 
                  f.toLowerCase().includes('seat') || 
                  f.toLowerCase().includes('third row') ||
                  f.toLowerCase().includes('3rd row'))
          );

          // Category groups — features within the same group satisfy each other (OR within group).
          // IMPORTANT: Each group must only contain genuinely interchangeable synonyms.
          // Sunroof/moonroof are separate from heated seats so they don't satisfy each other.
          const FEATURE_CATEGORIES = {
            fuel_type:    ['hybrid', 'electric', 'fuel-efficient', 'plug-in hybrid', 'gas', 'diesel', 'ev'],
            drivetrain:   ['awd', '4wd', 'all-wheel', 'four-wheel', 'fwd', 'rwd'],
            seating:      ['7-seater', '5-seater', 'third row', '3rd row'],
            tech:         ['apple carplay', 'android auto', 'navigation', 'bluetooth', 'wireless charging', 'head-up display', '360 camera'],
            safety:       ['backup camera', 'backup sensors', 'blind spot', 'lane assist', 'forward collision', 'automatic emergency braking', 'safety features'],
            sunroof:      ['sunroof', 'moonroof', 'panoramic', 'power moonroof', 'power sunroof', 'panoramic sunroof', 'panoramic moonroof'],
            heated_seats: ['heated seats', 'heated front seats', 'heated driver', 'heated passenger'],
            leather:      ['leather seats', 'leather', 'leather-trimmed', 'leatherette'],
            ventilated:   ['ventilated', 'cooled seats', 'ventilated seats'],
            audio:        ['premium sound', 'bose', 'harman kardon'],
          };

          // Assign each requested feature to its category (or 'other' if uncategorised)
          const getCategory = (f) => {
            const fl = f.toLowerCase();
            for (const [cat, keywords] of Object.entries(FEATURE_CATEGORIES)) {
              if (keywords.some(k => fl.includes(k) || k.includes(fl))) return cat;
            }
            return `other_${fl}`;
          };

          // Group selected features by category
          const grouped = {};
          for (const f of features) {
            const cat = getCategory(f);
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(f);
          }

          // A vehicle passes if, for EVERY category group, it matches AT LEAST ONE feature in that group
          const featuresFiltered = filtered.filter(v => {
            const vehicleFeatures = this.extractVehicleFeatures(v);
            return Object.values(grouped).every(group =>
              group.some(feature => this.featureMatches(vehicleFeatures, feature))
            );
          });
          
          if (featuresFiltered.length > 0) {
            filtered = featuresFiltered;
            console.log(`🔍 Features filter (${features.join(', ')}) applied: ${filtered.length} vehicles remaining`);
          } else {
            // Feature combination not found in inventory — return empty so the caller
            // (generateNoInventoryResponse) can give an honest, targeted recovery message
            // instead of silently showing mismatched vehicles.
            console.log(`🚫 Features filter (${features.join(', ')}) returned 0 — no silent fallback, returning empty`);
            filtered = [];
          }
        }

        // Apply OPTIONAL trim filter — if no match, keep all trims (user preference, not a hard requirement)
        if (trim && filtered.length > 0) {
          const trimLower = trim.toLowerCase();
          const trimFiltered = filtered.filter(v => {
            const vTrim = (v.trim || v.vehicle_trim || '').toLowerCase();
            return vTrim === trimLower || vTrim.includes(trimLower) || trimLower.includes(vTrim);
          });
          if (trimFiltered.length > 0) {
            filtered = trimFiltered;
            console.log(`🔍 Trim filter (${trim}) applied: ${filtered.length} vehicles remaining`);
          } else {
            console.log(`🔍 Trim filter (${trim}) found no matches — showing all trims`);
          }
        }
        
        return filtered;
      };
      
      // Helper function to provide alternative suggestions when optional filters don't match
      const getAlternativeSuggestions = (vehicleList, originalCriteria) => {
        const suggestions = {
          availableColors: new Set(),
          availableYears: new Set(),
          availableFeatures: new Set(),
          totalVehicles: vehicleList.length
        };
        
        vehicleList.forEach(vehicle => {
          // Collect available colors
          const vehicleColor = vehicle.color || vehicle.colors?.[0];
          if (vehicleColor) {
            const colorCategory = this.categorizeColorOptimized(vehicleColor);
            suggestions.availableColors.add(colorCategory);
            suggestions.availableColors.add(vehicleColor);
          }
          
          // Collect available years
          if (vehicle.year) {
            suggestions.availableYears.add(vehicle.year);
          }
          
          // Collect available features
          const vehicleFeatures = this.extractVehicleFeatures(vehicle);
          vehicleFeatures.forEach(feature => suggestions.availableFeatures.add(feature));
        });
        
        // Convert sets to arrays for easier use
        suggestions.availableColors = Array.from(suggestions.availableColors);
        suggestions.availableYears = Array.from(suggestions.availableYears).sort((a, b) => b - a);
        suggestions.availableFeatures = Array.from(suggestions.availableFeatures);
        
        console.log('💡 Alternative suggestions:', {
          colors: suggestions.availableColors.slice(0, 5),
          years: suggestions.availableYears.slice(0, 5),
          features: suggestions.availableFeatures.slice(0, 10)
        });
        
        return suggestions;
      };
      
      // Strategy 0: Journey tracker vehicle options (highest priority)
      if (vehicleOptions && vehicleOptions.length > 0) {
        console.log(`📋 Strategy 0: Journey tracker vehicle options search for ${vehicleOptions.length} options`);
        for (const vehicleOption of vehicleOptions) {
          const optionVehicles = await this.getVehiclesByMakeModelEnhanced(
            vehicleOption.make, 
            vehicleOption.model, 
            budget || vehicleOption.price, 
            dealerId, 
            Math.ceil((limit || 10) / vehicleOptions.length),
            vehicleType  // ✅ Pass vehicleType to filter correctly
          );
          vehicles = vehicles.concat(optionVehicles);
        }
        if (vehicles.length > 0) {
          console.log(`✅ Strategy 0 successful: Found ${vehicles.length} vehicles using vehicle options`);
          let results = this.deduplicateResults(vehicles);
          results = applyAdditionalFilters(results);
          results = results.slice(0, limit || 10);
          if (rejectedVehicleIds && rejectedVehicleIds.size > 0) {
            results = results.filter(vehicle => !rejectedVehicleIds.has(vehicle.id));
          }
          return _cacheAndReturn(results);
        }
      }
      
      // Strategy 0.3: Multiple makes search (highest priority for multiple makes)
      if (makes && Array.isArray(makes) && makes.length > 0) {
        console.log(`📋 Strategy 0.3: Multiple makes search for [${makes.join(', ')}]`);
        for (const makeToSearch of makes) {
          // If we also have models, search for each make with each model
          if (models && Array.isArray(models) && models.length > 0) {
            for (const modelToSearch of models) {
              const makeModelVehicles = await this.getVehiclesByMakeModelEnhanced(
                makeToSearch, 
                modelToSearch, 
                budget || 10000, 
                dealerId, 
                Math.ceil((limit || 10) / (makes.length * models.length))
              );
              vehicles = vehicles.concat(makeModelVehicles);
            }
          } else {
            // Just search by make
            const makeVehicles = await this.getVehiclesByMakeModelEnhanced(
              makeToSearch, 
              '', 
              budget || 10000, 
              dealerId, 
              Math.ceil((limit || 10) / makes.length),
              vehicleType  // ✅ Pass vehicleType to filter correctly
            );
            vehicles = vehicles.concat(makeVehicles);
          }
        }
        if (vehicles.length > 0) {
          console.log(`✅ Strategy 0.3 successful: Found ${vehicles.length} vehicles using multiple makes`);
          let results = this.deduplicateResults(vehicles);
          results = applyAdditionalFilters(results);
          results = results.slice(0, limit || 10);
          if (rejectedVehicleIds && rejectedVehicleIds.size > 0) {
            results = results.filter(vehicle => !rejectedVehicleIds.has(vehicle.id));
          }
          return _cacheAndReturn(results);
        }
      }
      
      // Strategy 0.5: Multiple models search (high priority)
      if (models && Array.isArray(models) && models.length > 0) {
        console.log(`📋 Strategy 0.5: Multiple models search for [${models.join(', ')}]`);
        for (const modelToSearch of models) {
          const modelVehicles = await this.getVehiclesByMakeModelEnhanced(
            make, 
            modelToSearch, 
            budget || 10000, 
            dealerId, 
            Math.ceil((limit || 10) / models.length),
            vehicleType  // ✅ Pass vehicleType to filter correctly
          );
          vehicles = vehicles.concat(modelVehicles);
        }
        if (vehicles.length > 0) {
          console.log(`✅ Strategy 0.5 successful: Found ${vehicles.length} vehicles using multiple models`);
          let results = this.deduplicateResults(vehicles);
          results = applyAdditionalFilters(results);
          results = results.slice(0, limit || 10);
          if (rejectedVehicleIds && rejectedVehicleIds.size > 0) {
            results = results.filter(vehicle => !rejectedVehicleIds.has(vehicle.id));
          }
          return _cacheAndReturn(results);
        }
      }
      
      // Strategy 1: Exact make/model search (most specific)
      if (make && model) {
        console.log(`📋 Strategy 1: Exact make/model search for ${make} ${model}`);
        vehicles = await this.getVehiclesByMakeModelEnhanced(make, model, budget || 100000, dealerId, limit, vehicleType);
        if (vehicles.length > 0) {
          const originalVehicles = [...vehicles];
          vehicles = applyAdditionalFilters(vehicles);
          
          // If optional filters reduced results significantly, provide alternatives
          // BUT NOT if condition filter was the cause (condition is mandatory)
          if (vehicles.length === 0 && (color || minYear || maxYear || features) && !condition) {
            console.log(`💡 No vehicles match optional filters, showing alternatives`);
            vehicles = originalVehicles.slice(0, limit || 10);
            const alternatives = getAlternativeSuggestions(vehicles, searchCriteria);
            vehicles.alternatives = alternatives;
          } else if (vehicles.length === 0 && condition) {
            console.log(`❌ No ${condition} vehicles found - condition filter is mandatory, no fallback`);
          }
          
          console.log(`✅ Strategy 1 successful: Found ${vehicles.length} vehicles`);
          if (rejectedVehicleIds && rejectedVehicleIds.size > 0) {
            vehicles = vehicles.filter(vehicle => !rejectedVehicleIds.has(vehicle.id));
          }
          return _cacheAndReturn(vehicles);
        } else {
          // No exact make/model found - the enhanced search already tried budget increases
          console.log(`❌ No ${make} ${model} vehicles found even with budget increases`);
          // Don't fall back to make-only search - return empty results
          return [];
        }
      }

      // Strategy 1.5: Model-only search (make not provided — e.g. "do you have a Santa Cruz?")
      // Runs when only a model name is known, scanning all makes in inventory.
      if (!make && model) {
        console.log(`📋 Strategy 1.5: Model-only search for "${model}" (no make specified)`);
        const modelLower = model.toLowerCase();
        const modelOnlyVehicles = [];
        for (const [, vehicle] of this.inventory) {
          if (!vehicle.model || !vehicle.model.toLowerCase().includes(modelLower)) continue;
          if (budget && vehicle.price > budget) continue;
          if (dealerId && vehicle.dealerId !== dealerId) continue;
          if (vehicleType && vehicle.type && vehicle.type.toLowerCase() !== vehicleType.toLowerCase()) continue;
          if (vehicle.inStock) modelOnlyVehicles.push(vehicle);
        }
        modelOnlyVehicles.sort((a, b) => a.price - b.price);
        vehicles = limit ? modelOnlyVehicles.slice(0, limit) : modelOnlyVehicles;
        if (vehicles.length > 0) {
          vehicles = applyAdditionalFilters(vehicles);
          console.log(`✅ Strategy 1.5 successful: Found ${vehicles.length} vehicles for model "${model}"`);
          if (rejectedVehicleIds && rejectedVehicleIds.size > 0) {
            vehicles = vehicles.filter(v => !rejectedVehicleIds.has(v.id));
          }
          return _cacheAndReturn(vehicles);
        }
        console.log(`❌ Strategy 1.5: No vehicles found for model "${model}"`);
      }
      
      // Strategy 2: Make-only search (broader)
      if (make && !model) {
        console.log(`📋 Strategy 2: Make-only search for ${make}`);
        vehicles = await this.getVehiclesByMakeModelEnhanced(make, '', budget || 100000, dealerId, limit, vehicleType);
        if (vehicles.length > 0) {
          const originalVehicles = [...vehicles];
          vehicles = applyAdditionalFilters(vehicles);
          
          // If optional filters reduced results significantly, provide alternatives
          // BUT NOT if condition or features was the cause (both are hard filters — no silent fallback)
          if (vehicles.length === 0 && (color || minYear || maxYear) && !condition && !features) {
            console.log(`💡 No vehicles match optional filters, showing alternatives`);
            vehicles = originalVehicles.slice(0, limit || 10);
            const alternatives = getAlternativeSuggestions(vehicles, searchCriteria);
            vehicles.alternatives = alternatives;
          } else if (vehicles.length === 0 && (condition || features)) {
            console.log(`❌ No vehicles match hard filter (condition="${condition}", features=[${(features||[]).join(',')}]) — no fallback`);
          }
          
          console.log(`✅ Strategy 2 successful: Found ${vehicles.length} vehicles`);
          if (rejectedVehicleIds && rejectedVehicleIds.size > 0) {
            vehicles = vehicles.filter(vehicle => !rejectedVehicleIds.has(vehicle.id));
          }
          return _cacheAndReturn(vehicles);
        }
      }
      
      // Strategy 3: Make-only search (if user specified make but no exact model found)
      if (make && !model) {
        console.log(`📋 Strategy 3: Make-only search for ${make} (fallback from exact model search)`);
        vehicles = await this.getVehiclesByMakeModelEnhanced(make, '', budget || 100000, dealerId, limit, vehicleType);
        if (vehicles.length > 0) {
          vehicles = applyAdditionalFilters(vehicles);
          console.log(`✅ Strategy 3 successful: Found ${vehicles.length} ${make} vehicles`);
          if (rejectedVehicleIds && rejectedVehicleIds.size > 0) {
            vehicles = vehicles.filter(vehicle => !rejectedVehicleIds.has(vehicle.id));
          }
          return _cacheAndReturn(vehicles);
        }
      }
      
      // Strategy 3.5: Type + budget + features search (only if no make specified)
      if (vehicleType && !make) {
        console.log(`📋 Strategy 3.5: Type + budget + features search for ${vehicleType}`);
        vehicles = await this.getVehiclesByTypeBudgetAndFeatures(vehicleType, budget || 100000, features || [], dealerId, limit);
        if (vehicles.length > 0) {
          vehicles = applyAdditionalFilters(vehicles);
          console.log(`✅ Strategy 3.5 successful: Found ${vehicles.length} vehicles`);
          if (rejectedVehicleIds && rejectedVehicleIds.size > 0) {
            vehicles = vehicles.filter(vehicle => !rejectedVehicleIds.has(vehicle.id));
          }
          return _cacheAndReturn(vehicles);
        }
      }
      
      // Strategy 4: Type + budget only (only if no make specified)
      if (vehicleType && !make) {
        console.log(`📋 Strategy 4: Type + budget search for ${vehicleType}`);
        vehicles = await this.getVehiclesByTypeAndBudget(vehicleType, budget || 100000, dealerId, limit);
        if (vehicles.length > 0) {
          vehicles = applyAdditionalFilters(vehicles);
          console.log(`✅ Strategy 4 successful: Found ${vehicles.length} vehicles`);
          if (rejectedVehicleIds && rejectedVehicleIds.size > 0) {
            vehicles = vehicles.filter(vehicle => !rejectedVehicleIds.has(vehicle.id));
          }
          return _cacheAndReturn(vehicles);
        }
      }
      
      // Strategy 5: Features-only search (broadest)
      if (features && features.length > 0) {
        console.log(`📋 Strategy 5: Features-only search for [${features.join(', ')}]`);
        vehicles = await this.getVehiclesByMultipleFilters({ features, budget });
        if (vehicles.length > 0) {
          vehicles = applyAdditionalFilters(vehicles);
          console.log(`✅ Strategy 5 successful: Found ${vehicles.length} vehicles`);
          let results = vehicles.slice(0, limit || 10);
          if (rejectedVehicleIds && rejectedVehicleIds.size > 0) {
            results = results.filter(vehicle => !rejectedVehicleIds.has(vehicle.id));
          }
          return _cacheAndReturn(results);
        }
      }
      
      // Strategy 6: Flexible multi-criteria search (handles any 3+ criteria combination)
      const criteriaCount = [make, vehicleType, budget, condition, color, minYear, maxYear, features].filter(Boolean).length;
      if (criteriaCount >= 3) {
        console.log(`📋 Strategy 6: Flexible multi-criteria search (${criteriaCount} criteria)`);
        
        // Use the unified search which handles all criteria comprehensively
        vehicles = await this.searchVehiclesUnified({
          make: make,
          vehicleType: vehicleType,
          budget: budget,
          color: color,
          minYear: minYear,
          features: features,
          dealerId: dealerId,
          limit: limit || 10
        });
        
        if (vehicles.length > 0) {
          // Apply additional filters that aren't handled by searchVehiclesUnified
          vehicles = applyAdditionalFilters(vehicles);
          console.log(`✅ Strategy 6 successful: Found ${vehicles.length} vehicles using flexible multi-criteria`);
          if (rejectedVehicleIds && rejectedVehicleIds.size > 0) {
            vehicles = vehicles.filter(vehicle => !rejectedVehicleIds.has(vehicle.id));
          }
          return _cacheAndReturn(vehicles);
        }
      }
      
      // Strategy 7: Budget-only search — no make/model/type specified
      // Fires when the customer gives a budget with no other constraints
      // ("do you have something under $35K?", "what's available under 30K?")
      if (budget && !make && !model && !vehicleType && (!features || features.length === 0)) {
        console.log(`📋 Strategy 7: Budget-only search — price ≤ $${budget.toLocaleString()}`);
        const budgetVehicles = [];
        for (const [, vehicle] of this.inventory) {
          if (!vehicle.inStock) continue;
          if (dealerId && vehicle.dealerId !== dealerId) continue;
          const _price = vehicle.price ?? vehicle.list_price ?? vehicle.asking_price ?? vehicle.internet_price;
          const _parsedPrice = _price != null ? parseFloat(String(_price).replace(/[^0-9.]/g, '')) : NaN;
          if (!isNaN(_parsedPrice) && _parsedPrice > 0 && _parsedPrice <= budget) {
            budgetVehicles.push(vehicle);
          }
        }
        // Sort by price ascending so cheapest options surface first
        budgetVehicles.sort((a, b) => {
          const pa = parseFloat(String(a.price ?? a.list_price ?? 0).replace(/[^0-9.]/g, '')) || 0;
          const pb = parseFloat(String(b.price ?? b.list_price ?? 0).replace(/[^0-9.]/g, '')) || 0;
          return pa - pb;
        });
        vehicles = limit ? budgetVehicles.slice(0, limit) : budgetVehicles;
        if (vehicles.length > 0) {
          console.log(`✅ Strategy 7 successful: Found ${vehicles.length} vehicles under $${budget.toLocaleString()}`);
          if (rejectedVehicleIds && rejectedVehicleIds.size > 0) {
            vehicles = vehicles.filter(v => !rejectedVehicleIds.has(v.id));
          }
          return _cacheAndReturn(vehicles);
        }
        console.log(`⚠️ Strategy 7: No vehicles under $${budget.toLocaleString()} in dealer inventory`);
      }

      console.log(`❌ All search strategies failed. No vehicles found.`);
      return [];
      
    } catch (error) {
      console.error('❌ Error in comprehensive search:', error);
      return [];
    }
  }

  /**
   * Helper: Extract features from vehicle object
   */

/**
 * One-pass, comprehensive vehicle search.
 * - Checks only the criteria the caller provided
 * - Single scan over in-memory inventory (fast)
 * - Only returns in-stock vehicles
 * - Supports: make, model, vehicleType, budget, minYear, features (all/any), color (light/dark/exact), dealerId
 * - Sorting: configurable (default = price asc), with sensible tie-breakers
 */
async searchVehiclesUnified(criteria = {}) {
  // ---- normalize criteria
  const {
    make = null,
    model = null,
    vehicleType = null,
    budget = null,           // max price
    minYear = null,          // e.g., 2020
    features = [],           // array of strings
    featuresMatch = 'all',   // 'all' | 'any'
    color = null,            // 'light' | 'dark' | exact color string
    dealerId = null,
    limit = 10,
    sortBy = 'price',        // 'price' | 'year' | 'mileage'
    sortDir = 'asc',         // 'asc' | 'desc'
  } = criteria;

  const wantMake   = make && String(make).trim().toLowerCase();
  const wantModel  = (model ?? '').toString().trim().toLowerCase();
  const wantType   = (vehicleType ?? '').toString().trim().toLowerCase();
  const wantBudget = (typeof budget === 'number' && budget > 0) ? budget : null;
  const wantYear   = (typeof minYear === 'number' && minYear > 0) ? minYear : null;
  const wantDealer = dealerId || null;

  const wantFeatures = Array.isArray(features)
    ? features.map(f => String(f).trim().toLowerCase()).filter(Boolean)
    : [];

  const wantColor = color ? String(color).trim().toLowerCase() : null;

  // quick exits
  if (this.inventory.size === 0) return [];

  // ---- helpers reused from your class (safe calls if you already have them)
  const featureMatches = (vehicleFeatures, required) => {
    // ✅ ENHANCED: Improved feature matching with bidirectional synonym support
    const req = String(required).toLowerCase().trim();
    
    // Direct match (case-insensitive)
    if (vehicleFeatures.some(f => f.toLowerCase() === req)) return true;
    
    // Substring match — only check that the vehicle feature contains the search term.
    // The reverse direction (req.includes(fLower)) was too broad and caused false positives
    // e.g. "moonroof".includes("roof") matching vehicles that merely had "roof rack".
    if (vehicleFeatures.some(f => {
      const fLower = f.toLowerCase();
      return fLower.includes(req);
    })) return true;

    // Synonym mapping for bidirectional matching
    const map = {
      'sunroof': ['sunroof','moonroof','panoramic','power moonroof','power sunroof'],
      'panoramic': ['panoramic','sunroof','moonroof'],
      'fast-charging': ['fast-charging','fast charging','dc fast','dc fast charging'],
      'electric': ['electric','ev','hybrid','plug-in'],
      'hybrid': ['hybrid','hybrid-electric','plug-in hybrid'],
      '7-seater': ['7-seater','7 seats','third row','3rd row','seven seats'],
      '7 seats': ['7-seater','7 seats','third row','3rd row','seven seats'],
      'third row': ['7-seater','7 seats','third row','3rd row','seven seats'],
      '3rd row': ['7-seater','7 seats','third row','3rd row','seven seats'],
      'seven seats': ['7-seater','7 seats','third row','3rd row','seven seats'],
      '5-seater': ['5-seater','5 seats','five seats','standard seating'],
      '5 seats': ['5-seater','5 seats','five seats','standard seating'],
      'five seats': ['5-seater','5 seats','five seats','standard seating'],
      'standard seating': ['5-seater','5 seats','five seats','standard seating'],
      'family': ['suv','minivan','sedan','wagon'],
      'awd': ['awd','all wheel drive','4wd','four wheel drive','4 wheel drive'],
      'all wheel drive': ['awd','all wheel drive','4wd','four wheel drive','4 wheel drive'],
      '4wd': ['awd','all wheel drive','4wd','four wheel drive','4 wheel drive']
    };
    
    // Get synonyms for the search term
    const candidates = map[req] || [req];
    
    // Check if any vehicle feature matches any synonym (case-insensitive, substring match)
    return candidates.some(candidate => {
      return vehicleFeatures.some(vf => {
        const vfLower = vf.toLowerCase();
        const candidateLower = candidate.toLowerCase();
        // Exact match
        if (vfLower === candidateLower) return true;
        // Substring match: vehicle feature contains the candidate (handles "Third Row Seating" ⊇ "third row")
        if (vfLower.includes(candidateLower)) return true;
        return false;
      });
    });
  };

  const extractVehicleFeatures = (vehicle) => {
    let cleanFeatures;
    if (Array.isArray(vehicle.features)) {
      cleanFeatures = vehicle.features.map(f => String(f).toLowerCase().trim()).filter(Boolean);
    } else {
      const svc = new InventoryService();
      cleanFeatures = svc.extractCleanFeaturesFromString(vehicle.features);
    }
    
    const additionalFeatures = [
      vehicle.type,
      vehicle.make,
      vehicle.model
    ].filter(Boolean);
    
    // No .slice() — return all features so safety, AWD, 3rd row etc. are all searchable
    return [...cleanFeatures, ...additionalFeatures]
      .filter(Boolean)
      .map(s => String(s).toLowerCase());
  };

  // color groups for "light"/"dark" preferences
  const lightColors = new Set(['white','silver','beige','champagne','pearl','cream','ivory','light gray','light grey','gold']);
  const darkColors  = new Set(['black','blue','navy','dark blue','charcoal','dark gray','dark grey','maroon','burgundy','brown','green']);

  const colorMatches = (vehColor, wantColor) => {
    if (!wantColor) return true;
    if (!vehColor) return false;

    const c = String(vehColor).toLowerCase();
    if (wantColor === 'light') return lightColors.has(c) || c.includes('silver') || c.includes('white') || c.includes('beige') || c.includes('pearl') || c.includes('cream');
    if (wantColor === 'dark')  return darkColors.has(c)  || c.includes('black')  || c.includes('navy')  || c.includes('charcoal') || c.includes('dark');
    return c.includes(wantColor);
  };

  // vehicleType mapping (“family car” etc.)
  const typeMatches = (vehType, wantType) => {
    if (!wantType) return true;
    const vt = String(vehType || '').toLowerCase();
    if (wantType === 'family car') {
      return vt === 'suv' || vt === 'minivan' || vt === 'van' || vt === 'sedan';
    }
    return vt === wantType;
  };

  // ---- main single-pass filter
  const results = [];
  for (const v of this.inventory.values()) {
    // Always enforce in-stock
    if (!v.inStock) continue;

    // Dealer constraint
    if (wantDealer && v.dealerId !== wantDealer) continue;

    // Make / model
    if (wantMake && String(v.make || '').toLowerCase() !== wantMake) continue;
    if (wantModel && !String(v.model || '').toLowerCase().includes(wantModel)) continue;

    // Type
    if (!typeMatches(v.type, wantType)) continue;

    // Budget
    if (wantBudget && !(typeof v.price === 'number' && v.price <= wantBudget)) continue;

    // Year
    if (wantYear && !(typeof v.year === 'number' && v.year >= wantYear)) continue;

    // Color
    const vehColor = Array.isArray(v.colors) ? v.colors[0] : v.color || (v.colors || [])[0];
    if (!colorMatches(vehColor, wantColor)) continue;

    // Features (all/any)
    if (wantFeatures.length) {
      const vf = extractVehicleFeatures(v);
      const matchedCount = wantFeatures.reduce((acc, f) => acc + (featureMatches(vf, f) ? 1 : 0), 0);
      const ok = featuresMatch === 'all' ? matchedCount === wantFeatures.length : matchedCount > 0;
      if (!ok) continue;
    }

    results.push(v);
  }

  // ---- sorting
  const dir = (sortDir === 'desc') ? -1 : 1;
  results.sort((a, b) => {
    const by = (key, fallback = 0) => {
      const av = (typeof a[key] === 'number') ? a[key] : fallback;
      const bv = (typeof b[key] === 'number') ? b[key] : fallback;
      return (av - bv) * dir;
    };

    if (sortBy === 'year') {
      // newer first if desc, older first if asc
      const primary = by('year');
      if (primary !== 0) return primary;
      // tie-breakers
      const priceTiebreak = by('price');      // cheaper first on asc
      if (priceTiebreak !== 0) return priceTiebreak;
      // lower mileage first
      return ((a.mileage ?? 0) - (b.mileage ?? 0)) * 1;
    }

    if (sortBy === 'mileage') {
      const am = a.mileage ?? Number.MAX_SAFE_INTEGER;
      const bm = b.mileage ?? Number.MAX_SAFE_INTEGER;
      const primary = (am - bm) * dir;
      if (primary !== 0) return primary;
      // cheaper first on asc
      const priceTiebreak = by('price');
      if (priceTiebreak !== 0) return priceTiebreak;
      // newer first naturally helps; invert with dir
      return (a.year - b.year) * (-dir);
    }

    // default: price
    const primary = by('price');
    if (primary !== 0) return primary;
    // newer first when prices tie
    const yearTiebreak = (a.year - b.year) * (-dir);
    if (yearTiebreak !== 0) return yearTiebreak;
    // lower mileage
    return ((a.mileage ?? 0) - (b.mileage ?? 0)) * 1;
  });

  // ---- limit
  if (limit && results.length > limit) results.length = limit;

  return results;
}


  extractVehicleFeatures(vehicle) {
    let cleanFeatures;

    if (Array.isArray(vehicle.features)) {
      // vehicle.features is already a parsed array (set during DB load at line ~63).
      // extractCleanFeaturesFromString would return [] for non-strings, so handle directly.
      cleanFeatures = vehicle.features
        .map(f => String(f).toLowerCase().trim())
        .filter(Boolean);
    } else {
      // Raw string from DB — parse it
      cleanFeatures = this.extractCleanFeaturesFromString(vehicle.features);
    }
    
    // Add type and other attributes as searchable features
    const additionalFeatures = [
      vehicle.type?.toLowerCase(),
      vehicle.make?.toLowerCase(),
      vehicle.model?.toLowerCase()
    ].filter(Boolean);
    
    // ✅ Removed .slice(0, 5) — truncating to 5 items caused all features beyond the
    // 5th position (airbags, ABS, third row, Apple CarPlay, etc.) to be invisible to
    // the feature search, making all feature-based queries silently return 0 results.
    return [...cleanFeatures, ...additionalFeatures].filter(f => f && f.length > 1);
  }

  /**
   * Helper: Check if vehicle features match required feature
   */
  featureMatches(vehicleFeatures, requiredFeature) {
    const required = requiredFeature.toLowerCase();
    
    // Direct match
    if (vehicleFeatures.includes(required)) {
      return true;
    }
    
    // Partial match: vehicle feature contains the search term (e.g. "power moonroof" satisfies "moonroof").
    // Deliberately NOT checking required.includes(f) — that direction caused false positives like
    // "moonroof".includes("roof") making a vehicle with only "roof rack" satisfy a moonroof search.
    // The synonym map below handles all legitimate abbreviation/synonym cases.
    if (vehicleFeatures.some(f => f.includes(required))) {
      return true;
    }
    
    // Special mappings for common features
    const featureMappings = {
      'sunroof': ['sunroof', 'moonroof', 'panoramic', 'power moonroof', 'power sunroof'],
      'panoramic': ['panoramic', 'sunroof', 'moonroof'],
      'fast-charging': ['fast-charging', 'fast charging', 'dc fast', 'dc fast charging'],
      // ✅ ENHANCED: Fuel type mappings
      'electric': ['electric', 'ev', 'electric vehicle', 'battery electric', 'bev'],
      'hybrid': ['hybrid', 'hybrid-electric', 'hybrid electric', 'hev'],
      'plug-in hybrid': ['plug-in hybrid', 'plug in hybrid', 'phev', 'plug-in', 'plug in'],
      'gas': ['gas', 'gasoline', 'petrol', 'fuel efficient', 'fuel economy'],
      'fuel-efficient': ['hybrid', 'hybrid-electric', 'hybrid electric', 'hev', 'electric', 'ev', 'bev', 'plug-in hybrid', 'phev', 'fuel efficient', 'fuel economy', 'high mpg', 'good mpg', 'good gas mileage'],
      'diesel': ['diesel'],
      // ✅ ENHANCED: Transmission mappings
      'automatic': ['automatic', 'auto', 'automatic transmission', 'at'],
      'manual': ['manual', 'manual transmission', 'mt', 'stick shift', 'stick'],
      'cvt': ['cvt', 'continuously variable', 'continuously variable transmission'],
      '8-speed': ['8-speed', '8 speed', '8spd', '8 spd'],
      '9-speed': ['9-speed', '9 speed', '9spd', '9 spd'],
      '10-speed': ['10-speed', '10 speed', '10spd', '10 spd'],
      // ✅ ENHANCED: Fuel efficiency/MPG mappings
      'high mpg': ['high mpg', 'high mpg', 'good gas mileage', 'fuel efficient', 'fuel economy', 'good mpg'],
      '30 mpg': ['30 mpg', '30mpg', '30 mpg', 'over 30 mpg'],
      '35 mpg': ['35 mpg', '35mpg', '35 mpg', 'over 35 mpg'],
      '40 mpg': ['40 mpg', '40mpg', '40 mpg', 'over 40 mpg'],
      // ✅ ENHANCED: Safety feature mappings
      'safety features': ['safety', 'safety features', 'safety systems', 'advanced safety'],
      'airbags': ['airbags', 'air bag', 'air bags', 'side airbags', 'curtain airbags'],
      'collision avoidance': ['collision avoidance', 'forward collision', 'collision warning', 'fcw'],
      'abs': ['abs', 'anti-lock brakes', 'anti lock brakes', 'antilock'],
      'stability control': ['stability control', 'esc', 'electronic stability', 'traction control'],
      'backup sensors': ['backup sensors', 'rear sensors', 'parking sensors', 'ultrasonic sensors'],
      'forward collision warning': ['forward collision warning', 'fcw', 'forward collision', 'collision warning'],
      'lane departure warning': ['lane departure warning', 'ldw', 'lane departure', 'lane warning'],
      'blind spot monitoring': ['blind spot', 'blind spot monitoring', 'bsm', 'blind spot warning'],
      'automatic emergency braking': ['automatic emergency braking', 'aeb', 'emergency braking', 'auto braking'],
      // ✅ ENHANCED: Technology feature mappings
      'apple carplay': ['apple carplay', 'carplay', 'apple car play'],
      'android auto': ['android auto', 'android', 'google android'],
      'wireless charging': ['wireless charging', 'wireless charger', 'qi charging', 'qi charger'],
      'head-up display': ['head-up display', 'hud', 'head up display', 'heads up display'],
      '360 camera': ['360 camera', '360° camera', 'surround view', '360 view', 'bird\'s eye view'],
      'premium sound': ['premium sound', 'premium audio', 'premium sound system', 'bose', 'harman kardon'],
      '7-seater': [
        '7-seater', '7 seats', 'seven seats', '7 passenger', '7-passenger',
        'third row', '3rd row', 'third-row', '3rd-row',
        'third row seating', '3rd row seating', 'third-row seating',
        'third row seats', '3rd row seats', 'third-row seats',
        'third row bench', '3rd row bench', 'third-row bench',
        'seating: 7', 'seating capacity: 7', 'seats: 7'
      ],
      '5-seater': [
        '5-seater', '5 seats', 'five seats', '5 passenger', '5-passenger',
        'standard seating', 'standard seats',
        'seating: 5', 'seating capacity: 5', 'seats: 5'
      ],
      'family': ['suv', 'minivan', 'sedan', 'wagon']
    };
    
    const mappedFeatures = featureMappings[required] || [required];
    
    // Check if any mapped feature matches (case-insensitive, partial match)
    return mappedFeatures.some(mappedFeature => {
      const mappedLower = mappedFeature.toLowerCase();
      return vehicleFeatures.some(vf => {
        const vfLower = String(vf).toLowerCase();
        // Exact match
        if (vfLower === mappedLower) return true;
        // Vehicle feature contains the mapped term (e.g. "Third Row Seating" ⊇ "third row").
        // Only check one direction to avoid "moonroof".includes("roof") false positives.
        if (vfLower.includes(mappedLower)) return true;
        return false;
      });
    });
  }

  /**
   * Get inventory summary for a dealer
   */
  async getDealerInventorySummary(dealerId) {
    try {
      const vehicles = this.dealerInventories.get(dealerId) || [];
      
      const summary = {
        total: vehicles.length,
        inStock: vehicles.filter(v => v.inStock).length,
        outOfStock: vehicles.filter(v => !v.inStock).length,
        byType: {},
        byPrice: {
          under25k: vehicles.filter(v => v.price < 25000).length,
          '25k-35k': vehicles.filter(v => v.price >= 25000 && v.price < 35000).length,
          '35k-50k': vehicles.filter(v => v.price >= 35000 && v.price < 50000).length,
          over50k: vehicles.filter(v => v.price >= 50000).length
        }
      };

      // Group by vehicle type
      for (const vehicle of vehicles) {
        if (!summary.byType[vehicle.type]) {
          summary.byType[vehicle.type] = 0;
        }
        summary.byType[vehicle.type]++;
      }

      return summary;

    } catch (error) {
      console.error('❌ Error getting dealer inventory summary:', error);
      return null;
    }
  }

  /**
   * Update vehicle availability
   */
  async updateVehicleAvailability(vehicleId, inStock, quantity = null) {
    try {
      const vehicle = this.inventory.get(vehicleId);
      if (!vehicle) {
        throw new Error(`Vehicle ${vehicleId} not found`);
      }

      vehicle.inStock = inStock;
      if (quantity !== null) {
        vehicle.quantity = quantity;
      }

      vehicle.lastUpdated = new Date();
      this.lastUpdate = new Date();

      console.log(`✅ Updated ${vehicle.name} availability: ${inStock ? 'In Stock' : 'Out of Stock'}`);
      return true;

    } catch (error) {
      console.error('❌ Error updating vehicle availability:', error);
      return false;
    }
  }

  /**
   * Get luxury vehicles (over $50,000 or premium brands)
   */
  getLuxuryVehicles(budget = null) {
    try {
      const luxuryBrands = ['Acura', 'Lexus', 'Genesis', 'Land Rover', 'Mercedes-Benz', 'BMW', 'Audi', 'Porsche', 'Ferrari', 'Tesla'];
      const luxuryPriceThreshold = 50000;
      
      let vehicles = Array.from(this.inventory.values());
      
      // Filter for luxury vehicles (either premium brands or high price)
      vehicles = vehicles.filter(v => 
        (v.make && luxuryBrands.includes(v.make)) || 
        (v.price && v.price >= luxuryPriceThreshold)
      );
      
      // Apply budget filter if specified
      if (budget && budget > 0) {
        vehicles = vehicles.filter(v => v.price && v.price <= budget);
      }
      
      // Only include in-stock vehicles
      vehicles = vehicles.filter(v => v.inStock);
      
      // Sort by price (highest first for luxury)
      vehicles.sort((a, b) => b.price - a.price);
      
      console.log(`🔍 Luxury vehicle search: Found ${vehicles.length} luxury vehicles`);
      if (vehicles.length > 0) {
        console.log(`🔍 Sample luxury vehicles:`, vehicles.slice(0, 3).map(v => `${v.make} ${v.model} - $${v.price}`));
      }
      
      return vehicles;
      
    } catch (error) {
      console.error('❌ Error getting luxury vehicles:', error);
      return [];
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.inventory.size > 0,
      totalVehicles: this.inventory.size,
      lastUpdate: this.lastUpdate,
      dealers: Array.from(this.dealerInventories.keys())
    };
  }

  // Enhanced search functions for comprehensive scenarios
  
  // Stock number lookup
  async searchByStockNumber(stockNumber, dealerId = null) {
    console.log('🔍 Searching by stock number:', stockNumber, 'for dealer:', dealerId);
    
    if (!stockNumber) return [];
    
    const results = [];
    for (const v of this.inventory.values()) {
      if (!v.inStock) continue;
      if (dealerId && v.dealerId !== dealerId) continue;
      
      // Check various stock number fields
      const vehicleStockNumber = v.stockNumber || v.stock_number || v.stockId || v.stock_id || v.id;
      const locationStockNumber = v.location ? v.location.replace(/Stock\s*#?\s*/i, '') : null;
      
      if ((vehicleStockNumber && String(vehicleStockNumber).includes(String(stockNumber))) ||
          (locationStockNumber && String(locationStockNumber).includes(String(stockNumber)))) {
        results.push(v);
      }
    }
    
    console.log('🔍 Stock number search found:', results.length, 'vehicles');
    return results;
  }
  
  // Make/Model specific search with enhanced matching
  async searchByMakeModel(make, model, dealerId = null, options = {}) {
    console.log('🔍 Searching by make/model:', make, model, 'for dealer:', dealerId);
    
    const results = [];
    const wantMake = make ? String(make).trim().toLowerCase() : null;
    const wantModel = model ? String(model).trim().toLowerCase() : null;
    
    for (const v of this.inventory.values()) {
      if (!v.inStock) continue;
      if (dealerId && v.dealerId !== dealerId) continue;
      
      const vehicleMake = String(v.make || '').toLowerCase();
      const vehicleModel = String(v.model || '').toLowerCase();
      
      // Exact make match
      if (wantMake && vehicleMake !== wantMake) continue;
      
      // Enhanced model matching (exact, contains, or fuzzy)
      if (wantModel) {
        const exactMatch = vehicleModel === wantModel;
        const containsMatch = vehicleModel.includes(wantModel) || wantModel.includes(vehicleModel);
        const fuzzyMatch = this.fuzzyMatch(vehicleModel, wantModel);
        
        if (!exactMatch && !containsMatch && !fuzzyMatch) continue;
      }
      
      results.push(v);
    }
    
    console.log('🔍 Make/Model search found:', results.length, 'vehicles');
    return results;
  }
  
  // Fuzzy matching for model names
  fuzzyMatch(str1, str2, threshold = 0.7) {
    const s1 = String(str1).toLowerCase();
    const s2 = String(str2).toLowerCase();
    
    // Simple similarity check
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length >= threshold;
  }
  
  // Levenshtein distance for fuzzy matching
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Filter out empty values to prevent "any" searches in inventory queries
   * CRITICAL: This prevents empty values from being used in inventory searches
   */
  filterEmptyValue(value) {
    if (value === null || value === undefined || value === '' || value === 'any' || value === 'any color' || value === 'any model' || value === 'any make') {
      return null;
    }
    return value;
  }

  /**
   * Filter out empty arrays to prevent "any" searches in inventory queries
   */
  filterEmptyArray(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      return null;
    }
    // Filter out empty values from array
    const filtered = arr.filter(item => this.filterEmptyValue(item) !== null);
    return filtered.length > 0 ? filtered : null;
  }
  
  // Multi-criteria search for complex queries with enhanced array support
  async searchMultiCriteria(criteria = {}) {
    console.log('🔍 Multi-criteria search with:', criteria);
    
    const {
      make = null,
      model = null,
      models = null, // NEW: Support multiple models array
      vehicleType = null,
      budget = null,
      minYear = null,
      maxYear = null,
      features = [],
      color = null,
      condition = null,
      dealerId = null,
      lowMileage = false,
      newArrivals = false,
      luxury = false,
      family = false,
      limit = 10,
      preferredMakes = null, // Support multiple makes
      vehicleOptions = null // NEW: Support journey tracker vehicle options
    } = criteria;
    
    // Initialize results array
    let results = [];
    
    // Handle multiple makes if provided
    if (preferredMakes && preferredMakes.length > 0) {
      console.log('🔍 Searching for multiple makes:', preferredMakes);
      for (const makeToSearch of preferredMakes) {
        const makeResults = await this.searchVehiclesUnified({
          make: this.filterEmptyValue(makeToSearch),
          model: this.filterEmptyValue(model),
          vehicleType: this.filterEmptyValue(vehicleType),
          budget: this.filterEmptyValue(budget),
          minYear: this.filterEmptyValue(minYear),
          features: this.filterEmptyArray(features) || [],
          color: this.filterEmptyValue(color),
          dealerId,
          limit: Math.ceil(limit * 2 / preferredMakes.length) // Distribute limit across makes
        });
        results = results.concat(makeResults);
      }
    } else {
      // Start with unified search for single make
      results = await this.searchVehiclesUnified({
        make: this.filterEmptyValue(make),
        model: this.filterEmptyValue(model),
        vehicleType: this.filterEmptyValue(vehicleType),
        budget: this.filterEmptyValue(budget),
        minYear: this.filterEmptyValue(minYear),
        features: this.filterEmptyArray(features) || [],
        color: this.filterEmptyValue(color),
        dealerId,
        limit: limit * 2 // Get more results for additional filtering
      });
    }
    
    // Apply additional filters
    if (maxYear) {
      results = results.filter(v => typeof v.year === 'number' && v.year <= maxYear);
    }
    
    if (lowMileage) {
      results = results.filter(v => typeof v.mileage === 'number' && v.mileage < 50000);
      // Sort by mileage ascending
      results.sort((a, b) => (a.mileage || 0) - (b.mileage || 0));
    }
    
    if (newArrivals) {
      // Sort by year descending (newest first)
      results.sort((a, b) => (b.year || 0) - (a.year || 0));
    }
    
    if (luxury) {
      // Filter for luxury brands
      const luxuryBrands = ['bmw', 'mercedes', 'audi', 'lexus', 'acura', 'infiniti', 'cadillac', 'lincoln', 'volvo', 'jaguar', 'land rover', 'range rover', 'porsche', 'ferrari', 'lamborghini', 'maserati', 'aston martin', 'bentley', 'rolls royce'];
      results = results.filter(v => luxuryBrands.includes(String(v.make || '').toLowerCase()));
    }
    
    if (family) {
      // Filter for family-friendly vehicles
      const familyTypes = ['suv', 'minivan', 'van', 'sedan', 'wagon'];
      results = results.filter(v => familyTypes.includes(String(v.type || '').toLowerCase()));
    }
    
    if (condition) {
      // Filter by vehicle condition using database values (N = New, U = Used) - OPTIONAL
      const conditionFiltered = results.filter(v => {
        if (condition === 'new') {
          return v.condition === 'N' || v.condition === 'new';
        } else if (condition === 'pre-owned' || condition === 'used') {
          return v.condition === 'U' || v.condition === 'used' || v.condition === 'pre-owned';
        }
        return true;
      });
      
      // Only apply condition filter if it returns results, otherwise keep original results
      if (conditionFiltered.length > 0) {
        results = conditionFiltered;
        console.log(`🔍 Condition filter (${condition}) applied: ${results.length} vehicles remaining`);
      } else {
        console.log(`⚠️ No ${condition} vehicles found - keeping all ${results.length} vehicles (condition treated as optional)`);
      }
    }
    
    // Apply limit
    if (limit && results.length > limit) {
      results = results.slice(0, limit);
    }
    
    console.log('🔍 Multi-criteria search found:', results.length, 'vehicles');
    return results;
  }
  
  // Color-specific search
  async searchByColor(color, dealerId = null) {
    console.log('🔍 Searching by color:', color, 'for dealer:', dealerId);
    
    const results = [];
    const wantColor = color ? String(color).trim().toLowerCase() : null;
    
    if (!wantColor) return results;
    
    for (const v of this.inventory.values()) {
      if (!v.inStock) continue;
      if (dealerId && v.dealerId !== dealerId) continue;
      
      const vehicleColor = Array.isArray(v.colors) ? v.colors[0] : v.color || (v.colors || [])[0];
      if (!vehicleColor) continue;
      
      const vc = String(vehicleColor).toLowerCase();
      
      // Exact color match
      if (vc === wantColor) {
        results.push(v);
        continue;
      }
      
      // Color group matching
      if (wantColor === 'light') {
        const lightColors = ['white', 'silver', 'beige', 'champagne', 'pearl', 'cream', 'ivory', 'light gray', 'light grey', 'gold'];
        if (lightColors.some(c => vc.includes(c))) {
          results.push(v);
        }
      } else if (wantColor === 'dark') {
        const darkColors = ['black', 'blue', 'navy', 'dark blue', 'charcoal', 'dark gray', 'dark grey', 'maroon', 'burgundy', 'brown', 'green'];
        if (darkColors.some(c => vc.includes(c))) {
          results.push(v);
        }
      } else if (vc.includes(wantColor) || wantColor.includes(vc)) {
        results.push(v);
      }
    }
    
    console.log('🔍 Color search found:', results.length, 'vehicles');
    return results;
  }
  
  // Year range search
  async searchByYearRange(minYear, maxYear, dealerId = null) {
    console.log('🔍 Searching by year range:', minYear, '-', maxYear, 'for dealer:', dealerId);
    
    const results = [];
    
    for (const v of this.inventory.values()) {
      if (!v.inStock) continue;
      if (dealerId && v.dealerId !== dealerId) continue;
      
      const year = v.year;
      if (typeof year !== 'number') continue;
      
      if (minYear && year < minYear) continue;
      if (maxYear && year > maxYear) continue;
      
      results.push(v);
    }
    
    // Sort by year descending (newest first)
    results.sort((a, b) => (b.year || 0) - (a.year || 0));
    
    console.log('🔍 Year range search found:', results.length, 'vehicles');
    return results;
  }
  
  // Inventory count by dealer
  async getInventoryCount(dealerId = null) {
    console.log('🔍 Getting inventory count for dealer:', dealerId);
    
    let count = 0;
    for (const v of this.inventory.values()) {
      if (!v.inStock) continue;
      if (dealerId && v.dealerId !== dealerId) continue;
      count++;
    }
    
    console.log('🔍 Inventory count:', count, 'vehicles');
    return count;
  }

  /**
   * Fast criteria-based count using pre-built search indexes (Set intersections).
   * No full-scan — narrows by dealer → type → make, then price-filters the small remainder.
   * Returns { count, lowestPrice } where lowestPrice is the cheapest vehicle matching
   * type+make (ignoring budget), so the caller can say "starts from $X" when count=0.
   */
  getInventoryCountByCriteria(dealerId, criteria = {}) {
    const { vehicleType, make, model, budget, condition } = criteria;

    // Start from dealer's vehicle ID set
    let ids = dealerId
      ? new Set(this.searchIndexes.byDealer.get(dealerId) || [])
      : new Set(this.inventory.keys());

    if (ids.size === 0) return { count: 0, lowestPrice: null };

    // Intersect with type index (vehicle.type stores the indexed value)
    if (vehicleType) {
      const typeIds = this.searchIndexes.byType.get(vehicleType.toLowerCase()) || new Set();
      ids = new Set([...ids].filter(id => typeIds.has(id)));
    }

    // Intersect with make index
    if (make) {
      const makeIds = this.searchIndexes.byMake.get(make.toLowerCase()) || new Set();
      ids = new Set([...ids].filter(id => makeIds.has(id)));
    }

    // Intersect with model index
    if (model) {
      const modelIds = this.searchIndexes.byModel.get(model.toLowerCase()) || new Set();
      ids = new Set([...ids].filter(id => modelIds.has(id)));
    }

    if (ids.size === 0) return { count: 0, lowestPrice: null };

    // Find lowest price across remaining candidates (ignore budget for lowest price)
    let lowestPrice = Infinity;
    for (const id of ids) {
      const v = this.inventory.get(id);
      if (v?.inStock && v.price > 0 && v.price < lowestPrice) lowestPrice = v.price;
    }
    lowestPrice = lowestPrice === Infinity ? null : lowestPrice;

    // Now apply budget + condition filter to get the actual count
    let count = 0;
    for (const id of ids) {
      const v = this.inventory.get(id);
      if (!v?.inStock) continue;
      if (budget && v.price > Number(budget)) continue;
      if (condition) {
        const vc = (v.condition || '').toLowerCase();
        if (condition.toLowerCase().startsWith('n') && !vc.startsWith('n')) continue; // new only
        if (/used|pre.?owned/i.test(condition) && vc.startsWith('n'))       continue; // used only
      }
      count++;
    }

    console.log(`🔢 [INDEX COUNT] type=${vehicleType} make=${make} budget=${budget} → count=${count} lowestPrice=${lowestPrice}`);
    return { count, lowestPrice };
  }

  // New arrivals (recent vehicles)
  async getNewArrivals(dealerId = null, days = 30) {
    console.log('🔍 Getting new arrivals for dealer:', dealerId, 'within', days, 'days');
    
    const results = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    for (const v of this.inventory.values()) {
      if (!v.inStock) continue;
      if (dealerId && v.dealerId !== dealerId) continue;
      
      // Check if vehicle is recent (based on year or arrival date)
      const vehicleYear = v.year || 0;
      const currentYear = new Date().getFullYear();
      
      if (vehicleYear >= currentYear - 1) {
        results.push(v);
      }
    }
    
    // Sort by year descending (newest first)
    results.sort((a, b) => (b.year || 0) - (a.year || 0));
    
    console.log('🔍 New arrivals found:', results.length, 'vehicles');
    return results;
  }

  // Helper: Deduplicate results to avoid duplicate vehicles
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(vehicle => {
      const key = `${vehicle.make}-${vehicle.model}-${vehicle.year}-${vehicle.stockNumber}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * OPTIMIZED: Color categorization method (replaces slotManager dependency)
   * Categorizes vehicle colors into light/dark categories for optimized array structure
   */
  categorizeColorOptimized(color) {
    if (!color) return 'light';
    
    const colorStr = String(color).toLowerCase().trim();
    
    // Light colors
    const lightColors = [
      'white', 'silver', 'beige', 'champagne', 'pearl', 'cream', 'ivory', 
      'light gray', 'light grey', 'gold', 'platinum', 'blonde', 'sand', 
      'champagne', 'pearl white', 'metallic silver', 'titanium'
    ];
    
    // Dark colors
    const darkColors = [
      'black', 'blue', 'navy', 'dark blue', 'charcoal', 'dark gray', 
      'dark grey', 'maroon', 'burgundy', 'brown', 'green', 'forest green',
      'midnight', 'onyx', 'ebony', 'jet black', 'deep blue', 'royal blue'
    ];
    
    // Check for light colors
    if (lightColors.some(lightColor => colorStr.includes(lightColor) || lightColor.includes(colorStr))) {
      return 'light';
    }
    
    // Check for dark colors
    if (darkColors.some(darkColor => colorStr.includes(darkColor) || darkColor.includes(colorStr))) {
      return 'dark';
    }
    
  // Default to light for unknown colors
  return 'light';
  }

  /**
   * ✅ NEW: Get minimum price for specific vehicle criteria from actual inventory
   * This prevents infinite budget increase loops by providing real minimum prices
   */
  async getMinimumPriceForCriteria(criteria = {}) {
    try {
      console.log('🔍 Getting minimum price for criteria:', criteria);
      
      const {
        make = null,
        model = null,
        vehicleType = null,
        condition = null,
        colorTone = null,
        dealerId = null
      } = criteria;

      let matchingVehicles = [];

      // Search through inventory for vehicles matching criteria
      for (const [key, vehicle] of this.inventory) {
        if (!vehicle.inStock) continue;

        // Check make match
        if (make && vehicle.make.toLowerCase() !== make.toLowerCase()) continue;
        
        // Check model match
        if (model && vehicle.model.toLowerCase() !== model.toLowerCase()) continue;
        
        // Check vehicle type match
        if (vehicleType && vehicle.type.toLowerCase() !== vehicleType.toLowerCase()) continue;
        
        // Check condition match
        if (condition && vehicle.condition && vehicle.condition.toLowerCase() !== condition.toLowerCase()) continue;
        
        // Check color tone match
        if (colorTone && colorTone !== 'any color') {
          const vehicleColorTone = this.categorizeColorTone(vehicle.color);
          if (vehicleColorTone !== colorTone) continue;
        }
        
        // Check dealer match
        if (dealerId && vehicle.dealerId !== dealerId) continue;

        matchingVehicles.push(vehicle);
      }

      if (matchingVehicles.length === 0) {
        console.log('❌ No vehicles found matching criteria');
        return null;
      }

      // Sort by price and get minimum
      matchingVehicles.sort((a, b) => a.price - b.price);
      const minimumPrice = matchingVehicles[0].price;
      
      console.log(`✅ Found minimum price: $${minimumPrice.toLocaleString()} for ${matchingVehicles.length} matching vehicles`);
      console.log(`   Cheapest vehicle: ${matchingVehicles[0].make} ${matchingVehicles[0].model} - $${matchingVehicles[0].price}`);
      
      return {
        minimumPrice,
        vehicleCount: matchingVehicles.length,
        cheapestVehicle: matchingVehicles[0],
        allPrices: matchingVehicles.map(v => v.price).slice(0, 5) // First 5 prices for context
      };

    } catch (error) {
      console.error('❌ Error getting minimum price for criteria:', error);
      return null;
    }
  }

  /**
   * ✅ NEW: Get minimum price for vehicle type (SUV, sedan, etc.) from actual inventory
   */
  async getMinimumPriceForVehicleType(vehicleType, dealerId = null) {
    return await this.getMinimumPriceForCriteria({
      vehicleType,
      dealerId
    });
  }

  /**
   * ✅ NEW: Get minimum price for specific make/model from actual inventory
   */
  async getMinimumPriceForMakeModel(make, model, dealerId = null) {
    return await this.getMinimumPriceForCriteria({
      make,
      model,
      dealerId
    });
  }

  /**
   * Get a compact dealer inventory summary from in-memory data.
   * This is derived from the already-initialized `this.inventory` Map and does NOT
   * run any DB queries. Intended for LLM grounding + "what do you carry?" questions.
   *
   * @param {string|null} dealerId
   * @param {{ maxMakes?: number, maxModelsPerMake?: number, maxTypes?: number }} [opts]
   * @returns {{
   *   dealerId: string|null,
   *   totalInStock: number,
   *   makes: string[],
   *   types: string[],
   *   modelsByMake: Record<string, string[]>,
   *   updatedAt: string
   * }}
   */
  getDealerInventorySummary(dealerId = null, opts = {}) {
    const { maxMakes = 12, maxModelsPerMake = 8, maxTypes = 12 } = opts || {};

    const makeCounts = new Map();          // makeLower -> count
    const typeCounts = new Map();          // typeLower -> count
    const modelsByMake = new Map();        // makeLower -> Map(modelLower -> count)
    let totalInStock = 0;

    for (const [, v] of this.inventory) {
      if (!v?.inStock) continue;
      if (dealerId && v.dealerId && v.dealerId !== dealerId) continue;

      totalInStock++;

      const makeLower = (v.make || 'unknown').toLowerCase();
      const modelLower = (v.model || 'unknown').toLowerCase();
      const typeLower =
        (v.type || v.vehicle_type || v.vehicleType || v.category || 'vehicle').toLowerCase();

      makeCounts.set(makeLower, (makeCounts.get(makeLower) || 0) + 1);
      typeCounts.set(typeLower, (typeCounts.get(typeLower) || 0) + 1);

      if (!modelsByMake.has(makeLower)) modelsByMake.set(makeLower, new Map());
      const mm = modelsByMake.get(makeLower);
      mm.set(modelLower, (mm.get(modelLower) || 0) + 1);
    }

    const makes = [...makeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxMakes)
      .map(([m]) => m);

    const types = [...typeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxTypes)
      .map(([t]) => t);

    const modelsByMakeOut  = {};  // make -> [model, ...]  (sorted by count, top N)
    const modelCountsOut   = {};  // make -> { model: count }
    const makeCountsOut    = {};  // make -> count

    for (const makeLower of makes) {
      const mm = modelsByMake.get(makeLower) || new Map();
      const sortedModels = [...mm.entries()].sort((a, b) => b[1] - a[1]);
      const topModels    = sortedModels.slice(0, maxModelsPerMake);

      modelsByMakeOut[makeLower] = topModels.map(([model]) => model);

      // per-model count map
      modelCountsOut[makeLower] = {};
      for (const [model, cnt] of topModels) {
        modelCountsOut[makeLower][model] = cnt;
      }

      makeCountsOut[makeLower] = makeCounts.get(makeLower) || 0;
    }

    // also expose type counts
    const typeCountsOut = {};
    for (const [t, cnt] of typeCounts) typeCountsOut[t] = cnt;

    return {
      dealerId:    dealerId || null,
      totalInStock,
      makes,
      types,
      modelsByMake:  modelsByMakeOut,
      modelCounts:   modelCountsOut,   // { hyundai: { tucson: 12, elantra: 8 } }
      makeCounts:    makeCountsOut,    // { hyundai: 32, kia: 18 }
      typeCounts:    typeCountsOut,    // { suv: 40, sedan: 20 }
      updatedAt:   new Date().toISOString()
    };
  }
}

export default InventoryService;
