const jestConfig = require('./jest.config');

module.exports = {
  ...jestConfig,
  coverageThreshold: {
    './src': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
