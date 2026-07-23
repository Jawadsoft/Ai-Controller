const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

// Configuration
const SERVER_URL = 'https://app.dealeriq.co/';
const UPLOADS_DIR = './uploads'; // Local directory with files to upload

// File types and their target directories
const FILE_MAPPINGS = {
  'audio': {
    extensions: ['.mp3', '.wav', '.m4a', '.ogg'],
    targetDir: '/uploads/daive-audio'
  },
  'images': {
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    targetDir: '/uploads/vehicle-photos'
  },
  'documents': {
    extensions: ['.pdf', '.doc', '.docx', '.txt', '.csv'],
    targetDir: '/uploads/etl-documents'
  }
};

// Function to get file type based on extension
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  for (const [type, config] of Object.entries(FILE_MAPPINGS)) {
    if (config.extensions.includes(ext)) {
      return type;
    }
  }
  return 'other';
}

// Function to upload a single file
async function uploadFile(filePath, targetDir) {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    
    const response = await axios.post(`${SERVER_URL}/api/upload${targetDir}`, form, {
      headers: {
        ...form.getHeaders(),
        'Content-Type': 'multipart/form-data'
      }
    });
    
    console.log(`✅ Uploaded: ${path.basename(filePath)} to ${targetDir}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to upload ${path.basename(filePath)}:`, error.message);
    return false;
  }
}

// Function to scan directory and upload files
async function uploadDirectory() {
  console.log('🚀 Starting file upload to server...\n');
  
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log(`❌ Local directory ${UPLOADS_DIR} does not exist`);
    console.log('📁 Please create the directory and add files to upload');
    return;
  }
  
  const files = fs.readdirSync(UPLOADS_DIR, { recursive: true });
  const uploadResults = [];
  
  for (const file of files) {
    if (fs.statSync(path.join(UPLOADS_DIR, file)).isFile()) {
      const fileType = getFileType(file);
      const targetDir = FILE_MAPPINGS[fileType]?.targetDir || '/uploads/temp';
      
      console.log(`📤 Uploading: ${file} (${fileType}) to ${targetDir}`);
      const success = await uploadFile(path.join(UPLOADS_DIR, file), targetDir);
      uploadResults.push({ file, success, targetDir });
      
      // Small delay between uploads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Summary
  console.log('\n📊 Upload Summary:');
  const successful = uploadResults.filter(r => r.success).length;
  const failed = uploadResults.filter(r => !r.success).length;
  
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed uploads:');
    uploadResults.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.file}`);
    });
  }
}

// Function to create sample files for testing
function createSampleFiles() {
  console.log('📁 Creating sample files for testing...');
  
  const sampleFiles = {
    'daive-audio': [
      { name: 'greeting-sample.mp3', content: 'Sample audio file' },
      { name: 'response-sample.mp3', content: 'Sample response audio' }
    ],
    'vehicle-photos': [
      { name: 'car1.jpg', content: 'Sample car image' },
      { name: 'car2.png', content: 'Sample car image 2' }
    ],
    'etl-documents': [
      { name: 'inventory.csv', content: 'Sample CSV data' },
      { name: 'report.pdf', content: 'Sample PDF report' }
    ]
  };
  
  for (const [dir, files] of Object.entries(sampleFiles)) {
    const dirPath = path.join(UPLOADS_DIR, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    files.forEach(file => {
      const filePath = path.join(dirPath, file.name);
      fs.writeFileSync(filePath, file.content);
      console.log(`✅ Created: ${filePath}`);
    });
  }
  
  console.log('📁 Sample files created successfully!\n');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--create-samples')) {
    createSampleFiles();
    return;
  }
  
  if (args.includes('--help')) {
    console.log(`
🚀 File Upload Script for Server

Usage:
  node upload-files-to-server.js [options]

Options:
  --create-samples    Create sample files for testing
  --help             Show this help message

Examples:
  node upload-files-to-server.js                    # Upload existing files
  node upload-files-to-server.js --create-samples   # Create sample files first

Requirements:
  - npm install form-data axios
  - Local 'uploads' directory with files
  - Server running and accessible
    `);
    return;
  }
  
  // Check if required packages are installed
  try {
    require('form-data');
    require('axios');
  } catch (error) {
    console.log('❌ Required packages not found. Installing...');
    console.log('📦 Run: npm install form-data axios');
    return;
  }
  
  await uploadDirectory();
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { uploadFile, uploadDirectory, createSampleFiles };
