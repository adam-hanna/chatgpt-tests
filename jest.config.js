module.exports = {
    // Specify the root directory for tests
    roots: ['<rootDir>/src'],
    
    // Match your specific test pattern
    testMatch: ['**/*.ut.test.ts'],
    
    // Set up TypeScript handling
    preset: 'ts-jest',
    testEnvironment: 'node',
    
    // Coverage configuration
    collectCoverage: true,
    collectCoverageFrom: [
      'src/**/*.{ts,tsx,js,jsx}',
      '!src/**/*.d.ts',
      '!**/node_modules/**',
      '!**/dist/**'
    ],
    coverageDirectory: 'coverage',
    
    // Set reasonable timeouts
    testTimeout: 10000,
    
    // Make output nicer
    verbose: true
  };