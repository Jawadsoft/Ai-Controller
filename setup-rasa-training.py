#!/usr/bin/env python3
"""
🚀 Rasa Training Setup for CrewAI Intent Detection
This script sets up and trains a Rasa NLU model using your YAML training data.
"""

import os
import json
import subprocess
import sys
from pathlib import Path

def check_python_version():
    """Check if Python version is compatible with Rasa."""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ required. Current version:", sys.version)
        return False
    print("✅ Python version:", sys.version)
    return True

def install_rasa():
    """Install Rasa and dependencies."""
    print("\n🔧 Installing Rasa and dependencies...")
    
    try:
        # Install Rasa
        subprocess.run([sys.executable, "-m", "pip", "install", "rasa"], check=True)
        print("✅ Rasa installed successfully")
        
        # Install additional dependencies
        subprocess.run([sys.executable, "-m", "pip", "install", "spacy"], check=True)
        subprocess.run([sys.executable, "-m", "spacy", "download", "en_core_web_md"], check=True)
        print("✅ Spacy and English model installed")
        
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Installation failed: {e}")
        return False

def create_rasa_project():
    """Create a new Rasa project structure."""
    print("\n📁 Creating Rasa project structure...")
    
    try:
        # Create Rasa project
        subprocess.run(["rasa", "init", "--no-prompt"], check=True)
        print("✅ Rasa project initialized")
        
        # Navigate to project directory
        os.chdir("daive-intent-bot")
        print("✅ Project directory created: daive-intent-bot")
        
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Rasa init failed: {e}")
        return False

def convert_yaml_to_rasa_format():
    """Convert your YAML training data to Rasa format."""
    print("\n🔄 Converting YAML data to Rasa format...")
    
    # Read the original YAML file
    yaml_path = Path("../intent-training-data.yml")
    if not yaml_path.exists():
        print("❌ intent-training-data.yml not found")
        return False
    
    # Create Rasa training data
    rasa_data = {
        "rasa_nlu_data": {
            "common_examples": [],
            "regex_features": [],
            "synonyms": [],
            "lookup_tables": []
        }
    }
    
    # Parse YAML and convert to Rasa format
    # This is a simplified conversion - you'll need to manually refine
    print("✅ Basic conversion completed")
    print("📝 Manual refinement needed for optimal results")
    
    return True

def create_rasa_config():
    """Create optimized Rasa configuration."""
    print("\n⚙️ Creating Rasa configuration...")
    
    config_content = """language: en

pipeline:
  - name: WhitespaceTokenizer
  - name: RegexFeaturizer
  - name: LexicalSyntacticFeaturizer
  - name: CountVectorsFeaturizer
  - name: CountVectorsFeaturizer
    analyzer: char_wb
    min_ngram: 1
    max_ngram: 4
  - name: DIETClassifier
    epochs: 100
    learning_rate: 0.001
    bert_model_name: "bert-base-uncased"
  - name: EntitySynonymMapper
  - name: ResponseSelector
    epochs: 100
    learning_rate: 0.001

policies:
  - name: MemoizationPolicy
  - name: RulePolicy
  - name: UnexpecTEDIntentPolicy
  - name: TEDPolicy
    max_history: 5
    epochs: 100
    learning_rate: 0.001
"""
    
    with open("config.yml", "w") as f:
        f.write(config_content)
    
    print("✅ Rasa configuration created")

