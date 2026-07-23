// NLP-Enhanced Slot Extraction for DAIVE
// This module provides AI-powered slot extraction with semantic understanding

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';

class NLPEnhancedSlotExtraction {
  constructor(openaiApiKey, options = {}) {
    this.llm = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName: options.modelName || 'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 150, // 🔧 Increased for complete JSON responses
      timeout: 8000   // 🚀 Increased timeout for complete responses
    });

    this.embeddings = new OpenAIEmbeddings({ openAIApiKey: openaiApiKey });
    this.vectorStore = null;
    this.extractionCache = new Map();

    this.performanceStats = {
      totalExtractions: 0,
      nlpExtractions: 0,
      ruleBasedExtractions: 0,
      averageResponseTime: 0,
      cacheHits: 0,
      aiTimeouts: 0,
      aiErrors: 0
    };

    this.aiFirstMode = options.aiFirstMode ?? true;     // 🤖 AI first, rules as fallback
    this.useVectorStore = options.useVectorStore ?? false;
    this.maxRetries = options.maxRetries ?? 1;          // 🔄 Retry failed AI calls
    if (this.useVectorStore) this.initializeVectorStore();
  }

  async initializeVectorStore() {
    try {
      this.vectorStore = new MemoryVectorStore(this.embeddings);
      console.log('✅ Vector store initialized');
    } catch (err) {
      console.warn('⚠️ Vector store failed:', err.message);
    }
  }

  async extractSlotsFromMessage(userMessage, intentResult, conversationContext = {}) {
    const start = performance.now();
    const cacheKey = this.generateCacheKey(userMessage, conversationContext);
    this.performanceStats.totalExtractions++;

    if (this.extractionCache.has(cacheKey)) {
      this.performanceStats.cacheHits++;
      return this.extractionCache.get(cacheKey);
    }

    let extractedSlots = {};
    let aiSuccess = false;

    // 🤖 AI-FIRST: Try AI extraction first for comprehensive results
    if (this.aiFirstMode) {
      try {
        console.log('🧠 Using AI-powered slot extraction...');
        const aiSlots = await this.extractSlotsWithAI(userMessage, intentResult, conversationContext);
        if (aiSlots && Object.keys(aiSlots).length > 0) {
          extractedSlots = { ...extractedSlots, ...aiSlots };
          this.performanceStats.nlpExtractions++;
          aiSuccess = true;
          console.log('✅ AI extraction successful');
        }
      } catch (err) {
        console.warn('⚠️ AI extraction failed, using rule-based fallback:', err.message);
        this.performanceStats.aiErrors++;
        
        // Retry once if configured
        if (this.maxRetries > 0) {
          try {
            console.log('🔄 Retrying AI extraction...');
            const retrySlots = await this.extractSlotsWithAI(userMessage, intentResult, conversationContext);
            if (retrySlots && Object.keys(retrySlots).length > 0) {
              extractedSlots = { ...extractedSlots, ...retrySlots };
              this.performanceStats.nlpExtractions++;
              aiSuccess = true;
              console.log('✅ AI retry successful');
            }
          } catch (retryErr) {
            console.warn('⚠️ AI retry failed:', retryErr.message);
          }
        }
      }
    }

    // 🔧 RULE-BASED FALLBACK: Only if AI failed or not in AI-first mode
    if (!aiSuccess) {
      console.log('🔧 Using rule-based slot extraction fallback...');
      const ruleSlots = await this.extractSlotsWithRules(userMessage, intentResult, conversationContext);
      extractedSlots = { ...extractedSlots, ...ruleSlots };
      this.performanceStats.ruleBasedExtractions++;
    }

    // 🔁 Context-aware enhancement removed for performance

    this.extractionCache.set(cacheKey, extractedSlots);

    const end = performance.now();
    const rt = end - start;
    const total = this.performanceStats.totalExtractions;
    this.performanceStats.averageResponseTime =
      ((this.performanceStats.averageResponseTime * (total - 1)) + rt) / total;

    return extractedSlots;
  }

  async extractSlotsWithAI(userMessage, intentResult, conversationContext = {}) {
    const currentStep = conversationContext.currentJourneyStep || 'inquiry';
    
    // Route to stage-specific extraction methods
    switch (currentStep) {
      case 'qualification':
        return await this.extractQualificationSlotsWithAI(userMessage, intentResult, conversationContext);
      
      case 'purchase_commitment':
        return await this.extractPurchaseCommitmentSlotsWithAI(userMessage, intentResult, conversationContext);
      
      default: // inquiry, vehicle_selection, test_drive, trade_evaluation
        return await this.extractVehicleSelectionSlotsWithAI(userMessage, intentResult, conversationContext);
    }
  }

  /**
   * ✅ VEHICLE SELECTION EXTRACTION (Stages 1-3)
   * Handles: vehicle preferences, budget, make/model, inventory selection
   * Only runs for: inquiry, vehicle_selection, test_drive, trade_evaluation
   */
  async extractVehicleSelectionSlotsWithAI(userMessage, intentResult, conversationContext = {}) {
    // AI-powered NLP handles all typos intelligently - no preprocessing needed
    const normalizedMessage = userMessage;
    
    // 🚀 NEW: Get dynamic inventory context for AI
    let inventoryContext = '';
    if (conversationContext.dealerId) {
      try {
        const inventoryService = global.inventoryService || this.inventoryService;
        if (inventoryService) {
          const cacheData = await inventoryService.getCachedMakesAndModels(conversationContext.dealerId);
          if (cacheData && cacheData.makes && cacheData.modelsByMake) {
            const availableMakes = cacheData.makes.slice(0, 10).map(make => 
              make.charAt(0).toUpperCase() + make.slice(1)
            ).join(', ');
            
            const availableModels = Object.entries(cacheData.modelsByMake)
              .slice(0, 5)
              .map(([make, models]) => {
                const capitalizedMake = make.charAt(0).toUpperCase() + make.slice(1);
                const modelList = models.slice(0, 5).map(model => 
                  model.charAt(0).toUpperCase() + model.slice(1)
                ).join(', ');
                return `${capitalizedMake}: ${modelList}`;
              }).join('; ');
            
            inventoryContext = `\n\nAVAILABLE INVENTORY CONTEXT:\nAvailable Makes: ${availableMakes}\nAvailable Models: ${availableModels}\n\nIMPORTANT: Only extract makes and models that exist in the available inventory above. If a make/model is not listed, do not extract it.`;
          }
        }
      } catch (err) {
        console.warn('⚠️ Could not get inventory context for AI:', err.message);
      }
    }
    
    const systemPrompt = `Extract car dealership information from customer messages. Return ONLY valid JSON.

REQUIRED FIELDS (extract if mentioned):
1. VEHICLE_CONDITION: "new", "pre-owned", "used", "certified"
2. VEHICLE_TYPE: "SUV", "car", "truck", "sedan", "hatchback", "crossover", "coupe", "convertible", "van", "minivan"
   - Map "car", "family car", "family vehicle", "family", "regular car" to "sedan" (will be normalized automatically)  
3. MAKE: Extract only if mentioned and it exists in available inventory
4. MODEL: Extract only if mentioned and it exists in available inventory
   - CRITICAL: For comparison questions (e.g., "compare X and Y"), DO NOT extract make/model as customer preferences
   - Only extract make/model when customer is expressing interest in purchasing/viewing a specific vehicle
   - If message contains "compare", "comparison", "between", "vs", "versus", DO NOT extract make/model
5. BUDGET: Extract numbers as target_price or max_price with comprehensive patterns
   - "25k" → {"target_price": 25000}
   - "30k" → {"target_price": 30000}
   - "19k" → {"target_price": 19000}
   - "$25,000" → {"target_price": 25000}
   - "under $30k" → {"max_price": 30000}
   - "around 25k" → {"target_price": 25000}
   - "up to 30k" → {"max_price": 30000}
   - "maximum 25k" → {"max_price": 25000}
   - "budget 30k" → {"target_price": 30000}
   - "25 thousand" → {"target_price": 25000}
   - "thirty thousand" → {"target_price": 30000}
   - "25 grand" → {"target_price": 25000}
   - "25K" → {"target_price": 25000}
   - "25,000" → {"target_price": 25000}
   - "25000" → {"target_price": 25000}

OPTIONAL FIELDS (extract if mentioned):
6. COLOR_TONE: "white", "black", "silver", "red", "blue", "gray", "light", "dark"
7. FEATURES: "navigation", "backup camera", "sunroof", "leather seats"

TYPO CORRECTION: Fix common typos automatically:
- "prepwned", "preowned", "pre owned" → "pre-owned"
- "ssuv", "s.u.v", "suv" → "SUV" 
- "hyundia", "hyundai", "hyundi", "hyaundai", "hyauandi", "hyuandi" → "Hyundai"
- "honda", "hnda", "hondi" → "Honda"
- "toyota", "toyta", "toytoa" → "Toyota"
- "tuson", "tucson" → "Tucson"
- "civic", "civc" → "Civic"
- "accord", "acord" → "Accord"
- "santa fe", "santafe", "santa-fe" → "Santa Fe"

RESPONSE FORMAT:
{
  "vehicle_condition": "string",
  "vehicle_type": "string", 
  "make": "string",
  "model": "string",
  "budget": {"target_price": number} or {"max_price": number},
  "color_tone": "string",
  "features": ["string"]
}

EXAMPLES:
Input: "Do you have the new Hyundai Tucson SUV under $30,000?"
Output: {"vehicle_condition": "new", "vehicle_type": "SUV", "make": "Hyundai", "model": "Tucson", "budget": {"max_price": 30000}}

Input: "Looking for a used Honda Civic in black"
Output: {"vehicle_condition": "used", "make": "Honda", "model": "Civic", "color_tone": "black"}

Input: "I want a 19k budget"
Output: {"budget": {"target_price": 19000}}

Input: "SUV options under budget 30k"
Output: {"vehicle_type": "SUV", "budget": {"max_price": 30000}}

Input: "25k"
Output: {"budget": {"target_price": 25000}}

Input: "I want a pre-owned Hyundai Tucson SUV, budget around 25k"
Output: {"vehicle_condition": "pre-owned", "vehicle_type": "SUV", "make": "Hyundai", "model": "Tucson", "budget": {"target_price": 25000}}

Input: "can you give me comparison between hyundai tucson and kia sorento"
Output: {}

Input: "compare the Tucson vs the Sorento"
Output: {}

CRITICAL COMPARISON QUESTION RULES:
- If message contains "compare", "comparison", "between", "vs", "versus", DO NOT extract make/model
- Comparison questions are informational only, not purchase intent
- Customer is exploring options, not selecting a specific vehicle yet

CRITICAL BUDGET EXTRACTION RULES:
- Always extract standalone numbers with "k" as target_price
- Convert "k" to thousands (25k = 25000)
- Use max_price for "under", "up to", "maximum" phrases
- Use target_price for "around", "about", "budget" phrases
- Handle both numeric and written numbers
- Extract even single budget mentions like "25k" or "19k"

CRITICAL: Return ONLY valid JSON. No markdown, no explanations, no extra text.${inventoryContext}`;

    const userPrompt = `Extract information from: "${normalizedMessage}"

Correct typos automatically:
- "prepwned", "preowned", "pre owned" → "pre-owned"
- "ssuv", "s.u.v" → "SUV" 
- "hyundia", "hyundai", "hyundi", "hyaundai", "hyauandi" → "Hyundai"
- "honda", "hnda", "hondi" → "Honda"
- "toyota", "toyta", "toytoa" → "Toyota"
- "tuson", "tucson" → "Tucson"
- "civic", "civc" → "Civic"
- "accord", "acord" → "Accord"
- "santa fe", "santafe" → "Santa Fe"

Return ONLY valid JSON.`;

    const response = await this.llm.invoke([
      new SystemMessage({ content: systemPrompt }),
      new HumanMessage({ content: userPrompt })
    ]);

    try {
      // Handle markdown-wrapped JSON responses
      let jsonContent = response.content.trim();
      
      // Remove markdown code blocks if present
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Clean up any remaining backticks or markdown artifacts
      jsonContent = jsonContent.replace(/^`+|`+$/g, '').trim();
      
      // 🚀 NEW: Handle incomplete JSON responses
      if (jsonContent.includes('{') && !jsonContent.endsWith('}')) {
        console.log('⚠️ Detected incomplete JSON response, attempting to fix...');
        
        // Try to find the last complete object
        const lastBrace = jsonContent.lastIndexOf('}');
        if (lastBrace > 0) {
          jsonContent = jsonContent.substring(0, lastBrace + 1);
          console.log('🔧 Truncated to last complete object');
        } else {
          // If no complete object found, try to close it
          const openBraces = (jsonContent.match(/\{/g) || []).length;
          const closeBraces = (jsonContent.match(/\}/g) || []).length;
          const missingBraces = openBraces - closeBraces;
          
          if (missingBraces > 0) {
            jsonContent += '}'.repeat(missingBraces);
            console.log(`🔧 Added ${missingBraces} closing braces`);
          }
        }
      }
      
      // 🚀 NEW: Handle unterminated strings
      if (jsonContent.includes('"') && !jsonContent.match(/"[^"]*"$/)) {
        console.log('⚠️ Detected unterminated string, attempting to fix...');
        
        // Find the last quote and close the string
        const lastQuote = jsonContent.lastIndexOf('"');
        if (lastQuote > 0) {
          // Check if it's an unterminated string
          const beforeQuote = jsonContent.substring(0, lastQuote);
          const afterQuote = jsonContent.substring(lastQuote + 1);
          
          if (!afterQuote.includes('"') && !afterQuote.includes('}')) {
            jsonContent = jsonContent.substring(0, lastQuote + 1) + '"}';
            console.log('🔧 Closed unterminated string');
          }
        }
      }
      
      const parsed = JSON.parse(jsonContent);
      
      // Add financing method detection to AI extraction
      const text = userMessage.toLowerCase();
      if (text.includes('cash') || text.includes('pay cash') || text.includes('cash payment')) {
        parsed.finance = {
          ...parsed.finance,
          mode: 'cash',
          preferred_method: 'cash',
          method_selected: true
        };
        parsed.qualification = {
          ...parsed.qualification,
          credit_situation: 'cash_buyer',
          financing_method: 'cash'
        };
        parsed.stage = 'qualification';
        console.log('💰 Cash payment selected via AI extraction');
      } else if (text.includes('finance') || text.includes('loan') || text.includes('financing') || 
                 text.includes('i want to go finance') || text.includes('i would like to finance') ||
                 text.includes('i want finance') || text.includes('go with finance')) {
        parsed.finance = {
          ...parsed.finance,
          mode: 'finance',
          preferred_method: 'finance',
          method_selected: true
        };
        parsed.qualification = {
          ...parsed.qualification,
          credit_situation: 'needs_financing',
          financing_method: 'finance'
        };
        parsed.stage = 'qualification';
        console.log('💰 Financing selected via AI extraction');
      } else if (text.includes('lease') || text.includes('leasing')) {
        parsed.finance = {
          ...parsed.finance,
          mode: 'lease',
          preferred_method: 'lease',
          method_selected: true
        };
        parsed.qualification = {
          ...parsed.qualification,
          credit_situation: 'lease_candidate',
          financing_method: 'lease'
        };
        parsed.stage = 'qualification';
        console.log('💰 Leasing selected via AI extraction');
      }
      
      // Add credit score detection to AI extraction
      if (text.includes('credit') || text.includes('score') || 
          text.includes('750') || text.includes('700') || text.includes('650') ||
          text.includes('excellent') || text.includes('good') || text.includes('fair') ||
          text.includes('below 650') || text.includes('above 750')) {
        
        let creditScore = null;
        let creditRange = null;
        
        // Detect specific credit score ranges
        if (text.includes('750') || text.includes('excellent') || text.includes('750+')) {
          creditScore = '750+';
          creditRange = 'excellent';
        } else if (text.includes('700') || text.includes('good') || text.includes('700-749')) {
          creditScore = '700-749';
          creditRange = 'good';
        } else if (text.includes('650') || text.includes('fair') || text.includes('650-699')) {
          creditScore = '650-699';
          creditRange = 'fair';
        } else if (text.includes('below 650') || text.includes('below 650')) {
          creditScore = 'below 650';
          creditRange = 'below average';
        }
        
        // Detect numeric credit scores (e.g., "its 700 good", "750+")
        const numericMatch = userMessage.match(/\b(\d{3})\b/);
        if (numericMatch) {
          const score = parseInt(numericMatch[1]);
          if (score >= 750) {
            creditScore = '750+';
            creditRange = 'excellent';
          } else if (score >= 700) {
            creditScore = '700-749';
            creditRange = 'good';
          } else if (score >= 650) {
            creditScore = '650-699';
            creditRange = 'fair';
          } else {
            creditScore = 'below 650';
            creditRange = 'below average';
          }
        }
        
        if (creditScore) {
          parsed.qualification = {
            ...parsed.qualification,
            credit_score: creditScore,
            credit_range: creditRange,
            credit_identified: true
          };
          console.log('💰 Credit score detected via AI extraction:', creditScore, '(' + creditRange + ')');
        }
      }
      
      // Add down payment detection to AI extraction
      if (text.includes('down') || text.includes('downpayment') || text.includes('down payment') ||
          text.includes('can make') || text.includes('can put down') || text.includes('have')) {
        let downPayment = null;
        
        // Detect down payment amounts
        const downPaymentPatterns = [
          /\$?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)\s*(?:down|downpayment|down payment)/i,
          /(\d{1,4})\s*k\s*(?:down|downpayment|down payment)/i,
          /(\d{1,4})\s*thousand\s*(?:down|downpayment|down payment)/i,
          /(\d{1,4})\s*grand\s*(?:down|downpayment|down payment)/i,
          /(\d{1,4})\s*000\s*(?:down|downpayment|down payment)/i,
          /down\s*\$?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/i,
          /downpayment\s*\$?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/i,
          /down\s*payment\s*\$?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/i,
          // New patterns for "I can make X" or "I have X"
          /can make\s*(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/i,
          /can put down\s*(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/i,
          /have\s*(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)\s*(?:for|as|down)/i,
          // Simple number patterns when context suggests down payment
          /^\s*(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)\s*$/i
        ];
        
        for (const pattern of downPaymentPatterns) {
          const match = userMessage.match(pattern);
          if (match) {
            let amount = match[1];
            
            // Handle 'k' suffix for thousands
            if (userMessage.toLowerCase().includes('k') && !amount.includes('k')) {
              amount = amount + '000';
            }
            
            // Parse the amount
            downPayment = parseInt(amount.replace(/,/g, ''));
            
            // Validate reasonable down payment range
            if (downPayment >= 500 && downPayment <= 50000) {
              console.log('💰 Down payment detected via AI extraction:', downPayment);
              break;
            } else {
              downPayment = null;
            }
          }
        }
        
        if (downPayment) {
          parsed.finance = {
            ...parsed.finance,
            down_payment: downPayment,
            down_payment_provided: true
          };
          console.log('💰 Down payment stored via AI extraction:', downPayment);
        }
      }
      
      // TEST DRIVE COMPLETION DETECTION - AI EXTRACTION
      console.log('🔍 Checking for test drive completion in AI extraction:', userMessage);
      
      // Test drive completion patterns
      const testDriveCompletionPatterns = [
        /drive.*was.*great/i,
        /glad.*drive.*was.*great/i,
        /i.*am.*glad.*drive/i,
        /i.*am.*glad.*it.*was.*great/i,
        /its.*was.*great.*drive/i,
        /it.*was.*great.*drive/i,
        /the.*drive.*was.*great/i,
        /test.*drive.*done/i,
        /finished.*test.*drive/i,
        /test.*drove.*it/i,
        /drove.*it/i,
        /loved.*that/i,
        /loved.*the.*drive/i,
        /enjoyed.*the.*drive/i,
        /drive.*was.*good/i,
        /drive.*was.*excellent/i,
        /drive.*was.*amazing/i,
        /test.*drive.*was.*great/i,
        /test.*drive.*was.*good/i,
        /test.*drive.*was.*excellent/i
      ];
      
      const hasTestDriveCompletion = testDriveCompletionPatterns.some(pattern => pattern.test(userMessage));
      
      if (hasTestDriveCompletion) {
        // Initialize test_drive slot if not exists
        if (!parsed.test_drive) {
          parsed.test_drive = {};
        }
        
        parsed.test_drive.completion_status = 'completed';
        parsed.test_drive.step = 'completed';
        parsed.test_drive.hasConfirmedInterest = true;
        parsed.test_drive.deal_ready = true;
        parsed.test_drive.review_collected = true;
        
        // Advance to trade evaluation stage
        parsed.stage = 'trade_evaluation';
        
      console.log('🚗 Test drive completion detected via AI extraction:', userMessage);
    }
    
    // FINANCING OPTION SELECTION DETECTION - AI EXTRACTION
    console.log('🔍 Checking for financing option selection in AI extraction:', userMessage);
    
    // Financing option selection patterns
    const financingOptionPatterns = [
      /go.*with.*extended.*term/i,
      /go.*with.*standard.*term/i,
      /go.*with.*short.*term/i,
      /extended.*term/i,
      /standard.*term/i,
      /short.*term/i,
      /option.*1/i,
      /option.*2/i,
      /option.*3/i,
      /first.*option/i,
      /second.*option/i,
      /third.*option/i,
      /choose.*extended/i,
      /choose.*standard/i,
      /choose.*short/i,
      /select.*extended/i,
      /select.*standard/i,
      /select.*short/i,
      /prefer.*extended/i,
      /prefer.*standard/i,
      /prefer.*short/i
    ];
    
    const hasFinancingOptionSelection = financingOptionPatterns.some(pattern => pattern.test(userMessage));
    
    if (hasFinancingOptionSelection) {
      // Initialize finance slot if not exists
      if (!parsed.finance) {
        parsed.finance = {};
      }
      
      // Determine selected option
      let selectedOption = 'standard';
      if (/extended/i.test(userMessage)) {
        selectedOption = 'extended';
      } else if (/short/i.test(userMessage)) {
        selectedOption = 'short';
      } else if (/option.*1|first/i.test(userMessage)) {
        selectedOption = 'option1';
      } else if (/option.*2|second/i.test(userMessage)) {
        selectedOption = 'option2';
      } else if (/option.*3|third/i.test(userMessage)) {
        selectedOption = 'option3';
      }
      
      parsed.finance.selected_option = selectedOption;
      parsed.finance.option_selected = true;
      
      // Advance to purchase commitment stage
      parsed.stage = 'purchase_commitment';
      
      console.log('💰 Financing option selection detected via AI extraction:', selectedOption);
    }
    
      return this.normalizeExtractedSlots(parsed);
    } catch (err) {
      console.warn('❌ JSON parse failed:', err.message);
      console.warn('Raw response length:', response.content.length);
      console.warn('Raw response preview:', response.content.substring(0, 500) + '...');
      
      // 🚀 NEW: Fallback to rule-based extraction if JSON parsing fails
      console.log('🔄 Falling back to rule-based extraction due to JSON parse failure');
      return {};
    }
  }

  /**
   * ✅ QUALIFICATION-SPECIFIC AI EXTRACTION (Stage 6)
   * Handles: financing method, credit score, down payment, lease terms
   * Only runs when currentJourneyStep === 'qualification'
   */
  async extractQualificationSlotsWithAI(userMessage, intentResult, conversationContext = {}) {
    console.log('🎯 Using Qualification-Specific AI Extraction');
    
    const systemPrompt = `Extract financial qualification information from customer messages. Return ONLY valid JSON.

QUALIFICATION FIELDS (extract if mentioned):
1. FINANCING_METHOD: "cash", "finance", "lease"
2. CREDIT_SCORE: "excellent", "good", "fair", "poor" (based on ranges or specific numbers)
3. DOWN_PAYMENT: Extract down payment amounts
4. LEASE_TERM: Extract lease terms (24, 36, 48 months)

QUALIFICATION EXAMPLES:
Input: "I want to finance, my credit score is 650, I can make $3000 down"
Output: {
  "qualification": {
    "financing_method": "finance",
    "credit_score": "fair",
    "credit_situation": "needs_financing"
  },
  "finance": {
    "down_payment": 3000
  }
}

Input: "I can make $5000 as down payment"
Output: {
  "qualification": {
    "financing_method": "finance",
    "credit_situation": "needs_financing"
  },
  "finance": {
    "down_payment": 5000
  }
}

Input: "my credit score is 600"
Output: {
  "qualification": {
    "credit_score": "poor"
  }
}

Input: "I want to lease for 36 months"
Output: {
  "qualification": {
    "financing_method": "lease",
    "credit_situation": "lease_candidate"
  },
  "finance": {
    "lease_term": 36
  }
}

Input: "financing"
Output: {
  "qualification": {
    "financing_method": "finance",
    "credit_situation": "needs_financing"
  }
}

CRITICAL QUALIFICATION RULES:
- Always infer financing method from context (down payment = finance, lease term = lease)
- Convert numeric credit scores to ranges (600 = poor, 650 = fair, 700 = good, 750 = excellent)
- Extract down payment amounts even without explicit "down payment" phrase
- Preserve existing qualification data from conversation context
- Return structured qualification and finance objects
- Handle partial information (e.g., just "financing" or just "I can make $3000")

CRITICAL: Return ONLY valid JSON. No markdown, no explanations.`;

    const userPrompt = `Extract qualification information from: "${userMessage}"

Return ONLY valid JSON.`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage({ content: systemPrompt }),
        new HumanMessage({ content: userPrompt })
      ]);

      // Parse AI response
      let jsonContent = response.content.trim();
      
      // Remove markdown code blocks if present
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Clean up any remaining backticks or markdown artifacts
      jsonContent = jsonContent.replace(/^`+|`+$/g, '').trim();
      
      const parsed = JSON.parse(jsonContent);
      
      // ✅ CONTEXT-AWARE: Preserve existing qualification data
      const existingQualification = conversationContext.Daivesteps?.[6]?.slots?.qualification || {};
      const existingFinance = conversationContext.Daivesteps?.[6]?.slots?.finance || {};
      
      // Merge AI extraction with existing data
      const mergedQualification = {
        ...existingQualification,
        ...parsed.qualification
      };
      
      const mergedFinance = {
        ...existingFinance,
        ...parsed.finance
      };
      
      console.log('🎯 Qualification AI Extraction Result:', {
        qualification: mergedQualification,
        finance: mergedFinance
      });
      
      return {
        qualification: mergedQualification,
        finance: mergedFinance
      };
      
    } catch (error) {
      console.warn('⚠️ Qualification AI extraction failed:', error.message);
      throw error; // Let it fall back to rule-based extraction
    }
  }

  /**
   * ✅ PURCHASE COMMITMENT EXTRACTION (Stage 7)
   * Handles: final decisions, contract terms, closing details
   * Only runs when currentJourneyStep === 'purchase_commitment'
   */
  async extractPurchaseCommitmentSlotsWithAI(userMessage, intentResult, conversationContext = {}) {
    console.log('🎯 Using Purchase Commitment-Specific AI Extraction');
    
    const systemPrompt = `Extract purchase commitment information from customer messages. Return ONLY valid JSON.

PURCHASE COMMITMENT FIELDS (extract if mentioned):
1. PURCHASE_DECISION: "yes", "no", "proceed", "decline", "confirmed"
2. PAYMENT_METHOD: "cash", "cheque", "check", "financing", "lease"
3. CONTRACT_READY: true/false if customer is ready to sign
4. CLOSING_DETAILS: Extract closing-related information

PURCHASE COMMITMENT EXAMPLES:
Input: "Yes, I want to proceed with the purchase"
Output: {
  "purchase_commitment": {
    "purchase_decision": "yes",
    "proceed": true,
    "commitment_confirmed": true
  }
}

Input: "I will pay by cheque"
Output: {
  "purchase_commitment": {
    "purchase_decision": "confirmed",
    "payment_method": "cheque",
    "commitment_confirmed": true
  }
}

Input: "I'm ready to sign the contract"
Output: {
  "purchase_commitment": {
    "purchase_decision": "yes",
    "contract_ready": true,
    "commitment_confirmed": true
  }
}

Input: "I want to buy this car"
Output: {
  "purchase_commitment": {
    "purchase_decision": "confirmed",
    "commitment_confirmed": true
  }
}

CRITICAL PURCHASE COMMITMENT RULES:
- Any positive purchase intent = commitment_confirmed: true
- Extract payment method if mentioned (cash, cheque, financing, lease)
- Set purchase_decision to "confirmed" for any purchase intent
- Return structured purchase_commitment object

CRITICAL: Return ONLY valid JSON. No markdown, no explanations.`;

    const userPrompt = `Extract purchase commitment information from: "${userMessage}"

Return ONLY valid JSON.`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage({ content: systemPrompt }),
        new HumanMessage({ content: userPrompt })
      ]);

      // Parse AI response
      let jsonContent = response.content.trim();
      
      // Remove markdown code blocks if present
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Clean up any remaining backticks or markdown artifacts
      jsonContent = jsonContent.replace(/^`+|`+$/g, '').trim();
      
      const parsed = JSON.parse(jsonContent);
      
      // ✅ CONTEXT-AWARE: Preserve existing purchase commitment data
      const existingCommitment = conversationContext.Daivesteps?.[7]?.slots?.purchase_commitment || {};
      
      // Merge AI extraction with existing data
      const mergedCommitment = {
        ...existingCommitment,
        ...parsed.purchase_commitment
      };
      
      console.log('🎯 Purchase Commitment AI Extraction Result:', {
        purchase_commitment: mergedCommitment
      });
      
      return {
        purchase_commitment: mergedCommitment
      };
      
    } catch (error) {
      console.warn('⚠️ Purchase Commitment AI extraction failed:', error.message);
      throw error; // Let it fall back to rule-based extraction
    }
  }

  async extractSlotsWithRules(message, intentResult, conversationContext = {}) {
    const slots = {};
    const text = message.toLowerCase();

    // COMPREHENSIVE EXTRACTION: Extract all possible information from single message
    console.log('🔍 Rule-based comprehensive extraction for:', message);
    
    // ✅ PURCHASE COMMITMENT DETECTION (Stage 7)
    if (conversationContext.currentJourneyStep === 'purchase_commitment') {
      console.log('🎯 Purchase Commitment Stage - Detecting commitment signals');
      
      // Payment method detection
      if (text.includes('cheque') || text.includes('check')) {
        slots.purchase_commitment = {
          ...slots.purchase_commitment,
          purchase_decision: 'confirmed',
          payment_method: 'cheque',
          commitment_confirmed: true
        };
        console.log('💰 Cheque payment detected');
      } else if (text.includes('cash')) {
        slots.purchase_commitment = {
          ...slots.purchase_commitment,
          purchase_decision: 'confirmed',
          payment_method: 'cash',
          commitment_confirmed: true
        };
        console.log('💰 Cash payment detected');
      } else if (text.includes('financing') || text.includes('finance')) {
        slots.purchase_commitment = {
          ...slots.purchase_commitment,
          purchase_decision: 'confirmed',
          payment_method: 'financing',
          commitment_confirmed: true
        };
        console.log('💰 Financing payment detected');
      } else if (text.includes('lease') || text.includes('leasing')) {
        slots.purchase_commitment = {
          ...slots.purchase_commitment,
          purchase_decision: 'confirmed',
          payment_method: 'lease',
          commitment_confirmed: true
        };
        console.log('💰 Lease payment detected');
      }
      
      // Purchase intent detection
      if (text.includes('yes') || text.includes('proceed') || text.includes('buy') || 
          text.includes('purchase') || text.includes('confirm') || text.includes('ready')) {
        slots.purchase_commitment = {
          ...slots.purchase_commitment,
          purchase_decision: 'confirmed',
          commitment_confirmed: true
        };
        console.log('✅ Purchase commitment confirmed');
      }
      
      // Contract readiness detection
      if (text.includes('sign') || text.includes('contract') || text.includes('paperwork')) {
        slots.purchase_commitment = {
          ...slots.purchase_commitment,
          contract_ready: true,
          commitment_confirmed: true
        };
        console.log('📋 Contract readiness detected');
      }
    }

    // Initialize qualification slot if not exists - but only if not in qualification step
    // In qualification step, we only want essential fields (credit_situation, credit_score, financing_method)
    if (!slots.qualification && conversationContext.currentJourneyStep !== 'qualification') {
      slots.qualification = {
        vehicle_usage: null,
        usage_identified: false,
        annual_mileage: null,
        mileage_identified: false,
        timeline: null,
        timeline_identified: false,
        purchase_intent: null,
        urgency: null,
        preferred_features: [],
        features_mentioned: false
      };
    }
    
    // If in qualification step, only initialize essential fields
    if (conversationContext.currentJourneyStep === 'qualification' && !slots.qualification) {
      slots.qualification = {
        credit_situation: null,
        credit_score: null,
        financing_method: null,
        qualification_completed: false
      };
    }
    
    // Clean up unnecessary fields if we're in qualification step
    if (conversationContext.currentJourneyStep === 'qualification' && slots.qualification) {
      // Remove unnecessary fields that shouldn't be in qualification step
      delete slots.qualification.vehicle_usage;
      delete slots.qualification.usage_identified;
      delete slots.qualification.annual_mileage;
      delete slots.qualification.mileage_identified;
      delete slots.qualification.timeline;
      delete slots.qualification.timeline_identified;
      delete slots.qualification.purchase_intent;
      delete slots.qualification.urgency;
      delete slots.qualification.preferred_features;
      delete slots.qualification.features_mentioned;
    }

    // MANDATORY SLOTS EXTRACTION - OPTIMIZED ORDER WITH CONTEXT AWARENESS
    // 1. Vehicle Condition (ASK FIRST) - Enhanced context awareness
    if (text.includes('new') && !text.includes('pre-owned')) {
      slots.vehicle_condition = 'new';
      console.log('📋 Rule-based: Vehicle condition = new');
    } else if (text.includes('pre-owned') || text.includes('preowned') || text.includes('pre owned')) {
      slots.vehicle_condition = 'pre-owned';
      console.log('📋 Rule-based: Vehicle condition = pre-owned');
    } else if (text.includes('used')) {
      slots.vehicle_condition = 'used';
      console.log('📋 Rule-based: Vehicle condition = used');
    } else if (text.includes('certified') || text.includes('certified pre-owned') || text.includes('certified preowned') || text.includes('certified pre owned')) {
      slots.vehicle_condition = 'certified';
      console.log('📋 Rule-based: Vehicle condition = certified');
    }
    
    // ENHANCED: Context-aware condition extraction for standalone mentions
    // Handle cases like "I would prefer something that is certified pre-owned if possible"
    if (!slots.vehicle_condition) {
      if (text.includes('certified') && (text.includes('pre-owned') || text.includes('preowned') || text.includes('pre owned'))) {
        slots.vehicle_condition = 'certified';
        console.log('📋 Rule-based: Vehicle condition = certified (context-aware)');
      } else if (text.includes('pre-owned') && text.includes('certified')) {
        slots.vehicle_condition = 'certified';
        console.log('📋 Rule-based: Vehicle condition = certified (context-aware)');
      }
    }

    // 2. Budget extraction (ASK SECOND) - Enhanced regex patterns with comprehensive coverage
    // Multiple budget patterns to handle complex sentences and edge cases
    const budgetPatterns = [
      /\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:k|thousand|max)?/i,  // $25,000 max, 25k, etc.
      /(\d{1,3})\s*k\b/i,                                            // 25k, 30k, etc. (standalone k)
      /(\d{1,3})\s*k\s/i,                                            // 25k with space after
      /(\d{1,3})k\b/i,                                               // 25k without space
      /budget.*?\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,              // budget is around $25,000
      /budget.*?(\d{1,3})\s*k/i,                                     // budget 25k
      /around.*?\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,              // around $25,000
      /around.*?(\d{1,3})\s*k/i,                                     // around 25k
      /under.*?\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,               // under $25,000
      /under.*?(\d{1,3})\s*k/i,                                      // under 25k
      /up to.*?\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,               // up to $25,000
      /up to.*?(\d{1,3})\s*k/i,                                     // up to 25k
      /maximum.*?\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,             // maximum $25,000
      /maximum.*?(\d{1,3})\s*k/i,                                   // maximum 25k
      /(\d{1,3})\s*thousand/i,                                       // 25 thousand
      /(\d{1,3})\s*grand/i,                                          // 25 grand
      /(\d{1,3})\s*000\b/i,                                          // 25000
      /\b(\d{1,3})\s*000\b/i                                         // 25 000
    ];
    
    let budgetValue = null;
    for (const pattern of budgetPatterns) {
      const match = message.match(pattern);
      if (match) {
        let price = match[1];
        console.log('🔍 Budget pattern matched:', pattern.toString(), 'for message:', message, 'captured:', price);
        
        // Enhanced 'k' suffix handling for thousands
        if (message.toLowerCase().includes('k') && !price.includes('k')) {
          // If the message contains 'k' but the captured price doesn't, it's likely a standalone 'k'
          price = price + '000';
          console.log('🔍 Added 000 for standalone k, price now:', price);
        } else if (price.includes('k')) {
          price = price.replace('k', '000');
          console.log('🔍 Replaced k with 000, price now:', price);
        }
        
        // Handle "thousand" and "grand" suffixes
        if (message.toLowerCase().includes('thousand')) {
          price = price + '000';
          console.log('🔍 Added 000 for thousand, price now:', price);
        } else if (message.toLowerCase().includes('grand')) {
          price = price + '000';
          console.log('🔍 Added 000 for grand, price now:', price);
        }
        
        // Parse the final price value
        budgetValue = parseInt(price.replace(/,/g, ''));
        console.log('🔍 Final budget value:', budgetValue);
        
        // Validate budget range (reasonable car prices)
        if (budgetValue >= 5000 && budgetValue <= 200000) {
          console.log('✅ Budget value is within reasonable range');
          break;
        } else {
          console.log('⚠️ Budget value outside reasonable range, continuing search');
          budgetValue = null; // Reset to continue searching
        }
      }
    }
    
    if (budgetValue) {
      
      // Enhanced year detection - check if the number is part of a year pattern
      const isYear = this.isYearPattern(message, budgetValue);
      const isMonthTerm = this.isMonthTermPattern(message, budgetValue);
      const isTradeIn = text.includes('trade') && (text.includes('in') || text.includes('-'));
      
      console.log('🔍 Budget validation checks:', {
        budgetValue,
        isYear,
        isMonthTerm,
        isTradeIn,
        inRange: budgetValue >= 1000 && budgetValue <= 200000
      });
      
      // Only extract as budget if it's not a year, month term, or trade-in context
      if (!isYear && !isMonthTerm && !isTradeIn && budgetValue >= 1000 && budgetValue <= 200000) {
        if (text.includes('under') || text.includes('below') || text.includes('max')) {
          slots.budget = { max_price: budgetValue };
          console.log('📋 Rule-based: Budget max_price =', budgetValue);
        } else if (text.includes('around') || text.includes('about') || text.includes('approximately')) {
          slots.budget = { target_price: budgetValue };
          console.log('📋 Rule-based: Budget target_price =', budgetValue);
        } else {
          slots.budget = { target_price: budgetValue };
          console.log('📋 Rule-based: Budget target_price =', budgetValue);
        }
      } else {
        console.log('📋 Rule-based: Skipped budget extraction for', budgetValue, '(year/month term)');
      }
    }

    // 3. Vehicle Type (ASK THIRD)
    if (text.includes('suv') || text.includes('s.u.v')) {
      slots.vehicle_type = 'SUV';
      console.log('📋 Rule-based: Vehicle type = SUV');
    } else if (text.includes('truck') || text.includes('pickup')) {
      slots.vehicle_type = 'truck';
      console.log('📋 Rule-based: Vehicle type = truck');
    } else if (text.includes('car') || text.includes('sedan')) {
      slots.vehicle_type = 'car';
      console.log('📋 Rule-based: Vehicle type = car');
    } else if (text.includes('hatchback')) {
      slots.vehicle_type = 'hatchback';
      console.log('📋 Rule-based: Vehicle type = hatchback');
    } else if (text.includes('crossover')) {
      slots.vehicle_type = 'crossover';
      console.log('📋 Rule-based: Vehicle type = crossover');
    } else if (text.includes('coupe')) {
      slots.vehicle_type = 'coupe';
      console.log('📋 Rule-based: Vehicle type = coupe');
    } else if (text.includes('convertible')) {
      slots.vehicle_type = 'convertible';
      console.log('📋 Rule-based: Vehicle type = convertible');
    } else if (text.includes('minivan') || text.includes('mini van')) {
      slots.vehicle_type = 'minivan';
      console.log('📋 Rule-based: Vehicle type = minivan');
    } else if (text.includes('van') || text.includes('cargo van') || text.includes('passenger van')) {
      slots.vehicle_type = 'van';
      console.log('📋 Rule-based: Vehicle type = van');
    }

    // 4. Make extraction (ASK FOURTH) - DYNAMIC from inventory
    // Fallback ordered roughly by market popularity/demand
    let availableMakes = [
       'hyundai','toyota', 'honda', 'ford', 'chevrolet', 'nissan', 'kia', 'subaru', 'mazda', 'volkswagen',
      'lexus', 'bmw', 'mercedes-benz', 'audi', 'acura', 'dodge', 'ram', 'buick', 'lincoln', 'genesis',
      'land rover', 'tesla', 'rivian', 'suzuki',
      // keep prior common ones to avoid regressions/aliases
      'mercedes', 'infiniti'
    ];
    
    // 🚀 NEW: Get dynamic makes from inventory if available
    if (conversationContext.dealerId) {
      try {
        const inventoryService = global.inventoryService || this.inventoryService;
        if (inventoryService) {
          const cacheData = await inventoryService.getCachedMakesAndModels(conversationContext.dealerId);
          if (cacheData && cacheData.makes && cacheData.makes.length > 0) {
            availableMakes = cacheData.makes.map(make => make.toLowerCase());
            console.log('📋 Using dynamic makes from inventory:', availableMakes.slice(0, 5));
          }
        }
      } catch (err) {
        console.warn('⚠️ Could not get dynamic makes, using fallback:', err.message);
      }
    }
    
    // Alias normalization for common make synonyms and variations
    const makeAliases = [
      { pattern: /\bmercedes[-\s]?benz\b|\bmercedes\b|\bmb\b/i, canonical: 'Mercedes-Benz' },
      { pattern: /\bland\s+rover\b/i, canonical: 'Land Rover' },
      { pattern: /\bvw\b|\bvolkswagen\b/i, canonical: 'Volkswagen' },
      { pattern: /\bchevy\b|\bchevrolet\b/i, canonical: 'Chevrolet' },
      { pattern: /\bbmw\b/i, canonical: 'BMW' },
      { pattern: /\bmbusa\b/i, canonical: 'Mercedes-Benz' }
    ];
    for (const alias of makeAliases) {
      if (alias.pattern.test(message)) {
        slots.make = alias.canonical;
        console.log('📋 Rule-based: Make (alias) =', slots.make);
        break;
      }
    }
    
    // If no alias matched, try direct inclusion from available list
    if (!slots.make) {
      for (const make of availableMakes) {
      if (text.includes(make)) {
          // Proper-case with support for spaces/hyphens
          const canonical = make.split(/[-\s]/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(make.includes('-') ? '-' : ' ');
          slots.make = canonical;
          console.log('📋 Rule-based: Make =', slots.make);
          break;
      }
      }
    }

    // 5. Model extraction (ASK FIFTH) - DYNAMIC from inventory
    let availableModels = [
      // Provided models (normalized to lowercase variants)
      'santa cruz', 'kicks', 'durango', 'tucson hybrid', 'rav4', 'rav 4', 'prius', 'passport', 'range rover sport',
      'civic', 'corrolla', 'corolla', 'odyssey', 'atlas', 'f-250sd', 'f250sd', 'fusion hybrid', 'defender 110',
      'explorer', 'santa fe hybrid', 'ioniq 5', 'cultus', 'escape', 'santa fe', 'sonata hybrid', 'atlas cross sport',
      'navigator', 'azera', 'glc', 'impreza', 'corvette', 'pilot', 'venue', 'sonata', 'camaro', 'miata rf', 'f-150',
      'f150', 'camry', 'encore', 'equinox', 'sportage', 'sorento', 'forester', '1500', 'rogue', 'mdx', 'elantra hybrid',
      'lc', 'kona', 'elantra', 'a6', 'palisade', 'bronco sport', 'city', 'grand highlander hybrid', 'santa fe sport',
      'r1t', 'is', 'tucson', 'tuson', 'ioniq 9', 'blazer ev', 'g90', 'f-350sd', 'f350sd', '4runner', 'model y',
      // Existing fallbacks
      'accent', 'veloster', 'nexo', 'ioniq', 'accord', 'cr-v', 'crv', 'pilot', 'highlander', 'malibu',
      'blazer', 'altima', 'pathfinder', 'cx-5', 'cx-9', 'outback', 'jetta', 'passat', 'tiguan'
    ];
    
    // 🚀 NEW: Get dynamic models from inventory if available
    if (conversationContext.dealerId) {
      try {
        const inventoryService = global.inventoryService || this.inventoryService;
        if (inventoryService) {
          const cacheData = await inventoryService.getCachedMakesAndModels(conversationContext.dealerId);
          if (cacheData && cacheData.modelsByMake) {
            // Preserve popularity by iterating makes (already popularity-ordered) then their models
            const orderedModels = [];
            if (Array.isArray(cacheData.makes) && cacheData.makes.length > 0) {
              cacheData.makes.forEach(make => {
                const models = cacheData.modelsByMake[make] || cacheData.modelsByMake[make?.toLowerCase?.()] || [];
                models.forEach(model => orderedModels.push(String(model).toLowerCase()));
              });
            } else {
              // Fallback: flatten values if makes order not present
              Object.values(cacheData.modelsByMake).forEach(models => {
                orderedModels.push(...models.map(model => String(model).toLowerCase()));
              });
            }
            availableModels = [...new Set(orderedModels)];
            console.log('📋 Using popularity-ordered models from inventory:', availableModels.slice(0, 10));
          }
        }
      } catch (err) {
        console.warn('⚠️ Could not get dynamic models, using fallback:', err.message);
      }
    }
    
    // Alias/canonical normalization for models
    const modelAliases = [
      { pattern: /\btuson\b/i, canonical: 'Tucson' },
      { pattern: /\bcrv\b/i, canonical: 'CR-V' },
      { pattern: /\brav\s?4\b/i, canonical: 'RAV4' },
      { pattern: /\bf\s?-?150\b/i, canonical: 'F-150' },
      { pattern: /\bf\s?-?250sd\b/i, canonical: 'F-250SD' },
      { pattern: /\bf\s?-?350sd\b/i, canonical: 'F-350SD' },
      { pattern: /\bbronco\s+sport\b/i, canonical: 'Bronco Sport' },
      { pattern: /\batlas\s+cross\s+sport\b/i, canonical: 'Atlas Cross Sport' },
      { pattern: /\bdefender\s*110\b/i, canonical: 'Defender 110' },
      { pattern: /\brange\s+rover\s+sport\b/i, canonical: 'Range Rover Sport' },
      { pattern: /\bmiata\s*rf\b/i, canonical: 'Miata RF' },
      { pattern: /\bmodel\s*y\b/i, canonical: 'Model Y' },
      { pattern: /\bioniq\s*5\b/i, canonical: 'IONIQ 5' },
      { pattern: /\bioniq\s*9\b/i, canonical: 'IONIQ 9' },
      { pattern: /\bgrand\s+highlander\s+hybrid\b/i, canonical: 'Grand Highlander Hybrid' },
      { pattern: /\bsanta\s*fe\s*hybrid\b/i, canonical: 'Santa Fe Hybrid' },
      { pattern: /\bsanta\s*fe\s*sport\b/i, canonical: 'Santa Fe Sport' },
      { pattern: /\btucson\s*hybrid\b/i, canonical: 'Tucson Hybrid' },
      { pattern: /\bfusion\s*hybrid\b/i, canonical: 'Fusion Hybrid' },
      { pattern: /\belantra\s*hybrid\b/i, canonical: 'Elantra Hybrid' },
      { pattern: /\bsonata\s*hybrid\b/i, canonical: 'Sonata Hybrid' },
      { pattern: /\bglc\b/i, canonical: 'GLC' },
      { pattern: /\ba6\b/i, canonical: 'A6' },
      { pattern: /\bg90\b/i, canonical: 'G90' },
      { pattern: /\blc\b/i, canonical: 'LC' },
      { pattern: /\bis\b/i, canonical: 'IS' },
      { pattern: /\bmdx\b/i, canonical: 'MDX' },
      { pattern: /\br1t\b/i, canonical: 'R1T' },
      { pattern: /\bblazer\s*ev\b/i, canonical: 'Blazer EV' },
      { pattern: /\bsanta\s*cruz\b/i, canonical: 'Santa Cruz' }
    ];
    for (const alias of modelAliases) {
      if (alias.pattern.test(message)) {
        slots.model = alias.canonical;
        console.log('📋 Rule-based: Model (alias) =', slots.model);
        break;
      }
    }
    
    // If no alias matched, try direct inclusion from available list
    if (!slots.model) {
      for (const model of availableModels) {
        if (text.includes(model)) {
          // Default canonicalization: title-case with support for spaces/hyphens
          let canonical = model;
          if (model === 'corrolla') canonical = 'corolla';
          if (model === 'f150') canonical = 'f-150';
          if (model === 'f250sd') canonical = 'f-250sd';
          if (model === 'f350sd') canonical = 'f-350sd';
          
          // Handle simple known corrections
          if (canonical === 'tuson') canonical = 'tucson';
          if (canonical === 'crv') canonical = 'cr-v';
          if (canonical === 'rav 4') canonical = 'rav4';
          
          const parts = canonical.split(/[-\s]/).map(part => part.charAt(0).toUpperCase() + part.slice(1));
          const joiner = canonical.includes('-') ? '-' : ' ';
          let pretty = parts.join(joiner).trim();
          // Preserve known uppercase models
          if (/^rav4$/i.test(canonical)) pretty = 'RAV4';
          if (/^glc$/i.test(canonical)) pretty = 'GLC';
          if (/^a6$/i.test(canonical)) pretty = 'A6';
          if (/^g90$/i.test(canonical)) pretty = 'G90';
          if (/^lc$/i.test(canonical)) pretty = 'LC';
          if (/^is$/i.test(canonical)) pretty = 'IS';
          if (/^mdx$/i.test(canonical)) pretty = 'MDX';
          if (/^r1t$/i.test(canonical)) pretty = 'R1T';
          
          slots.model = pretty;
          console.log('📋 Rule-based: Model =', slots.model);
          break;
        }
      }
    }

    // 6. Color extraction (ADDITIONAL - Non-mandatory but valuable)
    const colors = ['white', 'black', 'silver', 'red', 'blue', 'gray', 'grey', 'beige', 'navy', 'dark', 'light', 'brown', 'green', 'yellow', 'orange'];
    for (const color of colors) {
      if (text.includes(color)) {
        slots.color_tone = color;
        console.log('📋 Rule-based: Color =', color);
        break;
      }
    }

    // Enhanced qualification detection
    // Vehicle usage detection - skip if in qualification step
    if (conversationContext.currentJourneyStep !== 'qualification' && 
        (text.includes('commuting') || text.includes('daily') || 
        text.includes('family') || text.includes('work') ||
        text.includes('trips') || text.includes('business') ||
        text.includes('personal') || text.includes('family vehicle'))) {
      slots.qualification.vehicle_usage = message;
      slots.qualification.usage_identified = true;
      console.log('📋 Rule-based: Vehicle usage qualification detected:', message);
    }
    
    // Annual mileage detection - improved patterns - skip if in qualification step
    if (conversationContext.currentJourneyStep !== 'qualification' &&
        (/\d+.*mile/i.test(message) || text.includes('miles') || 
        /^\d+$/.test(message.trim()) || /\d+.*annually/i.test(message) ||
        /\d+.*per year/i.test(message) || /\d+.*yearly/i.test(message) ||
        /\b\d{4,5}\b/.test(message))) { // Match 4-5 digit numbers (typical annual mileage)
      // Extract just the number for mileage
      const mileageMatch = message.match(/\b(\d{4,5})\b/);
      if (mileageMatch) {
        slots.qualification.annual_mileage = `${mileageMatch[1]} miles annually`;
        slots.qualification.mileage_identified = true;
        console.log('📋 Rule-based: Annual mileage qualification detected:', mileageMatch[1]);
      }
    }
    
    // Timeline detection - improved patterns - skip if in qualification step
    if (conversationContext.currentJourneyStep !== 'qualification' &&
        (text.includes('soon') || text.includes('asap') ||
        text.includes('today') || text.includes('week') ||
        text.includes('month') || text.includes('immediately') ||
        text.includes('flexible') || text.includes('not in a rush') ||
        text.includes('when ready') || text.includes('this week') ||
        text.includes('this month'))) {
      slots.qualification.timeline = message;
      slots.qualification.timeline_identified = true;
      console.log('📋 Rule-based: Timeline qualification detected:', message);
    }
    
    // Credit score detection - comprehensive patterns
    if (text.includes('credit') || text.includes('score') || 
        text.includes('750') || text.includes('700') || text.includes('650') ||
        text.includes('excellent') || text.includes('good') || text.includes('fair') ||
        text.includes('below 650') || text.includes('above 750')) {
      
      let creditScore = null;
      let creditRange = null;
      
      // Detect specific credit score ranges
      if (text.includes('750') || text.includes('excellent') || text.includes('750+')) {
        creditScore = '750+';
        creditRange = 'excellent';
      } else if (text.includes('700') || text.includes('good') || text.includes('700-749')) {
        creditScore = '700-749';
        creditRange = 'good';
      } else if (text.includes('650') || text.includes('fair') || text.includes('650-699')) {
        creditScore = '650-699';
        creditRange = 'fair';
      } else if (text.includes('below 650') || text.includes('below 650')) {
        creditScore = 'below 650';
        creditRange = 'below average';
      }
      
      // Detect numeric credit scores (e.g., "its 700 good", "750+")
      const numericMatch = message.match(/\b(\d{3})\b/);
      if (numericMatch) {
        const score = parseInt(numericMatch[1]);
        if (score >= 750) {
          creditScore = '750+';
          creditRange = 'excellent';
        } else if (score >= 700) {
          creditScore = '700-749';
          creditRange = 'good';
        } else if (score >= 650) {
          creditScore = '650-699';
          creditRange = 'fair';
        } else {
          creditScore = 'below 650';
          creditRange = 'below average';
        }
      }
      
      if (creditScore) {
        slots.qualification.credit_score = creditScore;
        slots.qualification.credit_range = creditRange;
        slots.qualification.credit_identified = true;
        console.log('📋 Rule-based: Credit score qualification detected:', creditScore, '(' + creditRange + ')');
      }
    }
    
    // Down payment detection - comprehensive patterns
    console.log('🔍 Checking for down payment detection in message:', message);
    console.log('🔍 Text includes can make:', text.includes('can make'));
    
    if (text.includes('down') || text.includes('downpayment') || text.includes('down payment') ||
        text.includes('can make') || text.includes('can put down') || text.includes('have')) {
      console.log('✅ Down payment detection triggered');
      let downPayment = null;
      
      // Detect down payment amounts
      const downPaymentPatterns = [
        /\$?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)\s*(?:down|downpayment|down payment)/i,
        /(\d{1,4})\s*k\s*(?:down|downpayment|down payment)/i,
        /(\d{1,4})\s*thousand\s*(?:down|downpayment|down payment)/i,
        /(\d{1,4})\s*grand\s*(?:down|downpayment|down payment)/i,
        /(\d{1,4})\s*000\s*(?:down|downpayment|down payment)/i,
        /down\s*\$?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/i,
        /downpayment\s*\$?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/i,
        /down\s*payment\s*\$?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/i,
        // New patterns for "I can make X" or "I have X"
        /can make\s*\$?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/i,
        /can put down\s*\$?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/i,
        /have\s*\$?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)\s*(?:for|as|down)/i,
        // Simple number patterns when context suggests down payment
        /^\s*(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)\s*$/i
      ];
      
      for (const pattern of downPaymentPatterns) {
        console.log('🔍 Testing down payment pattern:', pattern);
        const match = message.match(pattern);
        console.log('🔍 Pattern match result:', match);
        if (match) {
          console.log('✅ Down payment pattern matched!');
          let amount = match[1];
          console.log('🔍 Extracted amount:', amount);
          
          // Handle 'k' suffix for thousands (only if k is directly after the number)
          if (message.toLowerCase().includes(amount + 'k') && !amount.includes('k')) {
            amount = amount + '000';
            console.log('🔍 Added k suffix, amount now:', amount);
          }
          
          // Parse the amount
          downPayment = parseInt(amount.replace(/,/g, ''));
          console.log('🔍 Parsed down payment:', downPayment);
          
          // Validate reasonable down payment range
          if (downPayment >= 500 && downPayment <= 50000) {
            console.log('📋 Rule-based: Down payment detected:', downPayment);
            break;
          } else {
            console.log('⚠️ Down payment outside range:', downPayment);
            downPayment = null;
          }
        }
      }
      
      if (downPayment) {
        if (!slots.finance) {
          slots.finance = {};
        }
        slots.finance.down_payment = downPayment;
        slots.finance.down_payment_provided = true;
        console.log('📋 Rule-based: Down payment stored:', downPayment);
      }
    }
    
    // Feature detection - look for common vehicle features
    const featureKeywords = [
      'navigation', 'gps', 'backup camera', 'rear camera', 'safety', 'entertainment',
      'sunroof', 'moonroof', 'leather', 'heated seats', 'cooled seats', 'ventilated seats',
      'cargo space', 'third row', 'seating', 'comfort', 'performance', 'fuel efficiency',
      'technology', 'bluetooth', 'usb', 'charging', 'premium audio', 'sound system',
      'cruise control', 'adaptive cruise', 'lane keeping', 'blind spot', 'parking assist',
      'all wheel drive', 'awd', 'four wheel drive', '4wd', 'towing', 'roof rack'
    ];
    
    const mentionedFeatures = [];
    featureKeywords.forEach(feature => {
      if (text.includes(feature)) {
        mentionedFeatures.push(feature);
      }
    });
    
    if (mentionedFeatures.length > 0) {
      slots.qualification.preferred_features = mentionedFeatures;
      slots.qualification.features_mentioned = true;
      console.log('📋 Rule-based: Features qualification detected:', mentionedFeatures);
    }

    if (text.includes("first time")) {
      slots.buyer_profile = { first_time: true };
    }
    if (text.includes("family")) {
      slots.buyer_profile = { ...slots.buyer_profile, family: true };
    }
    if (text.includes("luxury")) {
      slots.buyer_profile = { ...slots.buyer_profile, luxury_buyer: true };
    }

    // FINANCING METHOD DETECTION - CRITICAL FOR CONVERSATION FLOW
    console.log('🔍 Checking for financing method selection in message:', message);
    
    // ✅ CONTEXT-AWARE: Check if financing method was already established in conversation
    const existingFinancingMethod = conversationContext.Daivesteps?.[6]?.slots?.qualification?.financing_method;
    const existingCreditScore = conversationContext.Daivesteps?.[6]?.slots?.qualification?.credit_score;
    
    if (text.includes('cash') || text.includes('pay cash') || text.includes('cash payment')) {
      slots.finance = {
        ...slots.finance,
        mode: 'cash',
        preferred_method: 'cash',
        method_selected: true
      };
      slots.qualification = {
        ...slots.qualification,
        credit_situation: 'cash_buyer',
        financing_method: 'cash'
      };
      slots.stage = 'qualification';
      console.log('💰 Cash payment selected via NLP extraction');
    } else if (text.includes('finance') || text.includes('loan') || text.includes('financing') || 
               text.includes('i want to go finance') || text.includes('i would like to finance') ||
               text.includes('i want finance') || text.includes('go with finance')) {
      slots.finance = {
        ...slots.finance,
        mode: 'finance',
        preferred_method: 'finance',
        method_selected: true
      };
      slots.qualification = {
        ...slots.qualification,
        credit_situation: 'needs_financing',
        financing_method: 'finance'
      };
      slots.stage = 'qualification';
      console.log('💰 Financing selected via NLP extraction');
    } else if (text.includes('lease') || text.includes('leasing')) {
      slots.finance = {
        ...slots.finance,
        mode: 'lease',
        preferred_method: 'lease',
        method_selected: true
      };
      slots.qualification = {
        ...slots.qualification,
        credit_situation: 'lease_candidate',
        financing_method: 'lease'
      };
      slots.stage = 'qualification';
      console.log('💰 Leasing selected via NLP extraction');
    } else if (conversationContext.currentJourneyStep === 'qualification' && existingFinancingMethod) {
      // ✅ CONTEXT-AWARE: Preserve existing financing method from previous messages
      slots.qualification = {
        ...slots.qualification,
        financing_method: existingFinancingMethod,
        credit_situation: existingFinancingMethod === 'cash' ? 'cash_buyer' : 
                         existingFinancingMethod === 'lease' ? 'lease_candidate' : 'needs_financing'
      };
      console.log('💰 Preserved existing financing method from context:', existingFinancingMethod);
    } else if (conversationContext.currentJourneyStep === 'qualification' && slots.finance?.down_payment) {
      // ✅ CONTEXT-AWARE: Infer financing method from down payment context
      slots.qualification = {
        ...slots.qualification,
        financing_method: 'finance',
        credit_situation: 'needs_financing'
      };
      console.log('💰 Inferred financing method from down payment context');
    }
    
    // ✅ CONTEXT-AWARE: Preserve existing credit score from previous messages
    if (existingCreditScore && !slots.qualification?.credit_score) {
      slots.qualification = {
        ...slots.qualification,
        credit_score: existingCreditScore
      };
      console.log('💰 Preserved existing credit score from context:', existingCreditScore);
    }

    // TEST DRIVE COMPLETION DETECTION - CRITICAL FOR CONVERSATION FLOW
    console.log('🔍 Checking for test drive completion in message:', message);
    
    // Test drive completion patterns
    const testDriveCompletionPatterns = [
      /drive.*was.*great/i,
      /glad.*drive.*was.*great/i,
      /i.*am.*glad.*drive/i,
      /i.*am.*glad.*it.*was.*great/i,
      /its.*was.*great.*drive/i,
      /it.*was.*great.*drive/i,
      /the.*drive.*was.*great/i,
      /test.*drive.*done/i,
      /finished.*test.*drive/i,
      /test.*drove.*it/i,
      /drove.*it/i,
      /loved.*that/i,
      /loved.*the.*drive/i,
      /enjoyed.*the.*drive/i,
      /drive.*was.*good/i,
      /drive.*was.*excellent/i,
      /drive.*was.*amazing/i,
      /test.*drive.*was.*great/i,
      /test.*drive.*was.*good/i,
      /test.*drive.*was.*excellent/i
    ];
    
    const hasTestDriveCompletion = testDriveCompletionPatterns.some(pattern => pattern.test(message));
    
    if (hasTestDriveCompletion) {
      // Initialize test_drive slot if not exists
      if (!slots.test_drive) {
        slots.test_drive = {};
      }
      
      slots.test_drive.completion_status = 'completed';
      slots.test_drive.step = 'completed';
      slots.test_drive.hasConfirmedInterest = true;
      slots.test_drive.deal_ready = true;
      slots.test_drive.review_collected = true;
      
      // Advance to trade evaluation stage
      slots.stage = 'trade_evaluation';
      
      console.log('🚗 Test drive completion detected via NLP extraction:', message);
    }

    // FINANCING OPTION SELECTION DETECTION - RULE-BASED EXTRACTION
    console.log('🔍 Checking for financing option selection in rule-based extraction:', message);
    
    // Financing option selection patterns
    const financingOptionPatterns = [
      /go.*with.*extended.*term/i,
      /go.*with.*standard.*term/i,
      /go.*with.*short.*term/i,
      /extended.*term/i,
      /standard.*term/i,
      /short.*term/i,
      /option.*1/i,
      /option.*2/i,
      /option.*3/i,
      /first.*option/i,
      /second.*option/i,
      /third.*option/i,
      /choose.*extended/i,
      /choose.*standard/i,
      /choose.*short/i,
      /select.*extended/i,
      /select.*standard/i,
      /select.*short/i,
      /prefer.*extended/i,
      /prefer.*standard/i,
      /prefer.*short/i
    ];
    
    const hasFinancingOptionSelection = financingOptionPatterns.some(pattern => pattern.test(message));
    
    if (hasFinancingOptionSelection) {
      // Initialize finance slot if not exists
      if (!slots.finance) {
        slots.finance = {};
      }
      
      // Determine selected option
      let selectedOption = 'standard';
      if (/extended/i.test(message)) {
        selectedOption = 'extended';
      } else if (/short/i.test(message)) {
        selectedOption = 'short';
      } else if (/option.*1|first/i.test(message)) {
        selectedOption = 'option1';
      } else if (/option.*2|second/i.test(message)) {
        selectedOption = 'option2';
      } else if (/option.*3|third/i.test(message)) {
        selectedOption = 'option3';
      }
      
      slots.finance.selected_option = selectedOption;
      slots.finance.option_selected = true;
      
      // Advance to purchase commitment stage
      slots.stage = 'purchase_commitment';
      
      console.log('💰 Financing option selection detected via rule-based extraction:', selectedOption);
    }

    return slots;
  }

  normalizeExtractedSlots(data) {
    const out = {};
    
    // Handle both direct data and vehicle_preferences wrapper
    const sourceData = data.vehicle_preferences || data;
    
    if (sourceData) {
      Object.assign(out, sourceData);
      
      // CRITICAL FIX: Map 'color' to 'color_tone' for mandatory slot validation
      if (sourceData.color) {
        out.color_tone = sourceData.color;
        console.log('🎨 Mapped AI color to color_tone:', sourceData.color);
      }
      
      // CRITICAL FIX: Map 'condition' to 'vehicle_condition' for mandatory slot validation
      if (sourceData.condition) {
        out.vehicle_condition = sourceData.condition;
        console.log('🚗 Mapped AI condition to vehicle_condition:', sourceData.condition);
      }
      
      // Handle multiple makes array
      if (sourceData.makes && Array.isArray(sourceData.makes)) {
        out.makes = sourceData.makes;
        // If we have multiple makes, set the first one as the primary make
        if (sourceData.makes.length > 0) {
          out.make = sourceData.makes[0];
        }
      }
      
      // Handle multiple models array
      if (sourceData.models && Array.isArray(sourceData.models)) {
        out.models = sourceData.models;
        // If we have multiple models, set the first one as the primary model
        if (sourceData.models.length > 0) {
          out.model = sourceData.models[0];
        }
      }
      
      // Direct mapping for make and model
      if (sourceData.make) {
        out.make = sourceData.make;
        console.log('🚗 Mapped AI make:', sourceData.make);
      }
      
      if (sourceData.model) {
        out.model = sourceData.model;
        console.log('🚗 Mapped AI model:', sourceData.model);
      }
      
      if (sourceData.vehicle_condition) {
        out.vehicle_condition = sourceData.vehicle_condition;
        console.log('🚗 Mapped AI vehicle_condition:', sourceData.vehicle_condition);
      }
      
      if (sourceData.vehicle_type) {
        // Normalize vehicle type: map "car" and "family car" to "sedan"
        let normalizedType = sourceData.vehicle_type.toLowerCase().trim();
        
        // Map common variations to sedan
        if (normalizedType === 'car' || 
            normalizedType === 'family car' || 
            normalizedType === 'family vehicle' ||
            normalizedType === 'family' ||
            normalizedType === 'regular car') {
          normalizedType = 'sedan';
          console.log('🚗 Normalized vehicle_type from "' + sourceData.vehicle_type + '" to "sedan"');
        }
        
        out.vehicle_type = normalizedType;
        console.log('🚗 Mapped AI vehicle_type:', normalizedType);
      }
    }
    // 🚀 ENHANCED: Comprehensive budget extraction validation and processing
    if (data.budget) {
      console.log('💰 Processing AI extracted budget:', data.budget);
      
      // Validate and normalize budget structure
      if (typeof data.budget === 'object') {
        const normalizedBudget = {};
        
        // Process target_price
        if (data.budget.target_price) {
          const targetPrice = Number(data.budget.target_price);
          if (!isNaN(targetPrice) && targetPrice > 0) {
            normalizedBudget.target_price = targetPrice;
            console.log('✅ Valid target_price:', targetPrice);
          } else {
            console.log('⚠️ Invalid target_price, skipping:', data.budget.target_price);
          }
        }
        
        // Process max_price
        if (data.budget.max_price) {
          const maxPrice = Number(data.budget.max_price);
          if (!isNaN(maxPrice) && maxPrice > 0) {
            normalizedBudget.max_price = maxPrice;
            console.log('✅ Valid max_price:', maxPrice);
          } else {
            console.log('⚠️ Invalid max_price, skipping:', data.budget.max_price);
          }
        }
        
        // 🚀 NEW: If only max_price is available, set target_price to max_price for consistency
        if (normalizedBudget.max_price && !normalizedBudget.target_price) {
          normalizedBudget.target_price = normalizedBudget.max_price;
          console.log('🔄 Set target_price to max_price for consistency:', normalizedBudget.target_price);
        }
        
        // Only set budget if we have valid values
        if (normalizedBudget.target_price || normalizedBudget.max_price) {
          out.budget = normalizedBudget;
          console.log('✅ Final normalized budget:', normalizedBudget);
        } else {
          console.log('⚠️ No valid budget values found, skipping budget');
        }
      } else if (typeof data.budget === 'number') {
        // Convert single number to target_price
        const budgetValue = Number(data.budget);
        if (!isNaN(budgetValue) && budgetValue > 0) {
          out.budget = { target_price: budgetValue };
          console.log('🔧 Converted single budget number to target_price:', budgetValue);
        } else {
          console.log('⚠️ Invalid budget number, skipping:', data.budget);
        }
      } else if (typeof data.budget === 'string') {
        // Try to parse string budget
        const budgetStr = data.budget.toLowerCase().trim();
        let budgetValue = null;
        
        // Handle "k" notation
        if (budgetStr.includes('k')) {
          const match = budgetStr.match(/(\d+(?:\.\d+)?)\s*k/i);
          if (match) {
            budgetValue = parseFloat(match[1]) * 1000;
          }
        }
        // Handle comma-separated numbers
        else if (budgetStr.includes(',')) {
          budgetValue = parseFloat(budgetStr.replace(/,/g, ''));
        }
        // Handle regular numbers
        else {
          budgetValue = parseFloat(budgetStr);
        }
        
        if (!isNaN(budgetValue) && budgetValue > 0) {
          out.budget = { target_price: budgetValue };
          console.log('🔧 Converted string budget to target_price:', budgetValue);
        } else {
          console.log('⚠️ Could not parse budget string, skipping:', data.budget);
        }
      }
    }
    if (data.features) {
      out.features = data.features;
    }
    if (data.buyer_profile) {
      out.buyer_profile = data.buyer_profile;
    }
    if (data.test_drive) {
      out.test_drive = data.test_drive;
    }
    if (data.finance) {
      out.finance = data.finance;
    }
    if (data.trade_in) {
      out.trade_in = data.trade_in;
    }
    if (data.timeline) {
      out.timeline = data.timeline;
    }
        if (data.qualification) {
          out.qualification = data.qualification;
        }
        if (data.conversation) {
          out.conversation = data.conversation;
        }
        if (data.journeyStep) {
          out.journeyStep = data.journeyStep;
        }
        if (data.stage) {
          out.stage = data.stage;
        }
        return out;
  }


  generateCacheKey(userMessage, context) {
    return `${userMessage.toLowerCase()}_${JSON.stringify(context).slice(0, 100)}`;
  }

  getPerformanceStats() {
    return {
      ...this.performanceStats,
      nlpAccuracy: this.performanceStats.totalExtractions > 0
        ? (this.performanceStats.nlpExtractions / this.performanceStats.totalExtractions) * 100
        : 0,
      cacheHitRate: this.performanceStats.totalExtractions > 0
        ? (this.performanceStats.cacheHits / this.performanceStats.totalExtractions) * 100
        : 0
    };
  }

  clearCache() {
    this.extractionCache.clear();
  }

  /**
   * Check if a number is part of a year pattern (e.g., 2018, 2020, etc.)
   */
  isYearPattern(message, number) {
    const messageLower = message.toLowerCase();
    
    // Check for 4-digit years (2018-2025)
    if (number >= 2018 && number <= 2025) {
      return true;
    }
    
    // Check if the number appears in a year context
    const yearPattern = new RegExp(`\\b${number}\\b.*(?:year|model|car|vehicle)`, 'i');
    if (yearPattern.test(message)) {
      return true;
    }
    
    // Check if it's part of a year range or specific year mention
    const yearContextPattern = new RegExp(`(?:19|20)\\d{2}.*${number}|${number}.*(?:19|20)\\d{2}`, 'i');
    if (yearContextPattern.test(message)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if a number is part of a month term pattern (e.g., 60-month, 36-month loan)
   */
  isMonthTermPattern(message, number) {
    const messageLower = message.toLowerCase();
    
    // Check for month terms
    const monthPattern = new RegExp(`\\b${number}\\s*[-]?month`, 'i');
    if (monthPattern.test(messageLower)) {
      return true;
    }
    
    // Check for loan term patterns
    const loanTermPattern = new RegExp(`\\b${number}\\s*(?:year|yr)\\s*(?:loan|term)`, 'i');
    if (loanTermPattern.test(messageLower)) {
      return true;
    }
    
    // Check for financing term patterns
    const financingPattern = new RegExp(`\\b${number}\\s*(?:month|mo)\\s*(?:financing|loan|payment)`, 'i');
    if (financingPattern.test(messageLower)) {
      return true;
    }
    
    return false;
  }
}

// module.exports = NLPEnhancedSlotExtraction;

export default NLPEnhancedSlotExtraction;
