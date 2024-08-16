import { FindOperator } from '../FindOperator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Contains(value: string): FindOperator<string, 'contains'> {
  return new FindOperator({
    operator: 'contains',
    value,
  });
}
