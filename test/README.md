# Streaming Voice Pipeline Test Suite

This directory contains comprehensive tests for the ultra-fast streaming voice bot pipeline, designed to verify the 2-4 second end-to-end response time targets.

## 🎯 Test Objectives

The test suite validates:

- **Performance Targets**: All timing requirements (≤80ms voice capture, ≤500ms STT, ≤120ms intent, ≤700ms LLM, ≤600ms TTS, ≤4s total)
- **Optimization Settings**: Configuration parameters that enable fast performance
- **Real-world Benchmarks**: Actual performance measurements against targets
- **Caching Performance**: TTS and context caching effectiveness
- **Concurrent Load**: Multiple simultaneous user sessions
- **Error Handling**: Graceful degradation and fallbacks

## 📁 Test Files

### Core Test Files

- **`streaming-voice-performance.test.js`** - Main performance tests for the streaming pipeline
- **`optimized-settings.test.js`** - Configuration and settings validation tests
- **`performance-benchmarks.test.js`** - Real-world performance measurements and benchmarks

### Configuration Files

- **`jest.config.js`** - Jest configuration optimized for performance testing
- **`setup.js`** - Test environment setup and utilities
- **`run-performance-tests.js`** - Test runner script with reporting

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Install Jest and testing tools
npm install --save-dev jest @jest/globals jest-junit
```

### Running Tests

#### Run All Tests
```bash
npm test
```

#### Run Specific Test Suites
```bash
# Performance tests only
npm test -- --testPathPattern="streaming-voice-performance"

# Settings tests only
npm test -- --testPathPattern="optimized-settings"

# Benchmark tests only
npm test -- --testPathPattern="performance-benchmarks"
```

#### Run with Performance Test Runner
```bash
# Run all performance tests with comprehensive reporting
node test/run-performance-tests.js

# Run with verbose logging
node test/run-performance-tests.js --verbose

# Custom output directory
node test/run-performance-tests.js --output-dir custom-results
```

## 📊 Performance Targets

The test suite validates these performance targets:

| Component | Target | Description |
|-----------|--------|-------------|
| Voice Capture | ≤80ms | Audio recording and endpointing |
| STT First Partial | ≤500ms | First transcript chunk |
| Intent Detection | ≤120ms | Local intent classification |
| LLM First Token | ≤700ms | First AI response token |
| TTS First Audio | ≤600ms | First audio chunk |
| Time to First Audio | ≤2.0s | End-to-end audio response |
| Total Response | ≤4.0s | Complete conversation cycle |

## 🧪 Test Categories

### 1. Performance Timing Tests
- Validates each pipeline stage meets timing targets
- Measures real-world performance against benchmarks
- Detects performance regressions

### 2. Optimization Settings Tests
- Verifies LLM parameters (temperature=0, maxTokens=200-300)
- Confirms CrewAI routing optimizations
- Validates TTS streaming and caching configuration

### 3. Caching Performance Tests
- Measures TTS cache hit rates
- Tests common phrase preloading
- Validates context caching effectiveness

### 4. Concurrent Load Tests
- Tests multiple simultaneous user sessions
- Validates performance under memory pressure
- Measures scalability characteristics

### 5. Integration Tests
- End-to-end pipeline performance
- Error handling and fallbacks
- Real-world usage scenarios

## 📈 Test Results

### Output Files

Tests generate several output files in the `test-results/` directory:

- **`performance-report.json`** - Detailed performance metrics
- **`junit.xml`** - JUnit format for CI/CD integration
- **`summary-report.json`** - High-level test summary

### Performance Metrics

Each test tracks:

- `t_first_partial` - Time to first STT transcript
- `t_first_token` - Time to first LLM token
- `t_first_audio` - Time to first TTS audio
- `t_play_start` - Time to audio playback start
- `t_end` - Total pipeline completion time

### Success Criteria

Tests pass when:

- All performance targets are met
- Caching provides 5x+ speedup
- Concurrent sessions complete within 2 seconds
- Error handling works gracefully

## 🔧 Test Configuration

### Environment Variables

```bash
# Enable performance testing
PERFORMANCE_TESTING=true

# Enable benchmark mode
BENCHMARK_MODE=true

