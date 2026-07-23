#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Fixing Vite Build Configuration...\n');

async function fixViteConfig() {
  try {
    const viteConfigPath = path.join(__dirname, 'vite.config.ts');
    
    // Check if vite.config.ts exists
    if (!fs.existsSync(viteConfigPath)) {
      console.log('❌ vite.config.ts not found!');
      return false;
    }
    
    console.log('📁 Reading vite.config.ts...');
    let configContent = fs.readFileSync(viteConfigPath, 'utf8');
    
    // Check if uploads directory is already included
    if (configContent.includes("src: 'uploads'")) {
      console.log('✅ Uploads directory already included in build configuration');
      return true;
    }
    
    // Find the serverItems array and add uploads directory
    const serverItemsPattern = /const serverItems = \[([\s\S]*?)\];/;
    const match = configContent.match(serverItemsPattern);
    
    if (!match) {
      console.log('❌ Could not find serverItems array in vite.config.ts');
      return false;
    }
    
    console.log('🔍 Found serverItems array');
    
    // Add uploads directory to the serverItems array
    const updatedServerItems = match[0].replace(
      /(\s+)({ src: 'src\/middleware', dest: 'dist\/server\/middleware', isDir: true },)/,
      `$1$2\n$1{ src: 'uploads', dest: 'dist/uploads', isDir: true },`
    );
    
    // Replace the old serverItems with the updated one
    const updatedConfig = configContent.replace(serverItemsPattern, updatedServerItems);
    
    // Write the updated configuration
    fs.writeFileSync(viteConfigPath, updatedConfig, 'utf8');
    
    console.log('✅ Added uploads directory to Vite build configuration');
    console.log('📝 Updated vite.config.ts successfully');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error fixing Vite configuration:', error.message);
    return false;
  }
}

async function fixPackageJson() {
  try {
    const packageJsonPath = path.join(__dirname, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      console.log('❌ package.json not found!');
      return false;
    }
    
    console.log('📁 Reading package.json...');
    const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
    
    // Check for duplicate csv-parser entries
    const csvParserMatches = packageContent.match(/"csv-parser":/g);
    
    if (csvParserMatches && csvParserMatches.length > 1) {
      console.log('🔍 Found duplicate csv-parser entries');
      
      // Remove the duplicate entry (keep the first one)
      const lines = packageContent.split('\n');
      let foundFirst = false;
      const filteredLines = lines.filter(line => {
        if (line.includes('"csv-parser":')) {
          if (!foundFirst) {
            foundFirst = true;
            return true;
          } else {
            console.log('🗑️ Removing duplicate csv-parser entry:', line.trim());
            return false;
          }
        }
        return true;
      });
      
      const updatedPackageContent = filteredLines.join('\n');
      fs.writeFileSync(packageJsonPath, updatedPackageContent, 'utf8');
      
      console.log('✅ Removed duplicate csv-parser dependency');
    } else {
      console.log('✅ No duplicate csv-parser entries found');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error fixing package.json:', error.message);
    return false;
  }
}

async function createUploadsDirectory() {
  try {
    const uploadsPath = path.join(__dirname, 'uploads');
    
    if (!fs.existsSync(uploadsPath)) {
      console.log('📁 Creating uploads directory...');
      fs.mkdirSync(uploadsPath, { recursive: true });
      console.log('✅ Created uploads directory');
    } else {
      console.log('✅ Uploads directory already exists');
    }
    
    // Create daive-audio subdirectory if it doesn't exist
    const daiveAudioPath = path.join(uploadsPath, 'daive-audio');
    if (!fs.existsSync(daiveAudioPath)) {
      console.log('📁 Creating daive-audio subdirectory...');
      fs.mkdirSync(daiveAudioPath, { recursive: true });
      console.log('✅ Created daive-audio subdirectory');
    } else {
      console.log('✅ daive-audio subdirectory already exists');
    }
    
    // Create other subdirectories
    const subdirs = [
      'daive-audio/greeting',
      'daive-audio/response',
      'vehicle-photos',
      'vehicle-images',
      'etl-documents',
      'temp'
    ];
    
    for (const subdir of subdirs) {
      const fullPath = path.join(uploadsPath, subdir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`✅ Created directory: uploads/${subdir}`);
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error creating uploads directory:', error.message);
    return false;
  }
}

async function verifyBuildConfiguration() {
  try {
    console.log('🔍 Verifying build configuration...');
    
    const viteConfigPath = path.join(__dirname, 'vite.config.ts');
    const configContent = fs.readFileSync(viteConfigPath, 'utf8');
    
    // Check if uploads is included
    if (configContent.includes("src: 'uploads'")) {
      console.log('✅ Uploads directory is included in build configuration');
    } else {
      console.log('❌ Uploads directory is NOT included in build configuration');
      return false;
    }
    
    // Check if the destination is correct
    if (configContent.includes("dest: 'dist/uploads'")) {
      console.log('✅ Uploads directory destination is correct');
    } else {
      console.log('❌ Uploads directory destination is incorrect');
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error verifying configuration:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Vite Build Configuration Fix...\n');
  
  const results = {
    viteConfig: false,
    packageJson: false,
    uploadsDir: false,
    verification: false
  };
  
  // Fix Vite configuration
  console.log('1️⃣ Fixing Vite configuration...');
  results.viteConfig = await fixViteConfig();
  console.log('');
  
  // Fix package.json duplicates
  console.log('2️⃣ Fixing package.json duplicates...');
  results.packageJson = await fixPackageJson();
  console.log('');
  
  // Ensure uploads directory exists
  console.log('3️⃣ Ensuring uploads directory structure...');
  results.uploadsDir = await createUploadsDirectory();
  console.log('');
  
  // Verify configuration
  console.log('4️⃣ Verifying configuration...');
  results.verification = await verifyBuildConfiguration();
  console.log('');
  
  // Summary
  console.log('📋 Summary:');
  console.log(`   Vite Config Fix: ${results.viteConfig ? '✅' : '❌'}`);
  console.log(`   Package.json Fix: ${results.packageJson ? '✅' : '❌'}`);
  console.log(`   Uploads Directory: ${results.uploadsDir ? '✅' : '❌'}`);
  console.log(`   Configuration Verification: ${results.verification ? '✅' : '❌'}`);
  console.log('');
  
  if (results.viteConfig && results.packageJson && results.uploadsDir && results.verification) {
    console.log('🎉 All fixes applied successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('   1. Run: npm run build');
    console.log('   2. Check that dist/uploads/daive-audio exists');
    console.log('   3. Deploy your application');
    console.log('');
    console.log('🔍 The daive-audio folder should now be preserved during build!');
  } else {
    console.log('❌ Some fixes failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
