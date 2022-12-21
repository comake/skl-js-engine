import { FindOperator } from '../FindOperator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function GreaterThanOrEqual<T>(
  value: T,
): FindOperator<T> {
  return new FindOperator<T>({
    operator: 'gte',
    value,
  });
}
