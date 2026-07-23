// 🚀 ML + CrewAI Integration Script
// Connects your trained Python ML model with CrewAI

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class MLIntentDetector {
  constructor(modelPath = 'enhanced_intent_model.pkl') {
    this.modelPath = modelPath;
    this.pythonScript = path.join(process.cwd(), 'ml-predict.py');
    this.createPythonScript();
  }

  createPythonScript() {
    // Create a Python script for prediction
    const pythonCode = `#!/usr/bin/env python3
import sys
import pickle
import json

def predict_intent(message, model_path):
    try:
        # Load the trained model
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        
        # Predict intent
        probabilities = model.predict_proba([message.lower()])[0]
        predicted_class = model.predict([message.lower()])[0]
        confidence = max(probabilities)
        
        # Map to internal intent system
        intent_mapping = {
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
        }
        
        mapped_intent = intent_mapping.get(predicted_class, predicted_class)
        
        # Return result as JSON
        result = {
            'intent': mapped_intent,
            'confidence': float(confidence),
            'method': 'ml',
            'provider': 'enhanced_ml',
            'raw_intent': predicted_class,
            'probabilities': dict(zip(model.classes_, [float(p) for p in probabilities]))
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            'intent': 'unknown',
            'confidence': 0.0,
            'method': 'ml_error',
            'error': str(e)
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({'error': 'Usage: python ml-predict.py "message" model_path'}))
        sys.exit(1)
    
    message = sys.argv[1]
    model_path = sys.argv[2]
    predict_intent(message, model_path)
`;

    fs.writeFileSync(this.pythonScript, pythonCode);
    console.log('✅ Python prediction script created');
  }

  async detectIntent(message, confidenceThreshold = 0.15) {
    return new Promise((resolve, reject) => {
      try {
        const pythonProcess = spawn('python', [
          this.pythonScript,
          message,
          this.modelPath
        ]);

        let result = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
          result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        pythonProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Python process failed with code ${code}: ${error}`));
            return;
          }

          try {
            const mlResult = JSON.parse(result.trim());
            
            // Check confidence threshold
            if (mlResult.confidence >= confidenceThreshold) {
              resolve(mlResult);
            } else {
              resolve({
                ...mlResult,
                intent: 'unknown',
                method: 'ml_low_confidence'
              });
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse Python output: ${parseError.message}`));
          }
        });

        pythonProcess.on('error', (err) => {
          reject(new Error(`Failed to start Python process: ${err.message}`));
        });

      } catch (error) {
        reject(error);
      }
    });
  }
}

class CrewAIMLIntegration {
  constructor(options = {}) {
    this.mlDetector = new MLIntentDetector(options.modelPath);
    this.confidenceThreshold = options.confidenceThreshold || 0.15;
    this.cache = new Map();
    this.cacheTimeout = options.cacheTimeout || 30000; // 30 seconds
    
    // Performance tracking
    this.stats = {
      totalRequests: 0,
      mlHits: 0,
      fallbacks: 0,
      avgResponseTime: 0,
      cacheHits: 0
    };
  }

  async detectIntent(message, context = {}) {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(message, context);
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.stats.cacheHits++;
        return cachedResult;
      }

      // Use ML detection
      const mlResult = await this.mlDetector.detectIntent(message, this.confidenceThreshold);
      
      if (mlResult.method === 'ml') {
        this.stats.mlHits++;
        console.log(`🤖 ML detected intent: ${mlResult.intent} (confidence: ${mlResult.confidence})`);
      } else {
        this.stats.fallbacks++;
        console.log(`⚠️ ML low confidence, intent: ${mlResult.intent}`);
      }

      // Cache the result
      this.setCache(cacheKey, mlResult);

      // Update performance stats
      const responseTime = Date.now() - startTime;
      this.updatePerformanceStats(responseTime);

      return mlResult;

    } catch (error) {
      console.error('❌ ML intent detection failed:', error.message);
      this.stats.fallbacks++;
      
      return {
        intent: 'unknown',
        confidence: 0.0,
        method: 'ml_error',
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  generateCacheKey(message, context) {
    const normalizedMessage = message.toLowerCase().trim();
    const contextHash = JSON.stringify(context);
    return `${normalizedMessage}:${contextHash}`;
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }
    
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }

  setCache(key, result) {
    if (this.cache.size >= 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      result: result,
      timestamp: Date.now()
    });
  }

  updatePerformanceStats(responseTime) {
    const currentAvg = this.stats.avgResponseTime;
    const totalRequests = this.stats.totalRequests;
    
    this.stats.avgResponseTime = (currentAvg * (totalRequests - 1) + responseTime) / totalRequests;
  }

  getStats() {
    const mlAccuracy = this.stats.totalRequests > 0 ? 
      (this.stats.mlHits / this.stats.totalRequests * 100).toFixed(1) : 0;
    
    const fallbackRate = this.stats.totalRequests > 0 ? 
      (this.stats.fallbacks / this.stats.totalRequests * 100).toFixed(1) : 0;
    
    const cacheHitRate = this.stats.totalRequests > 0 ? 
      (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(1) : 0;

    return {
      totalRequests: this.stats.totalRequests,
      mlAccuracy: `${mlAccuracy}%`,
      fallbackRate: `${fallbackRate}%`,
      cacheHitRate: `${cacheHitRate}%`,
      avgResponseTime: `${this.stats.avgResponseTime.toFixed(1)}ms`,
      cacheSize: this.cache.size
    };
  }

  clearCache() {
    this.cache.clear();
    console.log('🧹 ML intent detection cache cleared');
  }
}

// Test the integration
async function testMLIntegration() {
  console.log('🧪 Testing ML + CrewAI Integration...\n');

  const integration = new CrewAIMLIntegration({
    confidenceThreshold: 0.15,
    cacheTimeout: 30000
  });

  const testMessages = [
    "I want to buy a car",
    "What's available in my price range?",
    "Do you offer financing?",
    "I need a 7-seater SUV",
    "Which is better: RAV4 or CR-V?",
    "Is the Toyota RAV4 in stock?",
    "Are there any promotions?",
    "What's the warranty on this car?",
    "I'm ready to purchase now",
    "Show me electric vehicles"
  ];

  for (const message of testMessages) {
    console.log(`\n🧪 Testing: "${message}"`);
    
    try {
      const startTime = Date.now();
      const result = await integration.detectIntent(message);
      const responseTime = Date.now() - startTime;
      
      console.log(`✅ Result:`, {
        intent: result.intent,
        confidence: result.confidence,
        method: result.method,
        responseTime: `${responseTime}ms`
      });
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }

  // Get performance stats
  const stats = integration.getStats();
  console.log(`\n📊 Performance Stats:`, stats);
  
  console.log('\n🎉 ML Integration Test Complete!');
  console.log('🚀 Ready to integrate with your CrewAI system!');
}

// Run the test
testMLIntegration().catch(console.error);

module.exports = { MLIntentDetector, CrewAIMLIntegration };
