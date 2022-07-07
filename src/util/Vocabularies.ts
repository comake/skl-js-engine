function createNamespace(baseUri: string, localNames: Record<string, string>): Record<string, string> {
  const namespace: Record<string, string> = {};
  for (const [ key, value ] of Object.entries(localNames)) {
    namespace[key] = `${baseUri}${value}`;
  }
  return namespace;
}

export const SKL = createNamespace('https://skl.standard.storage/', {
  data: 'data/',
  integrations: 'integrations/',
  nouns: 'nouns/',
  verbs: 'verbs/',
  mappingNoun: 'nouns/Mapping',
  verbIntegrationMappingNoun: 'nouns/VerbIntegrationMapping',
  openApiDescriptionNoun: 'nouns/OpenApiDescription',
  accountNoun: 'nouns/Account',
  oauthTokenNoun: 'nouns/OauthToken',
  folderNoun: 'nouns/Folder',
  properties: 'properties/',
  verbsProperty: 'properties/verb',
  accountProperty: 'properties/account',
  integrationProperty: 'properties/integration',
  parametersProperty: 'properties/parameters',
  nameProperty: 'properties/name',
  parameterMappingsProperty: 'properties/parameterMappings',
  returnValueMappingsProperty: 'properties/returnValueMappings',
  operationMappingsProperty: 'properties/operationMappings',
  openApiDescriptionProperty: 'properties/openApiDescription',
  accessTokenProperty: 'properties/accessToken',
  sourceIdProperty: 'properties/sourceId',
  returnValueProperty: 'properties/returnValue',
  requiredProperty: 'properties/required',
  nullableProperty: 'properties/nullable',
  parametersContext: 'properties/parametersContext',
});

export const XSD = createNamespace('http://www.w3.org/2001/XMLSchema#', {
  boolean: 'boolean',
  integer: 'integer',
  double: 'double',
  string: 'string',
});

export const RDF = createNamespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#', {
  type: 'type',
  first: 'first',
  rest: 'rest',
  datatype: 'datatype',
});

export const RDFS = createNamespace('http://www.w3.org/2000/01/rdf-schema#', {
  subClassOf: 'subClassOf',
  label: 'label',
  range: 'range',
});

export const OWL = createNamespace('http://www.w3.org/2002/07/owl#', {
  restriction: 'Restriction',
  onProperty: 'onProperty',
  allValuesFrom: 'allValuesFrom',
  class: 'Class',
  intersectionOf: 'intersectionOf',
  someValuesFrom: 'someValuesFrom',
});

export const SHACL = createNamespace('http://www.w3.org/ns/shacl#', {
  targetClass: 'targetClass',
});

export const GREL = createNamespace('http://users.ugent.be/~bjdmeest/function/grel.ttl#', {
  arrayJoin: 'array_join',
  controlsIf: 'controls_if',
  boolB: 'bool_b',
  anyTrue: 'any_true',
  anyFalse: 'any_false',
  stringEndsWith: 'string_endsWith',
  valueParameter: 'valueParameter',
  stringSub: 'string_sub',
  stringReplace: 'string_replace',
  pStringFind: 'p_string_find',
  pStringReplace: 'p_string_replace',
});

export const IDLAB = createNamespace('http://example.com/idlab/function/', {
  equal: 'equal',
  notEqual: 'notEqual',
  getMimeType: 'getMIMEType',
  str: 'str',
  isNull: 'isNull',
  random: 'random',
});
