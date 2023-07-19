/* eslint-disable @typescript-eslint/naming-convention */
import type { ReferenceNodeObject, TriplesMap } from '@comake/rmlmapper-js';
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
import type { JSONObject } from './Util';
import type { SKL } from './Vocabularies';

export interface Verb extends NodeObject {
  '@id': string;
  '@type': typeof SKL.Verb;
  [SKL.parametersContext]?: ValueObject;
  [SKL.returnValue]?: NodeObject;
  [SKL.returnValueFrame]?: ValueObject;
  [SKL.series]?: NodeObject;
  [SKL.parallel]?: NodeObject;
  [SKL.returnValueMapping]?: OrArray<TriplesMap>;
}

export interface SeriesVerbArgs extends JSONObject {
  originalVerbParameters: JSONObject;
  previousVerbReturnValue: JSONObject;
}

export interface MappingWithParameterMapping extends NodeObject {
  [SKL.parameterMapping]: OrArray<TriplesMap>;
  [SKL.parameterMappingFrame]: NodeObject;
}

export interface MappingWithParameterReference extends NodeObject {
  [SKL.parameterReference]: string | ValueObject;
}

export interface MappingWithReturnValueMapping extends NodeObject {
  [SKL.returnValueMapping]: OrArray<TriplesMap>;
  [SKL.returnValueFrame]: NodeObject;
}

export interface MappingWithVerbMapping extends NodeObject {
  [SKL.verbId]?: ValueObject | string;
  [SKL.verbMapping]?: TriplesMap;
}

export interface MappingWithOperationMapping extends NodeObject {
  [SKL.constantOperationId]: ValueObject;
  [SKL.operationMapping]?: TriplesMap;
}

export interface VerbMapping extends
  MappingWithVerbMapping,
  Partial<MappingWithParameterMapping>,
  Partial<MappingWithParameterReference>,
  Partial<MappingWithReturnValueMapping> {}

export interface VerbIntegrationMapping extends
  Partial<MappingWithParameterReference>,
  Partial<MappingWithParameterMapping>,
  MappingWithOperationMapping,
  Partial<MappingWithReturnValueMapping> {
  [SKL.verb]: ReferenceNodeObject;
  [SKL.integration]: ReferenceNodeObject;
}

export interface VerbNounMapping extends
  Partial<MappingWithParameterReference>,
  Partial<MappingWithParameterMapping>,
  MappingWithVerbMapping,
  Partial<MappingWithReturnValueMapping> {
  [SKL.verb]: ReferenceNodeObject;
  [SKL.noun]: ReferenceNodeObject;
}

export interface TriggerVerbMapping extends
  MappingWithVerbMapping,
  Partial<MappingWithParameterReference>,
  Partial<MappingWithParameterMapping> {
  [SKL.integration]: ReferenceNodeObject;
}

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

export interface ErrorMatcher {
  status: number;
  messageRegex: string;
}

export interface OperationResponse extends JSONObject {
  data: JSONObject;
  operationParameters: JSONObject;
}
