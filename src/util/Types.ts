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
} from 'jsonld';
import type { RDF, RDFS, SHACL, SKL } from './Vocabularies';

export type JSONPrimitive =
  | string
  | number
  | boolean
  | null;
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export interface JSONObject {
  [key: string]: JSONValue | undefined;
}
export interface JSONArray extends Array<JSONValue> {}

export type JSONValue =
  | JSONPrimitive
  | JSONObject
  | JSONValue[];

export interface RdfList<T> {
  [RDF.first]: T;
  [RDF.rest]?: RdfList<T> | typeof RDF.nil | ReferenceNodeObject;
}

export interface ValueObject<T extends string | boolean | number | JSONObject | JSONArray> {
  ['@type']: string;
  ['@value']: T;
  ['@language']?: string;
  ['@direction']?: string;
}

export type IRIObject<T extends string = string> = { '@id': T };

export type ShaclIRI = string | IRIObject;
export type ShaclIRIOrLiteral = ShaclIRI | ValueObject<any>;

export type NodeKindValues =
| typeof SHACL.Literal
| typeof SHACL.IRI
| typeof SHACL.BlankNode
| typeof SHACL.BlankNodeOrIRI
| typeof SHACL.BlankNodeOrLiteral
| typeof SHACL.IRIOrLiteral;

export type BaseShape = NodeObject & {
  [SHACL.targetNode]?: ShaclIRIOrLiteral;
  [SHACL.targetClass]?: ShaclIRI;
  [SHACL.targetSubjectsOf]?: ShaclIRI;
  [SHACL.targetObjectOf]?: ShaclIRI;
  [SHACL.severity]?: ShaclIRI;
  [SHACL.message]?: OrArray<ValueObject<string>>;
  [SHACL.deactivated]?: ValueObject<boolean>;
  [SHACL.and]?: ShapesListShape;
  [SHACL.class]?: OrArray<ShaclIRI>;
  [SHACL.closed]?: ValueObject<boolean>;
  [SHACL.ignoredProperties]?: ShaclIRI[];
  [SHACL.disjoint]?: OrArray<ShaclIRI>;
  [SHACL.equals]?: OrArray<ShaclIRI>;
  [SHACL.in]?: ListObject;
  [SHACL.languageIn]?: string[];
  [SHACL.maxExclusive]?: ValueObject<number>;
  [SHACL.maxInclusive]?: ValueObject<number>;
  [SHACL.maxLength]?: ValueObject<number>;
  [SHACL.minExclusive]?: ValueObject<number>;
  [SHACL.minInclusive]?: ValueObject<number>;
  [SHACL.minLength]?: ValueObject<number>;
  [SHACL.nodeKind]?: IRIObject<NodeKindValues>;
  [SHACL.or]?: ShapesListShape;
  [SHACL.pattern]?: ValueObject<string>;
  [SHACL.flags]?: ValueObject<string>;
  [SHACL.xone]?: ShapesListShape;
};

export type ShapesListShape = (PropertyShape | NodeShape)[];

export interface PropertyShape extends BaseShape {
  [SHACL.path]: PathTypes;
  [SHACL.datatype]?: ShaclIRI;
  [SHACL.node]?: OrArray<NodeShape>;
  [SHACL.name]?: ValueObject<string>;
  [SHACL.description]?: ValueObject<string>;
  [SHACL.minCount]?: ValueObject<number>;
  [SHACL.maxCount]?: ValueObject<number>;
  [SHACL.lessThanOrEquals]?: OrArray<ShaclIRI>;
  [SHACL.lessThan]?: OrArray<ShaclIRI>;
  [SHACL.qualifiedValueShape]?: OrArray<BaseShape>;
  [SHACL.qualifiedMaxCount]?: ValueObject<number>;
  [SHACL.qualifiedMinCount]?: ValueObject<number>;
  [SHACL.qualifiedValueShapesDisjoint]?: ValueObject<boolean>;
  [SHACL.uniqueLang]?: ValueObject<boolean>;
}

export interface NodeShape extends BaseShape {
  '@type': typeof SHACL.NodeShape;
  [RDFS.label]?: ValueObject<string>;
  [SHACL.property]: OrArray<PropertyShape>;
}

export interface InverseShaclPath extends NodeObject {
  [SHACL.inversePath]: PathShape;
}

export interface ZeroOrMoreShaclPath extends NodeObject {
  [SHACL.zeroOrMorePath]: PathShape;
}

export interface OneOrMoreShaclPath extends NodeObject {
  [SHACL.oneOrMorePath]: PathShape;
}

