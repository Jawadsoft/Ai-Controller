// Test customer journey with ES module syntax
import { OptimizedCrewAgentAI } from './src/lib/daivecrewai.js';

// Mock inventory data similar to what was shown in the logs
const mockInventoryData = [
  {
    make: 'Kia',
    model: 'Sorento',
    price: 13125,
    type: 'SUV',
    inStock: true,
    stockNumber: 'KS001',
    year: 2020
  },
  {
    make: 'Subaru',
    model: 'Forester',
    price: 15650,
    type: 'SUV',
    inStock: true,
    stockNumber: 'SF002',
    year: 2021
  },
  {
    make: 'Hyundai',
    model: 'Tucson',
    price: 16796,
    type: 'SUV',
    inStock: true,
    stockNumber: 'HT003',
    year: 2021
  }
];

// Mock inventory service
const mockInventoryService = {
  initialize: async () => Promise.resolve(),
  getStatus: () => ({ initialized: true }),
  getVehiclesByTypeAndBudget: async (type, budget, dealerId, limit) => {
    console.log(`🔍 Mock inventory service called: type=${type}, budget=${budget}, limit=${limit}`);
    return mockInventoryData.filter(v => v.type === type && v.price <= budget).slice(0, limit);
  },
  getVehiclesByMakeModel: async (make, model, budget, dealerId, limit) => {
    console.log(`🔍 Mock inventory service called: make=${make}, model=${model}, budget=${budget}, limit=${limit}`);
    return mockInventoryData.filter(v => 
      v.make.toLowerCase() === make.toLowerCase() && 
      (model ? v.model.toLowerCase().includes(model.toLowerCase()) : true) && 
      v.price <= budget
    ).slice(0, limit);
  }
};

async function testCustomerJourney() {
  console.log('🚀 Starting Customer Journey Test');
  console.log('=' .repeat(50));
  
  try {
    // Initialize the CrewAI system
    const crewAI = new OptimizedCrewAgentAI('test-api-key', 'test-dealer-id');
    
    // Mock the inventory service
    crewAI.inventoryService = mockInventoryService;
    
    // Test 1: Customer asks about SUVs
    console.log('\n📝 Test 1: Customer asks about SUVs');
    console.log('Customer: "I\'m looking for an SUV. What do you have available?"');
    
    const response1 = await crewAI.processWithCrewAgentAI(
      "I'm looking for an SUV. What do you have available?",
      'test-session-1',
      { messages: [], preferences: {} }
    );
    
    console.log('\n🤖 AI Response:');
    console.log(response1.response);
    console.log('\n📊 Response Details:');
    console.log('- Success:', response1.success);
    console.log('- Agent:', response1.agent);
    console.log('- Intent:', response1.intent);
    console.log('- Validation Score:', response1.validation?.overall_score);
    console.log('- Regenerated:', response1.response?.includes('regenerated') || false);
    
    // Check if inventory data was used
    const hasInventoryMention = mockInventoryData.some(vehicle => 
      response1.response.toLowerCase().includes(vehicle.make.toLowerCase()) &&
      response1.response.toLowerCase().includes(vehicle.model.toLowerCase())
    );
    
    console.log('- Uses Inventory Data:', hasInventoryMention ? '✅ YES' : '❌ NO');
    
    // Test 2: Customer asks about budget
    console.log('\n📝 Test 2: Customer asks about budget');
    console.log('Customer: "What SUVs do you have under $20,000?"');
    
    const response2 = await crewAI.processWithCrewAgentAI(
      "What SUVs do you have under $20,000?",
      'test-session-2',
      { 
        messages: [], 
        preferences: { budgetRange: '$20000' },
        inventoryData: mockInventoryData // Pre-populate with inventory
      }
    );
    
    console.log('\n🤖 AI Response:');
    console.log(response2.response);
    console.log('\n📊 Response Details:');
    console.log('- Success:', response2.success);
    console.log('- Agent:', response2.agent);
    console.log('- Intent:', response2.intent);
    console.log('- Validation Score:', response2.validation?.overall_score);
    console.log('- Uses Inventory Data:', mockInventoryData.some(vehicle => 
      response2.response.toLowerCase().includes(vehicle.make.toLowerCase()) &&
      response2.response.toLowerCase().includes(vehicle.model.toLowerCase())
    ) ? '✅ YES' : '❌ NO');
    
    // Test 3: Customer asks about specific make
    console.log('\n📝 Test 3: Customer asks about specific make');
    console.log('Customer: "Do you have any Kia vehicles?"');
    
    const response3 = await crewAI.processWithCrewAgentAI(
      "Do you have any Kia vehicles?",
      'test-session-3',
      { messages: [], preferences: {} }
    );
    
    console.log('\n🤖 AI Response:');
    console.log(response3.response);
    console.log('\n📊 Response Details:');
    console.log('- Success:', response3.success);
    console.log('- Agent:', response3.agent);
    console.log('- Intent:', response3.intent);
    console.log('- Validation Score:', response3.validation?.overall_score);
    console.log('- Uses Inventory Data:', mockInventoryData.some(vehicle => 
      response3.response.toLowerCase().includes(vehicle.make.toLowerCase()) &&
      response3.response.toLowerCase().includes(vehicle.model.toLowerCase())
    ) ? '✅ YES' : '❌ NO');
    
    // Test 4: Speed fallback test (simulate timeout)
    console.log('\n📝 Test 4: Speed Fallback Test');
    console.log('Customer: "Show me your SUV inventory"');
    
    // Mock a timeout scenario by temporarily breaking the LLM
    const originalLLM = crewAI.llm;
    crewAI.llm = {
      invoke: async () => {
        throw new Error('Response timeout');
      }
    };
    
    const response4 = await crewAI.processWithCrewAgentAI(
      "Show me your SUV inventory",
      'test-session-4',
      { messages: [], preferences: {} }
    );
    
    // Restore original LLM
    crewAI.llm = originalLLM;
    
    console.log('\n🤖 AI Response (Speed Fallback):');
    console.log(response4.response);
    console.log('\n📊 Response Details:');
    console.log('- Success:', response4.success);
    console.log('- Agent:', response4.agent);
    console.log('- Intent:', response4.intent);
    console.log('- Uses Inventory Data:', mockInventoryData.some(vehicle => 
      response4.response.toLowerCase().includes(vehicle.make.toLowerCase()) &&
      response4.response.toLowerCase().includes(vehicle.model.toLowerCase())
    ) ? '✅ YES' : '❌ NO');
    
    console.log('\n🎯 Test Summary:');
    console.log('=' .repeat(50));
    console.log('✅ All tests completed successfully');
    console.log('🔍 Check the responses above to verify inventory data usage');
    console.log('📊 Validation scores should be above 7 for good responses');
    console.log('🚗 Responses should mention specific vehicles from inventory');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testCustomerJourney().catch(console.error);

export { testCustomerJourney, mockInventoryData };
