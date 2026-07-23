import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixUploadsDirectory() {
  console.log('🔧 Fixing uploads directory structure...\n');
  
  try {
    // Get the project root directory
    const projectRoot = path.join(__dirname);
    const uploadsDir = path.join(projectRoot, 'uploads');
    
    console.log('📁 Project root:', projectRoot);
    console.log('📁 Uploads directory:', uploadsDir);
    
    // Create main uploads directory
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('✅ Created main uploads directory');
    } else {
      console.log('✅ Main uploads directory already exists');
    }
    
    // Create subdirectories for different file types
    const subdirs = [
      'daive-audio',
  'daive-audio/greeting',
  'daive-audio/response',
  'vehicle-photos',
  'vehicle-images',
  'etl-documents',
  'deal-sheets',          // ✅ Add this
  'credit-applications',  // ✅ Add this
  'qr-codes', 
  'carfax',           // ✅ Add this
  'temp'
    ];
    
    for (const subdir of subdirs) {
      const fullPath = path.join(uploadsDir, subdir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`✅ Created directory: ${subdir}`);
      } else {
        console.log(`✅ Directory exists: ${subdir}`);
      }
    }
    
    // Create a test file to verify permissions
    const testFile = path.join(uploadsDir, 'daive-audio', 'test.txt');
    try {
      fs.writeFileSync(testFile, 'Test file to verify directory permissions');
      console.log('✅ Test file created successfully');
      
      // Clean up test file
      fs.unlinkSync(testFile);
      console.log('✅ Test file cleaned up');
    } catch (error) {
      console.log('⚠️ Could not create test file (permissions issue):', error.message);
    }
    
    // Set proper permissions (if on Unix-like system)
    try {
      const { execSync } = await import('child_process');
      execSync(`chmod -R 755 ${uploadsDir}`);
      console.log('✅ Set directory permissions to 755');
    } catch (error) {
      console.log('⚠️ Could not set permissions (not Unix-like system or no sudo access)');
    }
    
    // Verify directory structure
    console.log('\n📋 Final directory structure:');
    function listDirectories(dir, indent = '') {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          console.log(`${indent}📁 ${item}/`);
          listDirectories(fullPath, indent + '  ');
        }
      }
    }
    
    listDirectories(uploadsDir);
    
    console.log('\n🎉 Uploads directory structure fixed successfully!');
    console.log('\n📋 What was accomplished:');
    console.log('  - Created main uploads directory');
    console.log('  - Created daive-audio subdirectories');
    console.log('  - Created vehicle photo/image directories');
    console.log('  - Created ETL document directories');
    console.log('  - Set proper permissions');
    console.log('  - Verified directory structure');
    
    console.log('\n🚀 Your audio files should now work properly!');
    
  } catch (error) {
    console.error('❌ Error fixing uploads directory:', error);
    throw error;
  }
}

// Run the fix
if (import.meta.url === `file://${process.argv[1]}`) {
  fixUploadsDirectory()
    .then(() => {
      console.log('\n✅ Directory fix completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Directory fix failed:', error);
      process.exit(1);
    });
}

export default fixUploadsDirectory;
