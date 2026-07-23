// Complete Customer Journey Test - From Initial Inquiry to Purchase Readiness
import { OptimizedCrewAgentAI } from './src/lib/daivecrewai.js';

// Mock inventory data with various vehicle types and prices
const mockInventoryData = [
  // 7-seater SUVs under $40,000
  {
    make: 'Kia',
    model: 'Telluride',
    price: 38500,
    type: 'SUV',
    inStock: true,
    stockNumber: 'KT001',
    year: 2023,
    seats: 7,
    colors: ['Black', 'White', 'Silver']
  },
  {
    make: 'Hyundai',
    model: 'Palisade',
    price: 39500,
    type: 'SUV',
    inStock: true,
    stockNumber: 'HP002',
    year: 2023,
    seats: 7,
    colors: ['Black', 'White', 'Blue']
  },
  // 5-seater SUVs for comparison
  {
    make: 'Honda',
    model: 'CR-V',
    price: 32000,
    type: 'SUV',
    inStock: true,
    stockNumber: 'HC003',
    year: 2023,
    seats: 5,
    colors: ['Black', 'White', 'Red']
  },
  {
    make: 'Toyota',
    model: 'RAV4',
    price: 33500,
    type: 'SUV',
    inStock: true,
    stockNumber: 'TR004',
    year: 2023,
    seats: 5,
    colors: ['Black', 'White', 'Silver']
  },
  // Additional vehicles
  {
    make: 'Kia',
    model: 'Sorento',
    price: 13125,
    type: 'SUV',
    inStock: true,
    stockNumber: 'KS005',
    year: 2020,
    seats: 7,
    colors: ['Black', 'White']
  }
];

// Mock inventory service with enhanced methods
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
  },
  getVehiclesBySeats: async (seats, budget, dealerId, limit) => {
    console.log(`🔍 Mock inventory service called: seats=${seats}, budget=${budget}, limit=${limit}`);
    return mockInventoryData.filter(v => v.seats >= seats && v.price <= budget).slice(0, limit);
  },
  getVehiclesByColor: async (color, budget, dealerId, limit) => {
    console.log(`🔍 Mock inventory service called: color=${color}, budget=${budget}, limit=${limit}`);
    return mockInventoryData.filter(v => 
      v.colors.some(c => c.toLowerCase().includes(color.toLowerCase())) && 
      v.price <= budget
    ).slice(0, limit);
  }
};