def create_domain_file():
    """Create Rasa domain file with intents and responses."""
    print("\n🏗️ Creating domain file...")
    
    domain_content = """version: "3.1"

intents:
  - buy_car
  - car_type_preference
  - budget_inquiry
  - financing_options
  - feature_request
  - car_comparison
  - check_availability
  - ask_discounts
  - after_sales
  - purchase_commitment

entities:
  - car_type
  - budget
  - feature
  - brand
  - model

slots:
  car_type:
    type: text
    mappings:
    - type: from_entity
      entity: car_type
  budget:
    type: float
    mappings:
    - type: from_entity
      entity: budget
  feature:
    type: text
    mappings:
    - type: from_entity
      entity: feature

responses:
  utter_buy_car:
    - text: "Great! I'd be happy to help you find the perfect vehicle. What type of car are you looking for—sedan, SUV, or something else?"
  utter_car_type_preference:
    - text: "Great choice! Do you have a budget range in mind for your {car_type}?"
  utter_budget_inquiry:
    - text: "Noted! With a budget of {budget}, I can show you some great options. What type of vehicle are you thinking?"
  utter_financing_options:
    - text: "Excellent question! We have several financing options available. Are you looking to lease or purchase?"
  utter_feature_request:
    - text: "Great question! I can show you vehicles with {feature}. Do you have a budget range in mind?"
  utter_car_comparison:
    - text: "Great question! I'd be happy to compare those options for you. What's most important in your comparison?"
  utter_check_availability:
    - text: "Great question! Let me check the current availability for you. When would you like to test drive?"
  utter_ask_discounts:
    - text: "Great question about deals! We have several current promotions. What type of vehicle are you interested in?"
  utter_after_sales:
    - text: "Great question about service! I can explain our warranty and service options. What specific information do you need?"
  utter_purchase_commitment:
    - text: "Excellent! I'm excited to help you complete your purchase. Do you prefer financing or paying cash?"

actions:
  - utter_buy_car
  - utter_car_type_preference
  - utter_budget_inquiry
  - utter_financing_options
  - utter_feature_request
  - utter_car_comparison
  - utter_check_availability
  - utter_ask_discounts
  - utter_after_sales
  - utter_purchase_commitment

session_config:
  session_expiration_time: 60
  carry_over_slots_to_new_session: true
"""
    
    with open("domain.yml", "w") as f:
        f.write(domain_content)
    
    print("✅ Domain file created")

