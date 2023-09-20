import { FindOperator } from '../FindOperator';
import type { FindOptionsRelations } from '../FindOptionsTypes';

export interface InverseRelationOperatorValue {
  resolvedName: string;
  relations?: FindOptionsRelations;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function InverseRelation(
  value: InverseRelationOperatorValue,
): FindOperator<InverseRelationOperatorValue, 'inverseRelation'> {
  return new FindOperator({
    operator: 'inverseRelation',
    value,
  });
}
