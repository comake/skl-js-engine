type Namespace<T extends string, TBase extends string> = {
  [key in T]: `${TBase}${key}`
};

function createNamespace<T extends string, TBase extends string>(
  baseUri: TBase,
  localNames: T[],
): Namespace<T, TBase> {
  return localNames.reduce((obj: Namespace<T, TBase>, localName): Namespace<T, TBase> => (
    { ...obj, [localName]: `${baseUri}${localName}` }
  // eslint-disable-next-line @typescript-eslint/prefer-reduce-type-parameter
  ), {} as Namespace<T, TBase>);
}

// export const SKL_NAMESPACE = 'https://standardknowledge.com/ontologies/core/';
// export const SKL = createNamespace(SKL_NAMESPACE, [
//   'Verb',
//   'Noun',
//   'Mapping',
//   'Parameters',
//   'VerbIntegrationMapping',
//   'NounInterfaceMapping',
//   'OpenApiDescription',
//   'Account',
//   'SecurityCredentials',
//   'InterfaceComponent',
//   'Folder',
//   'OpenApiSecuritySchemeVerb',
//   'NounMappedVerb',
//   'VerbNounMapping',
//   'CompositeVerbMapping',
//   'JsonDataSource',
//   'Integration',
//   'verb',
//   'account',
//   'integration',
//   'parameters',
//   'operationMapping',
//   'parameterReference',
//   'parameterMapping',
//   'parameterMappingFrame',
//   'returnValueMapping',
//   'returnValueFrame',
//   'verbMapping',
//   'openApiDescription',
//   'accessToken',
//   'bearerToken',
//   'refreshToken',
//   'apiKey',
//   'sourceId',
//   'returnValue',
//   'parametersContext',
//   'sourceUrl',
//   'interface',
//   'noun',
//   'propertiesMapping',
//   'styling',
//   'designTokens',
//   'iterate',
//   'iterateItemAccessor',
//   'clientId',
//   'IntegrationSyncConfiguration',
//   'syncStepDefaultArgs',
//   'syncSteps',
//   'TokenPaginatedCollection',
//   'PaginatedCollection',
//   'File',
//   'Event',
//   'schemeName',
//   'oauthFlow',
//   'stage',
//   'operationId',
//   'clientSecret',
//   'invalidTokenErrorMatcher',
//   'getOauthTokens',
//   'records',
//   'overrideBasePath',
//   'dataSource',
//   'data',
//   'source',
//   'TriggerVerbMapping',
//   'series',
//   'parallel',
//   'constantOperationId',
//   'verbId',
//   'preProcessingMapping',
//   'preProcessingMappingFrame',
//   'jwtBearerOptions',
//   'invalidTokenErrorMatcher',
//   'InvalidTokenErrorMatcher',
//   'invalidTokenErrorMatcherStatus',
//   'invalidTokenErrorMatcherMessageRegex',
//   'Dataview',
//   'Entity',
//   'query',
//   'getOpenApiRuntimeAuthorization',
//   'headers',
// ]);

export const SKL_NAMESPACE_V2 = 'https://skl.so/';
export const SKL = createNamespace(SKL_NAMESPACE_V2, [
  'Capability',
  'CapabilityMapping',
  'capability',
  'capabilityType',
  'TriggerCapabilityMapping',
  'capabilityId',
  'capabilityMapping',
  'integratedProduct',
  'inputs',
  'outputs',
  'inputContext',
  'outputContext',
  'invalidTokenErrorMatcher',
  'InvalidTokenErrorMatcher',
  'invalidTokenErrorMatcherStatus',
  'invalidTokenErrorMatcherMessageRegex',
  'getOauthTokens',
  'refreshToken',
  'jwtBearerOptions',
  'accessToken',
  'bearerToken',
  'clientId',
  'clientSecret',
  'schemeName',
  'oauthFlow',
  'stage',
  'operationId',
  'JsonDataSource',
  'data',
  'source',
  'TriggerVerbMapping',
  'series',
  'parallel',
  'constantOperationId',
  'verbId',
  'apiKey',
  'overrideBasePath',
  'headers',
  'object',
  'OpenApiDescription',
  'openApiDescription',
  'SecurityCredentials',
  'securityCredentials',
  'account',
  'inputsReference',
  'inputsMapping',
  'inputsMappingFrame',
  'outputsReference',
  'outputsMapping',
  'outputsMappingFrame',
  'preProcessingMapping',
  'preProcessingMappingFrame',
  'operationMapping',
  'dataSource',
  'Mapping',
  'Inputs',
  'Outputs',
  'File',
  'sourceId',
  'Event',
  'records',
]);

