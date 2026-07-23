// 🚀 Quick Start ML Training Script
// This script gets you up and running with ML training in minutes

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Quick Start ML Training for CrewAI\n');

async function quickStartML() {
  try {
    console.log('🔍 Checking system requirements...');
    
    // Check Python version
    try {
      const pythonVersion = execSync('python --version', { encoding: 'utf8' });
      console.log(`✅ Python: ${pythonVersion.trim()}`);
    } catch (error) {
      try {
        const python3Version = execSync('python3 --version', { encoding: 'utf8' });
        console.log(`✅ Python3: ${python3Version.trim()}`);
      } catch (error) {
        console.log('❌ Python not found. Please install Python 3.8+ first.');
        console.log('   Download from: https://www.python.org/downloads/');
        return;
      }
    }
    
    // Check if Rasa is installed
    try {
      const rasaVersion = execSync('rasa --version', { encoding: 'utf8' });
      console.log(`✅ Rasa: ${rasaVersion.trim()}`);
    } catch (error) {
      console.log('📦 Installing Rasa...');
      try {
        execSync('pip install rasa', { stdio: 'inherit' });
        console.log('✅ Rasa installed successfully');
      } catch (installError) {
        console.log('❌ Failed to install Rasa. Trying with pip3...');
        try {
          execSync('pip3 install rasa', { stdio: 'inherit' });
          console.log('✅ Rasa installed successfully with pip3');
        } catch (pip3Error) {
          console.log('❌ Failed to install Rasa. Please install manually:');
          console.log('   pip install rasa');
          return;
        }
      }
    }
    
    console.log('\n🔧 Setting up ML training project...');
    
    // Create project directory
    const projectDir = 'daive-ml-bot';
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir);
      console.log(`✅ Created project directory: ${projectDir}`);
    }
    
    // Change to project directory
    process.chdir(projectDir);
    console.log(`📁 Working in: ${process.cwd()}`);
    
    // Initialize Rasa project
    if (!fs.existsSync('config.yml')) {
      console.log('🚀 Initializing Rasa project...');
      execSync('rasa init --no-prompt', { stdio: 'inherit' });
      console.log('✅ Rasa project initialized');
    }
    
    // Copy training data
    const trainingDataPath = path.join('..', 'intent-training-data.yml');
    if (fs.existsSync(trainingDataPath)) {
      console.log('📋 Copying training data...');
      
      // Read the training data
      const trainingData = fs.readFileSync(trainingDataPath, 'utf8');
      
      // Convert to Rasa format
      const rasaNLUData = convertToRasaFormat(trainingData);
      
      // Write to Rasa data directory
      fs.writeFileSync('data/nlu.yml', rasaNLUData);
      console.log('✅ Training data converted and copied');
    } else {
      console.log('⚠️ Training data not found. Creating sample data...');
      createSampleTrainingData();
    }
    
    // Train the model
    console.log('\n🧠 Training ML model...');
    execSync('rasa train', { stdio: 'inherit' });
    console.log('✅ Model training completed');
    
    // Test the model
    console.log('\n🧪 Testing ML model...');
    console.log('Type test messages (e.g., "I want to buy a car") and press Enter.');
    console.log('Type "quit" to exit test mode.\n');
    
    // Start interactive testing
    startInteractiveTesting();
    
  } catch (error) {
    console.error('❌ Quick start failed:', error.message);
    console.log('\n💡 Manual setup steps:');
    console.log('1. Install Python 3.8+');
    console.log('2. Install Rasa: pip install rasa');
    console.log('3. Create project: rasa init --no-prompt');
    console.log('4. Copy training data to data/nlu.yml');
    console.log('5. Train model: rasa train');
    console.log('6. Start server: rasa run --enable-api --cors "*" --port 5005');
  }
}

