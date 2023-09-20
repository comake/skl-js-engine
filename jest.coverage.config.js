const jestConfig = require('./jest.config');

module.exports = {
  ...jestConfig,
  coverageThreshold: {
    './src': {
      branches: 89,
      functions: 93,
      lines: 93,
      statements: 92,
    },
  },
};
