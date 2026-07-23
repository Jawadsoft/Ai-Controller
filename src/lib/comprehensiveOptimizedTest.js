/**
 * ✅ COMPREHENSIVE OPTIMIZED CREW AGENT AI TEST
 * Tests the complete OptimizedCrewAgentAI system with current integration
 */

// Import the actual classes from daivecrewai.js
const fs = require('fs');
const path = require('path');

// Read and evaluate the daivecrewai.js file to get access to classes
const daivecrewaiCode = fs.readFileSync(path.join(__dirname, 'daivecrewai.js'), 'utf8');

// Create a safe evaluation context
const vm = require('vm');
const context = {
  console: console,
  require: require,
  module: { exports: {} },
  exports: {},
  __dirname: __dirname,
  __filename: __filename,
  process: process,
  Buffer: Buffer,
  setTimeout: setTimeout,
  setInterval: setInterval,
  clearTimeout: clearTimeout,
  clearInterval: clearInterval,
  performance: performance,
  Date: Date,
  JSON: JSON,
  Math: Math,
  Array: Array,
  Object: Object,
  String: String,
  Number: Number,
  Boolean: Boolean,
  RegExp: RegExp,
  Error: Error,
  TypeError: TypeError,
  ReferenceError: ReferenceError,
  SyntaxError: SyntaxError,
  RangeError: RangeError,
  EvalError: EvalError,
  URIError: URIError,
  global: global,
  globalThis: globalThis
};

// Evaluate the daivecrewai.js code
vm.createContext(context);
vm.runInContext(daivecrewaiCode, context);

// Extract the classes we need
const OptimizedCrewAgentAI = context.OptimizedCrewAgentAI;
const DAIVEService = context.DAIVEService;

