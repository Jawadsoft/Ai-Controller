// Puppeteer configuration for deployment
const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Skip downloading Chrome during npm install on servers
  skipDownload: process.env.NODE_ENV === 'production',
  
  // Cache directory
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
