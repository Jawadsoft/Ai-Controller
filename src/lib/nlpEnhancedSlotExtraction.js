// NLP-Enhanced Slot Extraction for DAIVE
// This module provides AI-powered slot extraction with semantic understanding

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';

class NLPEnhancedSlotExtraction {
  constructor(openaiApiKey, options = {}) {
    this.llm = new ChatOpenAI({
      apiKey: openaiApiKey,
      model:  'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 150, // 🔧 Increased for complete JSON responses
      timeout: 3000   // 🚀 Optimized timeout for faster responses
    });

    this.embeddings = new OpenAIEmbeddings({ apiKey: openaiApiKey });
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
    this.maxRetries = options.maxRetries ?? 0;          // 🚀 No retry — rule-based fallback is faster than a second LLM attempt
    // Per-dealer cache for the built inventoryContext string injected into LLM prompts.
    // Built once on first use, reused for all subsequent messages (same process lifetime).
    this._inventoryContextCache = new Map(); // dealerId → string
    // Per-dealer cache for makes/models arrays used by rule-based extractor.
    this._makesCache  = new Map(); // dealerId → string[]
    this._modelsCache = new Map(); // dealerId → string[]
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
        
        // ✅ FIX: AI returning empty object is SUCCESS (means no slots found, not an error)
        if (aiSlots !== null && aiSlots !== undefined) {
          if (Object.keys(aiSlots).length > 0) {
          extractedSlots = { ...extractedSlots, ...aiSlots };
            console.log('✅ AI extraction successful - found', Object.keys(aiSlots).length, 'slot groups');
          } else {
            console.log('✅ AI extraction successful - no slots found in message (expected for greetings/casual chat)');
          }
          this.performanceStats.nlpExtractions++;
          aiSuccess = true;
        } else {
          console.warn('⚠️ AI extraction returned null/undefined');
        }
      } catch (err) {
        console.warn('⚠️ AI extraction failed, using rule-based fallback:', err.message);
        this.performanceStats.aiErrors++;
        
        // Retry once if configured
        if (this.maxRetries > 0) {
          try {
            console.log('🔄 Retrying AI extraction...');
            const retrySlots = await this.extractSlotsWithAI(userMessage, intentResult, conversationContext);
            if (retrySlots !== null && retrySlots !== undefined) {
              if (Object.keys(retrySlots).length > 0) {
              extractedSlots = { ...extractedSlots, ...retrySlots };
              }
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
    const intent = intentResult?.intent || 'conversational';

    // ── INTENT-DIRECT ROUTING ────────────────────────────────────────────────
    // Intent tells us WHAT to extract. Stage only matters for ambiguous intents.
    // This prevents wasted LLM calls (e.g. running test_drive extractor when
    // the intent is inventory_inquiry) and avoids cross-stage slot pollution.

    // 1. Intents that produce NO extractable slots — skip entirely
    const _skipIntents = new Set([
      'informational',
      'refinement_same_brand', 'refinement_other_brands', 'refinement_all_colors',
      'general_inquiry', 'greeting', 'farewell', 'complaint', 'compliment'
    ]);
    if (_skipIntents.has(intent)) {
      console.log(`⏭️ [NLP] Skipping extraction — intent "${intent}" produces no slots`);
      return {};
    }


    // inventory_count_query and inventory_inquiry both carry vehicle preference data
    // (features, type, make, budget). The intent classifier already distinguishes
    // "browsing" messages as inventory_browse_by_make/model/general, so no stage check
    // is needed here — intent alone is the correct gate.
    if (intent === 'inventory_count_query' || intent === 'inventory_inquiry') {
      console.log(`🔍 [NLP] ${intent} → extractVehicleSelectionSlotsWithAI (no stage gate — intent is sufficient)`);
      return await this.extractVehicleSelectionSlotsWithAI(userMessage, intentResult, conversationContext);
    }


    // Browse sub-intents + refinement_budget are all sub-intents of slot_collection_vehicle.
    // Always run the parent extractor regardless of stage:
    //   • Safe  — returns {} if the message contains nothing extractable
    //   • Useful — captures make/model/budget even when the classifier chose a sub-intent
    //   • Persistent — writes to vehicle_selection Daivestep for cross-turn memory
    if (intent === 'inventory_browse_general' ||
        intent === 'inventory_browse_by_make'  ||
        intent === 'inventory_browse_by_model' ||
        intent === 'slot_collection_vehicle'||
        intent === 'refinement_budget') {
      console.log(`🔍 [NLP] ${intent} (sub-intent of slot_collection_vehicle) → extractVehicleSelectionSlotsWithAI`);
      return await this.extractVehicleSelectionSlotsWithAI(userMessage, intentResult, conversationContext);
    }

    // 2. Intents that map directly to a specific extractor regardless of stage
    if (
      intent === 'test_drive_request' ||
      intent === 'slot_collection_test_drive' ||
      intent === 'contextual_affirmation_test_drive' ||
      (intent?.startsWith('contextual_affirmation') && currentStep === 'test_drive')
    ) {
      console.log(`🚗 [NLP] ${intent} → extractTestDriveSlotsWithAI (stage: ${currentStep})`);
      return await this.extractTestDriveSlotsWithAI(userMessage, intentResult, conversationContext);
    }

    if (intent === 'trade_inquiry' || intent === 'slot_collection_trade') {
      const slots = await this.extractTradeEvaluationSlotsWithAI(userMessage, intentResult, conversationContext);
      // Write directly to Daivesteps regardless of current stage — no buffering needed.
      // extractStepFieldsFromMessage uses _writeTradeIn which is intent-gated, not stage-gated.
      console.log(`🚗 [NLP] Trade slots extracted (stage: ${currentStep}) — writing directly`);
      return slots;
    }

    if (intent === 'financing_options' || intent === 'slot_collection_finance') {
      const slots = await this.extractQualificationSlotsWithAI(userMessage, intentResult, conversationContext);
      // Write directly to Daivesteps regardless of current stage — no buffering needed.
      // extractStepFieldsFromMessage uses _writeQualification which is intent-gated, not stage-gated.
      console.log(`💳 [NLP] Financing slots extracted (stage: ${currentStep}) — writing directly`);
      return slots;
    }


    // 3. Ambiguous intents (slot_collection / conversational / contextual_affirmation):
    //    route by current stage — the stage tells us what the user is LIKELY filling in
    // switch (currentStep) {
    //   case 'test_drive':
    //     return await this.extractTestDriveSlotsWithAI(userMessage, intentResult, conversationContext);

    //   case 'trade_evaluation':
    //     return await this.extractTradeEvaluationSlotsWithAI(userMessage, intentResult, conversationContext);

    //   case 'qualification':
    //     return await this.extractQualificationSlotsWithAI(userMessage, intentResult, conversationContext);

    //   case 'purchase_commitment':
    //     return await this.extractPurchaseCommitmentSlotsWithAI(userMessage, intentResult, conversationContext);

    //   default: // inquiry, lead_capture, vehicle_selection
    //     return await this.extractVehicleSelectionSlotsWithAI(userMessage, intentResult, conversationContext);
    // }
    // ── END INTENT-DIRECT ROUTING ────────────────────────────────────────────
  }

  /**
   * ✅ VEHICLE SELECTION EXTRACTION (Stages 1-2)
   * Handles: vehicle preferences, budget, make/model, inventory selection
   * Only runs for: inquiry, vehicle_selection
   */
  async extractVehicleSelectionSlotsWithAI(userMessage, intentResult, conversationContext = {}) {
    const normalizedMessage = userMessage;

    // ── Inventory context: build once per dealer, reuse on every subsequent call ──
    let inventoryContext = '';
    const _dealerId = conversationContext.dealerId;
    if (_dealerId) {
      if (this._inventoryContextCache.has(_dealerId)) {
        inventoryContext = this._inventoryContextCache.get(_dealerId);
      } else {
        try {
          const inventoryService = global.inventoryService || this.inventoryService;
          if (inventoryService) {
            const cacheData = await inventoryService.getCachedMakesAndModels(_dealerId);
            if (cacheData && cacheData.makes && cacheData.modelsByMake) {
              const availableMakes = cacheData.makes.slice(0, 12)
                .map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ');
              const availableModels = Object.entries(cacheData.modelsByMake).slice(0, 8)
                .map(([make, models]) => {
                  const cm = make.charAt(0).toUpperCase() + make.slice(1);
                  return `${cm}: ${models.slice(0, 8).map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ')}`;
                }).join('; ');

              // Build a flat model→make lookup so the LLM can resolve a model name to its
              // correct make even when the user doesn't mention the brand.
              const modelMakeEntries = [];
              for (const [make, models] of Object.entries(cacheData.modelsByMake)) {
                const cm = make.charAt(0).toUpperCase() + make.slice(1);
                for (const model of (models || [])) {
                  const cmodel = model.charAt(0).toUpperCase() + model.slice(1);
                  modelMakeEntries.push(`${cmodel}→${cm}`);
                }
              }
              const modelMakeLookup = modelMakeEntries.join(', ');

              let typeMapContext = '';
              if (cacheData.typeByModel && Object.keys(cacheData.typeByModel).length > 0) {
                const typeList = Object.entries(cacheData.typeByModel).slice(0, 20)
                  .map(([model, type]) => `${model}→${type}`).join(', ');
                typeMapContext = `\nMODEL TYPES: ${typeList}`;
              }

              inventoryContext = `\nDEALER INVENTORY — use this to identify make/model/type:\nMakes in stock: ${availableMakes}\nModels by make: ${availableModels}\nMODEL→MAKE LOOKUP: ${modelMakeLookup}${typeMapContext}` +
                `\nCRITICAL: If the user mentions a model name that appears in MODEL→MAKE LOOKUP, ALWAYS set the corresponding make. Example: "santa cruz"→make=Hyundai,model=Santa Cruz | "tucson"→make=Hyundai,model=Tucson | "wrangler"→make=Jeep,model=Wrangler` +
                `\nAlso use MODEL TYPES to infer vehicle_type when the user names a model but not a type.`;
              this._inventoryContextCache.set(_dealerId, inventoryContext);
              console.log(`✅ [NLP] Cached inventoryContext for dealer ${_dealerId}`);
            }
          }
        } catch (err) {
          console.warn('⚠️ Could not build inventory context for AI:', err.message);
        }
      }
    }

    // ── Slimmed system prompt (~380 tokens vs ~1100 previously) ──────────────────
    const systemPrompt = `Extract car dealership slot data. Return ONLY valid JSON, no markdown.

FIELDS (omit fields not mentioned):
- vehicle_condition: "new"|"used"|"pre-owned"|"certified"
- vehicle_type: "SUV"|"truck"|"sedan"|"hatchback"|"crossover"|"coupe"|"van"|"minivan" — "car"/"family car" → leave empty; "pickup"→"truck"
- make: ALWAYS extract when any car brand is mentioned — inventory/show/have queries count as buying interest.
  Use your automotive knowledge to recognize and normalize misspellings, spacing variations, abbreviations, and phonetic spellings. Return the official brand name. NEVER return the user's typo.
  If confidence is low or the word could equally be a feature descriptor (hybrid, electric, luxury, sport, turbo, lifted) rather than a brand, OMIT make and extract as a feature instead.
  Known brands: Jeep, Toyota, Honda, Ford, Chevrolet, Nissan, Hyundai, Kia, BMW, Mercedes, Audi, Lexus,
  Subaru, Mazda, Dodge, Ram, Chrysler, Buick, Cadillac, Lincoln, Genesis, GMC, Volvo, Mitsubishi, Tesla,
  Rivian, Volkswagen, Acura, Infiniti, Land Rover, Porsche, Jaguar, Mini, Alfa Romeo, Scout, Lucid, Polestar.
  (NOT for compare/vs/between questions)
- model: only if a specific model is named (NOT for compare/vs/between questions).
  Use your automotive knowledge to recognize and normalize misspellings, spacing variations, abbreviations, and phonetic spellings. Return the official model name. NEVER return the user's typo.
  If confidence is low or multiple models are equally likely, omit the model rather than guessing.
- trim: the specific trim level if named (SE, SEL, XRT, Limited, N-Line, XSE, Touring, Sport, Premium, Base, etc.)
  Extract only when the user explicitly names a trim level — do NOT infer or guess from model alone.
  Examples: "the SEL" → "SEL" | "XRT trim" → "XRT" | "Limited version" → "Limited" | "want the N-Line" → "N-Line"
  If no trim is mentioned, omit this field.
- budget: {"max_price":N} for "under/up to/max Xk/$X"; {"target_price":N} for "around/about/budget Xk"; bare "Xk" alone → target_price
- color_tone: "white"|"black"|"silver"|"red"|"blue"|"gray"|"light"|"dark"
- max_mileage: number — "low mileage"→50000; "under Xk miles"→X*1000; "Xk miles" is mileage NOT budget
- min_mileage: number — only for "high mileage" searches
- features: array — sunroof, AWD, leather seats, heated seats, backup camera, navigation, Apple CarPlay, Android Auto, hybrid, electric, automatic, manual, third row, 7-seater, bluetooth, cruise control, safety features, etc.
  Use your automotive knowledge to recognize and normalize misspellings of feature words.
  "hybrd"/"hybrib"/"hydib"/"hybid" → "hybrid" | "lether" → "leather seats" | "sunruf"→"sunroof" | "awd"/"4wd"/"4x4"→"AWD"
  IMPORTANT: Words like "hybrid", "electric", "luxury", "sport", "lifted", "turbo" that appear before or after a vehicle type are ALWAYS features — never treat them as make names.

RULES:
- "Xk miles" / "X,000 miles" = max_mileage, NOT budget
- Bare "Xk" with no miles word = budget target_price
- "compare/vs/versus/between X and Y" → return {}
- features always as array even if one item
- Convert k→thousands (25k=25000)
- "show me [make] inventory" / "do you have [make]" / "[make] inventory" → ALWAYS extract make
- Any descriptor word between "I am looking" / "I want" and a vehicle type (SUV, sedan, truck) is almost certainly a feature or condition — extract it as a feature, not a make${inventoryContext}

EXAMPLES:
{"vehicle_condition":"new","vehicle_type":"SUV","make":"Hyundai","model":"Tucson","budget":{"max_price":30000}}  ← "new Hyundai Tucson SUV under 30k"
{"make":"Hyundai","model":"Palisade"}  ← "show me Hyundai Palisade"
{"make":"Toyota","model":"RAV4"}  ← "find me a Toyota RAV4"
{"make":"Jeep"}  ← "show me jeep inventory"
{"make":"Jeep"}  ← "do you have jeeps"
{"make":"Jeep","model":"Wrangler"}  ← "jeep wrangler"
{"make":"Hyundai","model":"Santa Fe","trim":"SEL"}  ← "I want the Santa Fe SEL"
{"make":"Hyundai","model":"Santa Fe","trim":"XRT"}  ← "thinking about the XRT"
{"trim":"Limited"}  ← "maybe the Limited version"
{"vehicle_type":"SUV","features":["leather seats","AWD"]}  ← "SUV with leather seats and AWD"
{"vehicle_type":"SUV","features":["hybrid"]}  ← "hybrid SUV" / "I am looking hybrid suvs" / "hydib suv"
{"vehicle_type":"sedan","features":["electric"]}  ← "electric car" / "electric sedan"
{"vehicle_type":"SUV","features":["hybrid"],"make":"Hyundai"}  ← "Hyundai hybrid SUV"
{"budget":{"target_price":25000},"max_mileage":30000}  ← "under 30k miles budget 25k"
{"color_tone":"dark"}  ← "dark colors" / "i am looking dark colors" / "any dark color options"
{"color_tone":"white"}  ← "white ones" / "show me white" / "prefer white color"
{"color_tone":"light"}  ← "light colors" / "something in a light color"
{}  ← "compare Tucson vs Sorento"`;



    const userPrompt = `Extract from: "${normalizedMessage}". Return ONLY valid JSON.`;

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

      // ── POST-PARSE HALLUCINATION GUARD ───────────────────────────────────────
      // If NLP extracted a make/model that doesn't exist in the dealer's inventory,
      // it's almost certainly a hallucination from a malformed/repaired JSON response.
      // In that case, prefer intentResult.extracted_info (from detectWithAI) as fallback.
      if (parsed.make || parsed.model) {
        const _summary = conversationContext?._dealerInventorySummary;
        if (_summary?.modelsByMake && parsed.make) {
          const _makeKey  = parsed.make.toLowerCase();
          const _knownMakes = Object.keys(_summary.modelsByMake);
          const _makeKnown  = _knownMakes.includes(_makeKey);

          if (!_makeKnown) {
            // Make not in dealer inventory — likely hallucinated; fall back to detectWithAI
            const _bei = intentResult?.extracted_info;
            if (_bei?.mentioned_make) {
              console.warn(`⚠️ [NLP] Hallucination guard: make "${parsed.make}" not in dealer inventory → replacing with detectWithAI: ${_bei.mentioned_make}/${_bei.mentioned_model || ''}`);
              parsed.make  = _bei.mentioned_make;
              if (_bei.mentioned_model) parsed.model = _bei.mentioned_model;
            } else {
              console.warn(`⚠️ [NLP] Hallucination guard: make "${parsed.make}" not in dealer inventory, no detectWithAI fallback — clearing make/model`);
              delete parsed.make;
              delete parsed.model;
            }
          } else if (parsed.model) {
            // Make is valid — now verify the model belongs to that make
            const _knownModels = (_summary.modelsByMake[_makeKey] || []).map(m => m.toLowerCase());
            const _modelKey = parsed.model.toLowerCase().replace(/\s+/g, ' ').trim();
            if (_knownModels.length > 0 && !_knownModels.some(km => km.replace(/\s+/g, ' ') === _modelKey)) {
              const _bei = intentResult?.extracted_info;
              if (_bei?.mentioned_model && _bei?.mentioned_make?.toLowerCase() === _makeKey) {
                console.warn(`⚠️ [NLP] Hallucination guard: model "${parsed.model}" not under ${parsed.make} → replacing with detectWithAI model: ${_bei.mentioned_model}`);
                parsed.model = _bei.mentioned_model;
              } else {
                console.warn(`⚠️ [NLP] Hallucination guard: model "${parsed.model}" not under ${parsed.make} — clearing model`);
                delete parsed.model;
              }
            }
          }
        }
      }
      // ── END HALLUCINATION GUARD ───────────────────────────────────────────────

      // Financing method detection — only apply during the qualification stage.
      // Applying it at earlier stages (inquiry, vehicle_selection, etc.) causes
      // false positives: words like "financing" in "show me financing options" or
      // "lease" in an inventory query silently overwrite qualification slots before
      // the user has even been asked about payment method.
      const _currentStep = conversationContext?.currentJourneyStep || '';
      const _isQualificationStage = _currentStep === 'qualification';
      const text = userMessage.toLowerCase();

      if (_isQualificationStage) {
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
      } else {
        // Outside qualification stage — strip any finance/qualification data the AI may
        // have hallucinated so it cannot pre-fill Step 6 slots prematurely.
        // EXCEPTION: when the intent is explicitly finance-collection, allow those slots
        // through even if currentJourneyStep hasn't advanced to 'qualification' yet.
        const _isFinanceIntent = intentResult?.intent === 'slot_collection_finance' || intentResult?.intent === 'financing_options';
        if (!_isFinanceIntent) {
          delete parsed.finance;
          if (parsed.qualification) {
            delete parsed.qualification.financing_method;
            delete parsed.qualification.credit_situation;
            if (Object.keys(parsed.qualification).length === 0) delete parsed.qualification;
          }
          if (parsed.stage === 'qualification') delete parsed.stage;
        }
      }
      
      // Add credit score detection to AI extraction
      if (text.includes('credit') || text.includes('score') || 
          text.includes('750') || text.includes('700') || text.includes('650') ||
          text.includes('excellent') || text.includes('good') || text.includes('fair') ||
          text.includes('below 650') || text.includes('above 750')) {
        
        let creditScore = null;
        let creditRange = null;
        
        // ✅ ENHANCED: Only detect credit scores with explicit context words
        const hasCreditContext = /credit|score|fico|rating/i.test(userMessage);
        
        // Detect specific credit score ranges ONLY if credit context exists
        if (hasCreditContext) {
          if (text.includes('750') || text.includes('excellent') || text.includes('750+')) {
            creditScore = '750+';
            creditRange = 'excellent';
          } else if (text.includes('700') || text.includes('700-749')) {
            creditScore = '700-749';
            creditRange = 'good';
          } else if (text.includes('650') || text.includes('650-699')) {
            creditScore = '650-699';
            creditRange = 'fair';
          } else if (text.includes('below 650')) {
            creditScore = 'below 650';
            creditRange = 'below average';
          }
          
          // Detect numeric credit scores (e.g., "my credit score is 700", "score: 750")
          const numericMatch = userMessage.match(/\b(\d{3})\b/);
          if (numericMatch && !creditScore) {
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
            } else if (score >= 300 && score < 650) {
              creditScore = 'below 650';
              creditRange = 'below average';
            }
          }
        }
        
        // ✅ ALSO detect credit quality words ONLY with credit context
        if (hasCreditContext && !creditScore) {
          if (text.includes('excellent')) {
            creditScore = '750+';
            creditRange = 'excellent';
          } else if (text.includes('good')) {
            creditScore = '700-749';
            creditRange = 'good';
          } else if (text.includes('fair')) {
            creditScore = '650-699';
            creditRange = 'fair';
          } else if (text.includes('poor') || text.includes('bad')) {
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
          text.includes('can make') || text.includes('can put down') || text.includes('have') ||
          text.includes('%') || text.includes('percent')) {
        let downPayment = null;
        let isPercentage = false;
        
        // 🔥 NEW: Check for percentage-based down payment first
        const percentagePatterns = [
          /(\d{1,2})%\s*(?:down|downpayment|down payment)?/i,
          /(\d{1,2})\s*percent\s*(?:down|downpayment|down payment)?/i,
          /(?:can make|can put down|make)\s*(\d{1,2})%/i,
          /(?:can make|can put down|make)\s*(\d{1,2})\s*percent/i
        ];
        
        // Try to extract a vehicle price stated inline in the same message
        // e.g. "value amount is 40000", "car costs 35000", "vehicle worth 28000"
        const inlineVehiclePricePatterns = [
          /(?:value|price|cost|worth|amount)\s+(?:is|are|of|=)?\s*\$?(\d{1,3}(?:,\d{3})*|\d{4,6})/i,
          /(?:car|vehicle|auto)\s+(?:is|costs?|worth|priced)\s+\$?(\d{1,3}(?:,\d{3})*|\d{4,6})/i,
          /\$?(\d{1,3}(?:,\d{3})*|\d{4,6})\s+(?:car|vehicle|auto)/i
        ];
        let inlineVehiclePrice = null;
        for (const vp of inlineVehiclePricePatterns) {
          const vpMatch = userMessage.match(vp);
          if (vpMatch) {
            const candidate = parseFloat(vpMatch[1].replace(/,/g, ''));
            if (candidate >= 5000 && candidate <= 200000) {
              inlineVehiclePrice = candidate;
              console.log(`🚗 Inline vehicle price extracted from message: $${inlineVehiclePrice}`);
              break;
            }
          }
        }

        for (const pattern of percentagePatterns) {
          const match = userMessage.match(pattern);
          if (match) {
            const percentage = parseInt(match[1]);
            if (percentage > 0 && percentage <= 100) {
              // Get vehicle price: prefer inline message value, then conversation context
              const vehiclePrice = inlineVehiclePrice ||
                                   conversationContext.Daivesteps?.[6]?.slots?.finance?.stated_vehicle_price ||
                                   conversationContext.Daivesteps?.[2]?.budget?.target_price || 
                                   conversationContext.Daivesteps?.[2]?.budget?.max_price ||
                                   conversationContext.Daivesteps?.[1]?.price;
              
              if (vehiclePrice) {
                const priceValue = parseFloat(vehiclePrice);
                downPayment = Math.round((priceValue * percentage) / 100 * 100) / 100; // Round to 2 decimals
                isPercentage = true;
                console.log(`💰 Percentage-based down payment detected: ${percentage}% of $${priceValue} = $${downPayment}`);
                break;
              } else {
                console.warn('⚠️ Percentage down payment detected but vehicle price not available in context');
              }
            }
          }
        }

        // If we found an inline vehicle price, store it in parsed.finance
        if (inlineVehiclePrice) {
          parsed.finance = parsed.finance || {};
          parsed.finance.stated_vehicle_price = inlineVehiclePrice;
        }
        
        // If no percentage match, try dollar amount patterns
        if (!downPayment) {
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
            /can make\s*\$?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)\s*(?:down)?/i,
            /can put down\s*\$?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/i,
            /have\s*\$?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)\s*(?:for|as|down)/i,
            // Simple number patterns when context suggests down payment
            /^\s*\$?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)\s*$/i
          ];
          
          for (const pattern of downPaymentPatterns) {
            const match = userMessage.match(pattern);
            if (match) {
              let amount = match[1];
              
              // 🔥 FIX: Don't add '000' if user said percentage - check for % in message
              if (userMessage.includes('%') || userMessage.toLowerCase().includes('percent')) {
                continue; // Skip this pattern, already handled above
              }
              
              // Handle 'k' suffix for thousands
              if (userMessage.toLowerCase().includes('k') && !amount.includes('k') && 
                  !userMessage.includes('%') && !userMessage.toLowerCase().includes('percent')) {
                amount = amount + '000';
              }
              
              // Parse the amount
              downPayment = parseFloat(amount.replace(/,/g, ''));
              
              // Validate reasonable down payment range
              if (downPayment >= 500 && downPayment <= 50000) {
                console.log('💰 Down payment detected via AI extraction:', downPayment);
                break;
              } else {
                downPayment = null;
              }
            }
          }
        }
        
        if (downPayment) {
          parsed.finance = {
            ...parsed.finance,
            down_payment: downPayment,
            down_payment_provided: true,
            down_payment_type: isPercentage ? 'percentage' : 'fixed'
          };
          console.log('💰 Down payment stored via AI extraction:', downPayment, isPercentage ? '(percentage-based)' : '(fixed amount)');
        }
      }
      
      // NOTE: Test drive completion detection moved to extractTestDriveSlotsWithAI method
    
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
//   async extractQualificationSlotsWithAI(userMessage, intentResult, conversationContext = {}) {
//     console.log('🎯 Using Qualification-Specific AI Extraction');
    
//     const systemPrompt = `Extract financial qualification information from customer messages. Return ONLY valid JSON.

// QUALIFICATION FIELDS (extract if mentioned):
// 1. FINANCING_METHOD: "cash", "finance", "lease"
// 2. CREDIT_SCORE: "excellent", "good", "fair", "poor" (based on ranges or specific numbers)
// 3. CREDIT_SCORE_EXACT: Preserve the exact numeric credit score if provided
// 4. DOWN_PAYMENT: Extract down payment amounts (both fixed amounts and percentages)
// 5. LEASE_TERM: Extract lease terms (24, 36, 48 months)
// 6. VEHICLE_PRICE: Extract any vehicle value/price the customer states (e.g. "value amount is 40000", "car costs 35000", "vehicle worth 28000", "price is 40000")

// QUALIFICATION EXAMPLES:
// Input: "I want to finance, my credit score is 690, I can make 10% down"
// Output: {
//   "qualification": {
//     "financing_method": "finance",
//     "credit_score": "fair",
//     "credit_score_exact": 690,
//     "credit_identified": true,
//     "credit_situation": "needs_financing"
//   },
//   "finance": {
//     "down_payment_percentage": 10,
//     "down_payment_type": "percentage"
//   }
// }

// Input: "I can make $5000 as down payment"
// Output: {
//   "qualification": {
//     "financing_method": "finance",
//     "credit_situation": "needs_financing"
//   },
//   "finance": {
//     "down_payment": 5000,
//     "down_payment_type": "fixed"
//   }
// }

// Input: "my credit score is 720"
// Output: {
//   "qualification": {
//     "credit_score": "good",
//     "credit_score_exact": 720,
//     "credit_identified": true
//   }
// }

// Input: "I want to lease for 36 months"
// Output: {
//   "qualification": {
//     "financing_method": "lease",
//     "credit_situation": "lease_candidate"
//   },
//   "finance": {
//     "lease_term": 36
//   }
// }

// Input: "what will my monthly payment if I go with 60 months"
// Output: {
//   "qualification": {
//     "financing_method": "finance",
//     "credit_situation": "needs_financing"
//   },
//   "finance": {
//     "loan_term": 60
//   }
// }

// Input: "I want to finance for 72 months"
// Output: {
//   "qualification": {
//     "financing_method": "finance",
//     "credit_situation": "needs_financing"
//   },
//   "finance": {
//     "loan_term": 72
//   }
// }

// Input: "I can put 20% down"
// Output: {
//   "qualification": {
//     "financing_method": "finance",
//     "credit_situation": "needs_financing"
//   },
//   "finance": {
//     "down_payment_percentage": 20,
//     "down_payment_type": "percentage"
//   }
// }

// Input: "my credit score is 700 and down is 10% value amount is 40000"
// Output: {
//   "qualification": {
//     "financing_method": "finance",
//     "credit_score": "good",
//     "credit_score_exact": 700,
//     "credit_identified": true,
//     "credit_situation": "needs_financing"
//   },
//   "finance": {
//     "down_payment_percentage": 10,
//     "down_payment_type": "percentage",
//     "stated_vehicle_price": 40000
//   }
// }

// Input: "I want to buy a car worth 35000 with 15% down"
// Output: {
//   "qualification": {
//     "financing_method": "finance",
//     "credit_situation": "needs_financing"
//   },
//   "finance": {
//     "down_payment_percentage": 15,
//     "down_payment_type": "percentage",
//     "stated_vehicle_price": 35000
//   }
// }

// CRITICAL QUALIFICATION RULES:
// - Always infer financing method from context (down payment = finance, lease term = lease, loan/finance term = finance)
// - Use finance.loan_term for finance/loan terms (36, 48, 60, 72 months) and finance.lease_term for lease terms (24, 36, 48 months)
// - Convert numeric credit scores to ranges (600 = poor, 650 = fair, 700 = good, 750 = excellent)
// - ALSO preserve exact numeric credit score in credit_score_exact field
// - For percentage-based down payments (e.g., "10%", "20 percent"), extract the percentage value in down_payment_percentage
// - For fixed down payments (e.g., "$5000"), extract the amount in down_payment field
// - Set down_payment_type to "percentage" or "fixed" based on input
// - Extract down payment amounts even without explicit "down payment" phrase
// - When the customer states any vehicle price/value/amount/cost, extract it into finance.stated_vehicle_price
// - Preserve existing qualification data from conversation context
// - Return structured qualification and finance objects
// - Handle partial information (e.g., just "financing" or just "I can make $3000")
// - If user says they completed/finished/submitted/done the application or form → set application.submitted: true, application.status: "completed". Example: "I completed the form" → {"application":{"submitted":true,"status":"completed"}}

// CRITICAL: Return ONLY valid JSON. No markdown, no explanations.`;

//     const userPrompt = `Extract qualification information from: "${userMessage}"

// Return ONLY valid JSON.`;

//     try {
//       const response = await this.llm.invoke([
//         new SystemMessage({ content: systemPrompt }),
//         new HumanMessage({ content: userPrompt })
//       ]);

//       // Parse AI response
//       let jsonContent = response.content.trim();
      
//       // Remove markdown code blocks if present
//       if (jsonContent.startsWith('```json')) {
//         jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
//       } else if (jsonContent.startsWith('```')) {
//         jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
//       }
      
//       // Clean up any remaining backticks or markdown artifacts
//       jsonContent = jsonContent.replace(/^`+|`+$/g, '').trim();
      
//       const parsed = JSON.parse(jsonContent);
      
//       // ✅ CONTEXT-AWARE: Preserve existing qualification data
//       const existingQualification = conversationContext.Daivesteps?.[6]?.slots?.qualification || {};
//       const existingFinance = conversationContext.Daivesteps?.[6]?.slots?.finance || {};
      
//       // Merge AI extraction with existing data
//       // Helper: returns the existing value unless the user explicitly stated a new payment method
//       // in the current message. Prevents the LLM silently overwriting confirmed values by
//       // inferring method from indirect context (e.g. month options → "lease").
//       const _msgLower = userMessage.toLowerCase();
//       const _hasExplicitMethod = _msgLower.includes('cash')     || _msgLower.includes('pay cash')  ||
//                                  _msgLower.includes('lease')    || _msgLower.includes('leasing')   ||
//                                  _msgLower.includes('finance')  || _msgLower.includes('financing') ||
//                                  _msgLower.includes('loan');
//       const _lockField = (existing, ai) => {
//         if (!existing) return ai;
//         if (!ai)       return existing;
//         return _hasExplicitMethod ? ai : existing;
//       };

//       const mergedQualification = {
//         ...existingQualification,
//         ...parsed.qualification,
//         // Lock both financing_method and credit_situation — they must only change
//         // when the user explicitly names a payment method in this message.
//         financing_method: _lockField(existingQualification.financing_method, parsed.qualification?.financing_method),
//         credit_situation: _lockField(existingQualification.credit_situation,  parsed.qualification?.credit_situation)
//       };
      
//       const mergedFinance = {
//         ...existingFinance,
//         ...parsed.finance
//       };
      
//       // 🔥 NEW: Calculate actual down payment from percentage if needed
//       if (mergedFinance.down_payment_percentage && !mergedFinance.down_payment) {
//         const vehiclePrice = mergedFinance.stated_vehicle_price ||
//                              conversationContext.Daivesteps?.[6]?.slots?.finance?.stated_vehicle_price ||
//                              conversationContext.Daivesteps?.[2]?.budget?.target_price || 
//                              conversationContext.Daivesteps?.[2]?.budget?.max_price ||
//                              conversationContext.Daivesteps?.[1]?.price;
        
//         if (vehiclePrice) {
//           const priceValue = parseFloat(vehiclePrice);
//           const percentage = mergedFinance.down_payment_percentage;
//           mergedFinance.down_payment = Math.round((priceValue * percentage) / 100 * 100) / 100;
//           console.log(`💰 Calculated down payment from ${percentage}%: $${mergedFinance.down_payment} (${percentage}% of $${priceValue})`);
//         }
//       }
      
//       console.log('🎯 Qualification AI Extraction Result:', {
//         qualification: mergedQualification,
//         finance: mergedFinance
//       });
      
//       // 🔥 CRITICAL FIX: Save extracted data back to conversationContext
//       if (!conversationContext.Daivesteps[6]) {
//         conversationContext.Daivesteps[6] = { slots: {} };
//       }
//       if (!conversationContext.Daivesteps[6].slots) {
//         conversationContext.Daivesteps[6].slots = {};
//       }
      
//       // Merge with existing data
//       conversationContext.Daivesteps[6].slots.qualification = {
//         ...conversationContext.Daivesteps[6].slots.qualification,
//         ...mergedQualification
//       };
//       conversationContext.Daivesteps[6].slots.finance = {
//         ...conversationContext.Daivesteps[6].slots.finance,
//         ...mergedFinance
//       };
      
//       console.log('✅ Saved qualification data to Daivesteps[6].slots');
      
//       // 🔥 CRITICAL: Detect application completion (rule-based fallback)
//       const applicationCompletionPatterns = /\b(complet(ed|e)|finish(ed)?|done|submitted?)\s+(the\s+)?(application|form|credit\s+app|financing\s+form)\b/i;
//       if (applicationCompletionPatterns.test(userMessage)) {
//         console.log('✅ Application completion detected via rule-based pattern!');
//         if (!conversationContext.Daivesteps[6].slots.application) {
//           conversationContext.Daivesteps[6].slots.application = {};
//         }
//         conversationContext.Daivesteps[6].slots.application.submitted = true;
//         conversationContext.Daivesteps[6].slots.application.status = 'completed';
//         conversationContext.Daivesteps[6].stageCompleted = true;
//         conversationContext.Daivesteps[6].status = 'completed';
//         conversationContext.Daivesteps[6].completedAt = new Date().toISOString();
        
//         // Add to return value
//         if (!mergedQualification.application) {
//           mergedQualification.application = {};
//         }
//         mergedQualification.application.submitted = true;
//         mergedQualification.application.status = 'completed';
//         console.log('✅ Marked application as submitted and qualification stage as completed');
//       }
      
//       return {
//         qualification: mergedQualification,
//         finance: mergedFinance
//       };
      
//     } catch (error) {
//       console.warn('⚠️ Qualification AI extraction failed:', error.message);
//       throw error; // Let it fall back to rule-based extraction
//     }
//   }

async extractQualificationSlotsWithAI(userMessage, intentResult, conversationContext = {}) {
  console.log('🎯 Using Qualification-Specific AI Extraction');

  const systemPrompt = `Extract financial qualification information from customer messages. Return ONLY valid JSON.

QUALIFICATION FIELDS (extract if mentioned):
1. FINANCING_METHOD: "cash", "finance", "lease"
2. CREDIT_SCORE: category — "excellent" (750+), "good" (700-749), "fair" (600-699), "poor" (<600)
3. CREDIT_SCORE_EXACT: numeric integer — ALWAYS set when user gives a number (e.g. "600", "720", "my score is 680")
4. DOWN_PAYMENT:
   - Fixed amount → finance.down_payment
   - Percentage → finance.down_payment_percentage
5. LEASE_TERM: Extract lease terms (24, 36, 48 months)
6. LOAN_TERM: Extract finance terms (36, 48, 60, 72 months)
7. VEHICLE_PRICE: Extract any vehicle value/price

CREDIT SCORE RULES:
- When user gives an exact number → set BOTH credit_score_exact (number) AND derive credit_score category
  - 750-850 → "excellent"
  - 700-749 → "good"
  - 600-699 → "fair"
  - 300-599 → "poor"
- When user gives only a word (good/fair/poor/excellent) → set only credit_score, omit credit_score_exact

QUALIFICATION EXAMPLES:

Input: "my credit score is 600"
Output: {
  "qualification": {
    "financing_method": "finance",
    "credit_situation": "needs_financing",
    "credit_score_exact": 600,
    "credit_score": "fair"
  },
  "finance": {}
}

Input: "I have a 720 credit score"
Output: {
  "qualification": {
    "financing_method": "finance",
    "credit_situation": "needs_financing",
    "credit_score_exact": 720,
    "credit_score": "good"
  },
  "finance": {}
}

Input: "my credit is fair"
Output: {
  "qualification": {
    "financing_method": "finance",
    "credit_situation": "needs_financing",
    "credit_score": "fair"
  },
  "finance": {}
}

Input: "I can make $5000 down"
Output: {
  "qualification": {
    "financing_method": "finance",
    "credit_situation": "needs_financing"
  },
  "finance": {
    "down_payment": 5000,
    "down_payment_type": "fixed"
  }
}

Input: "I can put 20% down"
Output: {
  "qualification": {
    "financing_method": "finance",
    "credit_situation": "needs_financing"
  },
  "finance": {
    "down_payment_percentage": 20,
    "down_payment_type": "percentage"
  }
}

Input: "vehicle is 40000 and I can do 20% down"
Output: {
  "qualification": {
    "financing_method": "finance",
    "credit_situation": "needs_financing"
  },
  "finance": {
    "stated_vehicle_price": 40000,
    "down_payment_percentage": 20,
    "down_payment_type": "percentage"
  }
}

CRITICAL RULES:
- NEVER place percentage values into finance.down_payment
- finance.down_payment is ONLY for fixed dollar amounts explicitly stated
- Use finance.down_payment_percentage ONLY for percentages
- ALWAYS set credit_score_exact when user provides a number
- Infer financing method from context
- Preserve existing qualification data
- Return ONLY valid JSON
- No markdown
- No explanations`;

  const userPrompt = `Extract qualification information from: "${userMessage}"

Return ONLY valid JSON.`;

  try {

    const response = await this.llm.invoke([
      new SystemMessage({ content: systemPrompt }),
      new HumanMessage({ content: userPrompt })
    ]);

    // --------------------------------------------
    // CLEAN AI RESPONSE
    // --------------------------------------------

    let jsonContent = response.content.trim();

    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '');
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '');
    }

