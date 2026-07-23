// NLP Integration for DAIVE CrewAI
// This file shows how to integrate NLP-enhanced slot extraction into the existing system

import NLPEnhancedSlotExtraction from './nlpEnhancedSlotExtraction.js';

/**
 * Enhanced extractSlotsFromMessage with NLP integration
 * This replaces the original method in daivecrewai.js
 */
export class NLPEnhancedDAIVEService {
  constructor(openaiApiKey, dealerId = null) {
    this.openaiApiKey = openaiApiKey;
    this.dealerId = dealerId;
    
    // Initialize NLP-enhanced slot extraction
    this.nlpSlotExtraction = new NLPEnhancedSlotExtraction(openaiApiKey);
    
    // Performance tracking
    this.extractionStats = {
      totalExtractions: 0,
      nlpExtractions: 0,
      ruleBasedExtractions: 0,
      averageResponseTime: 0
    };
  }

  /**
   * NLP-Enhanced Slot Extraction Method
   * This is the main method that should replace extractSlotsFromMessage
   */
  async extractSlotsFromMessage(userMessage, intentResult, conversationContext = {}) {
    const startTime = performance.now();
    this.extractionStats.totalExtractions++;

    try {
      console.log('🧠 Starting NLP-enhanced slot extraction...');
      
      // Use the NLP-enhanced extraction system
      const extractedSlots = await this.nlpSlotExtraction.extractSlotsFromMessage(
        userMessage, 
        intentResult, 
        conversationContext
      );
      
      // Track performance
      const responseTime = performance.now() - startTime;
      this.updateExtractionStats(responseTime, 'nlp');
      
      console.log(`✅ NLP extraction completed in ${responseTime.toFixed(2)}ms`);
      console.log('📊 Extracted slots:', extractedSlots);
      
      return extractedSlots;
      
    } catch (error) {
      console.warn('⚠️ NLP extraction failed, using rule-based fallback:', error.message);
      
      // Fallback to rule-based extraction
      const fallbackSlots = this.extractSlotsFromMessageRuleBased(userMessage, intentResult, conversationContext);
      
      const responseTime = performance.now() - startTime;
      this.updateExtractionStats(responseTime, 'rule-based');
      
      return fallbackSlots;
    }
  }

  /**
   * Rule-based fallback extraction (simplified version of original)
   * This provides a safety net when NLP extraction fails
   */
  extractSlotsFromMessageRuleBased(userMessage, intentResult, conversationContext) {
    const slots = {};
    const message = userMessage.toLowerCase();
    const extractedInfo = intentResult.extracted_info || {};

    // Basic buyer profile detection
    if (message.includes('first time') || message.includes('first-time')) {
      slots.buyer_profile = { ...slots.buyer_profile, first_time: true };
    }
    
    if (message.includes('family') || message.includes('kids')) {
      slots.buyer_profile = { ...slots.buyer_profile, family: true };
      slots.goal = 'mixed';
    }
    
    if (message.includes('cheapest') || message.includes('budget')) {
      slots.buyer_profile = { ...slots.buyer_profile, budget_shopper: true };
      slots.goal = 'budget_conscious';
    }

    // Basic vehicle type detection
    if (message.includes('suv') || message.includes('crossover')) {
      slots.vehicle_type = 'SUV';
    } else if (message.includes('truck') || message.includes('pickup')) {
      slots.vehicle_type = 'truck';
    } else if (message.includes('car') || message.includes('sedan')) {
      slots.vehicle_type = 'car';
    }

    // Basic make detection
    if (message.includes('hyundai')) {
      slots.make = 'Hyundai';
    } else if (message.includes('honda')) {
      slots.make = 'Honda';
    } else if (message.includes('toyota')) {
      slots.make = 'Toyota';
    }

    // Basic budget extraction
    const priceMatch = message.match(/\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:k|thousand)?/);
    if (priceMatch) {
      let price = parseFloat(priceMatch[1].replace(/,/g, ''));
      if (message.includes('k') || message.includes('thousand')) {
        price *= 1000;
      }
      
      if (message.includes('monthly') || message.includes('payment')) {
        slots.budget = { ...slots.budget, monthly: price };
      } else {
        slots.budget = { ...slots.budget, target_price: price };
      }
    }

