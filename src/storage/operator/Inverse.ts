import { FindOperator } from '../FindOperator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Inverse<T>(
  value: T | FindOperator<T, any>,
): FindOperator<T, 'inverse'> {
  return new FindOperator({
    operator: 'inverse',
    value,
  });
}
