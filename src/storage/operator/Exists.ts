import { FindOperator } from '../FindOperator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Exists(): FindOperator<undefined, 'exists'> {
  return new FindOperator({ operator: 'exists' });
}
