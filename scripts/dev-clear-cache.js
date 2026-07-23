#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧹 Development Cache Clear Script');
console.log('================================');

try {
  // Clear node_modules cache
  console.log('\n1. Clearing node_modules cache...');
  if (fs.existsSync('node_modules/.cache')) {
    execSync('rm -rf node_modules/.cache', { stdio: 'inherit' });
    console.log('✅ node_modules cache cleared');
  }

  // Clear Vite cache
  console.log('\n2. Clearing Vite cache...');
  if (fs.existsSync('.vite')) {
    execSync('rm -rf .vite', { stdio: 'inherit' });
    console.log('✅ Vite cache cleared');
  }

  // Clear dist/build cache
  console.log('\n3. Clearing build cache...');
  if (fs.existsSync('dist')) {
    execSync('rm -rf dist', { stdio: 'inherit' });
    console.log('✅ Build cache cleared');
  }

  // Clear uploads cache (if exists)
  console.log('\n4. Clearing uploads cache...');
  if (fs.existsSync('uploads')) {
    execSync('rm -rf uploads/*', { stdio: 'inherit' });
    console.log('✅ Uploads cache cleared');
  }

  // Clear browser cache files
  console.log('\n5. Clearing browser cache files...');
  const cacheDirs = [
    '.cache',
    '.parcel-cache',
    '.next',
    'coverage'
  ];
  
  cacheDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      execSync(`rm -rf ${dir}`, { stdio: 'inherit' });
      console.log(`✅ ${dir} cleared`);
    }
  });

  console.log('\n✅ All development caches cleared!');
  console.log('\n🔄 Starting development server...');
  
  // Start the development server
  execSync('npm run dev', { stdio: 'inherit' });

} catch (error) {
  console.error('❌ Error clearing cache:', error.message);
  process.exit(1);
} 