    jsonContent = jsonContent.replace(/^`+|`+$/g, '').trim();

    const parsed = JSON.parse(jsonContent);

    // --------------------------------------------
    // EXISTING CONTEXT
    // --------------------------------------------

    const existingQualification =
      conversationContext?.Daivesteps?.[6]?.slots?.qualification || {};

    const existingFinance =
      conversationContext?.Daivesteps?.[6]?.slots?.finance || {};

    // --------------------------------------------
    // LOCK FINANCING METHOD
    // --------------------------------------------

    const _msgLower = userMessage.toLowerCase();

    const _hasExplicitMethod =
      _msgLower.includes('cash') ||
      _msgLower.includes('pay cash') ||
      _msgLower.includes('lease') ||
      _msgLower.includes('leasing') ||
      _msgLower.includes('finance') ||
      _msgLower.includes('financing') ||
      _msgLower.includes('loan');

    const _lockField = (existing, ai) => {
      if (!existing) return ai;
      if (!ai) return existing;
      return _hasExplicitMethod ? ai : existing;
    };

    // --------------------------------------------
    // MERGE QUALIFICATION
    // --------------------------------------------

    const mergedQualification = {
      ...existingQualification,
      ...parsed.qualification,

      financing_method: _lockField(
        existingQualification.financing_method,
        parsed?.qualification?.financing_method
      ),

      credit_situation: _lockField(
        existingQualification.credit_situation,
        parsed?.qualification?.credit_situation
      ),

      // Preserve exact credit score — once known, never overwrite with null/undefined
      credit_score_exact: parsed?.qualification?.credit_score_exact
        || existingQualification.credit_score_exact
        || null,

      // Preserve category credit score — once known, never overwrite
      credit_score: parsed?.qualification?.credit_score
        || existingQualification.credit_score
        || null
    };

