import { pool } from './src/database/connection.js';

async function debugFormattingIssue() {
  console.log('🔍 Debugging Formatting Issues\n');
  
  try {
    // Test the exact responses that were flagged in the test
    const responses = [
      `Thanks for reaching out! I'll only recommend cars we have in stock.\n\nCould you share:\n\nBudget range\nBody style (SUV/sedan/truck)\nMust-have features (e.g., safety, hybrid, AWD)\nPreferred color/timeline\n\nI'll pull exact matches and prices right away. What's your budget and body style?`,
      `🚗 Perfect Matches for Your Vehicle Request:\n\n1. 2020 Toyota Camry SE - $23,500, 42,000 miles, White\n2. 2019 Toyota Camry LE - $21,800, 51,000 miles, Silver\n3. 2021 Toyota Camry XSE - $24,900, 28,000 miles, Blue\n\n✅ All vehicles are within your $25,000 budget\n\n💬 What interests you most? I can provide details, schedule test drives, or help with financing!`,
      `Hi! I'm D.A.I.V.E. How can I help you today?`,
      `What day works for your test drive?`,
      `Starting at 3.9% APR. Calculate payment?`,
      `I'll show you other options from our inventory!`
    ];
    
    console.log('Testing each response for formatting issues:\n');
    
    responses.forEach((response, index) => {
      console.log(`Response ${index + 1}:`);
      console.log('='.repeat(50));
      console.log(response);
      
      const hasAsterisks = /\*\*.*\*\*|\*.*\*/.test(response);
      const hasBullets = /[•\-]\s/.test(response);
      const hasMarkdown = /\*\*.*\*\*|\*.*\*|`.*`/.test(response);
      
      console.log('\nFormatting Check:');
      console.log(`  Asterisks: ${hasAsterisks ? '❌' : '✅'}`);
      console.log(`  Bullets: ${hasBullets ? '❌' : '✅'}`);
      console.log(`  Markdown: ${hasMarkdown ? '❌' : '✅'}`);
      
      if (hasBullets) {
        console.log('  🔍 Bullet points found at positions:');
        const bulletMatches = response.match(/[•\-]/g);
        if (bulletMatches) {
          bulletMatches.forEach((match, pos) => {
            console.log(`    ${match} at position ${response.indexOf(match)}`);
          });
        }
      }
      
      console.log('\n');
    });
    
    // Test the specific regex patterns
    console.log('Testing regex patterns:');
    console.log('=======================');
    
    const testString = `Thanks for reaching out! I'll only recommend cars we have in stock.\n\nCould you share:\n\nBudget range\nBody style (SUV/sedan/truck)\nMust-have features (e.g., safety, hybrid, AWD)\nPreferred color/timeline\n\nI'll pull exact matches and prices right away. What's your budget and body style?`;
    
    console.log('Test string:', testString);
    console.log('Contains bullets [•\-]\\s:', /[•\-]\s/.test(testString));
    console.log('Contains bullets [•\-]:', /[•\-]/.test(testString));
    
    // Check for any hidden characters
    console.log('\nCharacter analysis:');
    console.log('==================');
    for (let i = 0; i < testString.length; i++) {
      const char = testString[i];
      if (char === '•' || char === '-' || char === '*') {
        console.log(`Position ${i}: '${char}' (code: ${char.charCodeAt(0)})`);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await pool.end();
    console.log('\n🏁 Debug completed');
  }
}

// Run the debug
debugFormattingIssue().catch(console.error);
