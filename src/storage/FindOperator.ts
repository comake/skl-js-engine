export type FindOperatorType = 'in' | 'not' | 'equal';

export interface FindOperatorArgs<T> {
  operator: FindOperatorType;
  value: T | FindOperator<T>;
}

export class FindOperator<T> {
  public readonly type = 'operator';
  public readonly operator: FindOperatorType;
  public readonly value: T | FindOperator<T>;

  public constructor(args: FindOperatorArgs<T>) {
    this.operator = args.operator;
    this.value = args.value;
  }

  public static isFindOperator(value: any): boolean {
    return typeof value === 'object' &&
      'type' in value &&
      value.type === 'operator';
  }
}
