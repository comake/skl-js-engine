import { FindOperator } from '../FindOperator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Sequence<T>(
  value: T | FindOperator<T, any>,
): FindOperator<T, 'sequence'> {
  return new FindOperator({
    operator: 'sequence',
    value,
  });
}
