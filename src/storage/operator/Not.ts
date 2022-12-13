import { FindOperator } from '../FindOperator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Not<T>(
  value: T | FindOperator<T>,
): FindOperator<T> {
  return new FindOperator<T>({
    operator: 'not',
    value,
  });
}
