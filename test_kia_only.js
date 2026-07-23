// Focused test for Kia vehicle inquiry
import { OptimizedCrewAgentAI } from './src/lib/daivecrewai.js';

// Mock inventory data with Kia vehicles
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

async function testKiaInquiry() {
  console.log('🚀 Testing Kia Vehicle Inquiry Fix');
  console.log('=' .repeat(50));
  
  try {
    // Initialize the CrewAI system
    const crewAI = new OptimizedCrewAgentAI('test-api-key', 'test-dealer-id');
    
    // Mock the inventory service
    crewAI.inventoryService = mockInventoryService;
    
    // Test: Customer asks about Kia vehicles
    console.log('\n📝 Test: Customer asks about Kia vehicles');
    console.log('Customer: "Do you have any Kia vehicles?"');
    
    const response = await crewAI.processWithCrewAgentAI(
      "Do you have any Kia vehicles?",
      'test-session-kia',
      { messages: [], preferences: {} }
    );
    
    console.log('\n🤖 AI Response:');
    console.log(response.response);
    console.log('\n📊 Response Details:');
    console.log('- Success:', response.success);
    console.log('- Agent:', response.agent);
    console.log('- Intent:', response.intent);
    console.log('- Validation Score:', response.validation?.overall_score);
    
    // Check if inventory data was used
    const hasInventoryMention = mockInventoryData.some(vehicle => 
      response.response.toLowerCase().includes(vehicle.make.toLowerCase()) &&
      response.response.toLowerCase().includes(vehicle.model.toLowerCase())
    );
    
    console.log('- Uses Inventory Data:', hasInventoryMention ? '✅ YES' : '❌ NO');
    
    // Check if Kia vehicles are mentioned
    const hasKiaMention = response.response.toLowerCase().includes('kia');
    console.log('- Mentions Kia Vehicles:', hasKiaMention ? '✅ YES' : '❌ NO');
    
    // Check if specific Kia model is mentioned
    const hasKiaSorento = response.response.toLowerCase().includes('sorento');
    console.log('- Mentions Kia Sorento:', hasKiaSorento ? '✅ YES' : '❌ NO');
    
    console.log('\n🎯 Test Summary:');
    console.log('=' .repeat(50));
    if (hasInventoryMention && hasKiaMention && hasKiaSorento) {
      console.log('✅ SUCCESS: Kia vehicle inquiry is working correctly!');
      console.log('✅ System properly fetches and uses inventory data for make-specific queries');
    } else {
      console.log('❌ ISSUE: Kia vehicle inquiry still has problems');
      console.log('🔍 Check the response above to see what went wrong');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testKiaInquiry().catch(console.error);
