/* eslint-disable @typescript-eslint/naming-convention */
import type { OrArray } from '../util/Types';
import type { JSONArray, JSONObject } from '../util/Util';
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
  [k: string]: boolean | FindOptionsRelations | FindOperator<string>;
}

export type FindOptionsOrderValue = 'ASC' | 'DESC' | 'asc' | 'desc' | 1 | -1;

export type FindOptionsOrder = Record<string, FindOptionsOrderValue>;

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

export type ValueObject =
  | JsonValueObject
  | LanguageValueObject
  | NonJsonValueObject;

export type FindOptionsWhereField = OrArray<FieldPrimitiveValue> | ValueObject | FindOptionsWhere | FindOperator<any>;

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