    // Remove null credit score fields to keep the object clean
    if (mergedQualification.credit_score_exact === null) delete mergedQualification.credit_score_exact;
    if (mergedQualification.credit_score === null) delete mergedQualification.credit_score;

    // --------------------------------------------
    // MERGE FINANCE
    // --------------------------------------------

    const mergedFinance = {
      ...existingFinance,
      ...parsed.finance
    };

    // --------------------------------------------
    // FIX DOWN PAYMENT LOGIC
    // --------------------------------------------

    const hasPercentage =
      mergedFinance.down_payment_type === 'percentage' &&
      mergedFinance.down_payment_percentage &&
      Number(mergedFinance.down_payment_percentage) > 0;

    const hasFixedAmount =
      mergedFinance.down_payment_type === 'fixed' &&
      mergedFinance.down_payment &&
      Number(mergedFinance.down_payment) > 0;

    // 🚫 CRITICAL FIX
    // Remove invalid fixed amount if type is percentage

    if (hasPercentage) {
      delete mergedFinance.down_payment;
    }

    // 🚫 Remove invalid percentage if type is fixed

    if (hasFixedAmount) {
      delete mergedFinance.down_payment_percentage;
    }

    // --------------------------------------------
    // CALCULATE ESTIMATED DOWN PAYMENT
    // --------------------------------------------

    if (hasPercentage) {
      // Parse price string helper (handles "$34,694" → 34694)
      const _parsePrice = (p) => {
        if (!p) return null;
        if (typeof p === 'number' && !isNaN(p) && p > 0) return p;
        const n = parseFloat(String(p).replace(/[$,]/g, ''));
        return isNaN(n) || n <= 0 ? null : n;
      };

      // Check selected vehicle price from Daivesteps[3] first (most reliable)
      const _invChoice  = conversationContext?.Daivesteps?.[3]?.slots?.inventory_choice;
      const _selVehicle = conversationContext?.Daivesteps?.[3]?.slots?.VehicleSelection?.selectedVehicle;

      const vehiclePrice =
        _parsePrice(mergedFinance.stated_vehicle_price) ||
        _parsePrice(conversationContext?.Daivesteps?.[6]?.slots?.finance?.stated_vehicle_price) ||
        _parsePrice(_invChoice?.price) ||
        _parsePrice(_selVehicle?.price || _selVehicle?.msrp) ||
        _parsePrice(conversationContext?.Daivesteps?.[2]?.slots?.budget?.max_price) ||
        _parsePrice(conversationContext?.Daivesteps?.[2]?.slots?.budget?.target_price) ||
        _parsePrice(conversationContext?.Daivesteps?.[2]?.budget?.target_price) ||
        _parsePrice(conversationContext?.Daivesteps?.[2]?.budget?.max_price) ||
        _parsePrice(conversationContext?.Daivesteps?.[1]?.price);

      if (vehiclePrice && vehiclePrice > 0) {
        const percentage = parseFloat(mergedFinance.down_payment_percentage);
        mergedFinance.calculated_down_payment = Math.round((vehiclePrice * percentage / 100) * 100) / 100;
        // Also set down_payment so _hasDownPayment checks in generateSmartAgentResponse pass
        mergedFinance.down_payment = mergedFinance.calculated_down_payment;
        console.log(`💰 Calculated Down Payment: $${mergedFinance.calculated_down_payment} (${percentage}% of $${vehiclePrice})`);
      }
    }

    // --------------------------------------------
    // CLEAN INVALID VALUES
    // --------------------------------------------

    Object.keys(mergedFinance).forEach(key => {

      if (
        mergedFinance[key] === null ||
        mergedFinance[key] === undefined ||
        mergedFinance[key] === ''
      ) {
        delete mergedFinance[key];
      }
    });

    // --------------------------------------------
    // SAVE TO CONTEXT
    // --------------------------------------------

    if (!conversationContext.Daivesteps) {
      conversationContext.Daivesteps = {};
    }

    if (!conversationContext.Daivesteps[6]) {
      conversationContext.Daivesteps[6] = {
        slots: {}
      };
    }

    if (!conversationContext.Daivesteps[6].slots) {
      conversationContext.Daivesteps[6].slots = {};
    }

    conversationContext.Daivesteps[6].slots.qualification = {
      ...conversationContext.Daivesteps[6].slots.qualification,
      ...mergedQualification
    };

    conversationContext.Daivesteps[6].slots.finance = {
      ...conversationContext.Daivesteps[6].slots.finance,
      ...mergedFinance
    };

    console.log('✅ Saved qualification data');

    // --------------------------------------------
    // APPLICATION COMPLETION DETECTION
    // --------------------------------------------

    const applicationCompletionPatterns =
      /\b(complet(ed|e)|finish(ed)?|done|submitted?)\s+(the\s+)?(application|form|credit\s+app|financing\s+form)\b/i;

    if (applicationCompletionPatterns.test(userMessage)) {

      console.log('✅ Application completion detected');

      if (!conversationContext.Daivesteps[6].slots.application) {
        conversationContext.Daivesteps[6].slots.application = {};
      }

      conversationContext.Daivesteps[6].slots.application.submitted = true;

      conversationContext.Daivesteps[6].slots.application.status = 'completed';

      conversationContext.Daivesteps[6].stageCompleted = true;

      conversationContext.Daivesteps[6].status = 'completed';

      conversationContext.Daivesteps[6].completedAt =
        new Date().toISOString();
    }

    // --------------------------------------------
    // FINAL LOG
    // --------------------------------------------

    console.log('🎯 Final Qualification Extraction:', {
      qualification: mergedQualification,
      finance: mergedFinance
    });

