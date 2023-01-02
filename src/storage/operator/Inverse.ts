import { FindOperator } from '../FindOperator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Inverse<T>(
  value: T | FindOperator<T>,
): FindOperator<T> {
  return new FindOperator<T>({
    operator: 'inverse',
    value,
  });
}
