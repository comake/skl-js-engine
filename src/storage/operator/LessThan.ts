import type { ValueObject } from 'jsonld';
import { FindOperator } from '../FindOperator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function LessThan<T extends number | Date | string | ValueObject>(
  value: T,
): FindOperator<T, 'lt'> {
  return new FindOperator({
    operator: 'lt',
    value,
  });
}
