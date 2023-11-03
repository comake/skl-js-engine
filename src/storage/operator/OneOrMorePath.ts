import { FindOperator } from '../FindOperator';

export interface OneOrMorePathValue<T> {
  subPath: string | FindOperator<any, 'sequencePath' | 'inversePath'>;
  value?: string | FindOperator<T, any>;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function OneOrMorePath<
  T,
  TI extends OneOrMorePathValue<T>
>(value: TI): FindOperator<TI, 'oneOrMorePath'> {
  return new FindOperator({
    operator: 'oneOrMorePath',
    value,
  });
}