export interface ZeroOrOneShaclPath extends NodeObject {
  [SHACL.zeroOrOnePath]: PathShape;
}

export interface AlternativeShaclPath extends NodeObject {
  [SHACL.alternativePath]: PathTypes[];
}

export type PathTypes =
| ShaclIRI
| AlternativeShaclPath
| ZeroOrMoreShaclPath
| OneOrMoreShaclPath
| ZeroOrOneShaclPath
| InverseShaclPath;

export type PathShape = OrArray<PathTypes>;

export type Verb = NodeObject & {
  '@id': string;
  '@type': typeof SKL.Verb;
  [RDFS.label]?: ValueObject<string>;
  [SKL.parametersContext]?: ValueObject<JSONObject>;
  [SKL.parameters]?: NodeShape | ReferenceNodeObject;
  [SKL.returnValue]?: NodeShape | ReferenceNodeObject;
};

export interface SeriesVerbArgs extends JSONObject {
  originalVerbParameters: JSONObject;
  previousVerbReturnValue: JSONObject;
}

export type Mapping = NodeObject & {
  [SKL.preProcessingMapping]?: OrArray<TriplesMap>;
  [SKL.preProcessingMappingFrame]?: ValueObject<JSONObject>;
  [SKL.parameterMapping]?: OrArray<TriplesMap>;
  [SKL.parameterMappingFrame]?: ValueObject<JSONObject>;
  [SKL.parameterReference]?: string | ValueObject<string>;
  [SKL.operationId]?: ValueObject<string>;
  [SKL.operationMapping]?: TriplesMap;
  [SKL.verbId]?: ValueObject<string> | string;
  [SKL.verbMapping]?: TriplesMap;
  [SKL.returnValueMapping]?: OrArray<TriplesMap>;
  [SKL.returnValueFrame]?: ValueObject<JSONObject>;
  [SKL.series]?: { '@list': VerbMapping[] } | (RdfList<VerbMapping> & NodeObject);
  [SKL.parallel]?: OrArray<VerbMapping>;
};

export type VerbMapping = Mapping & {
  [SKL.verb]: ReferenceNodeObject;
  [SKL.noun]?: ReferenceNodeObject;
  [SKL.integration]?: ReferenceNodeObject;
};

export type MappingWithParameterMapping = VerbMapping &
Required<Pick<VerbMapping, typeof SKL.parameterMapping | typeof SKL.parameterMappingFrame>>;

export type MappingWithParameterReference = VerbMapping &
Required<Pick<VerbMapping, typeof SKL.parameterReference>>;

export type MappingWithReturnValueMapping = VerbMapping &
Required<Pick<VerbMapping, typeof SKL.returnValueMapping | typeof SKL.returnValueFrame>>;

export type MappingWithSeries = VerbMapping &
Required<Pick<VerbMapping, typeof SKL.series>>;

export type MappingWithParallel = VerbMapping &
Required<Pick<VerbMapping, typeof SKL.parallel>>;

export type TriggerMapping = Mapping & {
  [SKL.integration]: ReferenceNodeObject;
};

export type PossibleArrayFieldValues =
  | boolean
  | number
  | string
  | NodeObject
  | GraphObject
  | ValueObject<any>
  | ListObject
  | SetObject;

export type EntityFieldSingularValue =
  | boolean
  | number
  | string
  | NodeObject
  | GraphObject
  | ValueObject<any>
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

export interface OperationResponse extends JSONObject {
  data: JSONObject;
  operationParameters: JSONObject;
}

export interface VerbConfig {
  /**
   * Callbacks to execute upon events.
   * If global callbacks are provided, both are executed.
   */
  callbacks?: Callbacks;
  /**
   * When true, disables validation of verb parameters and
   * return values according to schemas. Overrides the global setting.
   */
  readonly disableValidation?: boolean;
  /**
   * An object containing files keyed on their title that can be used in mappings.
   * Merged with the global setting. The verb config taking prededence in the case of overlapping names.
   */
  readonly inputFiles?: Record<string, string>;
  /**
   * Manually defined functions which can be used in mappings.
   * Merged with the global setting. The verb config taking prededence in the case of overlapping names.
   */
  readonly functions?: Record<string, (args: any | any[]) => any>;
}

export interface Callbacks {
  /**
   * Callback run when a Verb starts being executed
   */
  onVerbStart?: (verb: string, args: Record<string, any>) => void;
  /**
   * Callback run when a Verb is finished being executed
   */
  onVerbEnd?: (verb: string, returnValue: Record<string, any>) => void;
}
