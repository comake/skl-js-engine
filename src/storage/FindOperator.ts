import { Variable } from "rdf-data-factory";

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
| 'contains'
| 'sequence';

export interface FindOperatorArgs<T, TType> {
  operator: TType;
  value?: T | FindOperator<T, any>;
  subject?: Variable;
  isOptional?: boolean;
}

export class FindOperator<T, TType extends FindOperatorType> {
  public readonly type = 'operator';
  public readonly operator: TType;
  public readonly subject?: Variable;
  public readonly value?: T | FindOperator<T, any>;
  public readonly isOptional?: boolean;
  public constructor(args: FindOperatorArgs<T, TType>) {
    this.operator = args.operator;
    this.value = args.value;
    this.subject = args.subject;
    this.isOptional = args.isOptional;
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
