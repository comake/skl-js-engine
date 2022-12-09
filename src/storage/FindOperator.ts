export type FindOperatorType = 'in';

export interface FindOperatorArgs<T> {
  operator: FindOperatorType;
  value: T | T[];
}

export class FindOperator<T> {
  public readonly type = 'operator';
  public readonly operator: FindOperatorType;
  public readonly value: T | T[];

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
