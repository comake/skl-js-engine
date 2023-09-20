import { FindOperator } from '../FindOperator';

export interface InversePathValue {
  subPath: string | FindOperator<any, 'sequencePath' | 'zeroOrMorePath' | 'oneOrMorePath'>;
  value?: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function InversePath<
  T extends InversePathValue
>(value: T): FindOperator<T, 'inversePath'> {
  return new FindOperator({
    operator: 'inversePath',
    value,
  });
}
