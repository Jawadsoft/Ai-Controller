/**
 * ✅ FRONTEND TEST RUNNER
 * Starts the server and runs frontend simulation tests
 */

const { spawn } = require('child_process');
const { FrontendSimulationTest } = require('./frontendSimulationTest');

class FrontendTestRunner {
  constructor() {
    this.serverProcess = null;
    this.serverPort = 3000;
    this.serverReady = false;
  }

  async runAllTests() {
    console.log('🚀 STARTING FRONTEND SIMULATION TEST RUNNER');
    console.log('='.repeat(80));

    try {
      // Start the server
      await this.startServer();
      
      // Wait for server to be ready
      await this.waitForServer();
      
      // Run the tests
      await this.runTests();
      
      // Stop the server
      await this.stopServer();
      
    } catch (error) {
      console.error('❌ Test runner failed:', error);
      await this.stopServer();
    }
  }

  async startServer() {
    console.log('\n🔧 Starting server...');
    
    return new Promise((resolve, reject) => {
      // Start the server process
      this.serverProcess = spawn('node', ['../server.js'], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('Server:', output);
        
        // Check if server is ready
        if (output.includes('Server running on port') || output.includes('listening on port')) {
          this.serverReady = true;
          resolve();
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        console.error('Server Error:', data.toString());
      });

      this.serverProcess.on('error', (error) => {
        console.error('Failed to start server:', error);
        reject(error);
      });

      this.serverProcess.on('exit', (code) => {
        console.log(`Server process exited with code ${code}`);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!this.serverReady) {
          reject(new Error('Server failed to start within 30 seconds'));
        }
      }, 30000);
    });
  }

  async waitForServer() {
    console.log('\n⏳ Waiting for server to be ready...');
    
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts && !this.serverReady) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      // Try to make a test request
      try {
        const http = require('http');
        const testRequest = http.request({
          hostname: 'localhost',
          port: this.serverPort,
          path: '/api/health',
          method: 'GET'
        }, (res) => {
          if (res.statusCode === 200) {
            this.serverReady = true;
            console.log('✅ Server is ready!');
          }
        });
        
        testRequest.on('error', () => {
          // Server not ready yet
        });
        
        testRequest.end();
      } catch (error) {
        // Server not ready yet
      }
    }
    
    if (!this.serverReady) {
      throw new Error('Server failed to become ready');
    }
  }

  async runTests() {
    console.log('\n🧪 Running frontend simulation tests...');
    
    const testSuite = new FrontendSimulationTest();
    await testSuite.runAllTests();
  }

  async stopServer() {
    if (this.serverProcess) {
      console.log('\n🛑 Stopping server...');
      this.serverProcess.kill();
      this.serverProcess = null;
      this.serverReady = false;
    }
  }
}

// Run the test runner
async function runFrontendTests() {
  const runner = new FrontendTestRunner();
  await runner.runAllTests();
}

// Run if called directly
if (require.main === module) {
  runFrontendTests().catch(console.error);
}

module.exports = { FrontendTestRunner, runFrontendTests };
