import { FindOperator } from '../FindOperator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Not<T>(
  value: T | FindOperator<T, any>,
): FindOperator<T, 'not'> {
  return new FindOperator({
    operator: 'not',
    value,
  });
}
