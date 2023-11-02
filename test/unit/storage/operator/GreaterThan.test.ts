import { FindOperator } from '../../../../src/storage/FindOperator';
import { GreaterThan } from '../../../../src/storage/operator/GreaterThan';

jest.mock('../../../../src/storage/FindOperator');

describe('GreaterThan', (): void => {
  it('constructs an greater than FindOperator.', (): void => {
    const operator = {};
    (FindOperator as unknown as jest.Mock).mockImplementation((): any => operator);
    expect(GreaterThan(3)).toBe(operator);
  });
});
