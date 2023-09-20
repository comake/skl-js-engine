import { FindOperator } from '../FindOperator';

export interface SequencePathValue {
  subPath: (string | FindOperator<any, 'zeroOrMorePath' | 'inversePath' | 'oneOrMorePath'>)[];
  value?: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function SequencePath<
  T extends SequencePathValue
>(value: T): FindOperator<T, 'sequencePath'> {
  return new FindOperator({
    operator: 'sequencePath',
    value,
  });
}
