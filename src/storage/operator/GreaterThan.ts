import { FindOperator } from '../FindOperator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function GreaterThan<T>(
  value: T,
): FindOperator<T> {
  return new FindOperator<T>({
    operator: 'gt',
    value,
  });
}
