import type { ValueObject } from 'jsonld';
import { FindOperator } from '../FindOperator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function GreaterThan<T extends number | Date | string | ValueObject>(
  value: T,
): FindOperator<T, 'gt'> {
  return new FindOperator({
    operator: 'gt',
    value,
  });
}
