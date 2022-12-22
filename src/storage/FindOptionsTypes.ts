import type { OrArray } from '../util/Types';
import type { FindOperator } from './FindOperator';

export type FindOptionsSelectByString = string[];

export type FindOptionsRelationsByString = string[];

export type FindOptionsSelect = FindOptionsSelectByString | {[key: string]: boolean | FindOptionsSelect };

export interface FindOneOptions {
  select?: FindOptionsSelect;
  where?: FindOptionsWhere;
  relations?: FindOptionsRelations;
  order?: FindOptionsOrder;
}

export interface FindOptionsRelations {
  [k: string]: boolean | FindOptionsRelations;
}

export type FindOptionsOrderValue = 'ASC' | 'DESC' | 'asc' | 'desc' | 1 | -1;

export type FindOptionsOrder = Record<string, FindOptionsOrderValue>;

export type FieldPrimitiveValue = boolean | number | string;

export type FindOptionsWhereField = OrArray<FieldPrimitiveValue> | FindOptionsWhere | FindOperator<any>;

export type IdOrTypeFindOptionsWhereField = string | FindOperator<string> | FindOperator<string[]>;

export interface FindOptionsWhere {
  type?: IdOrTypeFindOptionsWhereField;
  id?: IdOrTypeFindOptionsWhereField;
  [k: string]: FindOptionsWhereField | undefined;
}

export interface FindAllOptions extends FindOneOptions {
  offset?: number;
  limit?: number;
}
