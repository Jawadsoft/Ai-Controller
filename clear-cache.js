// Simple script to clear audio cache
console.log('🗑️ Clearing audio cache...');

// Clear all greeting-related cache keys
const keys = Object.keys(localStorage);
const audioKeys = keys.filter(key => key.startsWith('greeting_'));
audioKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log(`🗑️ Removed: ${key}`);
});

console.log(`✅ Audio cache cleared: ${audioKeys.length} files removed`);
console.log('🔄 Now refresh your browser to test the new Liam voice greeting!');
