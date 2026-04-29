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
    [
      'allure-jest',
      {
        resultsDir: 'allure-results',
        testMode: true,
      },
    ],
  ],
};
