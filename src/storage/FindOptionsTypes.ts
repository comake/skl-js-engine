/* eslint-disable capitalized-comments */
import type { FindOperator } from './FindOperator';

export type FindOptionsSelectByString = string[];

export type FindOptionsRelationsByString = string[];

export interface FindOneOptions {
  where?: FindOptionsWhere;
  // select?: FindOptionsSelect | FindOptionsSelectByString;
  // relations?: FindOptionsRelations;
  // order?: FindOptionsOrder;
}

export interface FindOptionsSelect {
  [k: string]: boolean | FindOptionsSelect;
}

export interface FindOptionsRelations {
  [k: string]: boolean | FindOptionsRelations;
}

export type FindOptionsOrderValue = 'ASC' | 'DESC' | 'asc' | 'desc' | 1 | -1;

export type FindOptionsOrder = Record<string, FindOptionsOrderValue>;

export type FieldPrimitiveValue = boolean | number | string;
// OrArray<boolean | number | string>;
export type FindOptionsWhereField = FieldPrimitiveValue | FindOptionsWhere | FindOperator<any>;

export type IdOrTypeFindOptionsWhereField = string | FindOperator<string>;

export interface FindOptionsWhere {
  type?: IdOrTypeFindOptionsWhereField;
  id?: IdOrTypeFindOptionsWhereField;
  [k: string]: FindOptionsWhereField | undefined;
}

export interface FindAllOptions extends FindOneOptions {
  offset?: number;
  limit?: number;
}
