import { FindOperator } from '../../../../src/storage/FindOperator';
import { In } from '../../../../src/storage/operator/In';

jest.mock('../../../../src/storage/FindOperator');

describe('In', (): void => {
  it('constructs an in FindOperator.', (): void => {
    const operator = {};
    (FindOperator as unknown as jest.Mock).mockImplementation((): any => operator);
    expect(In([ 'https://example.com' ])).toBe(operator);
  });
});
