/**
 * Configuration Jest — Tests de sécurité FileZen
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/security/**/*.test.js'],
  testTimeout: 30000,
  verbose: true,

  reporters: [
    'default',
  ],

  testEnvironment: 'allure-jest/node',
  testEnvironmentOptions: {
    resultsDir: 'allure-results',
  },
};
