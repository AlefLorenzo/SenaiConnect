export default {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^lucide-react$': '<rootDir>/src/__mocks__/lucide-react.js',
    '^../context/AuthContext\\.jsx$': '<rootDir>/src/__mocks__/AuthContext.jsx',
    '^../context/SocketContext\\.jsx$': '<rootDir>/src/__mocks__/SocketContext.jsx',
    '^../services/storiesService$': '<rootDir>/src/__mocks__/storiesService.js',
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(lucide-react)/)',
  ],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/main.jsx',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
};