export const SKL_V2 = SKL;

export const SKLSO_DATA_NAMESPACE = 'https://skl.so/d/';

export const SKLSO_PROPERTY_NAMESPACE = 'https://skl.so/';
export const SKLSO_PROPERTY = createNamespace(SKLSO_PROPERTY_NAMESPACE, [
  'type',
  'identifier',
]);

export const SKL_ENGINE_NAMESPACE = 'https://standardknowledge.com/ontologies/skl-engine/';
export const SKL_ENGINE = createNamespace(SKL_ENGINE_NAMESPACE, [
  'update',
  'findAll',
  'findAllBy',
  'find',
  'findBy',
  'exists',
  'existsResult',
  'count',
  'countResult',
  'save',
  'destroy',
]);

export const XSD_NAMESPACE = 'http://www.w3.org/2001/XMLSchema#';
export const XSD = createNamespace(XSD_NAMESPACE, [
  'boolean',
  'integer',
  'double',
  'decimal',
  'string',
  'float',
  'positiveInteger',
  'negativeInteger',
  'int',
  'date',
  'time',
  'dateTime',
]);

export const RDF_NAMESPACE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
export const RDF = createNamespace(RDF_NAMESPACE, [
  'Property',
  'type',
  'datatype',
  'JSON',
  'first',
  'rest',
  'nil',
]);

export const RDFS_NAMESPACE = 'http://www.w3.org/2000/01/rdf-schema#';
export const RDFS = createNamespace(RDFS_NAMESPACE, [
  'subClassOf',
  'label',
  'range',
]);

export const OWL_NAMESPACE = 'http://www.w3.org/2002/07/owl#';
export const OWL = createNamespace(OWL_NAMESPACE, [
  'Restriction',
  'onProperty',
  'allValuesFrom',
  'Class',
  'intersectionOf',
  'someValuesFrom',
  'ObjectProperty',
]);

export const SHACL_NAMESPACE = 'http://www.w3.org/ns/shacl#';
export const SHACL = createNamespace(SHACL_NAMESPACE, [
  'NodeShape',
  'PropertyShape',
  'Literal',
  'IRI',
  'BlankNode',
  'BlankNodeOrIRI',
  'BlankNodeOrLiteral',
  'IRIOrLiteral',
  'property',
  'path',
  'name',
  'description',
  'minCount',
  'maxCount',
  'targetNode',
  'targetClass',
  'targetSubjectsOf',
  'targetObjectOf',
  'severity',
  'message',
  'deactivated',
  'and',
  'or',
  'class',
  'closed',
  'ignoredProperties',
  'datatype',
  'disjoint',
  'equals',
  'in',
  'languageIn',
  'lessThan',
  'lessThanOrEquals',
  'maxCount',
  'maxExclusive',
  'maxInclusive',
  'maxLength',
  'minCount',
  'minExclusive',
  'minInclusive',
  'minLength',
  'nodeKind',
  'pattern',
  'flags',
  'qualifiedMaxCount',
  'qualifiedMinCount',
  'qualifiedValueShape',
  'qualifiedValueShapesDisjoint',
  'uniqueLang',
  'xone',
  'inversePath',
  'zeroOrMorePath',
  'oneOrMorePath',
  'zeroOrOnePath',
  'alternativePath',
  'name',
  'node',
]);

export const SDO_NAMESPACE = 'https://schema.org/';
export const SDO = createNamespace(SDO_NAMESPACE, [
  'Event',
]);

export const DCELEMENTS_NAMESPACE = 'http://purl.org/dc/elements/1.1/';
export const DCELEMENTS = createNamespace(DCELEMENTS_NAMESPACE, [
  'description',
]);

export const DCTERMS_NAMESPACE = 'http://purl.org/dc/terms/';
export const DCTERMS = createNamespace(DCTERMS_NAMESPACE, [
  'created',
  'modified',
]);
