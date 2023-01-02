function createNamespace<T extends string>(baseUri: string, localNames: T[]): Record<T, string> {
  const namespace: Record<T, string> = {} as Record<T, string>;
  for (const localName of localNames) {
    namespace[localName] = `${baseUri}${localName}`;
  }
  return namespace;
}

export const sklNamespace = 'https://skl.standard.storage/';

export const SKL = createNamespace(sklNamespace, [
  'Verb',
  'Noun',
  'Mapping',
  'Parameters',
  'mappingSubject',
  'VerbIntegrationMapping',
  'NounInterfaceMapping',
  'OpenApiDescription',
  'Account',
  'SecurityCredentials',
  'InterfaceComponent',
  'Folder',
  'Verb',
  'Verb',
  'OpenApiSecuritySchemeVerb',
  'NounMappedVerb',
  'VerbNounMapping',
  'JsonDataSource',
  'Integration',
  'StylingTheme',
  'verb',
  'account',
  'integration',
  'parameters',
  'parameterMapping',
  'returnValueMapping',
  'operationMapping',
  'verbMapping',
  'openApiDescription',
  'accessToken',
  'refreshToken',
  'apiKey',
  'sourceId',
  'returnValue',
  'parametersContext',
  'nodes',
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
  'returnValueFrame',
  'clientSecret',
  'invalidTokenErrorMatcher',
  'getOauthTokens',
  'records',
  'mapping',
  'overrideBasePath',
  'dataSource',
  'data',
  'source',
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
