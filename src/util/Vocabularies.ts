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

export const SKL = createNamespace('https://standardknowledge.com/ontologies/core/', [
  'Verb',
  'Noun',
  'Mapping',
  'Parameters',
  'VerbIntegrationMapping',
  'NounInterfaceMapping',
  'OpenApiDescription',
  'Account',
  'SecurityCredentials',
  'InterfaceComponent',
  'Folder',
  'OpenApiSecuritySchemeVerb',
  'NounMappedVerb',
  'VerbNounMapping',
  'JsonDataSource',
  'Integration',
  'verb',
  'account',
  'integration',
  'parameters',
  'operationMapping',
  'parameterMapping',
  'parameterMappingFrame',
  'returnValueMapping',
  'returnValueFrame',
  'verbMapping',
  'openApiDescription',
  'accessToken',
  'bearerToken',
  'refreshToken',
  'apiKey',
  'sourceId',
  'returnValue',
  'parametersContext',
  'sourceUrl',
  'interface',
  'noun',
  'propertiesMapping',
  'styling',
  'designTokens',
  'iterate',
  'iterateItemAccessor',
  'clientId',
  'IntegrationSyncConfiguration',
  'syncStepDefaultArgs',
  'syncSteps',
  'TokenPaginatedCollection',
  'PaginatedCollection',
  'File',
  'Event',
  'schemeName',
  'oauthFlow',
  'stage',
  'operationId',
  'clientSecret',
  'invalidTokenErrorMatcher',
  'getOauthTokens',
  'records',
  'overrideBasePath',
  'dataSource',
  'data',
  'source',
  'TriggerVerbMapping',
  'series',
  'parallel',
  'constantOperationId',
  'verbId',
]);

export const SKL_ENGINE = createNamespace('https://standardknowledge.com/ontologies/skl-engine/', [
  'update',
]);

export const XSD = createNamespace('http://www.w3.org/2001/XMLSchema#', [
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

export const RDF = createNamespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#', [
  'type',
  'first',
  'rest',
  'datatype',
  'JSON',
  'nil',
]);

export const RDFS = createNamespace('http://www.w3.org/2000/01/rdf-schema#', [
  'subClassOf',
  'label',
  'range',
]);

export const OWL = createNamespace('http://www.w3.org/2002/07/owl#', [
  'Restriction',
  'onProperty',
  'allValuesFrom',
  'Class',
  'intersectionOf',
  'someValuesFrom',
  'ObjectProperty',
]);

export const SHACL = createNamespace('http://www.w3.org/ns/shacl#', [
  'targetClass',
  'targetNode',
]);

export const SCHEMA = createNamespace('https://schema.org/', [
  'Event',
]);

export const DCTERMS = createNamespace('http://purl.org/dc/terms/', [
  'created',
  'modified',
]);

export const BDS = createNamespace('http://www.bigdata.com/rdf/search#', [
  'search',
]);
