#!/usr/bin/env node

// Performance Test Runner for Streaming Voice Pipeline
// Executes all performance tests and generates comprehensive reports
// Usage: node test/run-performance-tests.js [options]

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Configuration
const config = {
  testTimeout: 60000, // 60 seconds
  maxRetries: 3,
  outputDir: 'test-results',
  performanceThresholds: {
    audioChunk: 80,
    intentDetection: 120,
    llmFirstToken: 700,
    ttsFirstAudio: 600,
    timeToFirstAudio: 2000,
    totalResponse: 4000
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Utility functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log('\n' + '='.repeat(60), 'bright');
  log(message, 'bright');
  log('='.repeat(60), 'bright');
}

function logSection(message) {
  log('\n' + '-'.repeat(40), 'cyan');
  log(message, 'cyan');
  log('-'.repeat(40), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Performance test runner
class PerformanceTestRunner {
  constructor() {
    this.results = {
      startTime: Date.now(),
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        performance: {
          targets: {},
          regressions: [],
          improvements: []
        }
      }
    };
  }

  async run() {
    try {
      logHeader('🚀 STREAMING VOICE PIPELINE PERFORMANCE TESTS');
      logInfo(`Starting performance test suite at ${new Date().toLocaleString()}`);
      
      // Ensure output directory exists
      this.ensureOutputDirectory();
      
      // Run test suites
      await this.runTestSuite('Unit Tests', 'npm test -- --testPathPattern="streaming-voice-performance"');
      await this.runTestSuite('Settings Tests', 'npm test -- --testPathPattern="optimized-settings"');
      await this.runTestSuite('Benchmark Tests', 'npm test -- --testPathPattern="performance-benchmarks"');
      
      // Generate reports
      this.generatePerformanceReport();
      this.generateJUnitReport();
      this.generateSummaryReport();
      
      // Display final results
      this.displayFinalResults();
      
    } catch (error) {
      logError(`Test runner failed: ${error.message}`);
      process.exit(1);
    }
  }

  ensureOutputDirectory() {
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
      logInfo(`Created output directory: ${config.outputDir}`);
    }
  }

  async runTestSuite(name, command) {
    logSection(`Running ${name}`);
    
    try {
      logInfo(`Executing: ${command}`);
      
      const startTime = Date.now();
      const result = execSync(command, {
        encoding: 'utf8',
        timeout: config.testTimeout,
        stdio: 'pipe'
      });
      const duration = Date.now() - startTime;
      
      // Parse test results
      const testResult = this.parseTestOutput(result, name, duration);
      this.results.tests.push(testResult);
      
      if (testResult.status === 'PASS') {
        logSuccess(`${name} completed successfully in ${duration}ms`);
      } else {
        logWarning(`${name} completed with issues in ${duration}ms`);
      }
      
    } catch (error) {
      const testResult = {
        name,
        status: 'FAIL',
        duration: 0,
        error: error.message,
        output: error.stdout || error.stderr || 'No output available'
      };
      
      this.results.tests.push(testResult);
      logError(`${name} failed: ${error.message}`);
    }
  }

  parseTestOutput(output, name, duration) {
    // Simple parsing of Jest output
    const lines = output.split('\n');
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    
    lines.forEach(line => {
      if (line.includes('✓') || line.includes('PASS')) passed++;
      if (line.includes('✗') || line.includes('FAIL')) failed++;
      if (line.includes('SKIP')) skipped++;
    });
    
    const total = passed + failed + skipped;
    const status = failed > 0 ? 'FAIL' : 'PASS';
    
    return {
      name,
      status,
      duration,
      total,
      passed,
      failed,
      skipped,
      output: output.substring(0, 1000) // Limit output size
    };
  }

  generatePerformanceReport() {
    logSection('Generating Performance Report');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      testResults: this.results.tests,
      performance: {
        targets: config.performanceThresholds,
        recommendations: this.generateRecommendations()
      }
    };
    
    const reportPath = path.join(config.outputDir, 'performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    logSuccess(`Performance report saved to: ${reportPath}`);
  }

  generateJUnitReport() {
    logSection('Generating JUnit Report');
    
    const junitReport = this.convertToJUnitFormat();
    const junitPath = path.join(config.outputDir, 'junit.xml');
    fs.writeFileSync(junitPath, junitReport);
    
    logSuccess(`JUnit report saved to: ${junitPath}`);
  }

  convertToJUnitFormat() {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<testsuites>\n';
    
    this.results.tests.forEach(testSuite => {
      xml += `  <testsuite name="${testSuite.name}" tests="${testSuite.total}" failures="${testSuite.failed}" skipped="${testSuite.skipped}" time="${testSuite.duration / 1000}">\n`;
      
      if (testSuite.status === 'PASS') {
        xml += `    <testcase name="All tests" classname="${testSuite.name}" time="${testSuite.duration / 1000}"/>\n`;
      } else {
        xml += `    <testcase name="Test suite" classname="${testSuite.name}" time="${testSuite.duration / 1000}">\n`;
        xml += `      <failure message="Test suite failed">${testSuite.error || 'Unknown error'}</failure>\n`;
        xml += `    </testcase>\n`;
      }
      
      xml += '  </testsuite>\n';
    });
    
    xml += '</testsuites>';
    return xml;
  }

  generateSummaryReport() {
    logSection('Generating Summary Report');
    
    const summary = {
      timestamp: new Date().toISOString(),
      totalTests: this.results.tests.reduce((sum, t) => sum + t.total, 0),
      passedTests: this.results.tests.reduce((sum, t) => sum + t.passed, 0),
      failedTests: this.results.tests.reduce((sum, t) => sum + t.failed, 0),
      skippedTests: this.results.tests.reduce((sum, t) => sum + t.skipped, 0),
      totalDuration: this.results.tests.reduce((sum, t) => sum + t.duration, 0),
      successRate: this.calculateSuccessRate(),
      performance: this.analyzePerformance()
    };
    
    const summaryPath = path.join(config.outputDir, 'summary-report.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    logSuccess(`Summary report saved to: ${summaryPath}`);
  }

  calculateSuccessRate() {
    const total = this.results.tests.reduce((sum, t) => sum + t.total, 0);
    const passed = this.results.tests.reduce((sum, t) => sum + t.passed, 0);
    return total > 0 ? (passed / total) * 100 : 0;
  }

  analyzePerformance() {
    const analysis = {
      overallStatus: 'UNKNOWN',
      targetCompliance: 0,
      recommendations: []
    };
    
    // Analyze test results for performance insights
    const failedTests = this.results.tests.filter(t => t.status === 'FAIL');
    const passedTests = this.results.tests.filter(t => t.status === 'PASS');
    
    if (failedTests.length === 0 && passedTests.length > 0) {
      analysis.overallStatus = 'EXCELLENT';
      analysis.targetCompliance = 100;
    } else if (failedTests.length < passedTests.length) {
      analysis.overallStatus = 'GOOD';
      analysis.targetCompliance = 75;
    } else {
      analysis.overallStatus = 'NEEDS_IMPROVEMENT';
      analysis.targetCompliance = 25;
    }
    
    return analysis;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Analyze test results and generate recommendations
    this.results.tests.forEach(test => {
      if (test.status === 'FAIL') {
        recommendations.push({
          priority: 'HIGH',
          area: test.name,
          issue: 'Test suite failed',
          recommendation: 'Review and fix failing tests before deployment'
        });
      }
    });
    
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'LOW',
        area: 'Overall',
        issue: 'None',
        recommendation: 'All tests passing, ready for deployment'
      });
    }
    
    return recommendations;
  }

  displayFinalResults() {
    logHeader('📊 FINAL TEST RESULTS');
    
    // Display test suite results
    this.results.tests.forEach(test => {
      const statusIcon = test.status === 'PASS' ? '✅' : '❌';
      const statusColor = test.status === 'PASS' ? 'green' : 'red';
      
      log(`${statusIcon} ${test.name}:`, statusColor);
      log(`  Status: ${test.status}`);
      log(`  Duration: ${test.duration}ms`);
      log(`  Tests: ${test.passed}/${test.total} passed`);
      
      if (test.failed > 0) {
        log(`  Failures: ${test.failed}`, 'red');
      }
    });
    
    // Display summary
    const totalDuration = this.results.tests.reduce((sum, t) => sum + t.duration, 0);
    const successRate = this.calculateSuccessRate();
    
    logSection('Summary');
    log(`Total Duration: ${totalDuration}ms`);
    log(`Success Rate: ${successRate.toFixed(1)}%`);
    log(`Output Directory: ${config.outputDir}`);
    
    // Final status
    if (successRate === 100) {
      logSuccess('🎉 All tests passed! Performance targets met.');
    } else if (successRate >= 80) {
      logWarning('⚠️  Most tests passed, but some issues detected.');
    } else {
      logError('❌ Significant test failures detected.');
    }
  }
}