# Enable verbose logging
NODE_ENV=test
```

### Jest Configuration

The Jest config is optimized for:

- **Sequential Execution**: `maxWorkers: 1` for accurate timing
- **Extended Timeouts**: 30 seconds for performance tests
- **Coverage Collection**: 85%+ coverage requirements
- **Performance Monitoring**: Built-in performance tracking

### Test Utilities

Global test utilities provide:

- **Performance Measurement**: `performanceUtils.measureAsync()`
- **Mock Data Generation**: `mockUtils.createMockAudioData()`
- **Performance Assertions**: `assertPerformance.meetsTarget()`
- **Test Helpers**: `testHelpers.waitFor()`, `testHelpers.retry()`

## 🐛 Troubleshooting

### Common Issues

#### Tests Failing Due to Timing
```bash
# Increase test timeout
npm test -- --testTimeout=60000

# Run with verbose logging
npm test -- --verbose
```

#### Performance Targets Not Met
```bash
# Check system resources
# Verify API keys are configured
# Ensure external services are accessible
```

#### Mock Dependencies Issues
```bash
# Clear Jest cache
npm test -- --clearCache

# Reset mocks
npm test -- --resetMocks
```

### Debug Mode

Enable debug logging:

```bash
# Set environment variable
export DEBUG=true

# Run tests with debug output
npm test -- --verbose
```

## 📋 Test Commands

### NPM Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:performance": "jest --testPathPattern='streaming-voice-performance'",
    "test:settings": "jest --testPathPattern='optimized-settings'",
    "test:benchmarks": "jest --testPathPattern='performance-benchmarks'",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "test:performance:runner": "node test/run-performance-tests.js"
  }
}
```

### Direct Jest Commands

```bash
# Run with coverage
jest --coverage --collectCoverageFrom="src/lib/*.js"

# Run specific test file
jest test/streaming-voice-performance.test.js

# Run with custom config
jest --config test/jest.config.js
```

## 🔍 Performance Analysis

### Benchmark Results

The test suite provides:

- **Performance Scores**: 0-100 scale based on target compliance
- **Trend Analysis**: Performance improvements/regressions over time
- **Recommendations**: Specific optimization suggestions
- **Comparative Metrics**: Before/after optimization measurements

### Performance Regression Detection

Tests automatically detect:

- Performance degradation >20% from baseline
- Cache hit rate decreases
- Concurrent session performance drops
- Individual component slowdowns

## 🚀 Continuous Integration

### CI/CD Integration

Tests are designed for CI/CD pipelines:

- **JUnit Output**: Compatible with Jenkins, GitLab CI, GitHub Actions
- **Performance Thresholds**: Fail builds on performance regressions
- **Coverage Requirements**: Enforce minimum coverage standards
- **Automated Reporting**: Generate performance reports automatically

### GitHub Actions Example

```yaml
- name: Run Performance Tests
  run: |
    npm install
    npm run test:performance:runner
    
- name: Upload Test Results
  uses: actions/upload-artifact@v2
  with:
    name: test-results
    path: test-results/
```

## 📚 Additional Resources

### Documentation

- [Streaming Voice Pipeline README](../README.md)
- [Performance Optimization Guide](../PERFORMANCE_OPTIMIZATION.md)
- [API Reference](../API_REFERENCE.md)

### Related Tests

- [Unit Tests](../src/**/*.test.js)
- [Integration Tests](../src/**/*.integration.test.js)
- [E2E Tests](../e2e/**/*.test.js)

### Performance Monitoring

- [Performance Dashboard](../src/components/daive/PerformanceDashboard.tsx)
- [Real-time Metrics](../src/lib/performanceMonitor.js)
- [Performance Analytics](../src/lib/performanceAnalytics.js)

## 🤝 Contributing

### Adding New Tests

1. Follow the existing test structure
2. Use global test utilities for consistency
3. Include performance measurements
4. Add appropriate error handling
5. Update this README

### Test Naming Convention

- **Performance Tests**: `*.performance.test.js`
- **Settings Tests**: `*.settings.test.js`
- **Benchmark Tests**: `*.benchmarks.test.js`
- **Integration Tests**: `*.integration.test.js`

### Performance Test Template

```javascript
test('should meet performance target', async () => {
  const { result, duration } = await performanceUtils.measureAsync(
    async () => {
      // Test implementation
      return 'result';
    },
    'Test Description'
  );
  
  assertPerformance.meetsTarget(duration, target, 'Component Name');
  expect(result).toBeDefined();
});
```

## 📞 Support

For test-related issues:

1. Check the troubleshooting section above
2. Review test output and error messages
3. Verify test configuration and dependencies
4. Check system resources and API access
5. Review performance baseline data

---

**Note**: These tests are designed to validate the ultra-fast streaming voice pipeline. Ensure your system meets the performance requirements and has access to all required external services before running the test suite.
