import { FindOperator } from '../FindOperator';
import type { FindOptionsOrder, FindOptionsWhere } from '../FindOptionsTypes';

export interface InverseRelationOrderValue {
  order: FindOptionsOrder;
  where?: FindOptionsWhere;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function InverseRelationOrder(
  value: InverseRelationOrderValue,
): FindOperator<InverseRelationOrderValue> {
  return new FindOperator<InverseRelationOrderValue>({
    operator: 'inverseRelationOrder',
    value,
  });
}
