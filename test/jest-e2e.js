const { join } = require('path');

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: join(__dirname, '..'), // project root, not test/
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^prisma/(.*)$': '<rootDir>/prisma/$1',
  },
};
