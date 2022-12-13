import { FindOperator } from '../../../../src/storage/FindOperator';
import { Equal } from '../../../../src/storage/operator/Equal';

jest.mock('../../../../src/storage/FindOperator');

describe('Equal', (): void => {
  it('constructs an equal FindOperator.', (): void => {
    const operator = {};
    (FindOperator as unknown as jest.Mock).mockImplementation((): any => operator);
    expect(Equal([ 'https://example.com' ])).toBe(operator);
  });
});
