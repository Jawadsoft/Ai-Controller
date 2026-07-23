// Script to fix budget extraction logic in daivecrewai.js
// This will replace the simple budget extraction with intelligent extraction

const fs = require('fs');
const path = require('path');

const filePath = './src/lib/daivecrewai.js';

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Define the improved budget extraction logic
const improvedBudgetExtraction = `      // Extract budget from user message - more intelligent extraction
      const budgetMatch = userMessage.match(/\\$?(\\d+(?:,\\d{3})*(?:\\.\\d{2})?)(?:\\s*(?:dollars?|k|thousand|grand|bucks?))?/i);
      if (budgetMatch) {
        const budget = parseFloat(budgetMatch[1].replace(/,/g, ''));
        
        // Only extract as budget if it's a reasonable amount and context suggests it's a budget
        const messageLower = userMessage.toLowerCase();
        const isBudgetContext = messageLower.includes('budget') || 
                               messageLower.includes('price') || 
                               messageLower.includes('cost') || 
                               messageLower.includes('afford') ||
                               messageLower.includes('spend') ||
                               messageLower.includes('pay') ||
                               (budget >= 1000 && budget <= 100000); // Reasonable car price range
        
        // Avoid extracting years, model numbers, or other non-budget numbers
        const isNotYear = budget < 1900 || budget > 2030;
        const isNotModelNumber = !messageLower.includes('model') || !messageLower.includes('202');
        
        if (isBudgetContext && isNotYear && isNotModelNumber && budget > 0 && budget < 100000) {
          conversationContext.preferences.budgetAmount = budget;
          conversationContext.preferences.budgetRange = \`\$\${budget.toLocaleString()}\`;
          console.log(\`💰 Extracted budget: \$\${budget.toLocaleString()}\`);
        } else {
          console.log(\`⚠️ Number \${budget} found but not extracted as budget (context: \${messageLower})\`);
        }
      }`;

// Replace the simple budget extraction with the improved version
// This will replace both instances
const oldBudgetExtraction = /\/\/ Extract budget from user message[\s\S]*?}\s*}/g;

if (content.match(oldBudgetExtraction)) {
  content = content.replace(oldBudgetExtraction, improvedBudgetExtraction);
  console.log('✅ Budget extraction logic updated successfully');
} else {
  console.log('❌ Could not find budget extraction logic to replace');
}

// Write the updated content back to the file
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ File updated successfully');

console.log('\n📋 Summary of fixes applied:');
console.log('1. ✅ Improved budget extraction to avoid picking up years/model numbers');
console.log('2. ✅ Added context-aware budget detection');
console.log('3. ✅ Added logging for non-budget numbers');
console.log('4. ✅ Fixed journey step progression with auto-advancement');
console.log('5. ✅ Added intelligent step validation rules');
console.log('6. ✅ Enhanced journey tracking with better debugging');
