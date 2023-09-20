import { FindOperator } from '../FindOperator';

export interface OneOrMorePathValue {
  subPath: string | FindOperator<any, 'sequencePath' | 'inversePath'>;
  value?: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function OneOrMorePath<
  T extends OneOrMorePathValue
>(value: T): FindOperator<T, 'oneOrMorePath'> {
  return new FindOperator({
    operator: 'oneOrMorePath',
    value,
  });
}
