const jestConfig = require('./jest.config');

module.exports = {
  ...jestConfig,
  coverageThreshold: {
    './src': {
      branches: 89,
      functions: 93,
      lines: 92,
      statements: 92,
    },
  },
};
