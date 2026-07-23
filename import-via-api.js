#!/usr/bin/env node

/**
 * Import daive_scenario_flows.json data via the database admin API
 * 
 * This script reads the JSON file and uses the API endpoint to import the data.
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BACKEND_URL = 'https://vehicle-management-backend-ypsa.onrender.com';

async function importViaAPI() {
  try {
    console.log('🚀 Starting daive_scenario_flows import via API...');
    
    // Read the JSON file
    const jsonFilePath = join(__dirname, 'daive_scenario_flows.json');
    console.log(`📁 Reading data from: ${jsonFilePath}`);
    
    if (!fs.existsSync(jsonFilePath)) {
      throw new Error(`JSON file not found: ${jsonFilePath}`);
    }
    
    const jsonData = fs.readFileSync(jsonFilePath, 'utf8');
    const scenarioFlows = JSON.parse(jsonData);
    
    console.log(`📊 Found ${scenarioFlows.length} records to import`);
    
    // Call the API endpoint
    console.log('🌐 Calling import API...');
    
    const response = await fetch(`${BACKEND_URL}/api/database-admin/import-json-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tableName: 'daive_scenario_flows',
        data: scenarioFlows,
        options: {
          upsert: true // Update existing records
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('\n✅ Import completed successfully!');
      console.log('📊 Summary:');
      console.log(`   📥 Inserted: ${result.summary.inserted} records`);
      console.log(`   🔄 Updated: ${result.summary.updated} records`);
      console.log(`   ❌ Errors: ${result.summary.errors} records`);
      console.log(`   📈 Total processed: ${result.summary.inserted + result.summary.updated} records`);
      
      if (result.errors && result.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        result.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. Record ${error.index}: ${error.error}`);
        });
      }
      
      console.log(`\n🕐 Imported at: ${result.imported_at}`);
    } else {
      throw new Error(`Import failed: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Run the import
importViaAPI().catch(console.error);
