/* eslint-disable @typescript-eslint/naming-convention */
import type {
  GraphObject,
  IdMap,
  IncludedBlock,
  IndexMap,
  LanguageMap,
  ListObject,
  NodeObject,
  SetObject,
  TypeMap,
  ValueObject,
} from 'jsonld';

export type PossibleArrayFieldValues =
  | boolean
  | number
  | string
  | NodeObject
  | GraphObject
  | ValueObject
  | ListObject
  | SetObject;

export type EntityFieldSingularValue =
  | boolean
  | number
  | string
  | NodeObject
  | GraphObject
  | ValueObject
  | ListObject
  | SetObject;

export type EntityFieldValue =
  | OrArray<EntityFieldSingularValue>
  | LanguageMap
  | IndexMap
  | IncludedBlock
  | IdMap
  | TypeMap
  | NodeObject[keyof NodeObject];

export interface Entity {
  '@id': string;
  '@type': OrArray<string>;
  [key: string]: EntityFieldValue;
}

export type OrArray<T> = T | T[];
