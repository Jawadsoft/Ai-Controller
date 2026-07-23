// Check ML Integration Status
// This script checks if the ML integration is actually active

import DAIVEService from './src/lib/daivecrewai.js';

async function checkMLStatus() {
  console.log('🔍 Checking ML Integration Status');
  console.log('================================\n');

  try {
    // Initialize DAIVE Service
    console.log('1️⃣ Initializing DAIVE Service...');
    const daiveService = new DAIVEService();
    
    // Check if ML integration is available
    console.log('2️⃣ Checking ML Integration...');
    if (daiveService.mlIntegration) {
      console.log('✅ ML Integration found in DAIVE Service');
      console.log(`   Model Path: ${daiveService.mlIntegration.mlDetector.modelPath}`);
      console.log(`   Confidence Threshold: ${daiveService.mlIntegration.confidenceThreshold}`);
      console.log(`   Cache Size: ${daiveService.mlIntegration.cacheSize}`);
    } else {
      console.log('❌ ML Integration NOT found in DAIVE Service');
      console.log('   This means the integration code is not loaded');
    }
    
    // Check if the ML model file exists
    console.log('\n3️⃣ Checking ML Model File...');
    const fs = await import('fs');
    const modelPath = 'enhanced_intent_model.pkl';
    
    if (fs.existsSync(modelPath)) {
      console.log(`✅ ML Model file found: ${modelPath}`);
      const stats = fs.statSync(modelPath);
      console.log(`   File size: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`   Last modified: ${stats.mtime}`);
    } else {
      console.log(`❌ ML Model file NOT found: ${modelPath}`);
      console.log('   This is why ML detection is failing');
    }
    
    // Test a simple intent detection
    console.log('\n4️⃣ Testing ML Intent Detection...');
    if (daiveService.mlIntegration) {
      try {
        const testMessage = "Compare RAV4 and CR-V";
        console.log(`   Testing message: "${testMessage}"`);
        
        const startTime = Date.now();
        const result = await daiveService.mlIntegration.detectIntent(testMessage);
        const responseTime = Date.now() - startTime;
        
        console.log(`   ✅ ML Detection Result:`);
        console.log(`      Intent: ${result.intent}`);
        console.log(`      Confidence: ${result.confidence}%`);
        console.log(`      Method: ${result.method}`);
        console.log(`      Response Time: ${responseTime}ms`);
        
      } catch (error) {
        console.log(`   ❌ ML Detection Failed: ${error.message}`);
      }
    }
    
    // Show ML stats if available
    if (daiveService.mlIntegration) {
      console.log('\n5️⃣ ML Performance Statistics:');
      const stats = daiveService.mlIntegration.getStats();
      console.log(JSON.stringify(stats, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
    console.error(error.stack);
  }
}

// Run the check
checkMLStatus().then(() => {
  console.log('\n🔍 ML Status check completed!');
}).catch(error => {
  console.error('\n💥 Check failed with error:', error);
});