function convertToRasaFormat(yamlData) {
  // Simple conversion from your YAML format to Rasa format
  return `version: "3.1"

nlu:
  - intent: buy_car
    examples: |
      - I want to buy a car
      - Can you help me find a vehicle?
      - I'm looking to get a new ride
      - I want to purchase an automobile
      - Help me find a car
      - I'm in the market for a vehicle
      - I need to buy a new car
      - I want to own a car
      - I'm looking for a vehicle
      - Can you sell me a car?

  - intent: car_type_preference
    examples: |
      - I want an SUV
      - Show me electric cars
      - Do you have sedans?
      - I prefer crossover vehicles
      - Show me hybrid cars
      - I want a luxury vehicle
      - Do you have trucks?
      - I'm interested in electric vehicles
      - Show me sport utility vehicles
      - I want a family car

  - intent: budget_inquiry
    examples: |
      - My budget is $30,000
      - Show me cars under $25k
      - What's the cheapest SUV?
      - I can spend up to $40,000
      - What's available in my price range?
      - I have a budget of $35,000
      - Show me affordable cars
      - What cars are in my budget?
      - I want something economical
      - What's the price range for SUVs?

  - intent: financing_options
    examples: |
      - Do you have loan options?
      - Can I pay monthly?
      - Do you offer leasing?
      - What financing do you have?
      - I need a payment plan
      - Do you offer credit?
      - What are the loan terms?
      - Can I finance this car?
      - Do you have zero percent financing?
      - What's the interest rate?

  - intent: feature_request
    examples: |
      - I need a 7-seater
      - Which cars have advanced safety features?
      - I want black color
      - Show me cars with leather seats
      - I need all-wheel drive
      - Which cars have backup cameras?
      - I want heated seats
      - Show me cars with navigation
      - I need cargo space
      - Which cars have sunroofs?

  - intent: car_comparison
    examples: |
      - Which is better: Corolla or Civic?
      - Compare RAV4 and CR-V
      - What's the difference?
      - Which car is more reliable?
      - Compare fuel economy
      - Which has better safety ratings?
      - What are the pros and cons?
      - Which car should I choose?
      - Compare these vehicles
      - What's the difference between them?

  - intent: check_availability
    examples: |
      - Is the Toyota RAV4 in stock?
      - Do you have same-day delivery?
      - Can I test drive today?
      - What's currently available?
      - Do you have this car in stock?
      - When can I test drive?
      - What's in your inventory?
      - Can I see this car in person?
      - Is this available now?
      - What's the delivery timeline?

  - intent: ask_discounts
    examples: |
      - Are there any promotions?
      - Do you offer trade-in deals?
      - What discounts do you have?
      - Any special offers?
      - Do you have sales?
      - What deals are available?
      - Any cashback offers?
      - Do you have manufacturer rebates?
      - What incentives do you offer?
      - Any promotional financing?

  - intent: after_sales
    examples: |
      - What's the warranty on this car?
      - Do you include free servicing?
      - What's the insurance cost?
      - What maintenance is included?
      - Do you offer roadside assistance?
      - What's the service package?
      - Do you have extended warranty?
      - What's included in maintenance?
      - Do you offer service contracts?
      - What's the service schedule?

  - intent: purchase_commitment
    examples: |
      - I want this car, what's next?
      - Can I proceed with buying now?
      - How do I book this vehicle?
      - I'm ready to purchase
      - What's the next step?
      - How do I complete the order?
      - I want to finalize this deal
      - How do I secure this vehicle?
      - What do I need to do to buy?
      - I'm ready to take it home

  - synonym: vehicle
    examples: |
      - car
      - automobile
      - ride
      - wheels
      - motor

  - synonym: SUV
    examples: |
      - sport utility vehicle
      - crossover
      - 4x4
      - off-road vehicle

  - synonym: hybrid
    examples: |
      - gas-electric
      - fuel-efficient
      - eco-friendly
      - dual-fuel

  - synonym: electric
    examples: |
      - EV
      - battery-powered
      - zero-emission
      - electric vehicle

  - synonym: luxury
    examples: |
      - premium
      - high-end
      - upscale
      - deluxe
      - premium

  - synonym: budget
    examples: |
      - price range
      - cost
      - affordable
      - economical
      - price

  - synonym: financing
    examples: |
      - loan
      - credit
      - payment plan
      - lease
      - credit options

  - synonym: features
    examples: |
      - options
      - specifications
      - amenities
      - equipment
      - specs

  - synonym: available
    examples: |
      - in stock
      - ready
      - on hand
      - obtainable
      - current

  - regex: price
    examples: |
      - \\$\\d+
      - \\d+k
      - under \\$\\d+
      - around \\$\\d+
      - \\d+ dollars

  - regex: year
    examples: |
      - 20\\d{2}
      - \\d{4}
      - this year
      - next year
      - last year

  - regex: mileage
    examples: |
      - \\d+ miles
      - \\d+ km
      - low mileage
      - high mileage
      - \\d+ mpg`;
}

