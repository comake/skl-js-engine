import type { ValueObject } from 'jsonld';
import { FindOperator } from '../FindOperator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function LessThanOrEqual<T extends number | Date | string | ValueObject>(
  value: T,
): FindOperator<T, 'lte'> {
  return new FindOperator({
    operator: 'lte',
    value,
  });
}
