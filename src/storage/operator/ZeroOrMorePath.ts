import { FindOperator } from '../FindOperator';

export interface ZeroOrMorePathValue {
  subPath: string | FindOperator<any, 'sequencePath' | 'inversePath'>;
  value?: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function ZeroOrMorePath<
  T extends ZeroOrMorePathValue
>(value: T): FindOperator<T, 'zeroOrMorePath'> {
  return new FindOperator({
    operator: 'zeroOrMorePath',
    value,
  });
}
