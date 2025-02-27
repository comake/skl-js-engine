/* eslint-disable @typescript-eslint/naming-convention */
import type { Expression, Variable } from 'sparqljs';
import type { OrArray, JSONArray, JSONObject } from '../util/Types';
import type { FindOperator } from './FindOperator';
import type { InverseRelationOperatorValue } from './operator/InverseRelation';
import type { InverseRelationOrderValue } from './operator/InverseRelationOrder';

export type FindOptionsSelect = string[] | {[key: string]: boolean | FindOptionsSelect };

export interface FindOneOptions {
  select?: FindOptionsSelect;
  where?: FindOptionsWhere;
  relations?: FindOptionsRelations;
  order?: FindOptionsOrder;
  skipFraming?: boolean;
  group?: Variable;
  entitySelectVariable?: Variable;
}

export type FindOptionsRelationsValue = |
boolean |
FindOptionsRelations |
FindOperator<InverseRelationOperatorValue, 'inverseRelation'>;

// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export type FindOptionsRelations = {
  [k: string]: FindOptionsRelationsValue;
};

export type FindOptionsOrderValue = 'ASC' | 'DESC' | 'asc' | 'desc' | 1 | -1;

export type FindOptionsOrder =
  Record<string, FindOptionsOrderValue | FindOperator<InverseRelationOrderValue, 'inverseRelationOrder'>>;

export type FieldPrimitiveValue = boolean | number | string | Date;

export type JsonValueObject = {
  '@value': FieldPrimitiveValue | JSONObject | JSONArray;
  '@type': '@json';
};

export type LanguageValueObject = {
  '@value': string;
  '@language': string;
  '@direction': string;
};

export type NonJsonValueObject = {
  '@value': FieldPrimitiveValue;
  '@type': string;
};

export type ValueWhereFieldObject =
  | JsonValueObject
  | LanguageValueObject
  | NonJsonValueObject;

export type FindOptionsWhereField =
| OrArray<FieldPrimitiveValue>
| ValueWhereFieldObject
| FindOptionsWhere
| OrArray<FindOperator<any, any>>
| BindPattern[];

export type IdFindOptionsWhereField =
| string
| FindOperator<any, 'in' | 'not' | 'equal' | 'inversePath' | 'contains'>;

export type TypeFindOptionsWhereField =
| string
| FindOperator<string | string[] | FindOptionsWhere, 'in' | 'not' | 'equal' | 'inverse' | 'contains'>;

export interface BindPattern {
  expression: Expression;
  variable: Variable;
}

export interface FindOptionsWhere {
  type?: TypeFindOptionsWhereField;
  id?: IdFindOptionsWhereField;
  binds?: BindPattern[];
  [k: string]: FindOptionsWhereField | BindPattern[] | undefined;
}

// Add these new types
export interface SubQuery {
  select: Variable[];
  where: FindOptionsWhere;
  groupBy?: string[];
  having?: FindOptionsWhere;
}

export interface FindAllOptions extends FindOneOptions {
  offset?: number;
  limit?: number;
  subQueries?: SubQuery[];
}

export interface FindExistsOptions {
  where?: FindOptionsWhere;
  relations?: FindOptionsRelations;
}

export interface FindCountOptions {
  where?: FindOptionsWhere;
  relations?: FindOptionsRelations;
  order?: FindOptionsOrder;
  offset?: number;
}
