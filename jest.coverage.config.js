const jestConfig = require('./jest.config');

module.exports = {
  ...jestConfig,
  coverageThreshold: {
    './src': {
      branches: 99,
      functions: 99,
      lines: 99,
      statements: 99,
    },
  },
};
