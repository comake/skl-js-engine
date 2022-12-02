/* eslint-disable @typescript-eslint/indent */
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
  | null
  | boolean
  | number
  | string
  | NodeObject
  | GraphObject
  | ValueObject
  | ListObject
  | SetObject;

export type EntityFieldValue =
  | OrArray<
    | null
    | boolean
    | number
    | string
    | NodeObject
    | GraphObject
    | ValueObject
    | ListObject
    | SetObject
  >
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
