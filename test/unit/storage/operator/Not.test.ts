import { FindOperator } from '../../../../src/storage/FindOperator';
import { Not } from '../../../../src/storage/operator/Not';

jest.mock('../../../../src/storage/FindOperator');

describe('Not', (): void => {
  it('constructs a not FindOperator.', (): void => {
    const operator = {};
    (FindOperator as unknown as jest.Mock).mockImplementation((): any => operator);
    expect(Not([ 'https://example.com' ])).toBe(operator);
  });
});
