import { FindOperator } from '../../../src/storage/FindOperator';

describe('A FindOperator', (): void => {
  it('can be constructed with a operator and value.', (): void => {
    const operator = new FindOperator({
      operator: 'in',
      value: [ 'https://example.com' ],
    });
    expect(operator.operator).toBe('in');
    expect(operator.value).toEqual([ 'https://example.com' ]);
  });

  describe('#isFindOperator', (): void => {
    it('returns true for FindOperators.', (): void => {
      const operator = new FindOperator({
        operator: 'in',
        value: [ 'https://example.com' ],
      });
      expect(FindOperator.isFindOperator(operator)).toBe(true);
      const manualOperator = {
        type: 'operator',
        operator: 'in',
      };
      expect(FindOperator.isFindOperator(manualOperator)).toBe(true);
    });

    it('returns false for non FindOperators.', (): void => {
      expect(FindOperator.isFindOperator(false)).toBe(false);
      expect(FindOperator.isFindOperator('string')).toBe(false);
      expect(FindOperator.isFindOperator(1)).toBe(false);
      expect(FindOperator.isFindOperator({ type: 'operation' })).toBe(false);
    });
  });
});
