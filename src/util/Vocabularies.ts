/* eslint-disable @typescript-eslint/naming-convention */
function createNamespace<T extends string>(
  baseUri: string,
  localNames: Record<T, string>,
): Record<keyof typeof localNames, string> {
  const namespace: Record<T, string> = {} as Record<T, string>;
  for (const [ key, value ] of Object.entries(localNames)) {
    namespace[key as T] = `${baseUri}${value}`;
  }
  return namespace;
}

export const SKL = createNamespace('https://skl.standard.storage/', {
  verbs: 'verbs/',
  Noun: 'nouns/Noun',
  Mapping: 'nouns/Mapping',
  VerbIntegrationMapping: 'nouns/VerbIntegrationMapping',
  NounInterfaceMapping: 'nouns/NounInterfaceMapping',
  OpenApiDescription: 'nouns/OpenApiDescription',
  Account: 'nouns/Account',
  SecurityCredentials: 'nouns/SecurityCredentials',
  InterfaceComponent: 'nouns/InterfaceComponent',
  Folder: 'nouns/Folder',
  Verb: 'nouns/Verb',
  OpenApiOperationVerb: 'nouns/OpenApiOperationVerb',
  OpenApiSecuritySchemeVerb: 'nouns/OpenApiSecuritySchemeVerb',
  NounMappedVerb: 'nouns/NounMappedVerb',
  VerbNounMapping: 'nouns/VerbNounMapping',
  Integration: 'nouns/Integration',
  StylingTheme: 'nouns/StylingTheme',
  properties: 'properties/',
  verb: 'properties/verb',
  account: 'properties/account',
  integration: 'properties/integration',
  parameters: 'properties/parameters',
  name: 'properties/name',
  parameterMapping: 'properties/parameterMapping',
  returnValueMapping: 'properties/returnValueMapping',
  operationMapping: 'properties/operationMapping',
  verbMapping: 'properties/verbMapping',
  openApiDescription: 'properties/openApiDescription',
  accessToken: 'properties/accessToken',
  refreshToken: 'properties/refreshToken',
  apiKey: 'properties/apiKey',
  sourceId: 'properties/sourceId',
  returnValue: 'properties/returnValue',
  parametersContext: 'properties/parametersContext',
  nodes: 'properties/nodes',
  sourceUrl: 'properties/sourceUrl',
  interface: 'properties/interface',
  noun: 'properties/noun',
  propertiesMapping: 'properties/propertiesMapping',
  styling: 'properties/styling',
  designTokens: 'properties/designTokens',
  iterate: 'properties/iterate',
  iterateItemAccessor: 'properties/iterateItemAccessor',
  clientId: 'properties/clientId',
  IntegrationSyncConfiguration: 'nouns/IntegrationSyncConfiguration',
  syncStepDefaultArgs: 'properties/syncStepDefaultArgs',
  syncSteps: 'properties/syncSteps',
  TokenPaginatedCollection: 'nouns/TokenPaginatedCollection',
  paginatedCollection: 'nouns/PaginatedCollection',
  File: 'nouns/File',
  Event: 'nouns/Event',
  schemeName: 'properties/schemeName',
  oauthFlow: 'properties/oauthFlow',
  stage: 'properties/stage',
  operationId: 'properties/operationId',
  returnValueFrame: 'properties/returnValueFrame',
  clientSecret: 'properties/clientSecret',
  invalidTokenErrorMatcher: 'properties/invalidTokenErrorMatcher',
  getOauthTokens: 'verbs/getOauthTokens',
  records: 'properties/records',
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
  objectProperty: 'ObjectProperty',
});

export const SHACL = createNamespace('http://www.w3.org/ns/shacl#', {
  targetClass: 'targetClass',
  targetNode: 'targetNode',
});

export const GREL = createNamespace('http://users.ugent.be/~bjdmeest/function/grel.ttl#', {
  arrayJoin: 'array_join',
  controlsIf: 'controls_if',
  boolB: 'bool_b',
  anyTrue: 'any_true',
  anyFalse: 'any_false',
  arraySum: 'array_sum',
  arrayProduct: 'array_product',
  pArrayA: 'p_array_a',
  stringEndsWith: 'string_endsWith',
  valueParameter: 'valueParameter',
  stringSub: 'string_sub',
  stringReplace: 'string_replace',
  pStringFind: 'p_string_find',
  pStringReplace: 'p_string_replace',
  dateNow: 'date_now',
  booleanNot: 'boolean_not',
  arrayGet: 'array_get',
  paramIntIFrom: 'param_int_i_from',
  paramIntIOptTo: 'param_int_i_opt_to',
  stringSplit: 'string_split',
  pStringSep: 'p_string_sep',
  dateInc: 'date_inc',
  pDateD: 'p_date_d',
  pDecN: 'p_dec_n',
  paramN2: 'param_n2',
  pStringUnit: 'p_string_unit',
  max: 'math_max',
  min: 'math_min',
  booleanAnd: 'boolean_and',
  booleanOr: 'boolean_or',
  paramRepB: 'param_rep_b',
});

export const IDLAB = createNamespace('http://example.com/idlab/function/', {
  equal: 'equal',
  notEqual: 'notEqual',
  getMimeType: 'getMIMEType',
  str: 'str',
  otherStr: 'otherStr',
  isNull: 'isNull',
  random: 'random',
  concat: 'concat',
  delimiter: 'delimiter',
});

export const SCHEMA = createNamespace('https://schema.org/', {
  Event: 'Event',
});
