import type { ValueObject } from 'jsonld';
import { FindOperator } from '../FindOperator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function In<T extends number | Date | string | boolean | ValueObject>(
  value: T[],
): FindOperator<T[]> {
  return new FindOperator<T[]>({
    operator: 'in',
    value,
  });
}
