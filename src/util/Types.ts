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
export interface JSONArray extends Array<JSONValue> { }

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

export type Capability = NodeObject & {
  '@id': string;
  '@type': typeof SKL.Capability;
  [RDFS.label]?: ValueObject<string>;
  [SKL.inputsContext]?: ValueObject<JSONObject>;
  [SKL.inputs]?: NodeShape | ReferenceNodeObject;
  [SKL.outputsContext]?: ValueObject<JSONObject>;
  [SKL.outputs]?: NodeShape | ReferenceNodeObject;
};

export interface SeriesCapabilityArgs extends JSONObject {
  originalCapabilityParameters: JSONObject;
  previousCapabilityReturnValue: JSONObject;
}

export type Mapping = NodeObject & {
  [SKL.preProcessingMapping]?: OrArray<TriplesMap>;
  [SKL.preProcessingMappingFrame]?: ValueObject<JSONObject>;
  [SKL.inputsMapping]?: OrArray<TriplesMap>;
  [SKL.inputsMappingFrame]?: ValueObject<JSONObject>;
  [SKL.inputsReference]?: string | ValueObject<string>;
  [SKL.operationId]?: ValueObject<string>;
  [SKL.operationMapping]?: TriplesMap;
  [SKL.capabilityId]?: ValueObject<string> | string;
  [SKL.capabilityMapping]?: TriplesMap;
  [SKL.outputsMapping]?: OrArray<TriplesMap>;
  [SKL.outputsMappingFrame]?: ValueObject<JSONObject>;
  [SKL.outputsReference]?: string | ValueObject<string>;
  [SKL.series]?: { '@list': CapabilityMapping[] } | (RdfList<CapabilityMapping> & NodeObject);
  [SKL.parallel]?: OrArray<CapabilityMapping>;
};

export type CapabilityMapping = Mapping & {
  [SKL.capability]: ReferenceNodeObject;
  [SKL.object]?: ReferenceNodeObject;
  [SKL.integratedProduct]?: ReferenceNodeObject;
};

export type MappingWithInputs = CapabilityMapping &
  Required<Pick<CapabilityMapping, typeof SKL.inputs | typeof SKL.inputsMapping>>;

export type MappingWithInputsReference = CapabilityMapping &
  Required<Pick<CapabilityMapping, typeof SKL.inputsReference>>;

export type MappingWithOutputsMapping = CapabilityMapping &
  Required<Pick<CapabilityMapping, typeof SKL.outputsMapping | typeof SKL.outputsMappingFrame>>;

export type MappingWithSeries = CapabilityMapping &
  Required<Pick<CapabilityMapping, typeof SKL.series>>;

export type MappingWithParallel = CapabilityMapping &
  Required<Pick<CapabilityMapping, typeof SKL.parallel>>;

export type TriggerMapping = Mapping & {
  [SKL.integratedProduct]: ReferenceNodeObject;
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

export interface CapabilityConfig {
  /**
   * Callbacks to execute upon events.
   * If global callbacks are provided, both are executed.
   */
  callbacks?: Callbacks;
  /**
   * When true, disables validation of capability parameters and
   * return values according to schemas. Overrides the global setting.
   */
  readonly disableValidation?: boolean;
  /**
   * An object containing files keyed on their title that can be used in mappings.
   * Merged with the global setting. The capability config taking prededence in the case of overlapping names.
   */
  readonly inputFiles?: Record<string, string>;
  /**
   * Manually defined functions which can be used in mappings.
   * Merged with the global setting. The capability config taking prededence in the case of overlapping names.
   */
  readonly functions?: Record<string, (args: any | any[]) => any>;
}

export interface Callbacks {
  /**
   * Callback run when a Capability starts being executed
   */
  onCapabilityStart?: (capability: string, args: Record<string, any>) => void;
  /**
   * Callback run when a Capability is finished being executed
   */
  onCapabilityEnd?: (capability: string, returnValue: Record<string, any>) => void;
}
