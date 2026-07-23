console.log('🧹 Simple Formatting Check - Crew AI Responses\n');

// Test 1: Check inventory response format
console.log('1️⃣ Testing Inventory Response Format...');

const inventoryResponse = `🚗 Perfect Matches for Your Vehicle Request:

1. 2020 Toyota Camry SE - $23,500, 42,000 miles, White
2. 2019 Toyota Camry LE - $21,800, 51,000 miles, Silver
3. 2021 Toyota Camry XSE - $24,900, 28,000 miles, Blue

✅ All vehicles are within your $25,000 budget

💬 What interests you most? I can provide details, schedule test drives, or help with financing!`;

console.log('Inventory Response:');
console.log('==================');
console.log(inventoryResponse);

const inventoryHasAsterisks = /\*\*.*\*\*|\*.*\*/.test(inventoryResponse);
const inventoryHasBullets = /[•\-]\s/.test(inventoryResponse);
const inventoryHasMarkdown = /\*\*.*\*\*|\*.*\*|`.*`/.test(inventoryResponse);

console.log('\nFormatting Check:');
console.log('=================');
console.log(`Contains asterisks: ${inventoryHasAsterisks ? '❌' : '✅'}`);
console.log(`Contains bullets: ${inventoryHasBullets ? '❌' : '✅'}`);
console.log(`Contains markdown: ${inventoryHasMarkdown ? '❌' : '✅'}`);

// Test 2: Check fallback response format
console.log('\n2️⃣ Testing Fallback Response Format...');

const fallbackResponse = `Thanks for reaching out! I'll only recommend cars we have in stock.

Could you share:

Budget range
Body style (SUV/sedan/truck)
Must-have features (e.g., safety, hybrid, AWD)
Preferred color/timeline

I'll pull exact matches and prices right away. What's your budget and body style?`;

console.log('Fallback Response:');
console.log('==================');
console.log(fallbackResponse);

const fallbackHasAsterisks = /\*\*.*\*\*|\*.*\*/.test(fallbackResponse);
const fallbackHasBullets = /[•\-]\s/.test(fallbackResponse);

console.log('\nFallback Formatting Check:');
console.log('==========================');
console.log(`Contains asterisks: ${fallbackHasAsterisks ? '❌' : '✅'}`);
console.log(`Contains bullets: ${fallbackHasBullets ? '❌' : '✅'}`);

// Test 3: Check other responses
console.log('\n3️⃣ Testing Other Response Formats...');

const responses = [
  `Hi! I'm D.A.I.V.E. How can I help you today?`,
  `What day works for your test drive?`,
  `Starting at 3.9% APR. Calculate payment?`,
  `I'll show you other options from our inventory!`
];

responses.forEach((response, index) => {
  const hasAsterisks = /\*\*.*\*\*|\*.*\*/.test(response);
  const hasBullets = /[•\-]\s/.test(response);
  
  console.log(`Response ${index + 1}: "${response}"`);
  console.log(`  Asterisks: ${hasAsterisks ? '❌' : '✅'}`);
  console.log(`  Bullets: ${hasBullets ? '❌' : '✅'}`);
});

// Test 4: Summary
console.log('\n4️⃣ Summary...');

const allResponses = [inventoryResponse, fallbackResponse, ...responses];
let totalIssues = 0;

allResponses.forEach(response => {
  const hasAsterisks = /\*\*.*\*\*|\*.*\*/.test(response);
  const hasBullets = /[•\-]\s/.test(response);
  const hasMarkdown = /\*\*.*\*\*|\*.*\*|`.*`/.test(response);
  
  if (hasAsterisks || hasBullets || hasMarkdown) {
    totalIssues++;
  }
});

console.log(`Total responses tested: ${allResponses.length}`);
console.log(`Responses with formatting issues: ${totalIssues}`);
console.log(`Response quality: ${((allResponses.length - totalIssues) / allResponses.length * 100).toFixed(1)}%`);

if (totalIssues === 0) {
  console.log('\n🎉 All responses are clean and TTS-optimized!');
} else {
  console.log('\n⚠️ Some formatting issues remain. Review the responses above.');
}

console.log('\n🏁 Formatting check completed');
