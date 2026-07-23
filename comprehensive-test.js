#!/usr/bin/env node

/**
 * Comprehensive Test
 * This script tests both CrewAI conversations and TTS text cleaning
 */

import DAIVEService from './src/lib/daivecrewai.js';

// Enhanced text cleaning function (same as in routes)
function cleanTextForTTS(text) {
  if (!text || typeof text !== 'string') return text;
  
  let cleanedText = text;
  
  // Step 1: Remove markdown formatting
  cleanedText = cleanedText
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold formatting
    .replace(/\*(.*?)\*/g, '$1')      // Remove italic formatting
    .replace(/`(.*?)`/g, '$1')        // Remove code formatting
    .replace(/~~(.*?)~~/g, '$1')      // Remove strikethrough
    .replace(/^#{1,6}\s+/gm, '')     // Remove markdown headers
    .trim();
  
  // Step 2: Remove bullet points and lists
  cleanedText = cleanedText
    .replace(/\n\s*•\s*/g, '\n')     // Remove bullet points
    .replace(/\n\s*-\s*/g, '\n')     // Remove dashes
    .replace(/\n\s*\d+\.\s*/g, '\n') // Remove numbered lists
    .trim();
  
  // Step 3: Remove special characters that sound robotic
  cleanedText = cleanedText
    .replace(/[<>{}[\]|\\]/g, '')     // Remove HTML-like brackets and pipes
    .replace(/[~`^]/g, ' ')           // Remove tildes, backticks, carets
    .trim();
  
  // Step 4: Handle common abbreviations
  cleanedText = cleanedText
    .replace(/\bvs\./gi, 'versus')    // vs. → versus
    .replace(/\betc\./gi, 'and so on') // etc. → and so on
    .replace(/\bi\.e\./gi, 'that is') // i.e. → that is
    .replace(/\be\.g\./gi, 'for example') // e.g. → for example
    .replace(/\bMr\./gi, 'Mister')    // Mr. → Mister
    .replace(/\bMrs\./gi, 'Missus')   // Mrs. → Missus
    .replace(/\bDr\./gi, 'Doctor')    // Dr. → Doctor
    .replace(/\bSt\./gi, 'Street')    // St. → Street
    .replace(/\bAve\./gi, 'Avenue')   // Ave. → Avenue
    .replace(/\bBlvd\./gi, 'Boulevard') // Blvd. → Boulevard
    .trim();
  
  // Step 5: Clean up spacing and punctuation
  cleanedText = cleanedText
    .replace(/\s+([.,!?;:])/g, '$1')  // Remove spaces before punctuation
    .replace(/([.,!?;:])\s+/g, '$1 ') // Ensure proper spacing after punctuation
    .replace(/\s+/g, ' ')              // Normalize multiple spaces
    .replace(/\n\s*\n/g, '\n')        // Clean up multiple newlines
    .replace(/^\s+|\s+$/gm, '')       // Trim whitespace from each line
    .trim();
  
  return cleanedText;
}

async function comprehensiveTest() {
  console.log('🧪 Comprehensive Test - CrewAI + TTS Text Cleaning\n');
  
  try {
    // Test 1: CrewAI Service
    console.log('🔍 Test 1: CrewAI Service Initialization');
    const daiveService = new DAIVEService();
    console.log('✅ Service instance created');
    
    await daiveService.initialize();
    console.log('✅ Service initialized');
    
    const status = daiveService.getServiceStatus();
    console.log('📊 Service Status:', status);
    
    if (!status.crewAIAvailable) {
      console.log('❌ CrewAI not available - skipping conversation tests');
      return;
    }
    
    // Test 2: CrewAI Conversation
    console.log('\n🔍 Test 2: CrewAI Conversation');
    const validDealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    
    const result = await daiveService.processConversation(
      'test-session-comprehensive',
      null,
      'Hello! I\'m looking for a **Toyota** Camry. Can you help me find one?',
      { dealerId: validDealerId }
    );
    
    console.log('✅ Conversation result:', {
      success: !!result.response,
      crewUsed: result.crewUsed,
      intent: result.intent,
      responseLength: result.response?.length || 0,
      responsePreview: result.response?.substring(0, 150) + '...'
    });
    
    // Test 3: TTS Text Cleaning
    console.log('\n🔍 Test 3: TTS Text Cleaning');
    
    const testCases = [
      result.response, // Use the actual AI response
      "**Hello!** I can help you find a *great* car! 🚗",
      "The **Toyota** Camry is an excellent choice vs. other sedans.",
      "Features include: • Bluetooth • Navigation • Safety systems",
      "Price: $25,000 + tax = $27,000 total",
      "Contact us at: john@dealer.com or call (555) 123-4567",
      "We have #1 customer satisfaction rating!",
      "Models: 1. Sedan 2. SUV 3. Truck",
      "**Bold text** and *italic text* with `code` formatting",
      "Address: 123 Main St., New York, NY 10001",
      "Hours: Mon-Fri 9AM-6PM, Sat 10AM-4PM"
    ];
    
    console.log('🧹 Testing text cleaning on various inputs:');
    testCases.forEach((testCase, index) => {
      if (testCase) {
        const cleaned = cleanTextForTTS(testCase);
        console.log(`\nTest ${index + 1}:`);
        console.log(`Original: "${testCase.substring(0, 80)}..."`);
        console.log(`Cleaned:  "${cleaned.substring(0, 80)}..."`);
        console.log(`Improvement: ${testCase.length - cleaned.length} characters removed`);
      }
    });
    
    // Test 4: Voice Response Simulation
    console.log('\n🔍 Test 4: Voice Response Simulation');
    if (result.response) {
      const cleanedForVoice = cleanTextForTTS(result.response);
      console.log('🎤 Original AI response (for display):');
      console.log(`"${result.response.substring(0, 200)}..."`);
      console.log('\n🎤 Cleaned response (for voice/TTS):');
      console.log(`"${cleanedForVoice.substring(0, 200)}..."`);
      
      // Calculate improvement metrics
      const originalLength = result.response.length;
      const cleanedLength = cleanedForVoice.length;
      const improvementPercent = ((originalLength - cleanedLength) / originalLength * 100).toFixed(1);
      
      console.log(`\n📊 Text Cleaning Results:`);
      console.log(`- Original length: ${originalLength} characters`);
      console.log(`- Cleaned length: ${cleanedLength} characters`);
      console.log(`- Characters removed: ${originalLength - cleanedLength}`);
      console.log(`- Improvement: ${improvementPercent}%`);
      
      // Check for common issues
      const hasMarkdown = /\*\*.*\*\*|\*.*\*|`.*`/.test(result.response);
      const hasBullets = /[•\-]\s/.test(result.response);
      const hasSpecialChars = /[<>{}[\]|\\~`^]/.test(result.response);
      
      console.log(`\n🔍 Quality Checks:`);
      console.log(`- Contains markdown: ${hasMarkdown ? '❌' : '✅'}`);
      console.log(`- Contains bullets: ${hasBullets ? '❌' : '✅'}`);
      console.log(`- Contains special chars: ${hasSpecialChars ? '❌' : '✅'}`);
    }
    
    console.log('\n🎉 Comprehensive test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

comprehensiveTest().catch(console.error);
