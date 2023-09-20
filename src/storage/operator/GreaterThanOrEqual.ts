import type { ValueObject } from 'jsonld';
import { FindOperator } from '../FindOperator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function GreaterThanOrEqual<T extends number | Date | string | ValueObject>(
  value: T,
): FindOperator<T, 'gte'> {
  return new FindOperator({
    operator: 'gte',
    value,
  });
}
