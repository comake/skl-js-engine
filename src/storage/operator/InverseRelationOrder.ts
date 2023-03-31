import { FindOperator } from '../FindOperator';
import type { FindOptionsOrder } from '../FindOptionsTypes';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function InverseRelationOrder(
  value: FindOptionsOrder,
): FindOperator<FindOptionsOrder> {
  return new FindOperator<FindOptionsOrder>({
    operator: 'inverseRelationOrder',
    value,
  });
}
