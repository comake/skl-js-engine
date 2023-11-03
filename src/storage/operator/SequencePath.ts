import { FindOperator } from '../FindOperator';

export interface SequencePathValue<T> {
  subPath: (string | FindOperator<any, 'zeroOrMorePath' | 'inversePath' | 'oneOrMorePath'>)[];
  value?: string | FindOperator<T, any>;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function SequencePath<
  T,
  TI extends SequencePathValue<T>
>(value: TI): FindOperator<TI, 'sequencePath'> {
  return new FindOperator({
    operator: 'sequencePath',
    value,
  });
}
