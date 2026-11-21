module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/jest.config.js',
    '!**/jest.setup.js',
  ],
  coverageDirectory: 'coverage',
  moduleFileExtensions: ['js', 'json', 'node'],
  transform: {},
};