async function testCompleteCustomerJourney() {
  console.log('🚀 Complete Customer Journey Test');
  console.log('=' .repeat(60));
  
  try {
    // Initialize the CrewAI system
    const crewAI = new OptimizedCrewAgentAI('test-api-key', 'test-dealer-id');
    
    // Mock the inventory service
    crewAI.inventoryService = mockInventoryService;
    
    let conversationContext = { messages: [], preferences: {} };
    
    // Test 1: Initial inquiry about family car
    console.log('\n📝 Test 1: Initial Family Car Inquiry');
    console.log('Customer: "I need a new car for my family."');
    
    const response1 = await crewAI.processWithCrewAgentAI(
      "I need a new car for my family.",
      'test-session-complete',
      conversationContext
    );
    
    console.log('\n🤖 AI Response 1:');
    console.log(response1.response);
    console.log('- Intent:', response1.intent);
    console.log('- Uses Inventory Data:', response1.response.toLowerCase().includes('vehicle') || response1.response.toLowerCase().includes('car') ? '✅ YES' : '❌ NO');
    
    // Update conversation context
    conversationContext = response1.context || conversationContext;
    
    // Test 2: 7-seater SUV inquiry
    console.log('\n📝 Test 2: 7-Seater SUV Inquiry');
    console.log('Customer: "Do you have 7-seater SUVs?"');
    
    const response2 = await crewAI.processWithCrewAgentAI(
      "Do you have 7-seater SUVs?",
      'test-session-complete',
      conversationContext
    );
    
    console.log('\n🤖 AI Response 2:');
    console.log(response2.response);
    console.log('- Intent:', response2.intent);
    console.log('- Mentions 7-seaters:', response2.response.toLowerCase().includes('7') || response2.response.toLowerCase().includes('seven') ? '✅ YES' : '❌ NO');
    console.log('- Uses Inventory Data:', mockInventoryData.some(v => 
      response2.response.toLowerCase().includes(v.make.toLowerCase()) && 
      response2.response.toLowerCase().includes(v.model.toLowerCase())
    ) ? '✅ YES' : '❌ NO');
    
    conversationContext = response2.context || conversationContext;
    
    // Test 3: Budget constraint
    console.log('\n📝 Test 3: Budget Constraint');
    console.log('Customer: "I don\'t want to spend more than $40,000."');
    
    const response3 = await crewAI.processWithCrewAgentAI(
      "I don't want to spend more than $40,000.",
      'test-session-complete',
      conversationContext
    );
    
    console.log('\n🤖 AI Response 3:');
    console.log(response3.response);
    console.log('- Intent:', response3.intent);
    console.log('- Mentions Budget:', response2.response.toLowerCase().includes('40000') || response2.response.toLowerCase().includes('40') ? '✅ YES' : '❌ NO');
    
    conversationContext = response3.context || conversationContext;
    
    // Test 4: Color preference
    console.log('\n📝 Test 4: Color Preference');
    console.log('Customer: "Do you have it in black or white?"');
    
    const response4 = await crewAI.processWithCrewAgentAI(
      "Do you have it in black or white?",
      'test-session-complete',
      conversationContext
    );
    
    console.log('\n🤖 AI Response 4:');
    console.log(response4.response);
    console.log('- Intent:', response4.intent);
    console.log('- Mentions Colors:', (response4.response.toLowerCase().includes('black') || response4.response.toLowerCase().includes('white')) ? '✅ YES' : '❌ NO');
    
    conversationContext = response4.context || conversationContext;
    
    // Test 5: Vehicle comparison
    console.log('\n📝 Test 5: Vehicle Comparison');
    console.log('Customer: "Which is better: Honda CR-V or Toyota RAV4?"');
    
    const response5 = await crewAI.processWithCrewAgentAI(
      "Which is better: Honda CR-V or Toyota RAV4?",
      'test-session-complete',
      conversationContext
    );
    
    console.log('\n🤖 AI Response 5:');
    console.log(response5.response);
    console.log('- Intent:', response5.intent);
    console.log('- Mentions Both Vehicles:', (response5.response.toLowerCase().includes('honda') && response5.response.toLowerCase().includes('toyota')) ? '✅ YES' : '❌ NO');
    
    conversationContext = response5.context || conversationContext;
    
    // Test 6: Test drive request
    console.log('\n📝 Test 6: Test Drive Request');
    console.log('Customer: "Can I test drive the RAV4 this week?"');
    
    const response6 = await crewAI.processWithCrewAgentAI(
      "Can I test drive the RAV4 this week?",
      'test-session-complete',
      conversationContext
    );
    
    console.log('\n🤖 AI Response 6:');
    console.log(response6.response);
    console.log('- Intent:', response6.intent);
    console.log('- Mentions Test Drive:', response6.response.toLowerCase().includes('test drive') || response6.response.toLowerCase().includes('test') ? '✅ YES' : '❌ NO');
    
    conversationContext = response6.context || conversationContext;
    
    // Test 7: Trade-in inquiry
    console.log('\n📝 Test 7: Trade-in Inquiry');
    console.log('Customer: "Do you have trade-in deals available?"');
    
    const response7 = await crewAI.processWithCrewAgentAI(
      "Do you have trade-in deals available?",
      'test-session-complete',
      conversationContext
    );
    
    console.log('\n🤖 AI Response 7:');
    console.log(response7.response);
    console.log('- Intent:', response7.intent);
    console.log('- Mentions Trade-in:', response7.response.toLowerCase().includes('trade') || response7.response.toLowerCase().includes('trade-in') ? '✅ YES' : '❌ NO');
    
    conversationContext = response7.context || conversationContext;
    
    // Test 8: Financing inquiry
    console.log('\n📝 Test 8: Financing Inquiry');
    console.log('Customer: "How much is the down payment if I finance it?"');
    
    const response8 = await crewAI.processWithCrewAgentAI(
      "How much is the down payment if I finance it?",
      'test-session-complete',
      conversationContext
    );
    
    console.log('\n🤖 AI Response 8:');
    console.log(response8.response);
    console.log('- Intent:', response8.intent);
    console.log('- Mentions Financing:', response8.response.toLowerCase().includes('finance') || response8.response.toLowerCase().includes('down payment') ? '✅ YES' : '❌ NO');
    
    conversationContext = response8.context || conversationContext;
    
    // Test 9: Service packages
    console.log('\n📝 Test 9: Service Packages');
    console.log('Customer: "What service packages are included?"');
    
    const response9 = await crewAI.processWithCrewAgentAI(
      "What service packages are included?",
      'test-session-complete',
      conversationContext
    );
    
    console.log('\n🤖 AI Response 9:');
    console.log(response9.response);
    console.log('- Intent:', response9.intent);
    console.log('- Mentions Service:', response9.response.toLowerCase().includes('service') || response9.response.toLowerCase().includes('package') ? '✅ YES' : '❌ NO');
    
    conversationContext = response9.context || conversationContext;
    
    // Test 10: Purchase readiness
    console.log('\n📝 Test 10: Purchase Readiness');
    console.log('Customer: "I\'m ready to buy, what\'s the next step?"');
    
    const response10 = await crewAI.processWithCrewAgentAI(
      "I'm ready to buy, what's the next step?",
      'test-session-complete',
      conversationContext
    );
    
    console.log('\n🤖 AI Response 10:');
    console.log(response10.response);
    console.log('- Intent:', response10.intent);
    console.log('- Mentions Next Steps:', response10.response.toLowerCase().includes('next') || response10.response.toLowerCase().includes('step') ? '✅ YES' : '❌ NO');
    
    // Final Summary
    console.log('\n🎯 Complete Journey Test Summary');
    console.log('=' .repeat(60));
    console.log('✅ All 10 conversation steps completed successfully');
    console.log('🔍 System handled various intents: family inquiry, vehicle specs, budget, colors, comparison, test drive, trade-in, financing, service, and purchase');
    console.log('📊 Check responses above to verify quality and inventory usage');
    console.log('🚗 System should maintain context throughout the conversation');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testCompleteCustomerJourney().catch(console.error);
