  /**
   * Main Workflow: Complete CrewAgentAI Processing
   * Orchestrates all 5 steps in sequence
   * ✅ SIMPLIFIED: Uses conversationContext directly instead of getUnifiedSlots
   */
  async processWithCrewAgentAI(userMessage, sessionId, conversationContext = {}) {
    const methodName = 'processWithCrewAgentAI';
    const methodStartTime = performance.now();
    
    try {
      console.log('🚀 CrewAgentAI Main Workflow STARTED');
      const totalStartTime = performance.now();
      
      // INTERRUPTION HANDLING: Check if customer wants to return to deal completion
      const returnCheck = this.checkForReturnToDealCompletion(userMessage, conversationContext);
      if (returnCheck.shouldReturn) {
        console.log(`🔄 Customer wants to return to deal completion: ${returnCheck.returnMessage}`);
        return {
          response: returnCheck.returnMessage,
          conversationContext: conversationContext,
          processingTime: performance.now() - totalStartTime,
          intent: 'return_to_deal_completion',
          confidence: 1.0
        };
      }
      
      // INTERRUPTION DETECTION: Check if this is an interruption during deal completion
      const isInterruption = this.handleInterruption(userMessage, conversationContext);
      if (isInterruption) {
        console.log(`🔄 Deal completion interrupted - handling general inquiry`);
      }
      
      // TEST DRIVE FLOW: Handle complete customer journey FIRST
      const isTestDriveRequest = userMessage.toLowerCase().includes('test drive') || userMessage.toLowerCase().includes('testdrive');
      const hasStockNumber = userMessage.toLowerCase().includes('stock') || userMessage.toLowerCase().includes('no ');
      const isTestDriveWithStock = isTestDriveRequest && hasStockNumber;
      
      // Check if we're in an ongoing test drive conversation
      // ✅ SIMPLIFIED: Use conversationContext directly instead of getUnifiedSlots
      const testDriveData = conversationContext.Daivesteps?.['Step 4 - Test Drive']?.test_drive;
      const hasOngoingTestDrive = testDriveData?.step && 
                                 testDriveData?.step !== 'none' &&
                                 testDriveData?.completion_status !== 'completed';
      
      if (isTestDriveWithStock) {
        console.log('🚗 Test drive with stock number detected - proceeding with test drive flow');
        // Extract stock number and proceed with test drive scheduling
        const stockMatch = userMessage.match(/stock\s*no\.?\s*([A-Z0-9]+)/i);
        if (stockMatch) {
          const stockNumber = stockMatch[1];
          console.log(`🎯 Stock number extracted: ${stockNumber}`);
          
          // Check if customer wants immediate test drive (ASAP) or is at location
          const isAtLocation = userMessage.toLowerCase().includes('i am at') ||
                              userMessage.toLowerCase().includes('i\'m at') ||
                              userMessage.toLowerCase().includes('i am here') ||
                              userMessage.toLowerCase().includes('i\'m here') ||
                              userMessage.toLowerCase().includes('i am in') ||
                              userMessage.toLowerCase().includes('i\'m in') ||
                              userMessage.toLowerCase().includes('at the showroom') ||
                              userMessage.toLowerCase().includes('at the dealership') ||
                              userMessage.toLowerCase().includes('walked in') ||
                              userMessage.toLowerCase().includes('just walked in') ||
                              userMessage.toLowerCase().includes('came in') ||
                              userMessage.toLowerCase().includes('visiting') ||
                              userMessage.toLowerCase().includes('at your location') ||
                              userMessage.toLowerCase().includes('at your dealership');
          
          const wantsImmediateTestDrive = userMessage.toLowerCase().includes('asap') || 
                                        userMessage.toLowerCase().includes('right now') ||
                                        userMessage.toLowerCase().includes('immediately') ||
                                        userMessage.toLowerCase().includes('now') ||
                                        userMessage.toLowerCase().includes('today') ||
                                        userMessage.toLowerCase().includes('right away') ||
                                        isAtLocation;
              
          if (wantsImmediateTestDrive) {
            console.log('⚡ Immediate test drive requested - skipping scheduling steps');
            // Set up immediate test drive context
            if (conversationContext.Daivesteps && conversationContext.Daivesteps['Step 4 - Test Drive']) {
              conversationContext.Daivesteps['Step 4 - Test Drive'].test_drive = {
                step: 'immediate',
                hasConfirmedInterest: true,
                vehicle_selection: {
                  stock_number: stockNumber,
                  selection_timestamp: new Date().toISOString()
                },
                completion_status: 'pending',
                deal_ready: false,
                isImmediate: true,
                scheduled_date: 'today',
                scheduled_time: 'now'
              };
            }
          } else {
            // Set up regular test drive context with scheduling
            if (conversationContext.Daivesteps && conversationContext.Daivesteps['Step 4 - Test Drive']) {
              conversationContext.Daivesteps['Step 4 - Test Drive'].test_drive = {
                step: 'scheduling',
                hasConfirmedInterest: true,
                vehicle_selection: {
                  stock_number: stockNumber,
                  selection_timestamp: new Date().toISOString()
                },
                completion_status: 'pending',
                deal_ready: false,
                isImmediate: false
              };
            }
          }
          
          // Skip mandatory slots for test drive with stock number
          console.log('✅ Skipping mandatory slots for test drive with stock number');
        }
      } else if (hasOngoingTestDrive) {
        console.log('🚗 Continuing test drive conversation - maintaining context');
        // Don't reset context if we're in an ongoing test drive
      } else {
        // CONTEXT RESET: Check if this is a new conversation or greeting (only if not test drive)
        const hasExistingData = conversationContext.Daivesteps && 
                               Object.values(conversationContext.Daivesteps).some(step => 
                                 step.slots && Object.values(step.slots).some(slot => 
                                   slot && typeof slot === 'object' && Object.values(slot).some(value => 
                                     value && value !== null && value !== undefined && value !== ''
                                   )
                                 )
                               );
        const isNewConversation = (!conversationContext.messages || conversationContext.messages.length <= 1) && !hasExistingData;
        const isGreeting = userMessage.toLowerCase().includes('hello') || 
                          userMessage.toLowerCase().includes('hi') || 
                          userMessage.toLowerCase().includes('hey') ||
                          userMessage.toLowerCase().includes('showroom') ||
                          userMessage.toLowerCase().includes('vehicle');
        
        if (isNewConversation) {
          console.log('🔄 Resetting context for new conversation');
          // Reset optimized structure for new conversation
          this.resetOptimizedStructure(conversationContext);
        } else if (isGreeting) {
          console.log('👋 Greeting detected - preserving existing context');
          // Don't reset context for greetings, just continue with existing data
        }
      }
      
      // ENRICH CONTEXT: Add vehicle selection and preference information for agents
      await this.enrichContextForAgents(conversationContext, userMessage);
      
      // PERFORMANCE OPTIMIZATION: Check response cache AFTER context enrichment
      const cacheKey = this.generateCacheKey(userMessage, conversationContext);
      const cachedResponse = this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        console.log('⚡ Using cached response for faster performance');
        return cachedResponse;
      }
      
      // PERFORMANCE OPTIMIZATION: Use cached initialization status
      const contextDealerId = conversationContext.dealerId || this.dealerId;
      if (!this._inventoryInitialized) {
        console.log('🔍 Initializing inventory with dealer ID:', contextDealerId);
        await this.initializeInventory(contextDealerId);
        this._inventoryInitialized = true;
      }
      
      // PERFORMANCE OPTIMIZATION: Add overall timeout protection (8 seconds total)
      const self = this;
      const workflowPromise = (async () => {
        // Step 1: Semantic Intent Detection
        const intentResult = await self.detectSemanticIntent(userMessage, conversationContext);
        
        // Step 1.1: Handle Vehicle Selection (if detected)
        if (intentResult.intent === 'vehicle_selection') {
          console.log('🚗 Processing vehicle selection...');
          const selectedVehicle = intentResult.extracted_info.selectedVehicle;
          const selectionNumber = intentResult.extracted_info.selectedVehicleNumber;
          
          if (selectedVehicle) {
            // Store the selected vehicle in conversation context
            conversationContext.selectedVehicle = selectedVehicle;
            conversationContext.vehicleSelectionNumber = selectionNumber;
            
            // Update test drive slots with selected vehicle
            conversationContext.testDriveStep = 'vehicle_selected';
            conversationContext.vehicleSelection = {
              number: selectionNumber,
              vehicle: selectedVehicle,
              timestamp: new Date().toISOString()
            };
            
            console.log(`✅ Vehicle selection processed: Option ${selectionNumber} - ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`);
          }
        }
        
        // Step 1.5: Extract and Update Slots (ENHANCED APPROACH)
        console.log('✅ Enhanced slot extraction already completed in main flow');
        
        // Step 1.6: Update optimized structure from conversation context
        self.updateOptimizedStructureFromContext(conversationContext);
        
        // Step 1.7: Sync slots with conversation context (unified approach)
        self.syncSlotsWithConversationContext(conversationContext);
        
        // Step 1.7: Update deal completion progress based on current conversation stage
        self.updateDealCompletionProgressFromStage(conversationContext);
        
        // ✅ SIMPLIFIED: Use conversationContext directly instead of getUnifiedSlots
        const currentStep = conversationContext.currentJourneyStep || conversationContext.currentStep || 'inquiry';
        const stepData = conversationContext.stepData || {};
        const stepSlots = conversationContext.stepSlots || {};
        
        // Check step completion using new structure
        const stepCompleted = self.journeyManager ? self.journeyManager.isStepCompleted(currentStep, conversationContext) : false;
        
        console.log('📊 SIMPLIFIED SLOT DATA FOR MESSAGE:', {
          userMessage: userMessage,
          extractedSlots: 'Enhanced extraction completed in main flow',
          currentSlots: conversationContext,
          currentStep: currentStep,
          stepData: stepData,
          stepSlots: stepSlots,
          stepCompleted: stepCompleted,
          hasVehicleType: !!(conversationContext.vehicleType || conversationContext.vehicle?.type || stepSlots.vehicle_type || stepSlots['VehicleSelection']?.type),
          hasBudget: !!(conversationContext.budget?.max_price || conversationContext.budget?.target_price),
          hasMake: !!(conversationContext.vehicle?.make || stepSlots['VehicleSelection']?.make),
          sharedVehicles: stepSlots.sharedVehicles?.length || 0,
          rejectedVehicles: stepSlots.rejectedVehicles?.length || 0,
          selectedVehicles: stepSlots.selectedVehicles?.length || 0
        });
        
        // Step 2: Agent Routing
        const routingResult = await self.routeToAgent(intentResult, userMessage, conversationContext);
        
        // SAFETY CHECK: Ensure routingResult has a valid agent
        if (!routingResult || !routingResult.agent) {
          console.error('❌ Invalid routing result:', routingResult);
          throw new Error('Agent routing failed - no valid agent found');
        }
        
        // Step 3: Response Generation
        let agentResponse = await self.generateAgentResponse(
          routingResult.agent,
          userMessage,
          intentResult,
          routingResult,
          conversationContext
        );
        
        // Check if response generation failed and use fallback
        if (!agentResponse || !agentResponse.response) {
          console.warn('⚠️ Agent response generation failed, using fallback');
          const fallbackResponse = self.generateFallbackResponse(intentResult, conversationContext.inventoryData, userMessage);
          agentResponse = {
            response: fallbackResponse,
            agent: 'DAIVE',
            agentType: 'fallback',
            responseTime: 0,
            context: {}
          };
        }
        
        // Step 4: Context Maintenance
        await self.maintainConversationContext(sessionId, userMessage, agentResponse, intentResult, routingResult, conversationContext);
        
        // Step 5: Response Validation
        const validationResult = await self.validateResponseQuality(userMessage, agentResponse.response, intentResult, conversationContext);
        
        // Cache the response for future use
        self.cacheResponse(cacheKey, {
          response: agentResponse.response,
          conversationContext: conversationContext,
          processingTime: performance.now() - totalStartTime,
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          agent: agentResponse.agent || routingResult.agent?.name || 'unknown',
          validationResult: validationResult
        });
        
        return {
          response: agentResponse.response,
          conversationContext: conversationContext,
          processingTime: performance.now() - totalStartTime,
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          agent: agentResponse.agent || routingResult.agent?.name || 'unknown',
          validationResult: validationResult,
          method: methodName,
          stepData: stepData,
          stepSlots: stepSlots,
          currentStep: currentStep,
          stepCompleted: stepCompleted
        };
      })();
      
      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Workflow timeout after 8 seconds')), 8000);
      });
      
      const result = await Promise.race([workflowPromise, timeoutPromise]);
      
      console.log('✅ CrewAgentAI Main Workflow COMPLETED');
      return result;
      
    } catch (error) {
      console.error('❌ Error in processWithCrewAgentAI:', error);
      
      // Return fallback response on error
      const fallbackResponse = this.generateFallbackResponse(
        { intent: 'general_inquiry', confidence: 0.5, extracted_info: {} },
        conversationContext.inventoryData || [],
        userMessage
      );
      
      return {
        response: fallbackResponse,
        conversationContext: conversationContext,
        processingTime: performance.now() - methodStartTime,
        intent: 'general_inquiry',
        confidence: 0.5,
        agent: 'DAIVE',
        error: error.message,
        method: methodName
      };
    }
  }
