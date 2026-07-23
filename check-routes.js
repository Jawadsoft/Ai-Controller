/**
 * Check if the finance routes are properly registered
 */

import express from 'express';

console.log('🔍 Checking Express Route Registration\n');

// Create a mock app to inspect routes
const app = express();

// Import and mount routes the same way server.js does
console.log('📥 Importing finance routes...');
try {
  const financeRoutesModule = await import('./src/routes/finance.js');
  const financeRoutes = financeRoutesModule.default;
  
  console.log('✅ Finance routes module imported successfully\n');
  
  // Mount routes
  app.use('/api/finance', financeRoutes);
  
  // Extract routes
  console.log('📋 Registered Finance Routes:\n');
  
  let routeCount = 0;
  
  // Get all routes from the stack
  function printRoutes(stack, basePath = '') {
    stack.forEach((middleware) => {
      if (middleware.route) {
        // Routes registered directly on the app
        const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
        const path = basePath + middleware.route.path;
        console.log(`  ${methods.padEnd(8)} ${path}`);
        routeCount++;
      } else if (middleware.name === 'router') {
        // Router middleware
        const routerPath = middleware.regexp.source
          .replace('\\/?', '')
          .replace('(?=\\/|$)', '$')
          .replace(/\\\//g, '/');
        
        middleware.handle.stack.forEach((handler) => {
          if (handler.route) {
            const methods = Object.keys(handler.route.methods).join(', ').toUpperCase();
            const path = basePath + handler.route.path;
            console.log(`  ${methods.padEnd(8)} ${path}`);
            routeCount++;
            
            // Check for our specific route
            if (path.includes('/deals/:id/generate-sheet')) {
              console.log('       ⭐ Found PDF generation route!');
            }
          }
        });
      }
    });
  }
  
  // Print routes
  app._router.stack.forEach((middleware) => {
    if (middleware.name === 'router' && middleware.regexp.toString().includes('finance')) {
      console.log('Found finance router!\n');
      printRoutes(middleware.handle.stack, '/api/finance');
    }
  });
  
  console.log(`\n📊 Total routes found: ${routeCount}`);
  
  if (routeCount === 0) {
    console.log('\n⚠️  WARNING: No routes were registered!');
    console.log('   This means the finance routes module might have an error.');
  }
  
  // Check for the specific route we need
  const hasGenerateSheet = app._router.stack.some(middleware => {
    if (middleware.name === 'router' && middleware.handle.stack) {
      return middleware.handle.stack.some(handler => {
        return handler.route && handler.route.path && 
               handler.route.path.includes('/deals/:id/generate-sheet');
      });
    }
    return false;
  });
  
  if (hasGenerateSheet) {
    console.log('\n✅ PDF generation route IS registered');
  } else {
    console.log('\n❌ PDF generation route NOT found!');
    console.log('   Route should be: POST /api/finance/deals/:id/generate-sheet');
  }
  
} catch (error) {
  console.error('❌ Error importing finance routes:', error.message);
  console.error('\nStack trace:');
  console.error(error.stack);
  
  if (error.message.includes('pdfGenerator')) {
    console.log('\n💡 The error is related to pdfGenerator import');
    console.log('   This is expected - finance routes import pdfGenerator at runtime');
  }
}