    // Basic feature detection
    const features = [];
    if (message.includes('backup camera')) features.push('backup camera');
    if (message.includes('safety')) features.push('safety features');
    if (message.includes('leather')) features.push('leather seats');
    if (message.includes('moonroof')) features.push('moonroof');
    
    if (features.length > 0) {
      slots.features = features;
    }

    // Basic color detection
    if (message.includes('white') || message.includes('light')) {
      slots.color_tone = 'light';
    } else if (message.includes('black') || message.includes('dark')) {
      slots.color_tone = 'dark';
    }

    return slots;
  }

  /**
   * Update extraction statistics
   */
  updateExtractionStats(responseTime, method) {
    if (method === 'nlp') {
      this.extractionStats.nlpExtractions++;
    } else {
      this.extractionStats.ruleBasedExtractions++;
    }

    // Update average response time
    const total = this.extractionStats.totalExtractions;
    const currentAvg = this.extractionStats.averageResponseTime;
    this.extractionStats.averageResponseTime = ((currentAvg * (total - 1)) + responseTime) / total;
  }

  /**
   * Get extraction performance statistics
   */
  getExtractionStats() {
    return {
      ...this.extractionStats,
      nlpAccuracy: this.extractionStats.totalExtractions > 0 
        ? (this.extractionStats.nlpExtractions / this.extractionStats.totalExtractions) * 100 
        : 0,
      ruleBasedAccuracy: this.extractionStats.totalExtractions > 0 
        ? (this.extractionStats.ruleBasedExtractions / this.extractionStats.totalExtractions) * 100 
        : 0
    };
  }

  /**
   * Clear extraction cache
   */
  clearExtractionCache() {
    this.nlpSlotExtraction.clearCache();
    console.log('🧹 Extraction cache cleared');
  }
}

/**
 * Integration helper function
 * Use this to easily integrate NLP extraction into existing code
 */
export function integrateNLPSlotExtraction(daiveService, openaiApiKey) {
  // Add NLP extraction to the service
  daiveService.nlpSlotExtraction = new NLPEnhancedSlotExtraction(openaiApiKey);
  
  // Store original method
  const originalExtractSlots = daiveService.extractSlotsFromMessage.bind(daiveService);
  
  // Replace with NLP-enhanced version
  daiveService.extractSlotsFromMessage = async function(userMessage, intentResult, conversationContext) {
    try {
      // Try NLP extraction first
      const nlpSlots = await this.nlpSlotExtraction.extractSlotsFromMessage(
        userMessage, 
        intentResult, 
        conversationContext
      );
      
      console.log('🧠 NLP extraction successful');
      return nlpSlots;
      
    } catch (error) {
      console.warn('⚠️ NLP extraction failed, using original method:', error.message);
      
      // Fallback to original method
      return originalExtractSlots(userMessage, intentResult, conversationContext);
    }
  };
  
  console.log('✅ NLP slot extraction integrated successfully');
  return daiveService;
}

/**
 * Test function to validate NLP integration
 */
export async function testNLPIntegration(daiveService) {
  console.log('🧪 Testing NLP integration...');
  
  const testMessages = [
    "I'm a first-time buyer looking for a family SUV under $40k",
    "Trading in my 2018 Honda Civic for something newer",
    "Need a work truck for heavy loads, budget around $35k",
    "Looking for a reliable car for my college student",
    "Want a luxury sedan with all the latest features"
  ];
  
  const results = [];
  
  for (const message of testMessages) {
    console.log(`\n🔍 Testing: "${message}"`);
    
    try {
      const intentResult = { intent: 'general_inquiry', confidence: 0.9, extracted_info: {} };
      const extractedSlots = await daiveService.extractSlotsFromMessage(message, intentResult, {});
      
      results.push({
        message,
        slots: extractedSlots,
        success: true
      });
      
      console.log('✅ Success:', Object.keys(extractedSlots).length, 'slots extracted');
      
    } catch (error) {
      console.error('❌ Failed:', error.message);
      results.push({
        message,
        error: error.message,
        success: false
      });
    }
  }
  
  // Summary
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log(`\n📊 Test Results: ${successCount}/${totalCount} successful (${Math.round((successCount/totalCount)*100)}%)`);
  
  // Show stats
  if (daiveService.getExtractionStats) {
    const stats = daiveService.getExtractionStats();
    console.log('📈 Performance Stats:', stats);
  }
  
  return results;
}

export default NLPEnhancedDAIVEService;
