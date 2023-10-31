import { FindOperator } from '../FindOperator';

export interface InversePathValue<T> {
  subPath: string | FindOperator<any, 'sequencePath' | 'zeroOrMorePath' | 'oneOrMorePath'>;
  value?: T | FindOperator<T, any>;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function InversePath<
  T,
  TI extends InversePathValue<T>
>(value: TI): FindOperator<TI, 'inversePath'> {
  return new FindOperator({
    operator: 'inversePath',
    value,
  });
}