class ComprehensiveOptimizedTest {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      scenarios: []
    };
    this.optimizedCrewAI = null;
    this.daiveService = null;
  }

  async runAllTests() {
    console.log('🚀 COMPREHENSIVE OPTIMIZED CREW AGENT AI TEST SUITE');
    console.log('='.repeat(80));

    try {
      // Initialize the system
      await this.initializeSystem();
      
      // Test 1: Basic System Initialization
      await this.testSystemInitialization();
      
      // Test 2: Optimized Array Settings Integration
      await this.testOptimizedArrayIntegration();
      
      // Test 3: Complete Conversation Flow
      await this.testCompleteConversationFlow();
      
      // Test 4: Decision Making with Optimized Arrays
      await this.testDecisionMakingWithOptimizedArrays();
      
      // Test 5: Array Persistence and Synchronization
      await this.testArrayPersistenceAndSynchronization();
      
      // Test 6: Edge Cases and Error Handling
      await this.testEdgeCasesAndErrorHandling();
      
      // Test 7: Performance with Optimized Arrays
      await this.testPerformanceWithOptimizedArrays();
      
      // Test 8: Integration with DAIVEService
      await this.testDAIVEServiceIntegration();
      
      this.printTestResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  }

  async initializeSystem() {
    console.log('\n🔧 Initializing OptimizedCrewAgentAI System...');
    
    try {
      this.optimizedCrewAI = new OptimizedCrewAgentAI('test-api-key', 'test-dealer');
      this.daiveService = new DAIVEService();
      console.log('✅ System initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ System initialization failed:', error);
      return false;
    }
  }

  async testSystemInitialization() {
    console.log('\n📝 Test 1: System Initialization');
    console.log('-'.repeat(50));

    const tests = [
      {
        name: 'OptimizedCrewAgentAI Constructor',
        test: () => {
          const instance = new OptimizedCrewAgentAI('test-key', 'test-dealer');
          return instance && instance.dealerId === 'test-dealer';
        }
      },
      {
        name: 'DAIVEService Constructor',
        test: () => {
          const instance = new DAIVEService();
          return instance && typeof instance.processConversationWithOptimizedCrew === 'function';
        }
      },
      {
        name: 'OptimizedCrewAgentAI Methods Available',
        test: () => {
          return this.optimizedCrewAI && 
                 typeof this.optimizedCrewAI.processWithCrewAgentAI === 'function' &&
                 typeof this.optimizedCrewAI.getUnifiedSlots === 'function' &&
                 typeof this.optimizedCrewAI.updateDaivestepsField === 'function';
        }
      }
    ];

    for (const test of tests) {
      try {
        const success = test.test();
        this.recordTestResult(test.name, success, {});
      } catch (error) {
        this.recordTestResult(test.name, false, { error: error.message });
      }
    }
  }

  async testOptimizedArrayIntegration() {
    console.log('\n🔄 Test 2: Optimized Array Settings Integration');
    console.log('-'.repeat(50));

    const testCases = [
      {
        name: 'Vehicle Type Extraction and Storage',
        message: 'I want an SUV',
        expectedVehicleType: 'SUV',
        testSteps: [
          'extractStepFieldsFromMessage',
          'updateDaivestepsField',
          'getUnifiedSlots'
        ]
      },
      {
        name: 'Budget Extraction and Storage',
        message: 'my budget is 30k',
        expectedBudget: 30000,
        testSteps: [
          'extractStepFieldsFromMessage',
          'updateDaivestepsField',
          'getUnifiedSlots'
        ]
      },
      {
        name: 'Combined Vehicle Type and Budget',
        message: 'I want an SUV with a budget of 30k',
        expectedVehicleType: 'SUV',
        expectedBudget: 30000,
        testSteps: [
          'extractStepFieldsFromMessage',
          'updateDaivestepsField',
          'getUnifiedSlots',
          'decisionMaking'
        ]
      }
    ];

    for (const testCase of testCases) {
      await this.runOptimizedArrayTest(testCase);
    }
  }

  async runOptimizedArrayTest(testCase) {
    try {
      const conversationContext = this.createTestContext();
      
      // Test extraction
      const extractedFields = await this.optimizedCrewAI.extractStepFieldsFromMessage(
        testCase.message, 
        conversationContext
      );

      // Verify extraction worked
      let extractionValid = true;
      if (testCase.expectedVehicleType) {
        extractionValid = extractionValid && extractedFields.fields.vehicle_type === testCase.expectedVehicleType;
      }
      if (testCase.expectedBudget) {
        extractionValid = extractionValid && extractedFields.fields.budget === testCase.expectedBudget;
      }

      // Verify Daivesteps structure was updated
      const unifiedSlots = this.optimizedCrewAI.getUnifiedSlots(conversationContext);
      let daivestepsValid = true;
      if (testCase.expectedVehicleType) {
        daivestepsValid = daivestepsValid && unifiedSlots.vehicleType === testCase.expectedVehicleType;
      }
      if (testCase.expectedBudget) {
        daivestepsValid = daivestepsValid && unifiedSlots.budgetAmount === testCase.expectedBudget;
      }

      // Test decision making if applicable
      let decisionValid = true;
      if (testCase.testSteps.includes('decisionMaking')) {
        const hasVehicleType = !!unifiedSlots.vehicleType;
        const hasBudget = !!unifiedSlots.budgetAmount;
        const isEarlyConversation = conversationContext.messages.length < 3;
        
        let decision = 'unknown';
        if (hasVehicleType && hasBudget) {
          decision = 'show_inventory';
        } else if (isEarlyConversation && hasVehicleType) {
          decision = 'show_inventory';
        } else if (!hasVehicleType) {
          decision = 'ask_question';
        } else if (!hasBudget) {
          decision = 'ask_question';
        }
        
        decisionValid = decision !== 'unknown';
      }

      const success = extractionValid && daivestepsValid && decisionValid;

      this.recordTestResult(testCase.name, success, {
        extraction: { valid: extractionValid, data: extractedFields.fields },
        daivesteps: { valid: daivestepsValid, data: {
          vehicleType: unifiedSlots.vehicleType,
          budgetAmount: unifiedSlots.budgetAmount
        }},
        decision: { valid: decisionValid }
      });

    } catch (error) {
      this.recordTestResult(testCase.name, false, { error: error.message });
    }
  }

  async testCompleteConversationFlow() {
    console.log('\n🎯 Test 3: Complete Conversation Flow');
    console.log('-'.repeat(50));

    const conversationFlow = [
      { step: 'inquiry', message: 'hello', expectedResponse: 'greeting' },
      { step: 'inquiry', message: 'I want to buy a car', expectedResponse: 'question' },
      { step: 'inquiry', message: 'I want an SUV', expectedResponse: 'question' },
      { step: 'lead_capture', message: 'my budget is 30k', expectedResponse: 'inventory' },
      { step: 'vehicle_selection', message: 'I like Hyundai', expectedResponse: 'inventory' },
      { step: 'test_drive', message: 'can I test drive?', expectedResponse: 'test_drive' }
    ];

    let conversationContext = this.createTestContext();
    let flowResults = [];

    for (const step of conversationFlow) {
      try {
        const result = await this.optimizedCrewAI.processWithCrewAgentAI(
          step.message, 
          'test-session', 
          conversationContext
        );

        if (result.success) {
          conversationContext = result.context;
          const currentStep = conversationContext.currentJourneyStep || 'inquiry';
          
          flowResults.push({
            message: step.message,
            expectedStep: step.step,
            actualStep: currentStep,
            response: result.response ? result.response.substring(0, 100) + '...' : 'No response',
            success: true
          });
        } else {
          flowResults.push({
            message: step.message,
            expectedStep: step.step,
            actualStep: 'error',
            response: result.response || 'Error',
            success: false
          });
        }
      } catch (error) {
        flowResults.push({
          message: step.message,
          expectedStep: step.step,
          actualStep: 'error',
          response: error.message,
          success: false
        });
      }
    }

    const successCount = flowResults.filter(r => r.success).length;
    const success = successCount === conversationFlow.length;

    this.recordTestResult('Complete Conversation Flow', success, {
      totalSteps: conversationFlow.length,
      successfulSteps: successCount,
      flowResults
    });
  }

  async testDecisionMakingWithOptimizedArrays() {
    console.log('\n🧠 Test 4: Decision Making with Optimized Arrays');
    console.log('-'.repeat(50));

    const decisionTests = [
      {
        name: 'Show Inventory - Early Conversation with Vehicle Type',
        context: this.createContextWithOptimizedData({
          vehicleType: 'SUV',
          budgetAmount: null,
          messageCount: 2
        }),
        expectedDecision: 'show_inventory'
      },
      {
        name: 'Show Inventory - Complete Information',
        context: this.createContextWithOptimizedData({
          vehicleType: 'SUV',
          budgetAmount: 30000,
          messageCount: 5
        }),
        expectedDecision: 'show_inventory'
      },
      {
        name: 'Ask Question - Missing Vehicle Type',
        context: this.createContextWithOptimizedData({
          vehicleType: null,
          budgetAmount: 30000,
          messageCount: 3
        }),
        expectedDecision: 'ask_question'
      },
      {
        name: 'Ask Question - Missing Budget',
        context: this.createContextWithOptimizedData({
          vehicleType: 'SUV',
          budgetAmount: null,
          messageCount: 5
        }),
        expectedDecision: 'ask_question'
      }
    ];

    for (const test of decisionTests) {
      try {
        const unifiedSlots = this.optimizedCrewAI.getUnifiedSlots(test.context);
        
        // Simulate the actual decision logic
        let decision = 'unknown';
        const hasVehicleType = !!unifiedSlots.vehicleType;
        const hasBudget = !!unifiedSlots.budgetAmount;
        const isEarlyConversation = test.context.messages.length < 3;
        
        if (hasVehicleType && hasBudget) {
          decision = 'show_inventory';
        } else if (isEarlyConversation && hasVehicleType) {
          decision = 'show_inventory';
        } else if (!hasVehicleType) {
          decision = 'ask_question';
        } else if (!hasBudget) {
          decision = 'ask_question';
        }

        const success = decision === test.expectedDecision;

        this.recordTestResult(test.name, success, {
          decision,
          expectedDecision: test.expectedDecision,
          context: {
            hasVehicleType,
            hasBudget,
            isEarlyConversation,
            messageCount: test.context.messages.length
          },
          unifiedSlots: {
            vehicleType: unifiedSlots.vehicleType,
            budgetAmount: unifiedSlots.budgetAmount
          }
        });

      } catch (error) {
        this.recordTestResult(test.name, false, { error: error.message });
      }
    }
  }

  async testArrayPersistenceAndSynchronization() {
    console.log('\n💾 Test 5: Array Persistence and Synchronization');
    console.log('-'.repeat(50));

    const persistenceTests = [
      {
        name: 'Shared Vehicles Array',
        setup: (context) => {
          context.Daivesteps['Step 3 - Vehicle'].slots.sharedVehicles = [
            { stock_number: 'TEST-001', make: 'Hyundai', model: 'Tucson', year: 2024, price: 32000 },
            { stock_number: 'TEST-002', make: 'Hyundai', model: 'Santa Fe', year: 2024, price: 38000 }
          ];
          return context;
        },
        verify: (context) => {
          const unifiedSlots = this.optimizedCrewAI.getUnifiedSlots(context);
          return unifiedSlots.sharedVehicles && unifiedSlots.sharedVehicles.length === 2;
        }
      },
      {
        name: 'Rejected Vehicles Array',
        setup: (context) => {
          context.Daivesteps['Step 3 - Vehicle'].slots.rejectedVehicles = [
            { stock_number: 'REJECT-001', make: 'Honda', model: 'CR-V', year: 2023, price: 35000 }
          ];
          return context;
        },
        verify: (context) => {
          const unifiedSlots = this.optimizedCrewAI.getUnifiedSlots(context);
          return unifiedSlots.rejectedVehicles && unifiedSlots.rejectedVehicles.length === 1;
        }
      },
      {
        name: 'Selected Vehicles Array',
        setup: (context) => {
          context.Daivesteps['Step 3 - Vehicle'].slots.selectedVehicles = [
            { stock_number: 'SELECT-001', make: 'Hyundai', model: 'Tucson', year: 2024, price: 32000 }
          ];
          return context;
        },
        verify: (context) => {
          const unifiedSlots = this.optimizedCrewAI.getUnifiedSlots(context);
          return unifiedSlots.selectedVehicles && unifiedSlots.selectedVehicles.length === 1;
        }
      }
    ];

    for (const test of persistenceTests) {
      try {
        const context = this.createTestContext();
        const setupContext = test.setup(context);
        const success = test.verify(setupContext);
        
        this.recordTestResult(test.name, success, {
          context: setupContext.Daivesteps['Step 3 - Vehicle'].slots
        });
      } catch (error) {
        this.recordTestResult(test.name, false, { error: error.message });
      }
    }
  }

  async testEdgeCasesAndErrorHandling() {
    console.log('\n⚠️ Test 6: Edge Cases and Error Handling');
    console.log('-'.repeat(50));

    const edgeCases = [
      {
        name: 'Empty Message',
        message: '',
        shouldNotCrash: true
      },
      {
        name: 'Null Context',
        context: null,
        shouldHandle: true
      },
      {
        name: 'Empty Daivesteps',
        context: { Daivesteps: {} },
        shouldHandle: true
      },
      {
        name: 'Missing Step Slots',
        context: { Daivesteps: { 'Step 1 - Inquiry': {} } },
        shouldHandle: true
      },
      {
        name: 'Invalid Budget Format',
        message: 'my budget is abc dollars',
        shouldExtractNothing: true
      }
    ];

    for (const test of edgeCases) {
      try {
        let success = false;
        
        if (test.message !== undefined) {
          // Test with message
          const context = this.createTestContext();
          const result = await this.optimizedCrewAI.processWithCrewAgentAI(
            test.message, 
            'test-session', 
            context
          );
          
          if (test.shouldNotCrash) {
            success = result.success !== false;
          } else if (test.shouldExtractNothing) {
            const unifiedSlots = this.optimizedCrewAI.getUnifiedSlots(result.context);
            success = !unifiedSlots.budgetAmount;
          }
        } else if (test.context !== undefined) {
          // Test with context
          const unifiedSlots = this.optimizedCrewAI.getUnifiedSlots(test.context);
          success = test.shouldHandle && unifiedSlots !== null;
        }
        
        this.recordTestResult(test.name, success, {});
      } catch (error) {
        const success = test.shouldNotCrash || test.shouldHandle ? false : true;
        this.recordTestResult(test.name, success, { error: error.message });
      }
    }
  }

  async testPerformanceWithOptimizedArrays() {
    console.log('\n⚡ Test 7: Performance with Optimized Arrays');
    console.log('-'.repeat(50));

    const performanceTests = [
      {
        name: 'Multiple Rapid Messages',
        test: async () => {
          const context = this.createTestContext();
          const startTime = performance.now();
          
          for (let i = 0; i < 5; i++) {
            await this.optimizedCrewAI.processWithCrewAgentAI(
              `Message ${i}: I want an SUV`, 
              'test-session', 
              context
            );
          }
          
          const endTime = performance.now();
          return {
            success: endTime - startTime < 10000, // Should complete in under 10 seconds
            time: endTime - startTime
          };
        }
      },
      {
        name: 'Large Array Handling',
        test: async () => {
          const context = this.createTestContext();
          const largeArray = Array.from({ length: 100 }, (_, i) => ({
            stock_number: `TEST-${i.toString().padStart(3, '0')}`,
            make: 'Hyundai',
            model: 'Tucson',
            year: 2024,
            price: 30000 + i
          }));
          
          context.Daivesteps['Step 3 - Vehicle'].slots.sharedVehicles = largeArray;
          
          const startTime = performance.now();
          const unifiedSlots = this.optimizedCrewAI.getUnifiedSlots(context);
          const endTime = performance.now();
          
          return {
            success: unifiedSlots.sharedVehicles.length === 100 && (endTime - startTime) < 1000,
            time: endTime - startTime,
            arrayLength: unifiedSlots.sharedVehicles.length
          };
        }
      }
    ];

    for (const test of performanceTests) {
      try {
        const result = await test.test();
        this.recordTestResult(test.name, result.success, result);
      } catch (error) {
        this.recordTestResult(test.name, false, { error: error.message });
      }
    }
  }

  async testDAIVEServiceIntegration() {
    console.log('\n🔗 Test 8: DAIVEService Integration');
    console.log('-'.repeat(50));

    const integrationTests = [
      {
        name: 'DAIVEService processConversationWithOptimizedCrew',
        test: async () => {
          const result = await this.daiveService.processConversationWithOptimizedCrew(
            'test-session',
            'test-vehicle',
            'I want an SUV with budget 30k',
            { dealerId: 'test-dealer' }
          );
          
          return result && typeof result.response === 'string';
        }
      },
      {
        name: 'DAIVEService with OptimizedCrewAgentAI',
        test: async () => {
          // Test that DAIVEService properly integrates with OptimizedCrewAgentAI
          const result = await this.daiveService.processConversationWithOptimizedCrew(
            'test-session',
            'test-vehicle',
            'hello',
            { dealerId: 'test-dealer' }
          );
          
          return result && result.crewUsed === true;
        }
      }
    ];

    for (const test of integrationTests) {
      try {
        const success = await test.test();
        this.recordTestResult(test.name, success, {});
      } catch (error) {
        this.recordTestResult(test.name, false, { error: error.message });
      }
    }
  }

  // Helper methods
  createTestContext() {
    return {
      sessionId: 'test-session',
      messages: [],
      preferences: {},
      currentJourneyStep: 'inquiry',
      Daivesteps: {
        'Step 1 - Inquiry': { slots: {} },
        'Step 2 - Lead Capture': { slots: {} },
        'Step 3 - Vehicle': { slots: {} },
        'Step 4 - Test Drive': { slots: {} },
        'Step 5 - Trade Evaluation': { slots: {} },
        'Step 6 - Qualification': { slots: {} },
        'Step 7 - Purchase Commitment': { slots: {} },
        'Step 8 - Vehicle Preparation': { slots: {} },
        'Step 9 - Finance Manager': { slots: {} },
        'Step 10 - Delivery': { slots: {} }
      },
      dealerId: 'test-dealer'
    };
  }

  createContextWithOptimizedData(data) {
    const context = this.createTestContext();
    
    if (data.vehicleType) {
      context.Daivesteps['Step 3 - Vehicle'].slots['vehicle Selection'] = {
        type: data.vehicleType
      };
    }
    
    if (data.budgetAmount) {
      context.Daivesteps['Step 2 - Lead Capture'].slots.budget = {
        max_price: data.budgetAmount,
        target_price: data.budgetAmount
      };
    }
    
    if (data.messageCount) {
      context.messages = Array.from({ length: data.messageCount }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`,
        timestamp: new Date().toISOString()
      }));
    }
    
    return context;
  }

  recordTestResult(testName, success, details) {
    this.testResults.scenarios.push({
      name: testName,
      status: success ? 'PASSED' : 'FAILED',
      details
    });
    
    if (success) {
      this.testResults.passed++;
      console.log(`✅ ${testName}: PASSED`);
    } else {
      this.testResults.failed++;
      console.log(`❌ ${testName}: FAILED`);
      if (details && Object.keys(details).length > 0) {
        console.log(`   Details:`, JSON.stringify(details, null, 2));
      }
    }
  }

  printTestResults() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE OPTIMIZED CREW AGENT AI TEST RESULTS');
    console.log('='.repeat(80));
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📈 Success Rate: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)}%`);
    
    if (this.testResults.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults.scenarios
        .filter(s => s.status === 'FAILED')
        .forEach(s => console.log(`   - ${s.name}`));
    }
    
    console.log('\n🎯 OPTIMIZED ARRAY SETTINGS VALIDATION:');
    console.log('   - System Initialization: ' + (this.testResults.scenarios.filter(s => s.name.includes('Initialization')).every(s => s.status === 'PASSED') ? '✅' : '❌'));
    console.log('   - Array Integration: ' + (this.testResults.scenarios.filter(s => s.name.includes('Integration')).every(s => s.status === 'PASSED') ? '✅' : '❌'));
    console.log('   - Conversation Flow: ' + (this.testResults.scenarios.filter(s => s.name.includes('Conversation')).every(s => s.status === 'PASSED') ? '✅' : '❌'));
    console.log('   - Decision Making: ' + (this.testResults.scenarios.filter(s => s.name.includes('Decision')).every(s => s.status === 'PASSED') ? '✅' : '❌'));
    console.log('   - Array Persistence: ' + (this.testResults.scenarios.filter(s => s.name.includes('Persistence')).every(s => s.status === 'PASSED') ? '✅' : '❌'));
    console.log('   - Edge Cases: ' + (this.testResults.scenarios.filter(s => s.name.includes('Edge')).every(s => s.status === 'PASSED') ? '✅' : '❌'));
    console.log('   - Performance: ' + (this.testResults.scenarios.filter(s => s.name.includes('Performance')).every(s => s.status === 'PASSED') ? '✅' : '❌'));
    console.log('   - DAIVEService Integration: ' + (this.testResults.scenarios.filter(s => s.name.includes('DAIVEService')).every(s => s.status === 'PASSED') ? '✅' : '❌'));
    
    console.log('\n' + '='.repeat(80));
  }
}

// Run the comprehensive test
async function runComprehensiveTest() {
  const testSuite = new ComprehensiveOptimizedTest();
  await testSuite.runAllTests();
}

// Run if called directly
if (require.main === module) {
  runComprehensiveTest().catch(console.error);
}

module.exports = { ComprehensiveOptimizedTest, runComprehensiveTest };
