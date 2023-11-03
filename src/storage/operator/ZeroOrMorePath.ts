import { FindOperator } from '../FindOperator';

export interface ZeroOrMorePathValue<T> {
  subPath: string | FindOperator<any, 'sequencePath' | 'inversePath'>;
  value?: string | FindOperator<T, any>;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function ZeroOrMorePath<
  T,
  TI extends ZeroOrMorePathValue<T>
>(value: TI): FindOperator<TI, 'zeroOrMorePath'> {
  return new FindOperator({
    operator: 'zeroOrMorePath',
    value,
  });
}