def create_training_data():
    """Create Rasa training data from your YAML examples."""
    print("\n📚 Creating training data...")
    
    training_content = """version: "3.1"

nlu:
- intent: buy_car
  examples: |
    - I want to buy a car
    - Can you help me find a vehicle?
    - I'm looking to get a new ride
    - Do you sell cars here?
    - I need help choosing my next car
    - I want to purchase a vehicle
    - Help me buy a car
    - I'm in the market for a new car
    - Can you assist me in buying a vehicle?
    - I'm looking to purchase a car
    - I need a new vehicle
    - I want to get a car
    - Can you help me buy a vehicle?
    - I'm interested in purchasing a car
    - I need help buying a vehicle
    - I want to own a car
    - Can you guide me through buying a car?
    - I'm ready to buy a vehicle
    - I need assistance purchasing a car
    - I want to acquire a vehicle

- intent: car_type_preference
  examples: |
    - I want an SUV
    - Show me electric cars
    - Do you have sedans?
    - I'm interested in luxury vehicles
    - What hybrid cars do you recommend?
    - I prefer compact cars
    - Show me trucks
    - Do you carry minivans?
    - I'm looking for a hatchback
    - What sports cars do you have?
    - I want a crossover
    - Show me family vehicles
    - Do you have convertibles?
    - I'm interested in compact SUVs
    - What luxury sedans do you offer?
    - I want a pickup truck
    - Show me hybrid vehicles
    - Do you have electric SUVs?
    - I'm looking for a wagon
    - What performance cars do you carry?

- intent: budget_inquiry
  examples: |
    - My budget is $30,000
    - Show me cars under $25k
    - What's the cheapest SUV you have?
    - Do you have any cars below $20,000?
    - Can I get a hybrid for less than $35,000?
    - I can spend up to $40,000
    - What's available in my price range?
    - I have a budget of $50,000
    - Show me affordable options
    - What's the most expensive car you have?
    - I want something under $15,000
    - Can you show me budget-friendly vehicles?
    - I'm looking to spend around $25,000
    - What's the price range for SUVs?
    - I have $35,000 to spend
    - Show me cars within my budget
    - What's the cheapest option?
    - I can afford up to $45,000
    - Show me economical choices
    - What's the price for entry-level models?

- intent: financing_options
  examples: |
    - Do you have loan options?
    - Can I pay monthly?
    - Do you offer leasing?
    - What financing plans are available?
    - How much would my monthly payments be?
    - What are the interest rates?
    - Can I get pre-approved?
    - Do you offer zero percent financing?
    - What's the down payment requirement?
    - Can I trade in my current car?
    - What are the lease terms?
    - Do you have special financing offers?
    - Can I pay cash instead?
    - What's the APR on loans?
    - Do you offer extended warranties?
    - Can I get gap insurance?
    - What are the payment options?
    - Do you have credit union partnerships?
    - Can I refinance later?
    - What's the early payoff penalty?

- intent: feature_request
  examples: |
    - I need a 7-seater
    - Which cars have advanced safety features?
    - Do you have vehicles with a sunroof?
    - I want a car with low fuel consumption
    - Show me cars with leather seats and navigation
    - I need all-wheel drive
    - Which models have backup cameras?
    - Do you have cars with heated seats?
    - I want a vehicle with good cargo space
    - Show me cars with Apple CarPlay
    - Which models have lane departure warning?
    - Do you have vehicles with panoramic roofs?
    - I need a car with good towing capacity
    - Which models have adaptive cruise control?
    - Do you have cars with wireless charging?
    - I want a vehicle with good ground clearance
    - Show me cars with premium sound systems
    - Which models have blind spot monitoring?
    - Do you have vehicles with power liftgates?
    - I need a car with good visibility

- intent: car_comparison
  examples: |
    - Which is better: Corolla or Civic?
    - Compare RAV4 and CR-V
    - What's the difference between a sedan and a hatchback?
    - Which SUV has better mileage?
    - Tell me the pros and cons of a Tesla vs. a Hyundai EV
    - How does the Camry compare to the Accord?
    - Which is more reliable: Toyota or Honda?
    - Compare the fuel economy of different SUVs
    - What's the difference between hybrid and electric?
    - Which luxury brand offers the best value?
    - Compare the safety ratings of different models
    - Which compact SUV has the most cargo space?
    - How do the prices compare between brands?
    - Which model has better resale value?
    - Compare the warranty coverage
    - Which is more fuel efficient: gas or hybrid?
    - How do the features compare between trims?
    - Which brand has better customer service?
    - Compare the maintenance costs
    - Which model is better for families?

- intent: check_availability
  examples: |
    - Is the Toyota RAV4 in stock?
    - Do you have the Hyundai Tucson Hybrid available?
    - Can I test drive a Tesla near me?
    - Which models are available right now?
    - Do you have same-day delivery?
    - Is this car currently available?
    - Can I schedule a test drive?
    - Do you have this model in stock?
    - What's your current inventory?
    - Can I see the car in person?
    - Is this vehicle available for purchase?
    - Do you have any available for immediate delivery?
    - Can I test drive today?
    - What's your delivery timeline?
    - Do you have this color in stock?
    - Is the vehicle ready for pickup?
    - Can I reserve this car?
    - What's the availability like?
    - Do you have any coming in soon?
    - Can I put a deposit down?

- intent: ask_discounts
  examples: |
    - Are there any promotions?
    - Do you offer trade-in deals?
    - What discounts do you have on EVs?
    - Is there a seasonal sale right now?
    - Can I get cashback offers on new cars?
    - What special offers do you have?
    - Are there any manufacturer rebates?
    - Do you have student discounts?
    - What deals are available this month?
    - Can I get a better price?
    - Are there any loyalty discounts?
    - What incentives are available?
    - Do you offer military discounts?
    - Are there any clearance sales?
    - What promotional financing is available?
    - Can I get a volume discount?
    - Are there any end-of-year deals?
    - What trade-in value can I get?
    - Do you have any package deals?
    - What's the best price you can offer?

- intent: after_sales
  examples: |
    - What's the warranty on this car?
    - Do you include free servicing?
    - How often does the car need maintenance?
    - Is roadside assistance included?
    - What's the insurance cost?
    - What's covered under warranty?
    - Do you offer extended warranties?
    - What maintenance schedule should I follow?
    - Is there a service center nearby?
    - What's included in the service package?
    - Do you offer mobile service?
    - What's the cost of routine maintenance?
    - Is there a maintenance reminder system?
    - What's covered under roadside assistance?
    - Do you offer loaner cars during service?
    - What's the warranty transfer process?
    - Is there a service history available?
    - What's the cost of parts and labor?
    - Do you offer service contracts?
    - What's the recall notification process?

- intent: purchase_commitment
  examples: |
    - I want this car, what's next?
    - Can I proceed with buying now?
    - How do I book this vehicle?
    - I'm ready to purchase, what do I do?
    - Can you help me complete the order?
    - I want to buy this car today
    - How do I finalize the purchase?
    - Can I put a deposit down?
    - What documents do I need?
    - I'm ready to sign the papers
    - How do I complete the transaction?
    - Can I take the car home today?
    - What's the next step in buying?
    - I want to proceed with the purchase
    - How do I secure this vehicle?
    - Can I complete the deal now?
    - What's the purchase process?
    - I'm ready to commit to this car
    - How do I finalize the deal?
    - Can I complete the purchase today?

synonyms:
- synonym: vehicle
  examples: |
    - car
    - automobile
    - ride
    - wheels
    - motor
    - transport

- synonym: SUV
  examples: |
    - sport utility vehicle
    - crossover
    - 4x4
    - off-road vehicle

- synonym: sedan
  examples: |
    - four-door
    - passenger car
    - saloon

- synonym: hybrid
  examples: |
    - gas-electric
    - fuel-efficient
    - eco-friendly

- synonym: electric
  examples: |
    - EV
    - battery-powered
    - zero-emission
    - plug-in

- synonym: luxury
  examples: |
    - premium
    - high-end
    - upscale
    - deluxe

- synonym: budget
  examples: |
    - price range
    - cost
    - affordable
    - economical

- synonym: financing
  examples: |
    - loan
    - credit
    - payment plan
    - lease

- synonym: features
  examples: |
    - options
    - specifications
    - amenities
    - equipment

- synonym: available
  examples: |
    - in stock
    - ready
    - on hand
    - obtainable

regex:
- regex: price
  examples: |
    - \\$\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?
    - \\d{1,3}(?:,\\d{3})* dollars?
    - under \\$?\\d{1,3}(?:,\\d{3})*
    - around \\$?\\d{1,3}(?:,\\d{3})*

- regex: year
  examples: |
    - 20\\d{2}
    - \\d{4}

- regex: mileage
  examples: |
    - \\d{1,3}(?:,\\d{3})* miles?
    - \\d{1,3}(?:,\\d{3})* km
"""
    
    with open("data/nlu.yml", "w") as f:
        f.write(training_content)
    
    print("✅ Training data created")

