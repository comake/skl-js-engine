import { FindOperator } from '../FindOperator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function LessThan<T extends number | Date | string>(
  value: T,
): FindOperator<T> {
  return new FindOperator<T>({
    operator: 'lt',
    value,
  });
}