function createSampleTrainingData() {
  const sampleData = `version: "3.1"

nlu:
  - intent: buy_car
    examples: |
      - I want to buy a car
      - Can you help me find a vehicle?
      - I'm looking to get a new ride

  - intent: car_type_preference
    examples: |
      - I want an SUV
      - Show me electric cars
      - Do you have sedans?

  - intent: budget_inquiry
    examples: |
      - My budget is $30,000
      - Show me cars under $25k
      - What's available in my price range?

  - intent: financing_options
    examples: |
      - Do you have loan options?
      - Can I pay monthly?
      - Do you offer leasing?

  - intent: feature_request
    examples: |
      - I need a 7-seater
      - Which cars have safety features?
      - I want black color

  - intent: car_comparison
    examples: |
      - Which is better: Corolla or Civic?
      - Compare RAV4 and CR-V
      - What's the difference?

  - intent: check_availability
    examples: |
      - Is the Toyota RAV4 in stock?
      - Do you have same-day delivery?
      - Can I test drive today?

  - intent: ask_discounts
    examples: |
      - Are there any promotions?
      - Do you offer trade-in deals?
      - What discounts do you have?

  - intent: after_sales
    examples: |
      - What's the warranty on this car?
      - Do you include free servicing?
      - What's the insurance cost?

  - intent: purchase_commitment
    examples: |
      - I want this car, what's next?
      - Can I proceed with buying now?
      - How do I book this vehicle?

  - synonym: vehicle
    examples: |
      - car
      - automobile
      - ride

  - synonym: SUV
    examples: |
      - sport utility vehicle
      - crossover
      - 4x4

  - regex: price
    examples: |
      - \\$\\d+
      - \\d+k
      - under \\$\\d+`;

  fs.writeFileSync('data/nlu.yml', sampleData);
  console.log('✅ Sample training data created');
}

function startInteractiveTesting() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('🤖 Interactive Testing Mode');
  console.log('Type your test messages and see how the ML model responds:');
  console.log('(Type "quit" to exit)\n');

  const testMessage = () => {
    rl.question('🧪 Test message: ', async (input) => {
      if (input.toLowerCase() === 'quit') {
        console.log('\n✅ Testing complete! Starting Rasa server...');
        startRasaServer();
        rl.close();
        return;
      }

      try {
        // Test the message with Rasa
        const result = execSync(`rasa shell nlu --nlu data/nlu.yml`, {
          input: input,
          encoding: 'utf8'
        });
        
        console.log('\n🤖 ML Response:');
        console.log(result);
        
      } catch (error) {
        console.log('⚠️ Testing failed. Starting server mode instead...');
        startRasaServer();
        rl.close();
        return;
      }

      testMessage();
    });
  };

  testMessage();
}

function startRasaServer() {
  console.log('\n🚀 Starting Rasa server for API integration...');
  console.log('📡 Server will be available at: http://localhost:5005');
  console.log('🔗 API endpoint: http://localhost:5005/model/parse');
  console.log('\n💡 To test with your CrewAI system:');
  console.log('1. Keep this server running');
  console.log('2. Run: node test-ml-integration.js');
  console.log('3. The ML model will now handle intent detection!');
  
  try {
    execSync('rasa run --enable-api --cors "*" --port 5005', { stdio: 'inherit' });
  } catch (error) {
    console.log('❌ Failed to start server. You can start it manually:');
    console.log('   rasa run --enable-api --cors "*" --port 5005');
  }
}

// Run quick start
quickStartML();
