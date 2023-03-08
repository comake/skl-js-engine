import type { ValueObject } from 'jsonld';
import type { OrArray } from '../../util/Types';
import { FindOperator } from '../FindOperator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Equal<T extends OrArray<number | Date | string | boolean | ValueObject>>(
  value: T,
): FindOperator<T> {
  return new FindOperator<T>({
    operator: 'equal',
    value,
  });
}