    return {
      qualification: mergedQualification,
      finance: mergedFinance
    };

  } catch (error) {

    console.warn(
      '⚠️ Qualification AI extraction failed:',
      error.message
    );

    throw error;
  }
}

  /**
   * ✅ TRADE EVALUATION EXTRACTION (Stage 5)
   * Handles: trade-in vehicle information, condition, mileage, valuation
   * Only runs when currentJourneyStep === 'trade_evaluation'
   */
  async extractTradeEvaluationSlotsWithAI(userMessage, intentResult, conversationContext = {}) {
    console.log('🎯 Using Trade Evaluation-Specific AI Extraction');
    
    const systemPrompt = `Extract trade-in vehicle information from customer messages. Return ONLY valid JSON, no markdown.

IMPORTANT: Trade-in vehicles are cars the customer CURRENTLY OWNS — NOT the vehicle they want to purchase.
Trade-ins can be ANY make/model (not limited to dealer inventory).

FIELDS (omit if not mentioned):
- make: Use your full automotive knowledge — resolve nicknames/abbreviations ("beamer"→"BMW", "chevy"→"Chevrolet", "benz"→"Mercedes-Benz", "vette"→"Corvette") and fix phonetic misspellings. Capitalize properly.
- model: Same automotive knowledge applies — "f150"→"F-150", "crv"→"CR-V", "4runner"→"4Runner", "stang"→"Mustang". Capitalize properly.
- year: number (4-digit year)
- mileage: number — convert "50k"→50000, "75,000 miles"→75000. NEVER use the year value as mileage.
- condition: "excellent"|"good"|"fair"|"poor"
- has_trade_in: true when customer confirms they have a vehicle to trade
- ownership_confirmed: true when ownership language used ("I have", "my car", "I own", "currently driving")
- trade_in_declined: true when customer explicitly has NO vehicle to trade or refuses trade-in ("no", "nope", "nah", "don't have", "do not have", "not interested", "no trade", "no thanks", "skip", "pass")

EXAMPLES:
"i have kia sorento 2010 model" → {"trade_in":{"make":"Kia","model":"Sorento","year":2010,"has_trade_in":true,"ownership_confirmed":true}}
"trade in my 2015 Honda Accord 75k miles good condition" → {"trade_in":{"make":"Honda","model":"Accord","year":2015,"mileage":75000,"condition":"good","has_trade_in":true,"ownership_confirmed":true}}
"2018 Toyota Camry excellent 50,000 miles" → {"trade_in":{"make":"Toyota","model":"Camry","year":2018,"mileage":50000,"condition":"excellent","has_trade_in":true,"ownership_confirmed":true}}
"I have a 2012 Hyundai Tucson" → {"trade_in":{"make":"Hyundai","model":"Tucson","year":2012,"has_trade_in":true,"ownership_confirmed":true}}
"it has 100k miles fair condition" → {"trade_in":{"mileage":100000,"condition":"fair","has_trade_in":true}}
"my beamer 2016 with 80k" → {"trade_in":{"make":"BMW","year":2016,"mileage":80000,"has_trade_in":true,"ownership_confirmed":true}}
"no trade in" → {"trade_in":{"trade_in_declined":true}}
"I don't have a trade" → {"trade_in":{"trade_in_declined":true}}
"i dont have" → {"trade_in":{"trade_in_declined":true}}
"nope" / "nah" / "no" → {"trade_in":{"trade_in_declined":true}}
"not interested" / "no thanks" / "skip" → {"trade_in":{"trade_in_declined":true}}
"I don't have a car to trade" → {"trade_in":{"trade_in_declined":true}}

RULES:
- trade_in_declined takes priority — if the customer is refusing/has none, set trade_in_declined:true and omit all other fields
- has_trade_in and trade_in_declined are mutually exclusive — never set both
- Return {} ONLY if the message has nothing to do with trade-in at all
- year is a number not a string; mileage is full number (50k=50000)
- NEVER return the year value as mileage`;

    const userPrompt = `Extract trade-in vehicle information from: "${userMessage}"

Remember: This is about their CURRENT/OWNED vehicle they want to trade, not a vehicle they want to buy.

Return ONLY valid JSON.`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage({ content: systemPrompt }),
        new HumanMessage({ content: userPrompt })
      ]);

      // Handle markdown-wrapped JSON responses
      let jsonContent = response.content.trim();
      
      // Remove markdown code blocks if present
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const extractedData = JSON.parse(jsonContent);
      console.log('✅ Trade evaluation AI extraction result:', JSON.stringify(extractedData, null, 2));

      // Return normalized structure
      return this.normalizeExtractedSlots(extractedData);
      
    } catch (error) {
      console.warn('⚠️ Trade evaluation AI extraction failed:', error.message);
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

    const systemPrompt = `Extract purchase commitment intent. Return ONLY valid JSON, no markdown.

FIELDS: purchase_decision ("yes"|"no"|"proceed"|"decline"|"confirmed"), payment_method ("cash"|"cheque"|"check"|"financing"|"lease"), contract_ready (true), commitment_confirmed (true/false)

RULE: At this stage any short positive reply (yes/ok/sure/yeah/yep/sounds good/let's do it/go ahead/proceed) = commitment_confirmed: true, purchase_decision: "yes", proceed: true.
Payment method mention also sets commitment_confirmed: true.
Negative/hesitant = commitment_confirmed: false.

EXAMPLES:
"yes"/"ok"/"sure"/"go ahead" → {"purchase_commitment":{"purchase_decision":"yes","proceed":true,"commitment_confirmed":true}}
"I will pay by cheque" → {"purchase_commitment":{"purchase_decision":"confirmed","payment_method":"cheque","commitment_confirmed":true}}
"I will pay cash" → {"purchase_commitment":{"purchase_decision":"confirmed","payment_method":"cash","commitment_confirmed":true}}
"I want to finance it" → {"purchase_commitment":{"purchase_decision":"confirmed","payment_method":"financing","commitment_confirmed":true}}
"I'm ready to sign" → {"purchase_commitment":{"purchase_decision":"yes","contract_ready":true,"commitment_confirmed":true}}
"no"/"not yet"/"need to think" → {"purchase_commitment":{"purchase_decision":"decline","proceed":false,"commitment_confirmed":false}}`;

    const userPrompt = `The customer is at the purchase commitment stage and replied: "${userMessage}"

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

  /**
   * ✅ TEST DRIVE-SPECIFIC AI EXTRACTION (Stage 4)
   * Produces flags used by existing step-4 handlers in daivecrewai.js
   * - customer_at_location, customer_not_at_location, awaiting_location_confirmation
   * - test_drive_offered, test_drive_confirmed, awaiting_key_delivery
   * - keys_delivered, scheduling_initiated, test_drive_scheduled
   * - scheduled_time, specific_time, test_drive_completed, test_drive_review, awaiting_review
   */
//   async extractTestDriveSlotsWithAI(userMessage, intentResult, conversationContext = {}) {
//     console.log('🎯 Using Test Drive-Specific AI Extraction');
//     const systemPrompt = `Extract test drive stage details. Return ONLY valid JSON with a "test_drive" object.

// FIELDS (extract if present):
// - customer_at_location: boolean (true if at dealership NOW)
// - customer_not_at_location: boolean (true if NOT at dealership, wants to schedule)
// - awaiting_location_confirmation: boolean
// - test_drive_offered: boolean
// - test_drive_confirmed: boolean
// - awaiting_key_delivery: boolean
// - keys_delivered: boolean
// - scheduling_initiated: boolean (true if asking about different day/time)
// - test_drive_scheduled: boolean
// - scheduled_time: one of ["today","tomorrow","weekend","morning","afternoon","evening","specific","different_day"]
// - specific_time: string like "2:30 PM" or "Monday" or "next week"
// - test_drive_completed: boolean
// - test_drive_review: one of ["positive","negative","neutral"]
// - awaiting_review: boolean

// LOCATION DETECTION:
// - "I'm here", "at dealership", "I'm at your location", "I am at dealership", "I'm at the dealership" 
//   => customer_at_location: true
// - "not there", "will come later", "schedule later", "different day", "another day" 
//   => customer_not_at_location: true, scheduling_initiated: true

// SCHEDULING DETECTION:
// - "different day", "another day", "other day", "can we do different day", "schedule for different day"
//   => customer_not_at_location: true, scheduling_initiated: true, scheduled_time: "different_day"
// - "tomorrow", "next week", "Monday", "Tuesday", etc. 
//   => customer_not_at_location: true, scheduling_initiated: true, test_drive_scheduled: true, scheduled_time: "specific", specific_time: [the day mentioned]
// - "weekend", "Saturday", "Sunday" 
//   => customer_not_at_location: true, scheduling_initiated: true, test_drive_scheduled: true, scheduled_time: "weekend"

// KEY DELIVERY:
// - "he is here with keys", "I got the keys", "keys are here", "got the keys"
//   => keys_delivered: true

// COMPLETION:
// - "drive was great/good/excellent" => test_drive_completed: true + review: positive
// - "was okay/so-so" => test_drive_completed: true + review: neutral
// - "didn't like" => test_drive_completed: true + review: negative

// Return STRICT JSON:
// { "test_drive": { ...fields } }`;

//     const userPrompt = `Message: "${userMessage}"
// Return ONLY valid JSON.`;

//     try {
//       const response = await this.llm.invoke([
//         new SystemMessage({ content: systemPrompt }),
//         new HumanMessage({ content: userPrompt })
//       ]);

//       let jsonContent = response.content.trim();
//       if (jsonContent.startsWith('```json')) jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
//       else if (jsonContent.startsWith('```')) jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
//       jsonContent = jsonContent.replace(/^`+|`+$/g, '').trim();

//       const parsed = JSON.parse(jsonContent);

//       // Merge with existing step-4 slots
//       const existing = conversationContext.Daivesteps?.[4]?.slots || {};
//       const merged = { ...existing, ...(parsed.test_drive || {}) };

//       // Light normalization if AI missed obvious cues
//       const text = userMessage.toLowerCase();
      
//       // 1. AT LOCATION DETECTION
//       if ((text.includes('here') || text.includes('at the dealership') || text.includes('at dealership')) && merged.customer_at_location == null) {
//         merged.customer_at_location = true;
//       }
      
//       // 2. KEY DELIVERY DETECTION
//       if (/(?:keys?|key)\s+(?:here|ready|delivered|with|in)/i.test(userMessage) && merged.keys_delivered == null) {
//         merged.keys_delivered = true;
//       }
      
//       // 3. AT LOCATION + READY NOW → Auto-confirm and key delivery
//       if (
//         (text.includes("i'm here") || text.includes('i am here') || text.includes('at the dealership') || text.includes('at your location') || text.includes('at location') || text.includes("i'm at") || text.includes('i am at')) &&
//         (text.includes('test drive') || text.includes('testdrive')) &&
//         (text.includes('now') || text.includes('right now') || text.includes('ready') || text.includes('do it now') || text.includes('want to do'))
//       ) {
//         merged.customer_at_location = true;
//         merged.test_drive_offered = true;
//         merged.test_drive_confirmed = true;
//         merged.awaiting_key_delivery = true; // skip offer/confirm questions, proceed to key handoff
//       }
      
//       // 4. DIFFERENT DAY / SCHEDULING DETECTION
//       if (
//         (text.includes('different day') || text.includes('another day') || text.includes('other day') ||
//          text.includes('schedule') || text.includes('later') || text.includes('come back')) &&
//         merged.customer_not_at_location == null
//       ) {
//         merged.customer_not_at_location = true;
//         merged.scheduling_initiated = true;
//         if (text.includes('different day') || text.includes('another day') || text.includes('other day')) {
//           merged.scheduled_time = 'different_day';
//         }
//       }
      
//       // 4b. EXPLICIT WEEKDAY/NATURAL DAY PARSING
//       // Detect weekdays like "monday", "tuesday", as a specific scheduled day
//       const weekdayMatch = text.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
//       if (weekdayMatch) {
//         merged.customer_not_at_location = (merged.customer_at_location !== true);
//         merged.scheduling_initiated = true;
//         merged.test_drive_scheduled = true;
//         merged.scheduled_time = 'specific';
//         // Preserve the original case from userMessage if available
//         const originalWeekday = (userMessage.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/) || [])[0] || weekdayMatch[1];
//         merged.specific_time = originalWeekday;
//         merged.test_drive_offered = true;
//         merged.test_drive_confirmed = true;
//       }

//       // 4c. EXPLICIT TIME PARSING (e.g., "2 PM", "2:30 pm", "14:00", "at 3")
//       const explicitTime = userMessage.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
//       if (explicitTime) {
//         const hour = explicitTime[1];
//         const min = explicitTime[2] || '00';
//         const mer = (explicitTime[3] || '').toUpperCase();
//         const formatted = mer ? `${hour}:${min} ${mer}` : `${hour}:${min}`;
//         merged.customer_not_at_location = (merged.customer_at_location !== true);
//         merged.scheduling_initiated = true;
//         merged.test_drive_scheduled = true;
//         merged.scheduled_time = 'specific';
//         // If we already captured a weekday above, append time; else set time alone
//         merged.specific_time = merged.specific_time ? `${merged.specific_time} ${formatted}` : formatted;
//         merged.test_drive_offered = true;
//         merged.test_drive_confirmed = true;
//       }

//       // 5. TEST DRIVE COMPLETION DETECTION
//       if (
//         /(?:drive|test drive)\s+(?:was|went)\s+(?:great|good|excellent|amazing|fantastic|awesome)/i.test(userMessage) ||
//         /\b(?:loved|love|amazing|fantastic|excellent|perfect|great|awesome)\b/i.test(userMessage)
//       ) {
//         merged.test_drive_completed = true;
//         if (!merged.test_drive_review) merged.test_drive_review = 'positive';
//       }
      
//       // 6. NEGATIVE REVIEW DETECTION (expanded)
//       if (
//         /(?:didn['’]?t|did not|dont|don't)\s+(?:like|enjoy)/i.test(userMessage) ||
//         /(?:was|went)\s+(?:\w+\s+)?(?:bad|terrible|awful|not good|disappointing|poor|worse|worst)/i.test(userMessage) ||
//         /(?:not|wasn['’]?t)\s+(?:impressed|satisfied|happy|good)/i.test(userMessage) ||
//         /(?:drive|test drive)\s+(?:was|went)\s+(?:\w+\s+)?(?:bad|poor|terrible|awful|not good)/i.test(userMessage) ||
//         /\b(?:underwhelming|hate|hated)\b/i.test(userMessage) ||
//         /bad\s+(?:experience|drive|test)/i.test(userMessage)
//       ) {
//         merged.test_drive_completed = true;
//         if (!merged.test_drive_review) merged.test_drive_review = 'negative';
//       }
      
//       // 7. NEUTRAL REVIEW DETECTION (expanded)
//       if (
//         /(?:was|went)\s+(?:okay|ok|fine|alright|decent)/i.test(userMessage) ||
//         /\b(?:so[-\s]?so|meh|average|nothing special|not bad)\b/i.test(userMessage)
//       ) {
//         merged.test_drive_completed = true;
//         if (!merged.test_drive_review) merged.test_drive_review = 'neutral';
//       }
      
//       // 8. SET COMPLETION FLAGS if review is detected
//       if (merged.test_drive_review && !merged.completion_status) {
//         merged.completion_status = 'completed';
//         merged.step = 'completed';
//         merged.hasConfirmedInterest = true;
//         merged.deal_ready = true;
//         merged.review_collected = true;
//         console.log(`🚗 Test drive ${merged.test_drive_review.toUpperCase()} review detected in AI extraction`);
//       }

//       console.log('🎯 NLP Test Drive AI Extraction Result:', { test_drive: merged });
//       return { test_drive: merged };
//     } catch (error) {
//       console.warn('⚠️ Test Drive AI extraction failed:', error.message);
//       throw error;
//     }
//   }


// async extractTestDriveSlotsWithAI(userMessage, intentResult, conversationContext = {}) {
//   console.log('🚗 Handling Test Drive Extraction (AI → Rule-based fallback)');

//   // Ensure Step 4 initialized
//   if (!conversationContext.Daivesteps) conversationContext.Daivesteps = {};
//   if (!conversationContext.Daivesteps[4]) conversationContext.Daivesteps[4] = { slots: {} };
//   const existing = conversationContext.Daivesteps[4].slots || {};

//   // ------------------------------------------------------------------
//   // 🧠 1. Primary: AI-based Extraction
//   // ------------------------------------------------------------------
//   const systemPrompt = `
// You are an AI assistant for a U.S. car dealership. 
// Extract ONLY the test drive details that are explicitly mentioned or clearly implied in the user's message.

// Return ONLY valid JSON (no markdown, no code fences) with ONLY the detected fields:

// DETECTABLE FIELDS:
// - customer_at_location: true (if user says they are at dealership/location)
// - customer_not_at_location: true (if user says they are NOT at dealership)
// - test_drive_offered: true (if user expresses interest in test drive)
// - test_drive_confirmed: true (if user confirms they want to do test drive)
// - test_drive_scheduled: true (if user mentions scheduling)
// - scheduled_time: "today" | "tomorrow" | "weekend" | "morning" | "afternoon" | "evening" | "specific" | "different_day"
// - specific_time: string (specific time like "2 PM" or "Monday")
// - awaiting_key_delivery: true (if user is waiting for keys)
// - keys_delivered: true (if user mentions having keys)
// - test_drive_completed: true (if user mentions completing test drive)
// - test_drive_review: "positive" | "negative" | "neutral" (if user gives review)

// EXAMPLES:
// USER: "I am onsite and I want to do a test drive today"
// RETURN: {"test_drive":{"customer_at_location":true,"test_drive_offered":true,"test_drive_confirmed":true,"test_drive_scheduled":true,"scheduled_time":"today"}}

// USER: "I'm here at the dealership"
// RETURN: {"test_drive":{"customer_at_location":true}}

// USER: "yes today"
// RETURN: {"test_drive":{"test_drive_confirmed":true,"test_drive_scheduled":true,"scheduled_time":"today"}}

// USER: "The drive was great!"
// RETURN: {"test_drive":{"test_drive_completed":true,"test_drive_review":"positive"}}

// USER: "I want to schedule for tomorrow"
// RETURN: {"test_drive":{"test_drive_offered":true,"test_drive_scheduled":true,"scheduled_time":"tomorrow"}}

// USER: "I'm not at the dealership yet"
// RETURN: {"test_drive":{"customer_not_at_location":true}}

// USER: "next week saturday"
// RETURN: {"test_drive":{"test_drive_scheduled":true,"scheduled_time":"specific","specific_time":"next week saturday"}}

// USER: "I didn't like the drive"
// RETURN: {"test_drive":{"test_drive_completed":true,"test_drive_review":"negative"}}

// USER: "yes I really enjoyed and loved to proceed further"
// RETURN: {"test_drive":{"test_drive_completed":true,"test_drive_review":"positive"}}

// USER: "I loved it and want to buy it"
// RETURN: {"test_drive":{"test_drive_completed":true,"test_drive_review":"positive"}}

// USER: "it was great, let's move forward"
// RETURN: {"test_drive":{"test_drive_completed":true,"test_drive_review":"positive"}}

// CRITICAL: Only include fields that are explicitly mentioned or clearly implied. Do not fill in missing fields with false/null values.
// `;

//   const userPrompt = `Message: "${userMessage}"\nReturn ONLY JSON.`;

//   let aiResult = null;

//   try {
//     const aiResponse = await this.llm.invoke([
//       { role: "system", content: systemPrompt },
//       { role: "user", content: userPrompt }
//     ]);

//     let raw = aiResponse.content || aiResponse.text || "";
//     raw = raw.replace(/```json|```/g, "").trim();

//     const jsonMatch = raw.match(/\{[\s\S]*\}/);
//     if (jsonMatch) {
//       aiResult = JSON.parse(jsonMatch[0]);
//       console.log('✅ LLM Extracted Test Drive Data:', aiResult);
//     }
//   } catch (err) {
//     console.warn('⚠️ LLM extraction failed:', err.message);
//   }

//   // ------------------------------------------------------------------
//   // 🔍 2. Fallback: Rule-based detection
//   // ------------------------------------------------------------------
//   let result = aiResult;

//   if (!result || !result.test_drive) {
//     console.log('🔁 Falling back to rule-based test drive parsing...');
//     const text = userMessage.toLowerCase();

//     result = {
//       test_drive: {
//         customer_at_location: /(at the dealership|at dealership|i'm here|i am here|at your location|at location|at the location|yes.*(here|location|dealership)|yes i am at|yes, i am at|yes i'm at|yes, i'm at)/i.test(text),
//         customer_not_at_location: /(not there|not here|later|come back|different day|next week|no.*(here|location|dealership)|not at the|not at your)/i.test(text),
//         awaiting_location_confirmation: false, // Don't set this in extraction - only for asking questions
//         test_drive_offered: /(test drive|drive|check it out)/i.test(text),
//         test_drive_confirmed: /(confirm|booked|scheduled|doing now|want.*(test drive|drive)|yes.*(today|tomorrow|weekend))/i.test(text),
//         awaiting_key_delivery: /(ready|waiting|awaiting keys)/i.test(text),
//         keys_delivered: /(got the keys|keys (are )?here|with keys)/i.test(text),
//         scheduling_initiated: /(schedule|set up|later|different day|next week|tomorrow|today|want.*today|want.*tomorrow)/i.test(text),
//         test_drive_scheduled: /(today|tomorrow|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|want.*today|want.*tomorrow|yes.*today|yes.*tomorrow)/i.test(text),
//         scheduled_time: /today/i.test(text)
//           ? "today"
//           : /tomorrow/i.test(text)
//           ? "tomorrow"
//           : /weekend|saturday|sunday/i.test(text)
//           ? "weekend"
//           : /morning/i.test(text)
//           ? "morning"
//           : /afternoon/i.test(text)
//           ? "afternoon"
//           : /evening/i.test(text)
//           ? "evening"
//           : /(monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)/i.test(text)
//           ? "specific"
//           : null,
//         specific_time:
//           text.match(/\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i)?.[0] ||
//           text.match(/\b(next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[0] ||
//           text.match(/\bnext week \w+\b/i)?.[0] || // Match "next week saturday"
//           null,
//         test_drive_completed: /(drive|test drive).*(great|good|excellent|awesome|amazing|fine|okay|ok|bad|terrible|like|don't like|didn't like|review|feedback)/i.test(text) || 
//           /(share.*review|my review|feedback|how.*drive|experience)/i.test(text) ||
//           /(enjoyed|loved|proceed|move forward|next step)/i.test(text),
//         test_drive_review: /(great|excellent|amazing|awesome|good|loved|impressed|fantastic|wonderful|perfect|enjoyed|proceed|move forward)/i.test(text)
//           ? "positive"
//           : /(bad|terrible|poor|not good|awful|didn't like|don't like|hate|disappointed|not impressed|not what i expected|not for me|not interested)/i.test(text)
//           ? "negative"
//           : /(fine|okay|ok|average|so-so|decent|alright|not bad|it's ok)/i.test(text)
//           ? "neutral"
//           : null,
//         awaiting_review: /(how was|give.*feedback|rate|review)/i.test(text)
//       }
//     };
//   }

//   // ✅ ENHANCED: Additional rule-based detection for specific patterns
//   const messageText = userMessage.toLowerCase();
  
//   // Detect "enjoyed and loved to proceed further" pattern
//   if (/enjoyed.*loved.*proceed|proceed.*further|loved.*proceed|enjoyed.*proceed/i.test(messageText)) {
//     console.log('🎯 Detected positive test drive completion pattern');
//     result.test_drive = {
//       ...result.test_drive,
//       test_drive_completed: true,
//       test_drive_review: 'positive'
//     };
//   }
  
//   // Detect "no questions what next step" after positive review
//   if (/no questions.*next step|what.*next step|next step/i.test(messageText) && 
//       conversationContext.Daivesteps?.[4]?.slots?.test_drive_review === 'positive') {
//     console.log('🎯 Detected next step request after positive review');
//     result.test_drive = {
//       ...result.test_drive,
//       test_drive_completed: true,
//       test_drive_review: 'positive'
//     };
//   }

//   // ------------------------------------------------------------------
//   // 🧩 3. Normalize + Auto-complete related slots
//   // ------------------------------------------------------------------
//   const merged = { ...existing, ...(result.test_drive || {}) };

//   // ✅ IMPROVED: Only auto-complete if we have detected slots
//   if (result.test_drive && Object.keys(result.test_drive).length > 0) {
//     console.log('🎯 Detected test drive slots:', result.test_drive);
    
//     // Auto-complete logical dependencies only for detected slots
//     if (merged.test_drive_offered && !merged.test_drive_confirmed) {
//       merged.test_drive_confirmed = true;
//       console.log('✅ Auto-completed test_drive_confirmed from test_drive_offered');
//     }

//   // If customer is at location, set all related flags
//   if (merged.customer_at_location) {
//     console.log('✅ Customer at location detected - setting all related flags');
//     merged.customer_not_at_location = false;
//     merged.awaiting_location_confirmation = false;  // ✅ CRITICAL: Clear awaiting flag
//     merged.test_drive_offered = true;
//     merged.test_drive_confirmed = true;
//     if (!merged.keys_delivered) {
//       merged.awaiting_key_delivery = true;
//     }
//     merged.test_drive_scheduled = true;
//     merged.scheduling_initiated = true;
//     if (!merged.scheduled_time) merged.scheduled_time = 'today';
//   }
  
//   // If customer is NOT at location, clear the at_location flag
//   if (merged.customer_not_at_location) {
//     console.log('✅ Customer not at location detected - clearing at_location flag');
//     merged.customer_at_location = false;
//     merged.awaiting_location_confirmation = false;  // ✅ CRITICAL: Clear awaiting flag
//   }

//   // If test drive confirmed with timing, schedule it
//   if (merged.test_drive_confirmed && (merged.scheduled_time || /today|now|later|tomorrow|weekend|want.*today|yes.*today/.test(text))) {
//     merged.test_drive_scheduled = true;
//     merged.scheduling_initiated = true;
    
//     // Extract timing if not already set
//     if (!merged.scheduled_time) {
//       if (/today|now/.test(text)) merged.scheduled_time = 'today';
//       else if (/tomorrow/.test(text)) merged.scheduled_time = 'tomorrow';
//       else if (/weekend|saturday|sunday/.test(text)) merged.scheduled_time = 'weekend';
//       else if (/morning/.test(text)) merged.scheduled_time = 'morning';
//       else if (/afternoon/.test(text)) merged.scheduled_time = 'afternoon';
//       else if (/evening/.test(text)) merged.scheduled_time = 'evening';
//     }
//   }

//   // If scheduled time is set, confirm test drive
//   if (merged.scheduled_time && !merged.test_drive_scheduled) {
//     merged.test_drive_scheduled = true;
//     merged.scheduling_initiated = true;
//     merged.test_drive_confirmed = true;
//     merged.test_drive_offered = true;
//   }

//   // If review detected → mark step completed
//   if (merged.test_drive_review) {
//     console.log('✅ Test drive review detected - marking as completed');
//     merged.test_drive_completed = true;
//     merged.completion_status = 'completed';
//     merged.keys_delivered = true; // If they're giving a review, they must have had the keys
//     merged.awaiting_key_delivery = false;
//     merged.awaiting_review = false;
//   }

//   // If test drive completed flag is set, ensure related flags are set
//   if (merged.test_drive_completed) {
//     console.log('✅ Test drive completed detected - setting related flags');
//     merged.keys_delivered = true;
//     merged.awaiting_key_delivery = false;
//     merged.test_drive_offered = true;
//     merged.test_drive_confirmed = true;
//     merged.test_drive_scheduled = true;
//   }

//   // ------------------------------------------------------------------
//     // 💾 4. Persist in conversation context ONLY if slots were detected
//   // ------------------------------------------------------------------
//   conversationContext.Daivesteps[4].slots = merged;
//     console.log('🎯 Updated Daivesteps[4] with detected test drive slots:', merged);
    
//     // ✅ IMPROVED MANDATORY SLOT VALIDATION - Handle test drive completion
//     const mandatoryTestDriveSlots = [
//       'customer_at_location',
//       'customer_not_at_location', 
//       'test_drive_offered',
//       'test_drive_confirmed',
//       'test_drive_scheduled'
//     ];

//     // ✅ CRITICAL: If test drive is completed with review, skip mandatory slot validation
//     if (merged.test_drive_completed && merged.test_drive_review) {
//       console.log('✅ Test drive completed with review - skipping mandatory slot validation');
//       merged.slotDetectionStatus = 'complete';
//       merged.missingMandatorySlots = [];
//       merged.completion_status = 'completed';
//     } else {
//       // Only validate mandatory slots if test drive is not completed
//       const detectedSlots = Object.keys(result.test_drive || {});
//       const missingMandatorySlots = mandatoryTestDriveSlots.filter(slot => 
//         !detectedSlots.dfdfdfd(slot) && !merged[slot]
//       );

//       if (missingMandatorySlots.length > 0) {
//         console.log('🔍 Missing mandatory test drive slots:', missingMandatorySlots);
//         console.log('💡 This can trigger the next question logic in daivecrewai.js');
        
//         // Add missing slots info to help daivecrewai.js determine next questions
//         merged.missingMandatorySlots = missingMandatorySlots;
//         merged.slotDetectionStatus = 'partial'; // partial, complete, or none
//       } else {
//         merged.slotDetectionStatus = 'complete';
//         console.log('✅ All mandatory test drive slots detected');
//       }
//     }
//   } else {
//     console.log('⚠️ No test drive slots detected, keeping existing slots');
//     merged.slotDetectionStatus = 'none';
//   }

//   return { test_drive: merged };
// }

async extractTestDriveSlotsWithAI(userMessage, intentResult, conversationContext = {}) {
  console.log('🚗 Handling Test Drive Extraction (Semantic AI → Rule-based fallback)');

  // Ensure Step 4 initialized
  if (!conversationContext.Daivesteps) conversationContext.Daivesteps = {};
  if (!conversationContext.Daivesteps[4]) conversationContext.Daivesteps[4] = { slots: {} };
  const existing = conversationContext.Daivesteps[4].slots || {};

  // ------------------------------------------------------------------
  // 🧠 1. Primary: Semantic LLM Extraction
  // ------------------------------------------------------------------
  const systemPrompt = `
You are an intelligent semantic slot-extraction engine for a U.S. car dealership assistant.
Your job is to understand what the customer MEANS about a test drive and map it to the correct test_drive slots.
This is NOT keyword matching. Be robust to typos, spacing, and casual phrasing (e.g. "dealer ship", "i ma here", "send keys").

OUTPUT
Return ONLY valid JSON (no markdown / no explanations) with a single top-level key: "test_drive".
Include ONLY fields you are confident are true/known. Omit unknown fields. Do NOT output null/false.

SLOTS (only these):
{
  "test_drive": {
    "customer_at_location": boolean,
    "customer_not_at_location": boolean,
    "test_drive_offered": boolean,
    "test_drive_confirmed": boolean,
    "test_drive_scheduled": boolean,
    "scheduling_initiated": boolean,
    "awaiting_day_selection": boolean,
    "scheduled_time": "today" | "tomorrow" | "weekend" | "morning" | "afternoon" | "evening" | "specific" | "different_day",
    "specific_time": string,
    "test_drive_completed": boolean,
    "test_drive_review": "positive" | "negative" | "neutral"
  }
}

NOTE: Do NOT extract awaiting_key_delivery or keys_delivered — keys are handled by dealership staff and
      are never tracked through the customer conversation.

SEMANTIC MAPPING (examples)
- On-location NOW (set customer_at_location: true):
  - "I'm here", "im here", "i am here", "i ma here", "here now"
  - "at the dealership", "at dealer ship", "in the showroom", "on the lot", "at your location"
  - "I'm outside", "I'm in the parking lot"

- Wants immediate drive / at location and ready:
  - "ready to drive now", "let's go now", "take it for a spin now", "I want to test drive now"
  - "I am at the dealership, arrange a test drive"
  → Set: customer_at_location: true, test_drive_confirmed: true, test_drive_offered: true

- Scheduling (not yet at location — specific day/time known):
  - "today", "tomorrow", "this weekend", "Saturday", "Friday afternoon", "next week Monday"
  → Set: customer_not_at_location: true, test_drive_scheduled: true,
         scheduled_time: the appropriate value, specific_time: the day/time string, test_drive_confirmed: true
  IMPORTANT: "today" means they want to COME IN today — they are NOT physically at the dealership yet.
  Only set customer_at_location: true if they explicitly say "I'm here", "I'm at the dealership", "front desk", etc.

- Scheduling (future — NO specific day given yet, "another day" / deferral):
  - "another day", "different day", "some other day", "not today", "schedule later", "book for later"
  → Set: customer_not_at_location: true, scheduling_initiated: true,
         scheduled_time: "different_day", awaiting_day_selection: true
  → Do NOT set test_drive_scheduled: true (nothing is booked yet — they haven't named a day)
  → Do NOT set specific_time (no day was mentioned)

- Disambiguate YES based on context:
  - If the prior assistant message asked about timing ("today or another day?") and user says "yes"/"sure":
    interpret as test_drive_confirmed: true (and if they also say "today/now/here", set customer_at_location: true).

- Test drive completion WITHOUT explicit opinion (set only test_drive_completed):
  - "yes i have done the test drive" → ONLY test_drive_completed: true
  - "I've done the test drive" / "done with the test drive" → ONLY test_drive_completed: true
  - "finished the drive", "just came back", "back from the drive" → ONLY test_drive_completed: true
  DO NOT invent a review if the user has NOT expressed a feeling or opinion about the experience.

- Test drive completion WITH feedback — set BOTH test_drive_completed AND test_drive_review:
  POSITIVE: any excited/happy/satisfied/enthusiastic emotion after the drive (excited, thrilled, loved, amazing, fantastic, impressed, pleased, happy, great, wow) → test_drive_review: "positive"
  - "I am excited I just done the drive" / "Loved it! Just finished" → test_drive_completed: true, test_drive_review: "positive"
  NEGATIVE: disappointment, dissatisfaction, concern → test_drive_review: "negative"
  - "I didn't like it" / "It felt too big" / "I'm not impressed" → test_drive_completed: true, test_drive_review: "negative"
  NEUTRAL: unsure, mixed, non-committal → test_drive_review: "neutral"
  - "It was okay" / "So-so" / "I need to think" → test_drive_completed: true, test_drive_review: "neutral"
  RULE: Read emotional tone — do not require "good"/"great"; "excited"/"thrilled"/"wow" = POSITIVE.

CRITICAL RULES
- If user indicates they are at the dealership NOW, do NOT treat it as scheduling for another day.
- Never invent a time. Only set scheduled_time/specific_time when user indicates a time/day.
- NEVER set awaiting_key_delivery or keys_delivered — these are internal dealership operations.
`;

  const lastAgentMsg =
    conversationContext?.messages?.slice(-1)?.[0]?.content ||
    conversationContext?.lastAgentMessage ||
    '';
  // Only pass the slots that affect disambiguation — avoids token bloat as the object grows
  const _relevantExisting = {};
  const _keepKeys = ['customer_at_location', 'customer_not_at_location', 'test_drive_confirmed', 'scheduled_time', 'test_drive_completed', 'test_drive_review'];
  for (const k of _keepKeys) { if (existing[k] !== undefined) _relevantExisting[k] = existing[k]; }

  const userPrompt = `CONTEXT:
Last assistant message: "${String(lastAgentMsg).slice(0, 300)}"
Existing slots: ${JSON.stringify(_relevantExisting)}
Customer message: "${userMessage}"
Return JSON ONLY.`;

  let aiResult = null;

  try {
    const aiResponse = await this.llm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], { response_format: { type: "json_object" } });

    let raw = aiResponse.content || aiResponse.text || "";
    raw = raw.replace(/```json|```/g, "").trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      aiResult = JSON.parse(jsonMatch[0]);
      console.log('✅ Semantic LLM extracted test drive data:', aiResult);
    }
  } catch (err) {
    console.warn('⚠️ Semantic LLM extraction failed:', err.message);
  }

  // ------------------------------------------------------------------
  // 🔁 2. Rule-Based Fallback
  // ------------------------------------------------------------------
  let result = aiResult;
  if (!result || !result.test_drive) {
    console.log('🔁 Falling back to rule-based test drive parsing...');
    const text = userMessage.toLowerCase();

    result = {
      test_drive: {
        customer_at_location: /(at (the )?dealership|i'?m here|at your location|on site|onsite|front desk|i am here|i arrived|just arrived)/i.test(text),
        customer_not_at_location: /(not here|not there|on my way|later|coming|today|next week|different day|another day|other day|i want (different|another|other) day|want (different|another|other) day|^no.*schedule|want to schedule|i want to schedule|^schedule$)/i.test(text),
        test_drive_offered: /(test drive|try (it|the car)|take it for a spin|drive it)/i.test(text),
        test_drive_confirmed: /(book|confirm|ready now|want to test|doing now|yes.*(today|tomorrow)|yes.*(test drive|drive)|yes.*(schedule|appointment)|i want (different|another|other) day|want (different|another|other) day)/i.test(text),
        test_drive_scheduled: /(schedule|want to schedule|book|set up|today|tomorrow|weekend|next week|later|appointment|another day|different day|i want (different|another|other) day|want (different|another|other) day)/i.test(text),
        scheduled_time: /today/i.test(text)
          ? "today"
          : /tomorrow/i.test(text)
          ? "tomorrow"
          : /weekend|saturday|sunday/i.test(text)
          ? "weekend"
          : /morning/i.test(text)
          ? "morning"
          : /afternoon/i.test(text)
          ? "afternoon"
          : /evening/i.test(text)
          ? "evening"
          : /(monday|tuesday|wednesday|thursday|friday)/i.test(text)
          ? "specific"
          : /(different day|another day|other day|i want (different|another|other) day|want (different|another|other) day)/i.test(text)
          ? "different_day"
          : /(schedule|want to schedule)/i.test(text)
          ? "different_day"
          : null,
        specific_time:
          text.match(/\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i)?.[0] ||
          text.match(/\b(next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[0] ||
          null,
        // Completion can be stated without feedback ("I completed the test drive").
        // Only set `test_drive_review` when opinion/feeling words appear.
        test_drive_completed:
          /(done|completed|finished|already (did|done)|have (done|completed|finished)|did)\s+(the\s+)?(test drive|drive)\b/i.test(text) ||
          /(done with|finished with|completed)\s+(my\s+)?(test drive|drive)\b/i.test(text) ||
          /(test drive|drive)\s+(is\s+)?(done|completed|finished)\b/i.test(text) ||
          /(drive|test drive).*(great|good|amazing|awesome|bad|terrible|liked|didn't like|enjoyed|loved)/i.test(text),
        test_drive_review: /(great|excellent|awesome|good|loved|enjoyed|impressed|fantastic|excited|thrilled|happy|pleased|amazing|wonderful|brilliant|outstanding|incredible|superb|love it|love the)/i.test(text)
          ? "positive"
          : /(bad|poor|terrible|not good|didn't like|hate|disappointed|dislike|not impressed|not happy)/i.test(text)
          ? "negative"
          : /(okay|fine|average|decent|alright|not sure|so-so|mixed)/i.test(text)
          ? "neutral"
          : null
      }
    };
  }

  // ------------------------------------------------------------------
  // 🧩 3. Semantic Normalization & Slot Completion
  // ------------------------------------------------------------------
  // Strip false/null values from the result before merging so that
  // existing true state (e.g. test_drive_completed, test_drive_review)
  // is NEVER overwritten when the rule-based fallback returns all-false defaults.
  const rawResult = result.test_drive || {};
  const cleanResult = Object.fromEntries(
    Object.entries(rawResult).filter(([, v]) => v !== false && v !== null && v !== undefined)
  );
  const merged = { ...existing, ...cleanResult };
  const text = userMessage.toLowerCase();

  // Customer at location → auto-complete contextual flags
  if (merged.customer_at_location) {
    merged.customer_not_at_location = false;
    merged.awaiting_location_confirmation = false;
    merged.test_drive_offered = true;
    merged.test_drive_confirmed = true;
    merged.test_drive_scheduled = true;
    merged.scheduling_initiated = true;
    if (!merged.scheduled_time) merged.scheduled_time = "today";
    if (!merged.keys_delivered) merged.awaiting_key_delivery = true;
  }
  
  // Customer not at location
  if (merged.customer_not_at_location) {
    merged.customer_at_location = false;
    merged.awaiting_location_confirmation = false;
  }
  
  // ✅ ENHANCED: Explicit detection for "I want different day"
  if (/i want (different|another|other) day|want (different|another|other) day/i.test(text)) {
    merged.customer_not_at_location = true;
    merged.customer_at_location = false;
    merged.awaiting_location_confirmation = false;
    merged.test_drive_scheduled = true;
    merged.scheduling_initiated = true;
    merged.test_drive_offered = true;
    merged.test_drive_confirmed = true;
    merged.scheduled_time = "different_day";
    console.log('✅ Detected explicit "I want different day" request');
  }
  
  // ✅ ENHANCED: Detect "schedule" without "today" as customer_not_at_location
  else if (/(want to schedule|i want to schedule|^schedule$|^no.*schedule|another day|different day|other day)/i.test(text) && !/(today|right now|now)/i.test(text)) {
    merged.customer_not_at_location = true;
    merged.customer_at_location = false;
    merged.awaiting_location_confirmation = false;
    merged.test_drive_scheduled = true;
    merged.scheduling_initiated = true;
    merged.test_drive_offered = true;
    if (!merged.scheduled_time) merged.scheduled_time = "different_day";
    console.log('✅ Detected scheduling for different day (not today)');
  }

  // "Another day" / deferral — customer confirmed intent but has NOT yet named a specific day.
  // Mark awaiting_day_selection so the LLM knows to ask "What day works best?".
  // Also downgrade test_drive_scheduled to false — nothing is actually booked yet.
  if (merged.scheduled_time === "different_day" && !merged.specific_time) {
    merged.awaiting_day_selection = true;
    merged.test_drive_scheduled = false; // no day/time confirmed yet
    console.log('📅 "different_day" with no specific_time → awaiting_day_selection, test_drive_scheduled reset to false');
  }

  // Confirm + time = scheduled
  if (merged.test_drive_confirmed && (merged.scheduled_time || /today|tomorrow|weekend|later/.test(text))) {
    merged.test_drive_scheduled = true;
    merged.scheduling_initiated = true;
    
    // ✅ CRITICAL: Auto-set location based on scheduled time if not already set
    if (!merged.customer_at_location && !merged.customer_not_at_location) {
      if (merged.scheduled_time === 'today' || /today/i.test(text)) {
        // "today" means they want to COME today (not that they're physically here yet)
        merged.customer_not_at_location = true;
        merged.customer_at_location = false;
        merged.awaiting_location_confirmation = false;
        console.log('✅ Inferred customer_not_at_location from scheduled_time: today (scheduling for today)');
      } else if (merged.scheduled_time || /tomorrow|next week|different day|later/i.test(text)) {
        merged.customer_not_at_location = true;
        merged.customer_at_location = false;
        merged.awaiting_location_confirmation = false;
        console.log('✅ Inferred customer_not_at_location from scheduled_time:', merged.scheduled_time);
      }
    }
  }

  // ✅ ENHANCED: Handle simple "yes today" responses
  if (/yes.*today|yes.*tomorrow|yes.*schedule/i.test(text)) {
    merged.test_drive_confirmed = true;
    merged.test_drive_scheduled = true;
    merged.scheduling_initiated = true;
    if (/today/i.test(text)) {
      merged.scheduled_time = "today";
      // "yes today" means scheduling for today, not physically present yet
      merged.customer_not_at_location = true;
      merged.customer_at_location = false;
      merged.awaiting_location_confirmation = false;
    }
    if (/tomorrow/i.test(text)) {
      merged.scheduled_time = "tomorrow";
      merged.customer_not_at_location = true;
      merged.customer_at_location = false;
      merged.awaiting_location_confirmation = false;
    }
    console.log('✅ Detected simple confirmation with timing');
  }

  // Auto-confirm on scheduled time
  if (merged.scheduled_time && !merged.test_drive_confirmed) {
    merged.test_drive_confirmed = true;
    merged.test_drive_offered = true;
  }

  // test_drive_offered is implied whenever the drive is confirmed or scheduled —
  // a drive cannot be confirmed or scheduled without having been offered first.
  if ((merged.test_drive_confirmed || merged.test_drive_scheduled || merged.specific_time) && !merged.test_drive_offered) {
    merged.test_drive_offered = true;
    console.log('✅ Auto-set test_drive_offered=true (implied by confirmed/scheduled state)');
  }

  // ✅ ENHANCED: If user wants to schedule but no specific time, still mark as scheduled
  if (/want.*schedule|schedule.*test|book.*test/i.test(text) && !merged.test_drive_scheduled) {
    merged.test_drive_scheduled = true;
    merged.test_drive_offered = true;
    merged.scheduling_initiated = true;
    // ✅ CRITICAL: Auto-set location based on time context
    if (/tomorrow|next week|different day|another day|later/i.test(text)) {
      merged.customer_not_at_location = true;
      merged.customer_at_location = false;
      merged.awaiting_location_confirmation = false;
    } else if (/today|now|right now/i.test(text)) {
      merged.customer_at_location = true;
      merged.customer_not_at_location = false;
      merged.awaiting_location_confirmation = false;
    }
    console.log('✅ Detected scheduling intent without specific time');
  }

  // Mark completion if review given
  if (merged.test_drive_review) {
    merged.test_drive_completed = true;
    merged.keys_delivered = true;
    merged.awaiting_key_delivery = false;
    merged.awaiting_review = false; // ✅ CRITICAL: Clear awaiting review flag when review is present
    console.log('✅ Review detected - completing test drive and clearing awaiting_review flag');
  }

  // ------------------------------------------------------------------
  // 💾 4. Context Update & Validation
  // ------------------------------------------------------------------
  // 🔥 CRITICAL FIX: Merge instead of overwrite to preserve existing data
  conversationContext.Daivesteps[4].slots = {
    ...conversationContext.Daivesteps[4].slots,
    ...merged
  };
  console.log('🎯 Updated Daivesteps[4] with semantic test drive slots:', merged);

  const mandatorySlots = [
    'customer_at_location',
    'customer_not_at_location',
    'test_drive_offered',
    'test_drive_confirmed',
    'test_drive_scheduled',
    'test_drive_review'
  ];

  // ✅ CRITICAL: Test drive is only complete when we have a review
  if (merged.test_drive_review) {
    merged.test_drive_completed = true;
    merged.awaiting_review = false; // Clear awaiting review flag
    merged.slotDetectionStatus = 'complete';
    merged.missingMandatorySlots = [];
    merged.completion_status = 'completed';
    console.log('✅ Test drive completed with review:', merged.test_drive_review);
    
    // 🔥 CRITICAL: Also update the saved slots with completion flags
    conversationContext.Daivesteps[4].slots.test_drive_completed = true;
    conversationContext.Daivesteps[4].slots.awaiting_review = false;
    conversationContext.Daivesteps[4].slots.slotDetectionStatus = 'complete';
    conversationContext.Daivesteps[4].slots.missingMandatorySlots = [];
    conversationContext.Daivesteps[4].slots.completion_status = 'completed';
  } else {
    // ✅ ENHANCED: Check if all mandatory slots are collected
    const collectedMandatorySlots = mandatorySlots.filter(slot => merged[slot]);
    
    if (collectedMandatorySlots.length === mandatorySlots.length) {
      // All mandatory slots collected, only missing review
      merged.slotDetectionStatus = 'awaiting_review';
      merged.missingMandatorySlots = ['test_drive_review'];
      conversationContext.Daivesteps[4].slots.slotDetectionStatus = 'awaiting_review';
      conversationContext.Daivesteps[4].slots.missingMandatorySlots = ['test_drive_review'];
      console.log('✅ All mandatory slots collected, awaiting review');
    } else {
      const missing = mandatorySlots.filter(slot => !merged[slot]);
      merged.missingMandatorySlots = missing;
      merged.slotDetectionStatus = missing.length > 0 ? 'partial' : 'complete';
      conversationContext.Daivesteps[4].slots.missingMandatorySlots = missing;
      conversationContext.Daivesteps[4].slots.slotDetectionStatus = missing.length > 0 ? 'partial' : 'complete';
      console.log('🔍 Missing mandatory test drive slots:', missing);
    }
  }

  return { test_drive: merged };
}

  async extractSlotsWithRules(message, intentResult, conversationContext = {}) {
    const slots = {};
    const text = message.toLowerCase();

    // COMPREHENSIVE EXTRACTION: Extract all possible information from single message
    console.log('🔍 Rule-based comprehensive extraction for:', message);
    
    // ✅ PURCHASE COMMITMENT DETECTION (Stage 7)
    if (conversationContext.currentJourneyStep === 'purchase_commitment') {
      console.log('🎯 Purchase Commitment Stage - Detecting commitment signals');
      
      // Get financing method from Step 6 (Qualification) - this is the source of truth
      const qualificationStep = conversationContext.Daivesteps?.[6];
      const financingMethod = qualificationStep?.slots?.qualification?.financing_method;
      
      console.log('🔍 Financing method from Step 6:', financingMethod);
      
      // Payment method detection - prioritize Step 6 qualification data
      let paymentMethod = null;
      
      if (financingMethod) {
        // Use the financing method from qualification step (Step 6)
        paymentMethod = financingMethod;
        console.log('✅ Using financing method from Step 6:', paymentMethod);
      } else if (text.includes('cheque') || text.includes('check')) {
        paymentMethod = 'cheque';
        console.log('💰 Cheque payment detected from message');
      } else if (text.includes('cash')) {
        paymentMethod = 'cash';
        console.log('💰 Cash payment detected from message');
      } else if (text.includes('financing') || text.includes('finance')) {
        paymentMethod = 'finance';
        console.log('💰 Financing payment detected from message');
      } else if (text.includes('lease') || text.includes('leasing')) {
        paymentMethod = 'lease';
        console.log('💰 Lease payment detected from message');
      }
      
      // Set purchase commitment with correct payment method
      if (paymentMethod) {
        slots.purchase_commitment = {
          ...slots.purchase_commitment,
          purchase_decision: 'confirmed',
          payment_mode: paymentMethod, // Use payment_mode to match your data structure
          payment_method: paymentMethod,
          commitment_confirmed: true
        };
        console.log('✅ Purchase commitment set with payment_mode:', paymentMethod);
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

    // Initialize qualification slot only when the intent is finance/qualification-related
    // or when the stage is already qualification. Unconditionally initialising it on every
    // rule-based fallback run causes _writeQualification:true for unrelated messages
    // (e.g. "also hybrid" at vehicle_selection) and pollutes Daivesteps[6] unnecessarily.
    const _isQualIntent = intentResult?.intent === 'financing_options'
      || intentResult?.intent === 'slot_collection_finance'
      || conversationContext.currentJourneyStep === 'qualification';
    if (!slots.qualification && _isQualIntent && conversationContext.currentJourneyStep !== 'qualification') {
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
      
      // 🔥 CRITICAL: Detect application completion (rule-based)
      const applicationCompletionPatterns = /\b(complet(ed|e)|finish(ed)?|done|submitted?)\s+(the\s+)?(application|form|credit\s+app|financing\s+form)\b/i;
      if (applicationCompletionPatterns.test(message)) {
        console.log('✅ Application completion detected via rule-based pattern in extractSlotsWithRules!');
        if (!slots.application) {
          slots.application = {};
        }
        slots.application.submitted = true;
        slots.application.status = 'completed';
        slots.qualification.qualification_completed = true;
        console.log('✅ Marked application as submitted in rule-based extraction');
      }
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
      // Range/limit keyword patterns — capture full 5-digit amounts first
      /(?:range|limit)\s+(?:is|of|are)?\s*\$?(\d{1,3}(?:,\d{3})*|\d{4,6})/i,    // range is 16000
      /(?:my|the)\s+(?:budget|range|limit)\s+(?:is|are)?\s*\$?(\d{1,3}(?:,\d{3})*|\d{4,6})/i, // my range is 16000
      /budget.*?\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,              // budget is around $25,000
      /budget.*?(\d{1,3})\s*k/i,                                     // budget 25k
      /around.*?\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,              // around $25,000
      /around.*?(\d{1,3})\s*k/i,                                     // around 25k
      /under.*?\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,               // under $25,000
      /under.*?(\d{1,3})\s*k/i,                                      // under 25k
      /up to.*?\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,               // up to $25,000
      /up to.*?(\d{1,3})\s*k/i,                                      // up to 25k
      /maximum.*?\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,             // maximum $25,000
      /maximum.*?(\d{1,3})\s*k/i,                                    // maximum 25k
      /(\d{1,3})\s*k\b/i,                                            // 25k, 30k, etc. (standalone k)
      /(\d{1,3})\s*k\s/i,                                            // 25k with space after
      /(\d{1,3})k\b/i,                                               // 25k without space
      /(\d{1,3})\s*thousand/i,                                       // 25 thousand
      /(\d{1,3})\s*grand/i,                                          // 25 grand
      /\$(\d{1,3}(?:,\d{3})*)/i,                                     // $25,000 or $25000
      /\b(\d{4,6})\b/i,                                              // bare 4-6 digit number (e.g. 16000)
      /\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:k|thousand|max)?/i  // generic fallback
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
        if (text.includes('under') || text.includes('below') || text.includes('max') ||
            text.includes('range') || text.includes('limit') || text.includes('up to')) {
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
    // NOTE: "family" alone does NOT set a vehicle_type — the bot will ask the user to confirm (SUV, minivan, sedan, etc.)
    if (text.includes('suv') || text.includes('s.u.v')) {
      slots.vehicle_type = 'SUV';
      console.log('📋 Rule-based: Vehicle type = SUV');
    } else if (text.includes('truck') || text.includes('trucks') || text.includes('pickup') || text.includes('pickup truck')) {
      slots.vehicle_type = 'truck';
      console.log('📋 Rule-based: Vehicle type = truck');
    } else if (text.includes('sedan')) {
      slots.vehicle_type = 'sedan';
      console.log('📋 Rule-based: Vehicle type = sedan');
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
      // Stellantis / FCA brands (jeep was previously missing)
      'jeep', 'chrysler', 'cadillac', 'gmc', 'mitsubishi', 'volvo', 'mini', 'fiat',
      'alfa romeo', 'jaguar', 'porsche', 'scout', 'lucid', 'polestar', 'rivian',
      // keep prior common ones to avoid regressions/aliases
      'mercedes', 'infiniti'
    ];
    
    // 🚀 Get dynamic makes from inventory — cached on instance to avoid repeated async calls
    // Merge dealer makes with the broad fallback so we never miss a make the dealer actually carries.
    if (conversationContext.dealerId) {
      if (this._makesCache.has(conversationContext.dealerId)) {
        availableMakes = this._makesCache.get(conversationContext.dealerId);
      } else {
        try {
          const inventoryService = global.inventoryService || this.inventoryService;
          if (inventoryService) {
            const cacheData = await inventoryService.getCachedMakesAndModels(conversationContext.dealerId);
            if (cacheData && cacheData.makes && cacheData.makes.length > 0) {
              const dealerMakes = cacheData.makes.map(make => make.toLowerCase());
              // Merge: dealer makes first (priority), then broad fallback for recognition coverage
              availableMakes = [...new Set([...dealerMakes, ...availableMakes])];
              this._makesCache.set(conversationContext.dealerId, availableMakes);
              console.log('📋 [NLP] Cached dynamic makes for dealer:', conversationContext.dealerId, dealerMakes.slice(0, 5));
            }
          }
        } catch (err) {
          console.warn('⚠️ Could not get dynamic makes, using fallback:', err.message);
        }
      }
    }
    
    // Alias normalization for common make synonyms and variations
    const makeAliases = [
      { pattern: /\bmercedes[-\s]?benz\b|\bmercedes\b|\bmb\b/i, canonical: 'Mercedes-Benz' },
      { pattern: /\bland\s+rover\b/i, canonical: 'Land Rover' },
      { pattern: /\bvw\b|\bvolkswagen\b/i, canonical: 'Volkswagen' },
      { pattern: /\bchevy\b|\bchevrolet\b/i, canonical: 'Chevrolet' },
      { pattern: /\bbmw\b/i, canonical: 'BMW' },
      { pattern: /\bmbusa\b/i, canonical: 'Mercedes-Benz' },
      // jeep / jeeps (singular and plural both map to Jeep)
      { pattern: /\bjeeps?\b/i, canonical: 'Jeep' },
      { pattern: /\bgmc\b/i, canonical: 'GMC' },
      { pattern: /\bcadillac\b|\bcaddy\b/i, canonical: 'Cadillac' },
      { pattern: /\bporsche\b/i, canonical: 'Porsche' },
      { pattern: /\bjaguar\b|\bjag\b/i, canonical: 'Jaguar' },
      { pattern: /\bvolvo\b/i, canonical: 'Volvo' },
      { pattern: /\bmitsubishi\b/i, canonical: 'Mitsubishi' },
      { pattern: /\btesla\b/i, canonical: 'Tesla' },
      { pattern: /\brivian\b/i, canonical: 'Rivian' }
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
      // Jeep models
      'wrangler', 'grand cherokee l', 'grand cherokee', 'cherokee', 'compass', 'renegade', 'gladiator', 'wagoneer l', 'wagoneer', 'grand wagoneer',
      'f150', 'camry', 'encore', 'equinox', 'sportage', 'sorento', 'forester', '1500', 'rogue', 'mdx', 'elantra hybrid',
      'lc', 'kona', 'elantra', 'a6', 'palisade', 'bronco sport', 'city', 'grand highlander hybrid', 'santa fe sport',
      'r1t', 'is', 'tucson', 'tuson', 'ioniq 9', 'blazer ev', 'g90', 'f-350sd', 'f350sd', '4runner', 'model y',
      // Existing fallbacks
      'accent', 'veloster', 'nexo', 'ioniq', 'accord', 'cr-v', 'crv', 'pilot', 'highlander', 'malibu',
      'blazer', 'altima', 'pathfinder', 'cx-5', 'cx-9', 'outback', 'jetta', 'passat', 'tiguan'
    ];
    
    // 🚀 Get dynamic models from inventory — cached on instance to avoid repeated async calls
    if (conversationContext.dealerId) {
      if (this._modelsCache.has(conversationContext.dealerId)) {
        availableModels = this._modelsCache.get(conversationContext.dealerId);
      } else {
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
                Object.values(cacheData.modelsByMake).forEach(models => {
                  orderedModels.push(...models.map(model => String(model).toLowerCase()));
                });
              }
              availableModels = [...new Set(orderedModels)];
              this._modelsCache.set(conversationContext.dealerId, availableModels);
              console.log('📋 [NLP] Cached popularity-ordered models for dealer:', conversationContext.dealerId, availableModels.slice(0, 10));
            }
          }
        } catch (err) {
          console.warn('⚠️ Could not get dynamic models, using fallback:', err.message);
        }
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
      
      // ✅ ENHANCED: Only detect credit scores with explicit context words
      const hasCreditContext = /credit|score|fico|rating/i.test(message);
      
      // Detect specific credit score ranges ONLY if credit context exists
      if (hasCreditContext) {
        if (text.includes('750') || text.includes('excellent') || text.includes('750+')) {
          creditScore = '750+';
          creditRange = 'excellent';
        } else if (text.includes('700') || text.includes('700-749')) {
          creditScore = '700-749';
          creditRange = 'good';
        } else if (text.includes('650') || text.includes('650-699')) {
          creditScore = '650-699';
          creditRange = 'fair';
        } else if (text.includes('below 650')) {
          creditScore = 'below 650';
          creditRange = 'below average';
        }
        
        // Detect numeric credit scores (e.g., "my credit score is 700", "score: 750")
        const numericMatch = message.match(/\b(\d{3})\b/);
        if (numericMatch && !creditScore) {
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
          } else if (score >= 300 && score < 650) {
            creditScore = 'below 650';
            creditRange = 'below average';
          }
        }
      }
      
      // ✅ ALSO detect credit quality words ONLY with credit context
      if (hasCreditContext && !creditScore) {
        if (text.includes('excellent')) {
          creditScore = '750+';
          creditRange = 'excellent';
        } else if (text.includes('good')) {
          creditScore = '700-749';
          creditRange = 'good';
        } else if (text.includes('fair')) {
          creditScore = '650-699';
          creditRange = 'fair';
        } else if (text.includes('poor') || text.includes('bad')) {
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
    
    // Feature detection - look for common vehicle features (RULE-BASED FALLBACK - only if AI didn't extract)
    // ✅ NOTE: This is a fallback - AI extraction happens first in extractSlotsWithAI()
    const featureKeywords = [
      // Basic features
      'navigation', 'gps', 'backup camera', 'rear camera', 'safety', 'entertainment',
      'sunroof', 'moonroof', 'leather', 'heated seats', 'cooled seats', 'ventilated seats',
      'cargo space', 'third row', '3rd row', '7-seater', '7 seats', 'seven seats',
      '5-seater', '5 seats', 'five seats', 'standard seating', 'seating', 'comfort', 
      'performance', 'fuel efficiency', 'technology', 'bluetooth', 'usb', 'charging', 
      'premium audio', 'sound system', 'cruise control', 'adaptive cruise', 'lane keeping', 
      'blind spot', 'parking assist', 'all wheel drive', 'awd', 'four wheel drive', '4wd', 
      'towing', 'roof rack',
      // ✅ NEW: Fuel type
      'hybrid', 'electric', 'ev', 'plug-in hybrid', 'phev', 'gas', 'gasoline', 'diesel', 'fuel efficient',
      // ✅ NEW: Transmission
      'automatic', 'manual', 'cvt', 'transmission', '8-speed', '9-speed', '10-speed',
      // ✅ NEW: Fuel efficiency/MPG
      'high mpg', '30 mpg', '35 mpg', '40 mpg', 'good gas mileage', 'fuel economy',
      // ✅ NEW: Safety features
      'safety features', 'airbags', 'collision avoidance', 'abs', 'stability control',
      'backup sensors', 'forward collision warning', 'lane departure warning', 'blind spot monitoring',
      'rear cross traffic alert', 'automatic emergency braking', 'adaptive headlights',
      // ✅ NEW: Technology features
      'apple carplay', 'android auto', 'wireless charging', 'head-up display', 'hud',
      '360 camera', 'surround view', 'wireless carplay', 'wireless android auto', 'premium sound',
      'infotainment', 'touchscreen', 'digital dashboard'
    ];
    
    const mentionedFeatures = [];
    featureKeywords.forEach(feature => {
      if (text.includes(feature)) {
        mentionedFeatures.push(feature);
      }
    });
    
    if (mentionedFeatures.length > 0) {
      // Store in both locations for compatibility
      slots.qualification.preferred_features = mentionedFeatures;
      slots.qualification.features_mentioned = true;
      
      // ✅ ALSO store in main features slot for direct access
      slots.features = mentionedFeatures;
      
      console.log('📋 Rule-based: Features qualification detected:', mentionedFeatures);
      console.log('📋 Rule-based: Also stored in slots.features for inventory search');
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

    // TEST DRIVE: AT LOCATION DETECTION
    if (conversationContext.currentJourneyStep === 'test_drive') {
      
      // 1. AT LOCATION + READY NOW → Auto-confirm and key delivery
      if (
        (
          text.includes("i'm here") || text.includes('i am here') || text.includes('at the dealership') ||
          text.includes('at your location') || text.includes('at location') || text.includes("i'm at") || 
          text.includes('i am at') || text.includes('at dealership') || text.includes('here at')
        ) &&
        (text.includes('test drive') || text.includes('testdrive') || text.includes('drive')) &&
        (text.includes('now') || text.includes('right now') || text.includes('ready') || text.includes('do it now') || text.includes('want to do'))
      ) {
        slots.test_drive = {
          ...(slots.test_drive || {}),
          customer_at_location: true,
          test_drive_offered: true,
          test_drive_confirmed: true,
          awaiting_key_delivery: true
        };
        console.log('🚗 Rule-based: Customer at location and ready now → auto-confirmed test drive, awaiting key delivery');
      }
      // 2. JUST AT LOCATION (without "now" context)
      else if (
        text.includes("i'm here") || text.includes('i am here') || text.includes('at the dealership') ||
        text.includes('at your location') || text.includes('at dealership') || text.includes('i am at dealership') ||
        text.includes("i'm at the dealership") || text.includes('here at the dealership')
      ) {
        slots.test_drive = {
          ...(slots.test_drive || {}),
          customer_at_location: true
        };
        console.log('🚗 Rule-based: Customer at dealership location detected');
      }
      // 3. DIFFERENT DAY / SCHEDULING REQUEST
      else if (
        text.includes('different day') || text.includes('another day') || text.includes('other day') ||
        text.includes('schedule') || text.includes('book') || text.includes('appointment') ||
        text.includes('later') || text.includes('come back') || text.includes('tomorrow') ||
        text.includes('next week') || text.includes('weekend') || text.includes('monday') ||
        text.includes('tuesday') || text.includes('wednesday') || text.includes('thursday') ||
        text.includes('friday') || text.includes('saturday') || text.includes('sunday')
      ) {
        slots.test_drive = {
          ...(slots.test_drive || {}),
          customer_not_at_location: true,
          scheduling_initiated: true
        };
        
        // Detect specific scheduling time
        if (text.includes('different day') || text.includes('another day') || text.includes('other day')) {
          slots.test_drive.scheduled_time = 'different_day';
        } else if (text.includes('tomorrow')) {
          slots.test_drive.scheduled_time = 'tomorrow';
          slots.test_drive.test_drive_scheduled = true;
          slots.test_drive.specific_time = 'tomorrow';
        } else if (text.includes('weekend') || text.includes('saturday') || text.includes('sunday')) {
          slots.test_drive.scheduled_time = 'weekend';
          slots.test_drive.test_drive_scheduled = true;
        } else if (text.includes('next week')) {
          slots.test_drive.scheduled_time = 'specific';
          slots.test_drive.test_drive_scheduled = true;
          slots.test_drive.specific_time = 'next week';
        } else if (text.includes('monday')) {
          slots.test_drive.scheduled_time = 'specific';
          slots.test_drive.test_drive_scheduled = true;
          slots.test_drive.specific_time = 'Monday';
        } else if (text.includes('tuesday')) {
          slots.test_drive.scheduled_time = 'specific';
          slots.test_drive.test_drive_scheduled = true;
          slots.test_drive.specific_time = 'Tuesday';
        } else if (text.includes('wednesday')) {
          slots.test_drive.scheduled_time = 'specific';
          slots.test_drive.test_drive_scheduled = true;
          slots.test_drive.specific_time = 'Wednesday';
        } else if (text.includes('thursday')) {
          slots.test_drive.scheduled_time = 'specific';
          slots.test_drive.test_drive_scheduled = true;
          slots.test_drive.specific_time = 'Thursday';
        } else if (text.includes('friday')) {
          slots.test_drive.scheduled_time = 'specific';
          slots.test_drive.test_drive_scheduled = true;
          slots.test_drive.specific_time = 'Friday';
        }
        
        console.log('🚗 Rule-based: Customer wants to schedule for different day/time:', slots.test_drive.scheduled_time);
      }
    }

    // TEST DRIVE COMPLETION DETECTION - CRITICAL FOR CONVERSATION FLOW
    console.log('🔍 Checking for test drive completion in message:', message);
    
    // Positive review patterns
    const positiveReviewPatterns = [
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
    
    // Negative review patterns
    const negativeReviewPatterns = [
      /(?:didn't|did not|dont|don't)\s+(?:like|enjoy)/i,
      /(?:was|went)\s+(?:\w+\s+)?(?:bad|terrible|awful|not good|disappointing)/i,
      /(?:not|wasn't)\s+(?:impressed|satisfied|happy|good)/i,
      /(?:drive|test drive)\s+(?:was|went)\s+(?:\w+\s+)?(?:bad|poor|terrible|awful|not good)/i,
      /(?:didn't|did not|dont|don't)\s+(?:work|work out)/i,
      /(?:wasn't|was not)\s+(?:what|as)?\s*(?:expected|hoped|I expected|i hoped)/i,
      /bad\s+(?:experience|drive|test)/i,
      /(?:it|that)\s+was\s+(?:\w+\s+)?(?:bad|terrible|awful|horrible)/i
    ];
    
    // Neutral review patterns
    const neutralReviewPatterns = [
      /(?:was|went)\s+(?:okay|ok|fine|alright|decent)/i,
      /(?:so-so|meh|average|nothing special)/i,
      /(?:it was|drive was)\s+(?:fine|alright|okay)/i
    ];
    
    const hasPositiveReview = positiveReviewPatterns.some(pattern => pattern.test(message));
    const hasNegativeReview = negativeReviewPatterns.some(pattern => pattern.test(message));
    const hasNeutralReview = neutralReviewPatterns.some(pattern => pattern.test(message));
    
    if (hasPositiveReview || hasNegativeReview || hasNeutralReview) {
      // Initialize test_drive slot if not exists
      if (!slots.test_drive) {
        slots.test_drive = {};
      }
      
      slots.test_drive.completion_status = 'completed';
      slots.test_drive.step = 'completed';
      slots.test_drive.hasConfirmedInterest = true;
      slots.test_drive.deal_ready = true;
      slots.test_drive.review_collected = true;
      
      // Set review type
      if (hasPositiveReview) {
        slots.test_drive.test_drive_review = 'positive';
        console.log('🚗 Test drive POSITIVE review detected:', message);
      } else if (hasNegativeReview) {
        slots.test_drive.test_drive_review = 'negative';
        console.log('🚗 Test drive NEGATIVE review detected:', message);
      } else if (hasNeutralReview) {
        slots.test_drive.test_drive_review = 'neutral';
        console.log('🚗 Test drive NEUTRAL review detected:', message);
      }
      
      // Advance to trade evaluation stage
      slots.stage = 'trade_evaluation';
      
      console.log('🚗 Test drive completion detected via NLP extraction with review:', slots.test_drive.test_drive_review);
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

    // ── TRADE-IN WRAPPER: extractTradeEvaluationSlotsWithAI returns {"trade_in":{...}} ──
    if (data.trade_in && typeof data.trade_in === 'object') {
      const ti = data.trade_in;
      // Declined — pass the flag straight through so handlers don't need regex
      if (ti.trade_in_declined === true) {
        console.log('🚫 [normalizeExtractedSlots] NLP confirmed trade_in_declined');
        // Keep the trade_in wrapper intact so the slot-write block in daivecrewai.js
        // (which checks comprehensiveSlots.trade_in) can fire and persist the flag.
        return { trade_in: { trade_in_declined: true } };
      }
      // Positive trade-in data — flatten into out with trade_in_ prefix for flat-slot consumers
      if (ti.make)              { out.trade_in_make  = ti.make;  out.make  = ti.make; }
      if (ti.model)             { out.trade_in_model = ti.model; out.model = ti.model; }
      if (ti.year)              { out.trade_in_year  = ti.year;  out.year  = ti.year; }
      if (ti.mileage)           { out.trade_in_mileage = ti.mileage; }
      if (ti.condition)         { out.trade_in_condition = ti.condition; }
      if (ti.has_trade_in)      { out.has_trade_in = true; }
      if (ti.ownership_confirmed) { out.ownership_confirmed = true; }
      console.log('✅ [normalizeExtractedSlots] Trade-in data flattened:', out);
      return out;
    }
    // ── END TRADE-IN WRAPPER ────────────────────────────────────────────────────────────

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
        // Normalize vehicle type: map "car" to "sedan", "trucks" to "truck"
        // NOTE: "family", "family car", "family vehicle" are NOT mapped — leave unset so user is asked to confirm type
        let normalizedType = sourceData.vehicle_type.toLowerCase().trim();
        
        // If the AI returned a family-only term with no specific type, clear it so the slot stays empty
        if (normalizedType === 'family car' || 
            normalizedType === 'family vehicle' ||
            normalizedType === 'family' ||
            normalizedType === 'family-friendly') {
          console.log('🚗 Skipping vehicle_type normalization for "' + sourceData.vehicle_type + '" — will ask user to confirm type');
          // Do not set out.vehicle_type; fall through without storing
        } else {
        
        // "car" is generic — do NOT map it to "sedan". Only map explicit type words.
        // (Removed: normalizedType === 'car' → sedan mapping to prevent false positives
        //  from phrases like "this car", "the car", "do you have this car in white")
        
        // Map truck variations to truck
        if (normalizedType === 'trucks' || 
            normalizedType === 'pickup' || 
            normalizedType === 'pickup truck') {
          normalizedType = 'truck';
          console.log('🚗 Normalized vehicle_type from "' + sourceData.vehicle_type + '" to "truck"');
        }
        
        out.vehicle_type = normalizedType;
        console.log('🚗 Mapped AI vehicle_type:', normalizedType);
        } // end else (non-family type)
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
    // ✅ ENHANCED: Comprehensive features extraction and normalization
    // Merge features from multiple sources (AI extraction, rule-based extraction, qualification)
    const allFeatures = [];
    
    // 1. Features from AI extraction (direct features array)
    if (data.features && Array.isArray(data.features)) {
      allFeatures.push(...data.features);
      console.log('📋 Found features from AI extraction:', data.features);
    }
    
    // 2. Features from sourceData (if AI wrapped it in vehicle_preferences)
    if (sourceData && sourceData.features && Array.isArray(sourceData.features)) {
      allFeatures.push(...sourceData.features);
      console.log('📋 Found features from sourceData:', sourceData.features);
    }
    
    // 3. Features from rule-based extraction (stored in qualification.preferred_features)
    if (data.qualification?.preferred_features && Array.isArray(data.qualification.preferred_features)) {
      allFeatures.push(...data.qualification.preferred_features);
      console.log('📋 Found features from qualification.preferred_features:', data.qualification.preferred_features);
    }
    
    // 4. Features from sourceData.qualification (if wrapped)
    if (sourceData?.qualification?.preferred_features && Array.isArray(sourceData.qualification.preferred_features)) {
      allFeatures.push(...sourceData.qualification.preferred_features);
      console.log('📋 Found features from sourceData.qualification:', sourceData.qualification.preferred_features);
    }
    
    // Normalize and deduplicate features
    if (allFeatures.length > 0) {
      // Normalize feature names (lowercase, trim, handle variations)
      const normalizedFeatures = allFeatures
        .map(f => {
          if (typeof f !== 'string') return null;
          let normalized = f.toLowerCase().trim();
          
          // Handle common variations
          if (normalized === 'gps') normalized = 'navigation';
          if (normalized === 'rear camera' || normalized === 'backup camera') normalized = 'backup camera';
          if (normalized === 'moonroof') normalized = 'sunroof';
          if (normalized === '4wd' || normalized === 'four wheel drive') normalized = 'all wheel drive';
          if (normalized === 'awd') normalized = 'all wheel drive';
          // Seating capacity normalization
          if (normalized === 'seven seats' || normalized === '7 seats') normalized = '7-seater';
          if (normalized === 'five seats' || normalized === '5 seats') normalized = '5-seater';
          if (normalized.includes('third row') || normalized.includes('3rd row')) normalized = '7-seater';
          
          return normalized;
        })
        .filter(f => f && f.length > 0);
      
      // Remove duplicates
      const uniqueFeatures = [...new Set(normalizedFeatures)];
      
      out.features = uniqueFeatures;
      console.log('✅ Normalized and merged features:', uniqueFeatures);
      
      // Also preserve in qualification.preferred_features for backward compatibility
      if (!out.qualification) {
        out.qualification = {};
      }
      out.qualification.preferred_features = uniqueFeatures;
      out.qualification.features_mentioned = true;
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

  /**
   * Semantically detect test drive review sentiment AND concern categories
   * from any free-form customer message. Used by handleKeyDeliveryAndReview
   * to replace brittle regex pattern-matching.
   *
   * Returns:
   * {
   *   completed: boolean,           // did the user indicate test drive is done?
   *   sentiment: 'positive'|'negative'|'neutral'|null,
   *   concern: {
   *     categories: string[],       // e.g. ['comfort', 'condition', 'general']
   *     specific_detail: string     // raw user text describing the concern
   *   } | null
   * }
   */
  async extractTestDriveReviewWithAI(userMessage, conversationContext = {}) {
    const existing = conversationContext?.Daivesteps?.[4]?.slots || {};
    const lastAgentMsg =
      conversationContext?.messages?.slice().reverse().find(m => m.role === 'assistant')?.content ||
      conversationContext?.lastAgentMessage || '';

    const systemPrompt = `
You are a semantic extraction engine for a car dealership AI assistant.
Given a customer message sent AFTER a test drive, extract two things:

1. REVIEW — did the customer indicate test drive outcome and how they felt?
2. CONCERN — if negative, what specifically bothered them?

OUTPUT: Return ONLY valid JSON (no markdown, no explanations):
{
  "completed": true | false,
  "sentiment": "positive" | "negative" | "neutral" | null,
  "concern": {
    "categories": ["comfort"|"size"|"price"|"condition"|"mileage"|"performance"|"features"|"aesthetics"|"fuel_type"|"general"],
    "specific_detail": "<verbatim user text about concern>"
  }
}

RULES:
- "completed" = true whenever the user implies test drive happened (e.g. "I did it", "done", "just finished", "have completed", "I hate it" implies it's done)
- "sentiment" = null ONLY when message has NO emotional/evaluative content at all (e.g. "ok", "right", "yes", "I need to think")
- For short negative phrases like "its negative", "i hate it", "not good", "bad experience", "condition is bad" → sentiment = "negative", completed = true
- For ambiguous short affirmations like "yes", "okay", "exactly", "right" → completed = false, sentiment = null (context is unclear)
- "concern.categories" may have multiple values if the user mentions multiple issues
- "concern" should be null when sentiment is NOT negative
- Always extract concern.specific_detail verbatim from the user's own words

CONCERN CATEGORY GUIDE:
- comfort: rough ride, bumpy, noisy, uncomfortable, hard seats, vibration, stiff
- size: too big, too small, cramped, not enough space, need more room, compact
- condition: bad condition, wear, scratches, interior condition, damage, looks old
- mileage: too many miles, high mileage, old, used a lot
- performance: sluggish, slow, underpowered, weak engine, acceleration
- features: missing features, no nav, no sunroof, no heated seats, basic, no bluetooth
- aesthetics: ugly, don't like the look, style, color, design
- price: too expensive, over budget, costly
- fuel_type: not hybrid, want electric, fuel efficiency, mpg
- general: anything that doesn't fit the above (catch-all)
`;

    const userPrompt = `
Last assistant message: "${String(lastAgentMsg).slice(0, 300)}"
Current test drive slots: ${JSON.stringify({ test_drive_completed: existing.test_drive_completed, test_drive_review: existing.test_drive_review, awaiting_concern_detail: existing.awaiting_concern_detail })}

Customer message: "${userMessage}"

Return JSON only.`;

    try {
      const aiResponse = await this.llm.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], { response_format: { type: 'json_object' } });

      let raw = aiResponse.content || aiResponse.text || '';
      raw = raw.replace(/```json|```/g, '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        console.log('✅ [extractTestDriveReviewWithAI] LLM result:', result);
        return {
          completed: result.completed === true,
          sentiment: result.sentiment || null,
          concern: result.concern || null
        };
      }
    } catch (err) {
      console.warn('⚠️ [extractTestDriveReviewWithAI] LLM failed, using regex fallback:', err.message);
    }

    // ── Regex fallback ──
    const t = userMessage.toLowerCase();
    const completed =
      /(done|completed|finished|taken|have done|just done)\s+(the\s+)?(test\s+)?drive|drive.*(great|bad|good|hate|loved|okay|negative|positive)/i.test(t) ||
      /(i hate it|not for me|its negative|condition is bad|bad experience|didn't like it|don't like it)/i.test(t);
    const sentiment =
      /(great|good|loved|amazing|awesome|fantastic|thrilled|excited|happy|pleased|impressed|brilliant)/i.test(t)
        ? 'positive'
        : /(bad|hate|negative|terrible|poor|didn't like|dislike|not happy|not impressed|uncomfortable|condition is bad|not good|disappointing)/i.test(t)
        ? 'negative'
        : /(okay|fine|alright|decent|average|so-so|not sure|mixed)/i.test(t)
        ? 'neutral'
        : null;

    let concernCategories = ['general'];
    if (/(condition|wear|scratches|damage|looks old)/i.test(t)) concernCategories = ['condition'];
    else if (/(comfort|rough|bumpy|noisy|uncomfortable|hard seat|vibrat|stiff)/i.test(t)) concernCategories = ['comfort'];
    else if (/(too big|too small|cramped|more room|compact|space)/i.test(t)) concernCategories = ['size'];
    else if (/(price|expensive|budget|costly)/i.test(t)) concernCategories = ['price'];
    else if (/(mileage|too old|older|miles)/i.test(t)) concernCategories = ['mileage'];
    else if (/(slow|sluggish|power|acceleration)/i.test(t)) concernCategories = ['performance'];
    else if (/(feature|nav|sunroof|heated|bluetooth)/i.test(t)) concernCategories = ['features'];
    else if (/(look|style|ugly|color|design)/i.test(t)) concernCategories = ['aesthetics'];
    else if (/(hybrid|electric|fuel|mpg)/i.test(t)) concernCategories = ['fuel_type'];

    return {
      completed,
      sentiment,
      concern: sentiment === 'negative' ? { categories: concernCategories, specific_detail: userMessage } : null
    };
  }

  /**
   * Semantically detect whether a customer is confirming or declining a request to
   * show alternative vehicles after a negative test drive review.
   *
   * Returns: { confirmed: true | false | null }
   *   true  → customer wants to see alternatives
   *   false → customer is declining / not now
   *   null  → ambiguous, cannot determine
   */
  async extractInventoryConfirmationWithAI(userMessage, lastBotMessage = '') {
    const systemPrompt = `
You are a semantic intent classifier for a car dealership AI assistant.

The AI just asked the customer something like: "Would you like me to pull up some better-matched vehicles for you?"

Your job is to decide if the customer's reply is a CONFIRMATION (yes, show me), a DECLINE (no, not now), or AMBIGUOUS.

OUTPUT: Return ONLY valid JSON (no markdown, no explanations):
{ "confirmed": true | false | null }

RULES:
- confirmed = true  → customer agrees to see alternatives, even indirectly:
    "yes", "yeah", "sure", "okay", "ok", "go for it", "go ahead", "please do", "sounds good",
    "absolutely", "definitely", "why not", "let's do it", "please", "of course", "certainly",
    "find me something", "show me what you have", "let's see", "show me", "i'd like that",
    "that would be great", "find something else", "yes please", "do it"
- confirmed = false → customer declines:
    "no", "nope", "not now", "maybe later", "i'll think about it", "not interested",
    "i'm fine", "no thank you", "not today"
- confirmed = null  → genuinely ambiguous (e.g. "hmm", "i don't know", "let me think")

IMPORTANT: Lean towards true for any positive/agreeable reply. Only return false for clear declines.
Only return null if the intent is truly impossible to determine.
`;

    const userPrompt = `
Last bot message: "${String(lastBotMessage).slice(0, 300)}"
Customer reply: "${userMessage}"

Return JSON only.`;

    try {
      const aiResponse = await this.llm.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], { response_format: { type: 'json_object' } });

      let raw = aiResponse.content || aiResponse.text || '';
      raw = raw.replace(/```json|```/g, '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        console.log('✅ [extractInventoryConfirmationWithAI] result:', result);
        return { confirmed: result.confirmed ?? null };
      }
    } catch (err) {
      console.warn('⚠️ [extractInventoryConfirmationWithAI] LLM failed, using regex fallback:', err.message);
    }

    // Regex fallback
    const t = userMessage.toLowerCase().trim();
    if (/\b(yes|yeah|yep|sure|okay|ok|absolutely|definitely|please|show me|go ahead|let'?s see|let me see|go for it|why not|do it|sounds good|of course|certainly|find me|i'?d like that)\b/i.test(t)) {
      return { confirmed: true };
    }
    if (/^(no|nope|not now|maybe later|i'?ll think|not interested|no thanks)\b/i.test(t)) {
      return { confirmed: false };
    }
    return { confirmed: null };
  }
}

// module.exports = NLPEnhancedSlotExtraction;

export default NLPEnhancedSlotExtraction;
