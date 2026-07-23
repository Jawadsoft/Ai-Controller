// Jest Configuration for Streaming Voice Pipeline Tests
// Optimized for performance testing and real-world benchmarks

export default {
  // Test environment
  testEnvironment: 'node',
  
  // File patterns to test
  testMatch: [
    '**/test/**/*.test.js',
    '**/test/**/*.test.ts',
    '**/test/**/*.spec.js',
    '**/test/**/*.spec.ts'
  ],
  
  // File patterns to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/'
  ],
  
  // Collect coverage from these files
  collectCoverageFrom: [
    'src/lib/streamingVoiceService.js',
    'src/lib/optimizedCrewAI.js',
    'src/lib/optimizedTTSService.js',
    'src/routes/streamingVoice.js',
    'src/components/daive/StreamingVoiceRecorder.tsx',
    'src/components/daive/PerformanceDashboard.tsx'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],
  
  // Test timeout (increased for performance benchmarks)
  testTimeout: 30000,
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  
  // Global test setup
  globalSetup: '<rootDir>/test/globalSetup.js',
  
  // Global test teardown
  globalTeardown: '<rootDir>/test/globalTeardown.js',
  
  // Test reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ],
  
  // Performance testing specific settings
  maxWorkers: 1, // Run tests sequentially for accurate performance measurement
  
  // Verbose output for performance tests
  verbose: true,
  
  // Collect performance metrics
  collectCoverage: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Reset modules between tests
  resetModules: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Module name mapping for ES modules
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
        '@babel/preset-react'
      ]
    }]
  },
  
  // Module file extensions
  moduleFileExtensions: [
    'js',
    'jsx',
    'ts',
    'tsx',
    'json'
  ],
  
  // Test environment variables
  testEnvironmentOptions: {
    NODE_ENV: 'test',
    PERFORMANCE_TESTING: 'true',
    BENCHMARK_MODE: 'true'
  },
  
  // Performance testing hooks
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  
  // Extensions to treat as ES modules
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  
  // Performance monitoring
  notify: true,
  notifyMode: 'always',
  
  // Test results output
  outputDirectory: 'test-results',
  
  // Performance thresholds
  performanceThresholds: {
    // Audio processing
    audioChunkProcessing: 80,
    voiceCapture: 80,
    
    // Intent detection
    intentDetection: 120,
    
    // LLM processing
    llmFirstToken: 700,
    
    // TTS generation
    ttsFirstAudio: 600,
    
    // Pipeline performance
    timeToFirstAudio: 2000,
    totalResponse: 4000,
    
    // Concurrent performance
    concurrentSessions: 2000
  }
};