// Main execution
async function main() {
  const runner = new PerformanceTestRunner();
  
  // Handle command line arguments
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Performance Test Runner for Streaming Voice Pipeline

Usage: node test/run-performance-tests.js [options]

Options:
  --help, -h          Show this help message
  --verbose, -v       Enable verbose logging
  --output-dir <dir>  Specify output directory (default: test-results)
  --timeout <ms>      Set test timeout in milliseconds (default: 60000)

Examples:
  node test/run-performance-tests.js
  node test/run-performance-tests.js --verbose
  node test/run-performance-tests.js --output-dir custom-results
    `);
    process.exit(0);
  }
  
  // Parse options
  if (args.includes('--verbose') || args.includes('-v')) {
    global.testConfig.enableLogging = true;
  }
  
  const outputDirIndex = args.indexOf('--output-dir');
  if (outputDirIndex !== -1 && args[outputDirIndex + 1]) {
    config.outputDir = args[outputDirIndex + 1];
  }
  
  const timeoutIndex = args.indexOf('--timeout');
  if (timeoutIndex !== -1 && args[timeoutIndex + 1]) {
    config.testTimeout = parseInt(args[timeoutIndex + 1]);
  }
  
  try {
    await runner.run();
    process.exit(0);
  } catch (error) {
    logError(`Test runner failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default PerformanceTestRunner;
