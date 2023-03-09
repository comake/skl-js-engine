const jestConfig = require('./jest.config');

module.exports = {
  ...jestConfig,
  coverageThreshold: {
    './src': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
};
