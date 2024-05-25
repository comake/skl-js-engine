export type FindOperatorType =
| 'in'
| 'not'
| 'equal'
| 'exists'
| 'gt'
| 'gte'
| 'lt'
| 'lte'
| 'inverse'
| 'inverseRelation'
| 'inverseRelationOrder'
| 'sequencePath'
| 'zeroOrMorePath'
| 'inversePath'
| 'oneOrMorePath'
| 'contains';

export interface FindOperatorArgs<T, TType> {
  operator: TType;
  value?: T | FindOperator<T, any>;
}

export class FindOperator<T, TType extends FindOperatorType> {
  public readonly type = 'operator';
  public readonly operator: TType;
  public readonly value?: T | FindOperator<T, any>;

  public constructor(args: FindOperatorArgs<T, TType>) {
    this.operator = args.operator;
    this.value = args.value;
  }

  public static isFindOperator(value: any): boolean {
    return typeof value === 'object' &&
      'type' in value &&
      value.type === 'operator';
  }

  public static isPathOperator(operator: FindOperator<any, any>): boolean {
    return operator.operator === 'inversePath' ||
      operator.operator === 'zeroOrMorePath' ||
      operator.operator === 'sequencePath' ||
      operator.operator === 'zeroOrMorePath';
  }
}