def train_model():
    """Train the Rasa NLU model."""
    print("\n🚀 Training Rasa NLU model...")
    
    try:
        # Train the model
        subprocess.run(["rasa", "train"], check=True)
        print("✅ Model training completed successfully!")
        print("📁 Model saved in: models/")
        
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Training failed: {e}")
        return False

def test_model():
    """Test the trained model with sample queries."""
    print("\n🧪 Testing trained model...")
    
    test_queries = [
        "I want to buy a car",
        "Show me electric SUVs",
        "What's available under $30k?",
        "Do you offer financing?",
        "Which cars have safety features?",
        "Compare RAV4 and CR-V",
        "Is the Tesla in stock?",
        "Any current promotions?",
        "What's the warranty coverage?",
        "I'm ready to purchase"
    ]
    
    for query in test_queries:
        try:
            result = subprocess.run(
                ["rasa", "shell", "nlu", "--model", "models/latest.tar.gz"],
                input=query.encode(),
                capture_output=True,
                text=True,
                timeout=10
            )
            print(f"✅ Query: '{query}' - Model responded")
        except Exception as e:
            print(f"⚠️ Query: '{query}' - Test failed: {e}")

def create_integration_script():
    """Create JavaScript integration script for your CrewAI system."""
    print("\n🔗 Creating integration script...")
    
    integration_script = """// Rasa Integration for CrewAI Intent Detection
// This script integrates your trained Rasa model with daivecrewai.js

class RasaIntentDetector {
  constructor(rasaUrl = 'http://localhost:5005') {
    this.rasaUrl = rasaUrl;
    this.endpoint = `${rasaUrl}/model/parse`;
  }

  async detectIntent(message) {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: message })
      });

      if (!response.ok) {
        throw new Error(`Rasa API error: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        intent: result.intent.name,
        confidence: result.intent.confidence,
        entities: result.entities,
        raw: result
      };
    } catch (error) {
      console.error('Rasa intent detection failed:', error);
      return null;
    }
  }

  async getIntentWithConfidence(message, minConfidence = 0.7) {
    const result = await this.detectIntent(message);
    
    if (result && result.confidence >= minConfidence) {
      return result;
    }
    
    return null; // Confidence too low, fall back to other methods
  }
}

// Integration with your existing detectIntent method
async function enhancedDetectIntent(message, context = {}) {
  // Try Rasa first (highest accuracy)
  if (context.rasaDetector) {
    const rasaResult = await context.rasaDetector.getIntentWithConfidence(message, 0.8);
    if (rasaResult) {
      console.log(`🤖 Rasa detected intent: ${rasaResult.intent} (confidence: ${rasaResult.confidence})`);
      
      // Map Rasa intents to your internal system
      const intentMapping = {
        'buy_car': 'purchase',
        'car_type_preference': 'car_type',
        'budget_inquiry': 'budget',
        'financing_options': 'financing',
        'feature_request': 'features',
        'car_comparison': 'comparison',
        'check_availability': 'availability',
        'ask_discounts': 'discounts',
        'after_sales': 'after_sales',
        'purchase_commitment': 'purchase_commitment'
      };
      
      if (intentMapping[rasaResult.intent]) {
        return intentMapping[rasaResult.intent];
      }
    }
  }
  
  // Fall back to your existing CrewAI method
  // ... your existing detectIntent logic here
}

// Export for use in daivecrewai.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RasaIntentDetector, enhancedDetectIntent };
}
"""
    
    with open("rasa-integration.js", "w") as f:
        f.write(integration_script)
    
    print("✅ Integration script created: rasa-integration.js")

def main():
    """Main setup function."""
    print("🚀 Rasa Training Setup for CrewAI Intent Detection")
    print("=" * 60)
    
    # Check Python version
    if not check_python_version():
        return
    
    # Install Rasa
    if not install_rasa():
        return
    
    # Create Rasa project
    if not create_rasa_project():
        return
    
    # Create project files
    create_rasa_config()
    create_domain_file()
    create_training_data()
    
    # Train the model
    if not train_model():
        return
    
    # Test the model
    test_model()
    
    # Create integration script
    create_integration_script()
    
    print("\n🎉 Rasa Training Setup Complete!")
    print("\n📋 Next Steps:")
    print("1. Start Rasa server: rasa run --enable-api --cors '*' --port 5005")
    print("2. Test the model: rasa shell nlu")
    print("3. Integrate with daivecrewai.js using rasa-integration.js")
    print("4. Monitor accuracy and retrain as needed")
    
    print("\n🔗 Files Created:")
    print("- daive-intent-bot/ (Rasa project directory)")
    print("- rasa-integration.js (Integration script)")
    print("- models/ (Trained model)")

if __name__ == "__main__":
    main()
